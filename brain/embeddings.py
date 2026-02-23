"""
Zaytri — Embedding Utility
Generates and manages vector embeddings for RAG knowledge sources.
Supports OpenAI embeddings (text-embedding-3-small) with Ollama fallback.
"""

import hashlib
import logging
import time
from typing import List, Optional

import httpx
import numpy as np

logger = logging.getLogger("brain.embeddings")

# ─── Constants ───────────────────────────────────────────────────────────────

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMENSION = 1536  # text-embedding-3-small default
OLLAMA_EMBEDDING_MODEL = "nomic-embed-text"
OLLAMA_EMBEDDING_DIMENSION = 768
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


# ─── Embedding Providers ────────────────────────────────────────────────────

class EmbeddingProvider:
    """Base embedding provider interface."""

    async def embed(self, texts: List[str]) -> List[List[float]]:
        raise NotImplementedError

    @property
    def dimension(self) -> int:
        raise NotImplementedError


class OpenAIEmbeddingProvider(EmbeddingProvider):
    """Generate embeddings using OpenAI text-embedding-3-small."""

    def __init__(self, api_key: str, model: str = EMBEDDING_MODEL):
        self.api_key = api_key
        self.model = model
        self._dimension = EMBEDDING_DIMENSION

    @property
    def dimension(self) -> int:
        return self._dimension

    async def embed(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for a batch of texts."""
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=self.api_key)
        try:
            response = await client.embeddings.create(
                input=texts,
                model=self.model,
            )
            return [item.embedding for item in response.data]
        except Exception as e:
            logger.error(f"OpenAI embedding failed: {e}")
            raise


class OllamaEmbeddingProvider(EmbeddingProvider):
    """Generate embeddings using local Ollama (nomic-embed-text)."""

    def __init__(self, host: str = "http://localhost:11434", model: str = OLLAMA_EMBEDDING_MODEL):
        self.host = host.rstrip("/")
        self.model = model
        self._dimension = OLLAMA_EMBEDDING_DIMENSION

    @property
    def dimension(self) -> int:
        return self._dimension

    async def embed(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings one at a time via Ollama API."""
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
                    embedding = data.get("embedding", [])
                    if embedding:
                        embeddings.append(embedding)
                        if self._dimension != len(embedding):
                            self._dimension = len(embedding)
                    else:
                        logger.warning(f"Empty embedding returned for text: {text[:50]}...")
                        embeddings.append([0.0] * self._dimension)
                except Exception as e:
                    logger.error(f"Ollama embedding failed: {e}")
                    embeddings.append([0.0] * self._dimension)
        return embeddings


# ─── Provider Factory ────────────────────────────────────────────────────────

def get_embedding_provider() -> EmbeddingProvider:
    """
    Get the best available embedding provider.
    Priority: OpenAI (if API key available) → Ollama (local).
    """
    try:
        from config import settings

        # 1. Try OpenAI via stored API key in DB
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
                    logger.info("Using OpenAI for embeddings (text-embedding-3-small)")
                    return OpenAIEmbeddingProvider(api_key=api_key)
            engine.dispose()
        except Exception as e:
            logger.debug(f"Could not load OpenAI key from DB: {e}")

        # 2. Fallback to Ollama
        logger.info("Using Ollama for embeddings (nomic-embed-text)")
        return OllamaEmbeddingProvider(host=settings.ollama_host)

    except Exception as e:
        logger.warning(f"Could not determine embedding provider: {e}")
        return OllamaEmbeddingProvider()
