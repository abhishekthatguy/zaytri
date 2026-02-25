"""
Zaytri — RAG Engine (Multi-Layer Brand-Aware Retrieval with pgvector)
Production-grade RAG service with:
- pgvector cosine similarity search (primary)
- Text-based similarity fallback (when no embeddings exist)
- Health checking, hallucination guards, performance logging
- Brand namespace isolation, async-safe, no global state
"""

import logging
import re
import time
from collections import Counter
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import select, func, and_, text as sa_text
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import async_session
from db.settings_models import BrandSettings, KnowledgeSource, DocumentEmbedding
from db.models import Content, ContentStatus

logger = logging.getLogger("brain.rag_engine")

# ─── Constants ───────────────────────────────────────────────────────────────

DEFAULT_TOP_K = 5
DEFAULT_SIMILARITY_THRESHOLD = 0.5  # Lowered for better recall with Ollama models (was 0.6)
MAX_CHUNK_PREVIEW_LENGTH = 200
EMBEDDING_DIMENSION = 1536


# ─── Content Fetcher (auto-sync from source URLs) ────────────────────────────

# Regex patterns to extract Google Doc/Sheet IDs from various URL formats
_GDOC_ID_RE = re.compile(
    r"docs\.google\.com/document/d/([a-zA-Z0-9_-]+)"
)
_GSHEET_ID_RE = re.compile(
    r"docs\.google\.com/spreadsheets/d/([a-zA-Z0-9_-]+)"
)


async def _fetch_source_content(url: str, source_type: str) -> Optional[str]:
    """
    Fetch the latest content from a knowledge source URL.

    Supports:
    - Google Docs  → exported as plain text via /export?format=txt
    - Google Sheets → exported as CSV
    - Generic HTTP  → raw text download

    Returns None if the URL can't be fetched or isn't supported.
    """
    import aiohttp

    if not url:
        return None

    fetch_url = url  # default: use URL as-is

    # Google Docs → use export endpoint for plain text
    gdoc_match = _GDOC_ID_RE.search(url)
    if gdoc_match:
        doc_id = gdoc_match.group(1)
        fetch_url = f"https://docs.google.com/document/d/{doc_id}/export?format=txt"

    # Google Sheets → use export endpoint for CSV
    gsheet_match = _GSHEET_ID_RE.search(url)
    if gsheet_match:
        sheet_id = gsheet_match.group(1)
        fetch_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv"

    try:
        timeout = aiohttp.ClientTimeout(total=30)
        async with aiohttp.ClientSession(timeout=timeout) as client:
            async with client.get(fetch_url, allow_redirects=True) as resp:
                if resp.status != 200:
                    logger.warning(
                        f"Failed to fetch {fetch_url}: HTTP {resp.status}"
                    )
                    return None

                text = await resp.text()

                # Sanity: skip empty or HTML error pages
                if not text or len(text.strip()) < 10:
                    return None
                if text.strip().startswith("<!DOCTYPE") or text.strip().startswith("<html"):
                    logger.warning(f"Got HTML instead of text from {fetch_url} — doc may not be public")
                    return None

                return text.strip()

    except Exception as e:
        logger.warning(f"Error fetching content from {fetch_url}: {e}")
        return None


# ─── Data Classes ────────────────────────────────────────────────────────────

@dataclass
class RetrievedChunk:
    """A single retrieved chunk of knowledge."""
    chunk_id: str
    content: str
    source_name: str
    source_type: str
    similarity_score: float
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RAGResult:
    """Complete RAG retrieval result with timing and metadata."""
    brand_id: str
    brand_name: str
    namespace: str
    query: str
    retrieved_chunks: List[RetrievedChunk] = field(default_factory=list)
    similarity_scores: List[float] = field(default_factory=list)
    context_block: str = ""
    is_sufficient: bool = False
    warning: Optional[str] = None
    search_method: str = "text"  # "vector" or "text"

    # Timing (milliseconds)
    embedding_time_ms: float = 0.0
    retrieval_time_ms: float = 0.0
    context_build_time_ms: float = 0.0
    total_time_ms: float = 0.0

    # Metadata
    total_embeddings: int = 0
    top_k: int = DEFAULT_TOP_K


@dataclass
class HealthReport:
    """Embedding/knowledge health report for a brand."""
    brand_id: str
    brand_name: str
    total_knowledge_sources: int = 0
    active_knowledge_sources: int = 0
    total_content_items: int = 0
    total_embeddings: int = 0
    total_chunks: int = 0
    embedding_dimension: int = 0
    has_brand_guidelines: bool = False
    has_target_audience: bool = False
    has_brand_tone: bool = False
    sample_metadata: List[Dict[str, Any]] = field(default_factory=list)
    is_healthy: bool = False
    error: Optional[str] = None


# ─── Text Similarity (Fallback) ──────────────────────────────────────────────

def _tokenize(text: str) -> List[str]:
    """Simple tokenization: lowercase, split, remove stopwords."""
    stopwords = {
        "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
        "have", "has", "had", "do", "does", "did", "will", "would", "could",
        "should", "may", "might", "shall", "can", "need", "to", "of", "in",
        "for", "on", "with", "at", "by", "from", "as", "into", "through",
        "and", "but", "or", "not", "so", "yet", "about", "it", "its",
        "this", "that", "what", "which", "who", "where", "when", "why", "how",
    }
    tokens = re.findall(r"[a-z0-9]+", text.lower())
    return [t for t in tokens if t not in stopwords and len(t) > 1]


def compute_text_similarity(query: str, document: str) -> float:
    """Term frequency overlap scoring (fallback when no vectors exist)."""
    if not query or not document:
        return 0.0

    query_tokens = _tokenize(query)
    doc_tokens = _tokenize(document)
    if not query_tokens or not doc_tokens:
        return 0.0

    query_counter = Counter(query_tokens)
    doc_counter = Counter(doc_tokens)
    common_terms = set(query_counter.keys()) & set(doc_counter.keys())
    if not common_terms:
        return 0.0

    overlap = sum(min(query_counter[t], doc_counter[t]) for t in common_terms)
    max_possible = sum(query_counter.values())
    coverage = len(common_terms) / len(set(query_tokens))

    return min(1.0, max(0.0, 0.6 * (overlap / max_possible) + 0.4 * coverage))


# ─── RAG Engine ──────────────────────────────────────────────────────────────

class RAGEngine:
    """
    Production-grade RAG engine with pgvector + text fallback.
    Brand-isolated, async-safe, no global state.
    """

    def __init__(
        self,
        similarity_threshold: float = DEFAULT_SIMILARITY_THRESHOLD,
        top_k: int = DEFAULT_TOP_K,
    ):
        self.similarity_threshold = similarity_threshold
        self.top_k = top_k

    # ── Health Check ─────────────────────────────────────────────────────

    async def check_embedding_health(
        self,
        brand_id: str,
        session: Optional[AsyncSession] = None,
    ) -> HealthReport:
        """
        Check health of embeddings/knowledge for a brand.
        Raises ValueError if brand_id is None.
        """
        if not brand_id:
            raise ValueError("brand_id is required for RAG health check")

        report = HealthReport(brand_id=brand_id, brand_name="Unknown")

        async def _run(sess: AsyncSession):
            # 1. Brand settings
            brand = (await sess.execute(
                select(BrandSettings).where(BrandSettings.id == brand_id)
            )).scalars().first()

            if not brand:
                report.error = f"Brand not found: {brand_id}"
                return

            report.brand_name = brand.brand_name
            report.has_brand_guidelines = bool(brand.brand_guidelines)
            report.has_target_audience = bool(brand.target_audience)
            report.has_brand_tone = bool(brand.brand_tone)

            # 2. Knowledge sources
            report.total_knowledge_sources = (await sess.execute(
                select(func.count(KnowledgeSource.id)).where(
                    KnowledgeSource.brand_id == brand_id
                )
            )).scalar() or 0

            report.active_knowledge_sources = (await sess.execute(
                select(func.count(KnowledgeSource.id)).where(
                    and_(
                        KnowledgeSource.brand_id == brand_id,
                        KnowledgeSource.is_active == True,
                    )
                )
            )).scalar() or 0

            # 3. Vector embeddings count
            report.total_embeddings = (await sess.execute(
                select(func.count(DocumentEmbedding.id)).where(
                    DocumentEmbedding.brand_id == brand_id
                )
            )).scalar() or 0

            # 4. Embedding dimension (from first embedding)
            if report.total_embeddings > 0:
                first_emb = (await sess.execute(
                    select(DocumentEmbedding.embedding_dimension).where(
                        DocumentEmbedding.brand_id == brand_id
                    ).limit(1)
                )).scalar()
                report.embedding_dimension = first_emb or 0

            # 5. Content items
            report.total_content_items = (await sess.execute(
                select(func.count(Content.id)).where(
                    Content.created_by == brand.user_id
                )
            )).scalar() or 0

            # 6. Total retrievable chunks (ONLY count actual vector embeddings)
            report.total_chunks = report.total_embeddings

            # 7. Sample metadata — show knowledge sources with their vector status
            ks_samples = (await sess.execute(
                select(KnowledgeSource)
                .where(KnowledgeSource.brand_id == brand_id)
                .limit(5)
            )).scalars().all()
            for ks in ks_samples:
                report.sample_metadata.append({
                    "id": str(ks.id),
                    "source_name": ks.name,
                    "source_type": ks.source_type,
                    "vector_count": ks.vector_count or 0,
                    "has_content": bool(ks.content_summary),
                    "summary_preview": (ks.content_summary or "")[:100],
                })

            # 8. Health determination
            # Healthy only if we have actual vector embeddings
            report.is_healthy = report.total_embeddings > 0
            if not report.is_healthy:
                if report.active_knowledge_sources > 0:
                    report.error = (
                        f"Brand '{brand.brand_name}' has {report.active_knowledge_sources} "
                        "knowledge source(s) but NO vector embeddings. "
                        "Run: python3 cli/rag_commands.py embed --brand "
                        f'"{brand.brand_name}" to generate embeddings.'
                    )
                else:
                    report.error = (
                        f"No retrievable knowledge found for brand '{brand.brand_name}'. "
                        "Upload knowledge sources or configure brand guidelines."
                    )

        if session:
            await _run(session)
        else:
            async with async_session() as sess:
                await _run(sess)

        return report

    # ── Retrieval (pgvector primary, text fallback) ──────────────────────

    async def test_retrieval(
        self,
        brand_id: str,
        query: str,
        session: Optional[AsyncSession] = None,
    ) -> RAGResult:
        """
        Retrieve matching documents for a brand + query.
        Uses pgvector cosine similarity if embeddings exist, text fallback otherwise.
        """
        if not brand_id:
            raise ValueError("brand_id is required for RAG retrieval")
        if not query:
            raise ValueError("query is required for RAG retrieval")

        start_time = time.perf_counter()
        result = RAGResult(
            brand_id=brand_id,
            brand_name="Unknown",
            namespace=f"brand_{brand_id[:8]}",
            query=query,
            top_k=self.top_k,
        )

        async def _run(sess: AsyncSession):
            # Get brand
            brand = (await sess.execute(
                select(BrandSettings).where(BrandSettings.id == brand_id)
            )).scalars().first()
            if not brand:
                result.warning = f"Brand not found: {brand_id}"
                return

            result.brand_name = brand.brand_name
            result.namespace = f"brand_{brand_id[:8]}"

            # Check if vector embeddings exist for this brand
            embedding_count = (await sess.execute(
                select(func.count(DocumentEmbedding.id)).where(
                    DocumentEmbedding.brand_id == brand_id
                )
            )).scalar() or 0

            if embedding_count > 0:
                await self._vector_retrieval(sess, brand, query, result)
            else:
                await self._text_retrieval(sess, brand, query, result)

        if session:
            await _run(session)
        else:
            async with async_session() as sess:
                await _run(sess)

        result.total_time_ms = (time.perf_counter() - start_time) * 1000
        return result

    async def _vector_retrieval(
        self,
        session: AsyncSession,
        brand: BrandSettings,
        query: str,
        result: RAGResult,
    ):
        """pgvector cosine similarity search."""
        retrieval_start = time.perf_counter()
        result.search_method = "vector"

        try:
            # Generate query embedding
            embed_start = time.perf_counter()
            from brain.embeddings import get_embedding_provider
            provider = get_embedding_provider()
            query_embeddings = await provider.embed([query])
            query_vector = query_embeddings[0]
            result.embedding_time_ms = (time.perf_counter() - embed_start) * 1000

            # pgvector cosine distance: 1 - cosine_similarity
            # NOTE: We use CAST(... AS vector) instead of ::vector because
            # asyncpg confuses ::vector with its :named_param syntax.
            stmt = sa_text("""
                SELECT id, chunk_text, source_name, source_type, metadata_json,
                       1 - (embedding <=> CAST(:query_vec AS vector)) as similarity
                FROM document_embeddings
                WHERE brand_id = :brand_id
                ORDER BY embedding <=> CAST(:query_vec AS vector)
                LIMIT :top_k
            """)

            rows = (await session.execute(
                stmt,
                {
                    "query_vec": str(query_vector),
                    "brand_id": str(brand.id),
                    "top_k": self.top_k,
                },
            )).fetchall()

            result.total_embeddings = (await session.execute(
                select(func.count(DocumentEmbedding.id)).where(
                    DocumentEmbedding.brand_id == str(brand.id)
                )
            )).scalar() or 0

            for row in rows:
                score = float(row.similarity)
                chunk = RetrievedChunk(
                    chunk_id=str(row.id),
                    content=row.chunk_text,
                    source_name=row.source_name,
                    source_type=row.source_type,
                    similarity_score=round(score, 4),
                    metadata=row.metadata_json or {},
                )
                result.retrieved_chunks.append(chunk)
                result.similarity_scores.append(round(score, 4))

        except Exception as e:
            logger.warning(f"Vector retrieval failed, falling back to text: {e}")
            # Rollback the failed transaction before attempting text fallback
            await session.rollback()
            await self._text_retrieval(session, brand, query, result)
            return

        result.retrieval_time_ms = (time.perf_counter() - retrieval_start) * 1000

        # Determine sufficiency
        above_threshold = [s for s in result.similarity_scores if s >= self.similarity_threshold]
        result.is_sufficient = len(above_threshold) > 0

        if not result.is_sufficient and result.retrieved_chunks:
            result.warning = (
                f"All similarity scores below threshold ({self.similarity_threshold}). "
                "Context may not be relevant."
            )
        elif not result.retrieved_chunks:
            result.warning = "No embeddings found for this brand."

    async def _text_retrieval(
        self,
        session: AsyncSession,
        brand: BrandSettings,
        query: str,
        result: RAGResult,
    ):
        """Text-based similarity fallback (no vectors required)."""
        retrieval_start = time.perf_counter()
        result.search_method = "text"

        # Collect all retrievable text documents
        documents: List[Tuple[str, str, str, str, Dict]] = []

        # Knowledge sources
        ks_rows = (await session.execute(
            select(KnowledgeSource).where(
                and_(
                    KnowledgeSource.brand_id == str(brand.id),
                    KnowledgeSource.is_active == True,
                )
            )
        )).scalars().all()

        for ks in ks_rows:
            if ks.content_summary:
                documents.append((
                    str(ks.id), ks.content_summary,
                    ks.name, ks.source_type,
                    {"source": "knowledge_source", "url": ks.url},
                ))

        # 3. Document chunks from embeddings table (even if vectors are missing)
        chunks = (await session.execute(
            select(DocumentEmbedding).where(
                DocumentEmbedding.brand_id == str(brand.id)
            )
        )).scalars().all()

        for chunk in chunks:
            documents.append((
                str(chunk.id), chunk.chunk_text,
                chunk.source_name, chunk.source_type,
                chunk.metadata_json or {"source": "document_chunk"},
            ))

        result.total_embeddings = len(documents)

        # Score and rank
        scored = [(compute_text_similarity(query, doc[1]), doc) for doc in documents]
        scored.sort(key=lambda x: x[0], reverse=True)

        for score, (chunk_id, content, source_name, source_type, metadata) in scored[:self.top_k]:
            chunk = RetrievedChunk(
                chunk_id=chunk_id,
                content=content,
                source_name=source_name,
                source_type=source_type,
                similarity_score=round(score, 4),
                metadata=metadata,
            )
            result.retrieved_chunks.append(chunk)
            result.similarity_scores.append(round(score, 4))

        result.retrieval_time_ms = (time.perf_counter() - retrieval_start) * 1000

        # Sufficiency
        above_threshold = [s for s in result.similarity_scores if s >= self.similarity_threshold]
        result.is_sufficient = len(above_threshold) > 0

        if not result.is_sufficient and result.retrieved_chunks:
            result.warning = (
                f"All similarity scores below threshold ({self.similarity_threshold}). "
                "Context may not be relevant."
            )
        elif not result.retrieved_chunks:
            result.warning = "No retrievable knowledge found for this brand."

    # ── Context Building ─────────────────────────────────────────────────

    async def build_rag_context(
        self,
        brand_id: str,
        query: str,
        force_rag: bool = False,
        session: Optional[AsyncSession] = None,
    ) -> RAGResult:
        """Build complete RAG context block for LLM prompt injection."""
        context_start = time.perf_counter()

        rag_result = await self.test_retrieval(brand_id, query, session)

        # Build context block from retrieved chunks
        if rag_result.retrieved_chunks:
            chunks_text = []
            for i, chunk in enumerate(rag_result.retrieved_chunks, 1):
                chunks_text.append(
                    f"[Source {i}: {chunk.source_name} ({chunk.source_type})] "
                    f"(relevance: {chunk.similarity_score:.2f})\n"
                    f"{chunk.content}"
                )
            rag_result.context_block = "\n\n".join(chunks_text)
        else:
            rag_result.context_block = ""

        # Hallucination guard
        if force_rag and not rag_result.is_sufficient:
            rag_result.context_block = ""
            rag_result.warning = (
                "I do not have sufficient brand knowledge to answer this. "
                "No relevant brand knowledge found."
            )

        rag_result.context_build_time_ms = (
            (time.perf_counter() - context_start) * 1000 - rag_result.retrieval_time_ms
        )
        return rag_result

    # ── Embed Brand Knowledge ────────────────────────────────────────────

    async def embed_brand_knowledge(
        self,
        brand_id: str,
        session: Optional[AsyncSession] = None,
    ) -> Dict[str, Any]:
        """
        Generate and store vector embeddings for all brand knowledge.
        Smart upsert logic:
          - IF content_hash changed → DELETE old embeddings for that source, INSERT new
          - ELSE → skip (no re-embed needed)
          - Cleans up stale embeddings for sources that no longer exist
        """
        if not brand_id:
            raise ValueError("brand_id is required")

        results = {"embedded": 0, "skipped": 0, "deleted_stale": 0, "errors": 0, "time_ms": 0}
        embed_start = time.perf_counter()

        async def _run(sess: AsyncSession):
            from brain.embeddings import get_embedding_provider, chunk_text, content_hash

            brand = (await sess.execute(
                select(BrandSettings).where(BrandSettings.id == brand_id)
            )).scalars().first()
            if not brand:
                raise ValueError(f"Brand not found: {brand_id}")

            provider = get_embedding_provider()

            # ── Step 0: Auto-sync content from source URLs ────────────
            # Fetch latest content from Google Docs (or other URLs) and
            # update content_summary in DB if the content has changed.
            sources = (await sess.execute(
                select(KnowledgeSource).where(
                    and_(
                        KnowledgeSource.brand_id == brand_id,
                        KnowledgeSource.is_active == True,
                    )
                )
            )).scalars().all()

            synced_count = 0
            for ks in sources:
                if ks.url:
                    try:
                        fresh_content = await _fetch_source_content(ks.url, ks.source_type)
                        if fresh_content:
                            old_hash = content_hash(ks.content_summary or "")
                            new_hash = content_hash(fresh_content)
                            if old_hash != new_hash:
                                logger.info(
                                    f"Content changed for '{ks.name}' "
                                    f"({len(ks.content_summary or '')} → {len(fresh_content)} chars)"
                                )
                                ks.content_summary = fresh_content
                                synced_count += 1
                            else:
                                logger.debug(f"Content unchanged for '{ks.name}'")
                    except Exception as e:
                        logger.warning(f"Failed to sync content for '{ks.name}': {e}")

            if synced_count > 0:
                await sess.flush()
                logger.info(f"Auto-synced {synced_count} knowledge source(s) with fresh content")
                # Re-fetch sources after flush to get updated content
                sources = (await sess.execute(
                    select(KnowledgeSource).where(
                        and_(
                            KnowledgeSource.brand_id == brand_id,
                            KnowledgeSource.is_active == True,
                        )
                    )
                )).scalars().all()

            # ── Step 1: Collect all current text to embed ─────────────
            # Each entry: (text, source_name, source_type, hash, metadata, knowledge_source_id)
            texts_to_embed: List[Tuple[str, str, str, str, Dict, Optional[str]]] = []
            current_source_names = set()

            # Knowledge sources
            for ks in sources:
                if ks.content_summary:
                    current_source_names.add(ks.name)
                    chunks = chunk_text(ks.content_summary)
                    for i, chunk in enumerate(chunks):
                        c_hash = content_hash(f"{ks.name}::{chunk}")
                        texts_to_embed.append((
                            chunk, ks.name, ks.source_type, c_hash,
                            {"source": "knowledge_source", "url": ks.url, "chunk_index": i},
                            str(ks.id),
                        ))

            # Brand config documents
            brand_docs = []
            if brand.brand_guidelines:
                brand_docs.append(("Brand Guidelines", f"Brand Guidelines for {brand.brand_name}: {brand.brand_guidelines}"))
            if brand.core_values:
                brand_docs.append(("Core Values", f"Core Values of {brand.brand_name}: {brand.core_values}"))
            if brand.target_audience:
                brand_docs.append(("Target Audience", f"Target Audience for {brand.brand_name}: {brand.target_audience}"))

            for name, text_content in brand_docs:
                current_source_names.add(name)
                c_hash = content_hash(f"{name}::{text_content}")
                texts_to_embed.append((
                    text_content, name, "brand_config", c_hash,
                    {"source": "brand_settings"},
                    None,  # no knowledge_source_id for brand config
                ))

            # ── Step 2: Get existing embeddings for this brand ────────
            existing_rows = (await sess.execute(
                select(DocumentEmbedding.id, DocumentEmbedding.content_hash, DocumentEmbedding.source_name).where(
                    DocumentEmbedding.brand_id == brand_id
                )
            )).fetchall()

            existing_hashes = {row.content_hash for row in existing_rows}
            existing_source_names = {row.source_name for row in existing_rows}

            # ── Step 3: Delete stale embeddings (sources that no longer exist) ──
            stale_sources = existing_source_names - current_source_names
            if stale_sources:
                for stale_name in stale_sources:
                    del_result = await sess.execute(
                        DocumentEmbedding.__table__.delete().where(
                            and_(
                                DocumentEmbedding.brand_id == brand_id,
                                DocumentEmbedding.source_name == stale_name,
                            )
                        )
                    )
                    results["deleted_stale"] += del_result.rowcount
                    logger.info(f"Deleted {del_result.rowcount} stale embeddings for source '{stale_name}'")

            # ── Step 4: Identify new hashes and changed sources ───────
            new_hashes = {h for _, _, _, h, _, _ in texts_to_embed}

            # Sources whose content has changed: they have chunks with NEW hashes
            # that don't exist in the DB yet → delete old chunks for those sources, then insert
            changed_source_names = set()
            for text_content, source_name, source_type, c_hash, metadata, ks_id in texts_to_embed:
                if c_hash not in existing_hashes:
                    changed_source_names.add(source_name)

            # Delete old embeddings for sources that have changed content
            if changed_source_names:
                for src_name in changed_source_names:
                    del_result = await sess.execute(
                        DocumentEmbedding.__table__.delete().where(
                            and_(
                                DocumentEmbedding.brand_id == brand_id,
                                DocumentEmbedding.source_name == src_name,
                            )
                        )
                    )
                    if del_result.rowcount > 0:
                        logger.info(f"Deleted {del_result.rowcount} old embeddings for changed source '{src_name}'")

                await sess.flush()

            # ── Step 5: Filter to only new texts that need embedding ──
            # Re-fetch existing hashes after deletion
            existing_after_delete = (await sess.execute(
                select(DocumentEmbedding.content_hash).where(
                    DocumentEmbedding.brand_id == brand_id
                )
            )).scalars().all()
            existing_hashes_after = set(existing_after_delete)

            new_texts = [(t, n, st, h, m, kid) for t, n, st, h, m, kid in texts_to_embed if h not in existing_hashes_after]
            results["skipped"] = len(texts_to_embed) - len(new_texts)

            if not new_texts:
                await sess.commit()
                return

            # ── Step 6: Generate embeddings in batch and insert ───────
            try:
                raw_texts = [t[0] for t in new_texts]
                vectors = await provider.embed(raw_texts)

                for (text_content, source_name, source_type, c_hash, metadata, ks_id), vector in zip(new_texts, vectors):
                    vec_dim = len(vector) if vector else 0

                    # Both routes (Ollama padded + OpenAI native) should produce 1536D
                    if vec_dim != EMBEDDING_DIMENSION:
                        logger.warning(
                            f"Unexpected dimension: got {vec_dim}D, expected {EMBEDDING_DIMENSION}D. "
                            f"Source: {source_name}. Provider: {provider.provider_name}"
                        )

                    emb_data = {
                        "brand_id": brand_id,
                        "knowledge_source_id": ks_id,
                        "chunk_text": text_content,
                        "chunk_index": metadata.get("chunk_index", 0),
                        "content_hash": c_hash,
                        "source_name": source_name,
                        "source_type": source_type,
                        "embedding_dimension": EMBEDDING_DIMENSION,
                        "embedding_provider": provider.provider_name,
                        "embedding_model": provider.model_name,
                        "metadata_json": metadata,
                    }

                    # Store vector if pgvector is available and dimension matches
                    if hasattr(DocumentEmbedding, "embedding") and DocumentEmbedding.embedding is not None:
                        if vec_dim == EMBEDDING_DIMENSION:
                            emb_data["embedding"] = vector
                        else:
                            logger.warning(
                                f"Cannot store {vec_dim}D vector in 1536D column for {source_name}. "
                                f"This should not happen — check {provider.provider_name} padding logic."
                            )

                    embedding = DocumentEmbedding(**emb_data)
                    sess.add(embedding)
                    results["embedded"] += 1

                await sess.commit()

                # ── Step 7: Update vector_count on knowledge_sources ──
                # Count embeddings per knowledge_source_id and update accordingly
                ks_counts = (await sess.execute(
                    select(
                        DocumentEmbedding.knowledge_source_id,
                        func.count(DocumentEmbedding.id),
                    ).where(
                        and_(
                            DocumentEmbedding.brand_id == brand_id,
                            DocumentEmbedding.knowledge_source_id.isnot(None),
                        )
                    ).group_by(DocumentEmbedding.knowledge_source_id)
                )).all()

                for ks_id, count in ks_counts:
                    await sess.execute(
                        KnowledgeSource.__table__.update()
                        .where(KnowledgeSource.id == ks_id)
                        .values(vector_count=count, last_indexed_at=func.now())
                    )

                # Zero out vector_count for KnowledgeSources that have NO embeddings
                all_ks_ids_with_vectors = {str(ks_id) for ks_id, _ in ks_counts}
                for ks in sources:
                    if str(ks.id) not in all_ks_ids_with_vectors:
                        await sess.execute(
                            KnowledgeSource.__table__.update()
                            .where(KnowledgeSource.id == ks.id)
                            .values(vector_count=0)
                        )

                await sess.commit()

                logger.info(
                    f"Embedded {results['embedded']} chunks for brand {brand_id} "
                    f"via {provider.provider_name}/{provider.model_name} "
                    f"(skipped={results['skipped']}, deleted_stale={results['deleted_stale']})"
                )
            except Exception as e:
                logger.error(f"Embedding generation failed: {e}")
                results["errors"] += 1
                await sess.rollback()

        if session:
            await _run(session)
        else:
            async with async_session() as sess:
                await _run(sess)

        results["time_ms"] = round((time.perf_counter() - embed_start) * 1000, 1)
        return results

    # ── Full Pipeline Debug ──────────────────────────────────────────────

    async def run_debug_pipeline(
        self,
        brand_id: str,
        query: str,
        force_rag: bool = False,
        deterministic: bool = False,
        session: Optional[AsyncSession] = None,
    ) -> Dict[str, Any]:
        """Run full RAG pipeline with debug output for CLI report."""
        pipeline_start = time.perf_counter()

        health = await self.check_embedding_health(brand_id, session)
        rag_result = await self.build_rag_context(
            brand_id=brand_id, query=query,
            force_rag=force_rag, session=session,
        )

        # Build prompt that would be sent to LLM
        system_prompt = self._build_system_prompt(rag_result)
        full_prompt = f"SYSTEM:\n{system_prompt}\n\nUSER QUESTION:\n{query}"

        logger.debug(f"Debug pipeline prompt built ({len(full_prompt)} chars)")

        pipeline_end = time.perf_counter()

        return {
            "brand": rag_result.brand_name,
            "brand_id": brand_id,
            "namespace": rag_result.namespace,
            "total_embeddings": health.total_embeddings,
            "embedding_dimension": health.embedding_dimension,
            "retrieved_docs": len(rag_result.retrieved_chunks),
            "similarity_scores": rag_result.similarity_scores,
            "search_method": rag_result.search_method,
            "chunks_preview": [
                c.content[:MAX_CHUNK_PREVIEW_LENGTH] + ("..." if len(c.content) > MAX_CHUNK_PREVIEW_LENGTH else "")
                for c in rag_result.retrieved_chunks
            ],
            "full_prompt": full_prompt,
            "system_prompt": system_prompt,
            "context_block": rag_result.context_block,
            "is_sufficient": rag_result.is_sufficient,
            "warning": rag_result.warning,
            "deterministic": deterministic,
            "force_rag": force_rag,
            "health": {
                "is_healthy": health.is_healthy,
                "knowledge_sources": health.total_knowledge_sources,
                "active_sources": health.active_knowledge_sources,
                "content_items": health.total_content_items,
                "total_embeddings": health.total_embeddings,
                "embedding_dimension": health.embedding_dimension,
                "has_guidelines": health.has_brand_guidelines,
                "has_audience": health.has_target_audience,
                "sample_metadata": health.sample_metadata,
            },
            "latency": {
                "embedding_ms": round(rag_result.embedding_time_ms, 1),
                "retrieval_ms": round(rag_result.retrieval_time_ms, 1),
                "context_build_ms": round(rag_result.context_build_time_ms, 1),
                "total_pipeline_ms": round((pipeline_end - pipeline_start) * 1000, 1),
            },
        }

    # ── Prompt Builder ───────────────────────────────────────────────────

    def _build_system_prompt(self, rag_result: RAGResult) -> str:
        """Build system prompt with RAG context injected."""
        base = (
            "Use ONLY the following context to answer.\n"
            "If context is insufficient, say you don't know.\n"
        )
        if rag_result.context_block:
            return f"{base}\nCONTEXT:\n{rag_result.context_block}"
        else:
            return f"{base}\nCONTEXT:\n(No relevant brand knowledge available)"


# ─── Module-level Factory ────────────────────────────────────────────────────

def get_rag_engine(
    similarity_threshold: float = DEFAULT_SIMILARITY_THRESHOLD,
    top_k: int = DEFAULT_TOP_K,
) -> RAGEngine:
    """Factory function for RAGEngine instances. No global state."""
    return RAGEngine(similarity_threshold=similarity_threshold, top_k=top_k)
