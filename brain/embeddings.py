"""
Zaytri — Hybrid Embedding Utility (Architecture V2)
Generates and manages vector embeddings for RAG knowledge sources.

Hybrid Architecture:
  - Free tier: Ollama nomic-embed-text (768D native → zero-padded to 1536D)
  - Pro tier:  OpenAI text-embedding-3-small (native 1536D)
  - Both routes produce 1536D vectors for the same pgvector column

Provider selection:
  if OPENAI_API_KEY is configured → Pro route (OpenAI)
  else                            → Free route (Ollama, zero-padded to 1536D)
"""

import hashlib
import logging
import time
from typing import List, Optional, Tuple

import httpx
import numpy as np

logger = logging.getLogger("brain.embeddings")

# ─── Constants (LOCKED) ─────────────────────────────────────────────────────

EMBEDDING_DIMENSION = 1536  # LOCKED at 1536D for BOTH routes
OPENAI_MODEL = "text-embedding-3-small"
OPENAI_NATIVE_DIM = 1536
OLLAMA_MODEL = "nomic-embed-text"
OLLAMA_NATIVE_DIM = 768
MAX_CHUNK_SIZE = 8000  # characters per chunk


# ─── Text Chunking ───────────────────────────────────────────────────────────

def chunk_text(text: str, chunk_size: int = MAX_CHUNK_SIZE, overlap: int = 200) -> List[str]:
    """
    Split text into overlapping chunks for embedding.

    Args:
        text: Source text to chunk
        chunk_size: Max characters per chunk
        overlap: Character overlap between chunks

    Returns:
        List of text chunks
    """
    if not text or len(text) <= chunk_size:
        return [text] if text else []

    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size

        # Try to break at sentence boundary
        if end < len(text):
            for sep in [". ", ".\n", "\n\n", "\n", " "]:
                last_sep = text[start:end].rfind(sep)
                if last_sep > chunk_size // 2:
                    end = start + last_sep + len(sep)
                    break

        chunks.append(text[start:end].strip())
        start = end - overlap

    return [c for c in chunks if c]


def content_hash(text: str) -> str:
    """Generate a hash for deduplication."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def _pad_to_1536(vector: List[float]) -> List[float]:
    """
    Zero-pad a vector to 1536 dimensions.
    Used by Ollama route (768D → 1536D) so both routes
    store in the same pgvector column.
    """
    current_dim = len(vector)
    if current_dim >= EMBEDDING_DIMENSION:
        return vector[:EMBEDDING_DIMENSION]
    # Zero-pad the remaining dimensions
    return vector + [0.0] * (EMBEDDING_DIMENSION - current_dim)


# ─── Embedding Providers ────────────────────────────────────────────────────

class EmbeddingProvider:
    """Base embedding provider interface."""

    async def embed(self, texts: List[str]) -> List[List[float]]:
        raise NotImplementedError

    @property
    def dimension(self) -> int:
        """Always returns 1536 — LOCKED dimension for pgvector."""
        return EMBEDDING_DIMENSION

    @property
    def provider_name(self) -> str:
        """Provider identifier for provenance tracking."""
        raise NotImplementedError

    @property
    def model_name(self) -> str:
        """Model identifier for provenance tracking."""
        raise NotImplementedError


class OpenAIEmbeddingProvider(EmbeddingProvider):
    """
    Pro Embedding Route — OpenAI text-embedding-3-small.
    Native 1536D output, no padding needed.
    Requires: OPENAI_API_KEY (set for paid tier)
    """

    def __init__(self, api_key: str, model: str = OPENAI_MODEL):
        self.api_key = api_key
        self.model = model

    @property
    def provider_name(self) -> str:
        return "openai"

    @property
    def model_name(self) -> str:
        return self.model

    async def embed(self, texts: List[str]) -> List[List[float]]:
        """Generate 1536D embeddings via OpenAI API."""
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=self.api_key)
        try:
            response = await client.embeddings.create(
                input=texts,
                model=self.model,
            )
            vectors = [item.embedding for item in response.data]
            logger.debug(f"OpenAI embedded {len(texts)} texts → {len(vectors[0])}D")
            return vectors
        except Exception as e:
            logger.error(f"OpenAI embedding failed: {e}")
            raise


class OllamaEmbeddingProvider(EmbeddingProvider):
    """
    Free Embedding Route — Ollama nomic-embed-text.
    Native 768D output, zero-padded to 1536D for pgvector compatibility.
    Config: OLLAMA_API_URL=http://localhost:11434 (set for free tier)
    """

    def __init__(self, host: str = "http://localhost:11434", model: str = OLLAMA_MODEL):
        self.host = host.rstrip("/")
        self.model = model
        self._native_dim = OLLAMA_NATIVE_DIM

    @property
    def provider_name(self) -> str:
        return "ollama"

    @property
    def model_name(self) -> str:
        return self.model

    async def embed(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings via Ollama API, then zero-pad to 1536D.
        Native dim: 768D → Padded to: 1536D (matches pgvector column).
        """
        embeddings = []
        async with httpx.AsyncClient(timeout=30.0) as client:
            for text in texts:
                try:
                    response = await client.post(
                        f"{self.host}/api/embeddings",
                        json={"model": self.model, "prompt": text},
                    )
                    response.raise_for_status()
                    data = response.json()
                    raw_embedding = data.get("embedding", [])
                    if raw_embedding:
                        # Track native dimension
                        if self._native_dim != len(raw_embedding):
                            self._native_dim = len(raw_embedding)
                        # Zero-pad to 1536D for pgvector column compatibility
                        padded = _pad_to_1536(raw_embedding)
                        embeddings.append(padded)
                    else:
                        logger.warning(f"Empty embedding returned for text: {text[:50]}...")
                        embeddings.append([0.0] * EMBEDDING_DIMENSION)
                except Exception as e:
                    logger.error(f"Ollama embedding failed: {e}")
                    embeddings.append([0.0] * EMBEDDING_DIMENSION)

        logger.debug(
            f"Ollama embedded {len(texts)} texts: "
            f"{self._native_dim}D native → {EMBEDDING_DIMENSION}D padded"
        )
        return embeddings


# ─── Provider Factory (Plan-Based Selection) ────────────────────────────────

def get_embedding_provider(
    user_plan: Optional[str] = None,
    force_provider: Optional[str] = None,
) -> EmbeddingProvider:
    """
    Get the embedding provider based on user plan.

    Hybrid Architecture V2:
      user_plan == "free"  → Ollama nomic-embed-text (768D → padded to 1536D)
      user_plan == "pro"   → OpenAI text-embedding-3-small (native 1536D)
      user_plan is None    → fallback to Ollama (free)
      force_provider       → override for admin/testing ("openai" or "ollama")

    Both routes produce 1536D vectors for the same pgvector column.
    """
    try:
        from config import settings

        # ── Force override (for testing / admin) ──
        if force_provider == "ollama":
            logger.info("🆓 Embedding: Ollama (forced) — nomic-embed-text → 1536D padded")
            return OllamaEmbeddingProvider(host=settings.ollama_host)
        if force_provider == "openai":
            api_key = _resolve_openai_key(settings)
            if api_key:
                logger.info("💎 Embedding: OpenAI (forced) — text-embedding-3-small → 1536D native")
                return OpenAIEmbeddingProvider(api_key=api_key)
            logger.warning("Forced OpenAI but no API key found, falling back to Ollama")
            return OllamaEmbeddingProvider(host=settings.ollama_host)

        # ── Plan-based selection ──
        if user_plan == "pro":
            api_key = _resolve_openai_key(settings)
            if api_key:
                logger.info("💎 Pro Embedding Route: OpenAI text-embedding-3-small → 1536D native")
                return OpenAIEmbeddingProvider(api_key=api_key)
            else:
                logger.warning(
                    "⚠️ User is on Pro plan but no OpenAI API key configured. "
                    "Falling back to Ollama. Add OPENAI_API_KEY to enable pro embeddings."
                )
                return OllamaEmbeddingProvider(host=settings.ollama_host)

        # ── Free route (default) ──
        logger.info("🆓 Free Embedding Route: Ollama nomic-embed-text → 1536D padded")
        return OllamaEmbeddingProvider(host=settings.ollama_host)

    except Exception as e:
        logger.warning(f"Could not determine embedding provider: {e}. Defaulting to Ollama.")
        return OllamaEmbeddingProvider()


def _resolve_openai_key(settings) -> Optional[str]:
    """
    Try to find an OpenAI API key from multiple sources.
    Priority: DB config (set via UI) → Environment variable
    """
    # 1. Try OpenAI key from DB (set via Settings UI)
    try:
        from sqlalchemy import create_engine, select
        from sqlalchemy.orm import Session
        from db.settings_models import LLMProviderConfig
        from utils.crypto import decrypt_value

        sync_url = settings.database_url.replace("+asyncpg", "").replace("postgresql://", "postgresql://")
        engine = create_engine(sync_url)
        with Session(engine) as session:
            cfg = session.execute(
                select(LLMProviderConfig).where(LLMProviderConfig.provider == "openai")
            ).scalar_one_or_none()
            if cfg and cfg.api_key_encrypted:
                api_key = decrypt_value(cfg.api_key_encrypted)
                engine.dispose()
                return api_key
        engine.dispose()
    except Exception as e:
        logger.debug(f"Could not load OpenAI key from DB: {e}")

    # 2. Try environment variable
    import os
    env_key = os.getenv("OPENAI_API_KEY")
    if env_key:
        return env_key

    return None

