"""
Zaytri — RAG Pipeline Tests
End-to-end tests for the RAG engine: health checks, retrieval,
context injection, brand isolation, hallucination guards,
and orchestrator integration.

Uses unittest.mock with AsyncMock — no live database required.
"""

import pytest
import uuid
from unittest.mock import AsyncMock, MagicMock, patch, PropertyMock
from dataclasses import dataclass

# ─── Fixtures ────────────────────────────────────────────────────────────────

BRAND_ID = str(uuid.uuid4())
BRAND_NAME = "CorpEdge"


def _make_brand(name=BRAND_NAME, brand_id=BRAND_ID):
    """Create a mock BrandSettings object."""
    brand = MagicMock()
    brand.id = brand_id
    brand.brand_name = name
    brand.user_id = str(uuid.uuid4())
    brand.brand_guidelines = "Always be professional and data-driven."
    brand.brand_tone = "Formal"
    brand.target_audience = "Enterprise CTOs and CIOs"
    brand.core_values = "Innovation, Reliability, Transparency"
    brand.niche = "B2B SaaS"
    return brand


def _make_knowledge_source(name="Company Overview", summary="CorpEdge is a B2B SaaS automating enterprise workflows."):
    """Create a mock KnowledgeSource."""
    ks = MagicMock()
    ks.id = str(uuid.uuid4())
    ks.name = name
    ks.source_type = "website"
    ks.content_summary = summary
    ks.url = "https://corpedge.com"
    ks.is_active = True
    ks.vector_count = 0
    return ks


def _make_embedding(chunk_text="CorpEdge automates enterprise workflows", source_name="Company Overview"):
    """Create a mock DocumentEmbedding."""
    emb = MagicMock()
    emb.id = str(uuid.uuid4())
    emb.brand_id = BRAND_ID
    emb.chunk_text = chunk_text
    emb.source_name = source_name
    emb.source_type = "website"
    emb.embedding_dimension = 1536
    emb.content_hash = "abc123"
    emb.metadata_json = {"source": "knowledge_source"}
    return emb


# ═══════════════════════════════════════════════════════════════════════════════
# Text Similarity Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestTextSimilarity:
    """Test the text-based similarity scoring fallback."""

    def test_identical_text(self):
        from brain.rag_engine import compute_text_similarity
        score = compute_text_similarity("enterprise workflow automation", "enterprise workflow automation")
        assert score == 1.0

    def test_related_text(self):
        from brain.rag_engine import compute_text_similarity
        score = compute_text_similarity(
            "enterprise workflow automation",
            "CorpEdge automates enterprise workflows with intelligent automation"
        )
        assert score > 0.3

    def test_unrelated_text(self):
        from brain.rag_engine import compute_text_similarity
        score = compute_text_similarity(
            "chocolate cake recipe",
            "CorpEdge automates enterprise workflows"
        )
        assert score < 0.3

    def test_empty_query(self):
        from brain.rag_engine import compute_text_similarity
        assert compute_text_similarity("", "some document") == 0.0

    def test_empty_document(self):
        from brain.rag_engine import compute_text_similarity
        assert compute_text_similarity("some query", "") == 0.0


# ═══════════════════════════════════════════════════════════════════════════════
# Embedding Utility Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestEmbeddingUtility:
    """Test text chunking and hashing."""

    def test_chunk_short_text(self):
        from brain.embeddings import chunk_text
        chunks = chunk_text("Short text.")
        assert len(chunks) == 1
        assert chunks[0] == "Short text."

    def test_chunk_empty_text(self):
        from brain.embeddings import chunk_text
        assert chunk_text("") == []

    def test_chunk_long_text(self):
        from brain.embeddings import chunk_text
        long_text = "Word " * 5000  # ~25000 chars
        chunks = chunk_text(long_text, chunk_size=1000, overlap=100)
        assert len(chunks) > 1
        # Verify no empty chunks
        assert all(c.strip() for c in chunks)

    def test_content_hash_deterministic(self):
        from brain.embeddings import content_hash
        h1 = content_hash("Hello world")
        h2 = content_hash("Hello world")
        assert h1 == h2

    def test_content_hash_unique(self):
        from brain.embeddings import content_hash
        h1 = content_hash("Hello world")
        h2 = content_hash("Different text")
        assert h1 != h2


# ═══════════════════════════════════════════════════════════════════════════════
# RAG Engine — Health Check Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestHealthCheck:
    """Test check_embedding_health."""

    @pytest.mark.asyncio
    async def test_requires_brand_id(self):
        from brain.rag_engine import RAGEngine
        engine = RAGEngine()
        with pytest.raises(ValueError, match="brand_id is required"):
            await engine.check_embedding_health("")

    @pytest.mark.asyncio
    async def test_health_with_data(self):
        from brain.rag_engine import RAGEngine
        engine = RAGEngine()

        brand = _make_brand()
        mock_session = AsyncMock()

        # Mock queries: brand, knowledge counts, embedding counts, content counts, samples
        mock_results = [
            MagicMock(scalars=MagicMock(return_value=MagicMock(first=MagicMock(return_value=brand)))),   # brand
            MagicMock(scalar=MagicMock(return_value=3)),     # total KS
            MagicMock(scalar=MagicMock(return_value=2)),     # active KS
            MagicMock(scalar=MagicMock(return_value=5)),     # total embeddings
            MagicMock(scalar=MagicMock(return_value=1536)),  # dimension
            MagicMock(scalar=MagicMock(return_value=10)),    # content items
            MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[_make_embedding()])))),  # samples
        ]
        mock_session.execute = AsyncMock(side_effect=mock_results)

        report = await engine.check_embedding_health(BRAND_ID, session=mock_session)

        assert report.brand_name == BRAND_NAME
        assert report.total_knowledge_sources == 3
        assert report.active_knowledge_sources == 2
        assert report.total_embeddings == 5
        assert report.has_brand_guidelines is True
        assert report.has_target_audience is True
        assert report.is_healthy is True
        assert report.error is None

    @pytest.mark.asyncio
    async def test_health_brand_not_found(self):
        from brain.rag_engine import RAGEngine
        engine = RAGEngine()

        mock_session = AsyncMock()
        mock_session.execute = AsyncMock(return_value=MagicMock(
            scalars=MagicMock(return_value=MagicMock(first=MagicMock(return_value=None)))
        ))

        report = await engine.check_embedding_health(BRAND_ID, session=mock_session)

        assert report.error is not None
        assert "not found" in report.error


# ═══════════════════════════════════════════════════════════════════════════════
# RAG Engine — Retrieval Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestRetrieval:
    """Test retrieval methods (text fallback path)."""

    @pytest.mark.asyncio
    async def test_requires_brand_id(self):
        from brain.rag_engine import RAGEngine
        engine = RAGEngine()
        with pytest.raises(ValueError, match="brand_id is required"):
            await engine.test_retrieval("", "test query")

    @pytest.mark.asyncio
    async def test_requires_query(self):
        from brain.rag_engine import RAGEngine
        engine = RAGEngine()
        with pytest.raises(ValueError, match="query is required"):
            await engine.test_retrieval(BRAND_ID, "")

    @pytest.mark.asyncio
    async def test_text_retrieval_returns_results(self):
        from brain.rag_engine import RAGEngine
        engine = RAGEngine(similarity_threshold=0.1)

        brand = _make_brand()
        ks = _make_knowledge_source()

        mock_session = AsyncMock()
        mock_results = [
            # brand
            MagicMock(scalars=MagicMock(return_value=MagicMock(first=MagicMock(return_value=brand)))),
            # embedding count = 0 (force text fallback)
            MagicMock(scalar=MagicMock(return_value=0)),
            # knowledge sources
            MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[ks])))),
        ]
        mock_session.execute = AsyncMock(side_effect=mock_results)

        result = await engine.test_retrieval(BRAND_ID, "What is CorpEdge?", session=mock_session)

        assert result.brand_name == BRAND_NAME
        assert result.search_method == "text"
        assert len(result.retrieved_chunks) > 0
        assert result.retrieval_time_ms > 0

    @pytest.mark.asyncio
    async def test_retrieval_empty_no_data(self):
        from brain.rag_engine import RAGEngine
        engine = RAGEngine()

        brand = _make_brand()
        brand.brand_guidelines = None
        brand.core_values = None
        brand.target_audience = None

        mock_session = AsyncMock()
        mock_results = [
            MagicMock(scalars=MagicMock(return_value=MagicMock(first=MagicMock(return_value=brand)))),
            MagicMock(scalar=MagicMock(return_value=0)),
            MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))),
        ]
        mock_session.execute = AsyncMock(side_effect=mock_results)

        result = await engine.test_retrieval(BRAND_ID, "test", session=mock_session)

        assert len(result.retrieved_chunks) == 0
        assert result.warning is not None


# ═══════════════════════════════════════════════════════════════════════════════
# RAG Engine — Context Building Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestContextBuilding:
    """Test build_rag_context and hallucination guards."""

    @pytest.mark.asyncio
    async def test_context_block_format(self):
        from brain.rag_engine import RAGEngine
        engine = RAGEngine(similarity_threshold=0.1)

        brand = _make_brand()
        ks = _make_knowledge_source()

        mock_session = AsyncMock()
        mock_results = [
            MagicMock(scalars=MagicMock(return_value=MagicMock(first=MagicMock(return_value=brand)))),
            MagicMock(scalar=MagicMock(return_value=0)),
            MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[ks])))),
        ]
        mock_session.execute = AsyncMock(side_effect=mock_results)

        result = await engine.build_rag_context(BRAND_ID, "What is CorpEdge?", session=mock_session)

        assert "Source 1:" in result.context_block
        assert "relevance:" in result.context_block

    @pytest.mark.asyncio
    async def test_force_rag_blocks_empty_context(self):
        from brain.rag_engine import RAGEngine
        engine = RAGEngine(similarity_threshold=0.99)  # Very high threshold

        brand = _make_brand()
        brand.brand_guidelines = None
        brand.core_values = None
        brand.target_audience = None

        mock_session = AsyncMock()
        mock_results = [
            MagicMock(scalars=MagicMock(return_value=MagicMock(first=MagicMock(return_value=brand)))),
            MagicMock(scalar=MagicMock(return_value=0)),
            MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))),
        ]
        mock_session.execute = AsyncMock(side_effect=mock_results)

        result = await engine.build_rag_context(
            BRAND_ID, "unrelated query", force_rag=True, session=mock_session,
        )

        assert result.context_block == ""
        assert "sufficient" in result.warning.lower()

    @pytest.mark.asyncio
    async def test_hallucination_guard_low_scores(self):
        from brain.rag_engine import RAGEngine
        engine = RAGEngine(similarity_threshold=0.99)

        brand = _make_brand()
        ks = _make_knowledge_source(summary="Completely unrelated content about penguins")

        mock_session = AsyncMock()
        mock_results = [
            MagicMock(scalars=MagicMock(return_value=MagicMock(first=MagicMock(return_value=brand)))),
            MagicMock(scalar=MagicMock(return_value=0)),
            MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[ks])))),
        ]
        mock_session.execute = AsyncMock(side_effect=mock_results)

        result = await engine.build_rag_context(
            BRAND_ID, "enterprise workflow", session=mock_session,
        )

        assert not result.is_sufficient
        assert result.warning is not None


# ═══════════════════════════════════════════════════════════════════════════════
# Brand Isolation Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestBrandIsolation:
    """Test that RAG retrieval enforces brand isolation."""

    @pytest.mark.asyncio
    async def test_none_brand_id_raises_error(self):
        from brain.rag_engine import RAGEngine
        engine = RAGEngine()

        with pytest.raises(ValueError, match="brand_id is required"):
            await engine.test_retrieval(None, "query")

    @pytest.mark.asyncio
    async def test_empty_brand_id_raises_error(self):
        from brain.rag_engine import RAGEngine
        engine = RAGEngine()

        with pytest.raises(ValueError, match="brand_id is required"):
            await engine.check_embedding_health("")


# ═══════════════════════════════════════════════════════════════════════════════
# System Prompt Builder Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestPromptBuilder:
    """Test the prompt builder output format."""

    def test_prompt_with_context(self):
        from brain.rag_engine import RAGEngine, RAGResult
        engine = RAGEngine()

        result = RAGResult(
            brand_id=BRAND_ID, brand_name=BRAND_NAME,
            namespace="brand_test", query="test",
            context_block="CorpEdge does enterprise automation.",
        )

        prompt = engine._build_system_prompt(result)
        assert "CONTEXT:" in prompt
        assert "CorpEdge" in prompt
        assert "(No relevant brand knowledge available)" not in prompt

    def test_prompt_without_context(self):
        from brain.rag_engine import RAGEngine, RAGResult
        engine = RAGEngine()

        result = RAGResult(
            brand_id=BRAND_ID, brand_name=BRAND_NAME,
            namespace="brand_test", query="test",
            context_block="",
        )

        prompt = engine._build_system_prompt(result)
        assert "CONTEXT:" in prompt
        assert "No relevant brand knowledge" in prompt


# ═══════════════════════════════════════════════════════════════════════════════
# Factory Function Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestFactory:
    """Test module-level convenience functions."""

    def test_get_rag_engine_defaults(self):
        from brain.rag_engine import get_rag_engine
        engine = get_rag_engine()
        assert engine.similarity_threshold == 0.6
        assert engine.top_k == 5

    def test_get_rag_engine_custom(self):
        from brain.rag_engine import get_rag_engine
        engine = get_rag_engine(similarity_threshold=0.8, top_k=10)
        assert engine.similarity_threshold == 0.8
        assert engine.top_k == 10
