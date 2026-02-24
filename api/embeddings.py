"""
Zaytri — Embedding API (Hybrid Architecture V2)

Provides /api/embeddings endpoints for:
  - Free tier: Ollama nomic-embed-text (768D → padded to 1536D)
  - Pro tier:  OpenAI text-embedding-3-small (native 1536D)

Endpoints:
  POST /api/embeddings        — Generate embeddings for given texts
  GET  /api/embeddings/info   — Show current embedding route info
  POST /api/embeddings/reindex — Trigger re-indexing for a brand
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from auth.models import User
from db.database import get_db

logger = logging.getLogger("api.embeddings")

router = APIRouter(prefix="/api/embeddings", tags=["Embeddings"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class EmbedRequest(BaseModel):
    """Request to generate embeddings for a list of texts."""
    texts: List[str] = Field(..., min_length=1, max_length=100,
                             description="Texts to embed (max 100)")
    force_provider: Optional[str] = Field(None,
                                          description="Override provider: 'ollama' or 'openai'")


class EmbedResponse(BaseModel):
    """Response containing embeddings and provenance."""
    embeddings: List[List[float]]
    dimension: int
    provider: str
    model: str
    count: int


class EmbeddingInfoResponse(BaseModel):
    """Current embedding route info."""
    provider: str
    model: str
    dimension: int
    route: str  # "free" or "pro"
    native_dimension: int
    padded: bool


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/info", response_model=EmbeddingInfoResponse)
async def get_embedding_info(
    user: User = Depends(get_current_user),
):
    """
    Show which embedding route is currently active.
    Free = Ollama (768D → 1536D padded)
    Pro  = OpenAI (native 1536D)
    """
    from brain.embeddings import get_embedding_provider, OLLAMA_NATIVE_DIM, OPENAI_NATIVE_DIM, EMBEDDING_DIMENSION

    plan_str = getattr(user, 'plan', None)
    plan_str = plan_str.value if hasattr(plan_str, 'value') else (plan_str or 'free')
    provider = get_embedding_provider(user_plan=plan_str)
    is_pro = provider.provider_name == "openai"

    return EmbeddingInfoResponse(
        provider=provider.provider_name,
        model=provider.model_name,
        dimension=provider.dimension,
        route="pro" if is_pro else "free",
        native_dimension=OPENAI_NATIVE_DIM if is_pro else OLLAMA_NATIVE_DIM,
        padded=not is_pro,
    )


@router.post("", response_model=EmbedResponse)
async def generate_embeddings(
    request: EmbedRequest,
    user: User = Depends(get_current_user),
):
    """
    Generate embeddings for the given texts using the current embedding route.
    Free tier: Ollama nomic-embed-text → padded to 1536D
    Pro tier:  OpenAI text-embedding-3-small → native 1536D
    """
    from brain.embeddings import get_embedding_provider

    plan_str = getattr(user, 'plan', None)
    plan_str = plan_str.value if hasattr(plan_str, 'value') else (plan_str or 'free')
    provider = get_embedding_provider(user_plan=plan_str, force_provider=request.force_provider)

    try:
        vectors = await provider.embed(request.texts)
        return EmbedResponse(
            embeddings=vectors,
            dimension=provider.dimension,
            provider=provider.provider_name,
            model=provider.model_name,
            count=len(vectors),
        )
    except Exception as e:
        logger.error(f"Embedding generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Embedding generation failed: {str(e)}")


@router.post("/reindex")
async def reindex_brand_embeddings(
    brand_id: Optional[str] = None,
    force_provider: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Re-index embeddings for a specific brand or all brands.
    Uses the current embedding route (free Ollama / pro OpenAI).
    Optional: force_provider='openai' or 'ollama' to override.
    """
    from brain.rag_engine import get_rag_engine
    from brain.embeddings import get_embedding_provider

    plan_str = getattr(user, 'plan', None)
    plan_str = plan_str.value if hasattr(plan_str, 'value') else (plan_str or 'free')
    engine = get_rag_engine()
    provider = get_embedding_provider(user_plan=plan_str, force_provider=force_provider)

    if brand_id:
        result = await engine.embed_brand_knowledge(brand_id)
        return {
            "status": "success",
            "brand_id": brand_id,
            "embedding_route": provider.provider_name,
            "embedding_model": provider.model_name,
            "result": result,
        }
    else:
        # Re-index all brands for this user
        from sqlalchemy import select
        from db.settings_models import BrandSettings

        brands = await db.execute(
            select(BrandSettings).where(BrandSettings.user_id == user.id)
        )
        results = {}
        for brand in brands.scalars().all():
            bid = str(brand.id)
            try:
                res = await engine.embed_brand_knowledge(bid)
                results[brand.brand_name] = res
            except Exception as e:
                results[brand.brand_name] = {"error": str(e)}

        return {
            "status": "success",
            "embedding_route": provider.provider_name,
            "embedding_model": provider.model_name,
            "results": results,
        }
