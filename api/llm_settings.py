"""
Zaytri — LLM Settings API Routes
Manage LLM providers, API keys, and per-agent model assignments.
"""

from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from auth.models import User
from db.database import get_db
from db.settings_models import LLMProviderConfig, AgentModelConfig
from utils.crypto import encrypt_value, decrypt_value, mask_value
from brain.llm_router import PROVIDER_MODELS, AGENT_IDS, create_provider, llm_router

router = APIRouter(prefix="/settings/llm", tags=["LLM Settings"])


# ─── Schemas ────────────────────────────────────────────────────────────────

class ProviderKeyRequest(BaseModel):
    provider: str
    api_key: str


class AgentModelRequest(BaseModel):
    agent_id: str
    provider: str
    model: str


class ResetAgentRequest(BaseModel):
    agent_id: str


# ─── Provider Registry ─────────────────────────────────────────────────────

@router.get("/providers")
async def list_providers(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """List all available LLM providers with their models and configuration status."""
    result = await db.execute(select(LLMProviderConfig))
    configs = {c.provider: c for c in result.scalars().all()}

    providers = []
    for provider, models in PROVIDER_MODELS.items():
        cfg = configs.get(provider)
        providers.append({
            "provider": provider,
            "models": models,
            "is_configured": provider == "ollama" or (cfg is not None and cfg.api_key_encrypted is not None),
            "is_enabled": cfg.is_enabled if cfg else (provider == "ollama"),
            "test_status": cfg.test_status if cfg else ("connected" if provider == "ollama" else None),
            "last_tested_at": cfg.last_tested_at.isoformat() if cfg and cfg.last_tested_at else None,
            "masked_key": mask_value(decrypt_value(cfg.api_key_encrypted)) if cfg and cfg.api_key_encrypted else None,
        })

    return providers


# ─── Provider API Keys ─────────────────────────────────────────────────────

@router.post("/providers/key")
async def save_provider_key(
    req: ProviderKeyRequest,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Save or update an API key for a provider."""
    if req.provider not in PROVIDER_MODELS:
        raise HTTPException(400, f"Unknown provider: {req.provider}")
    if req.provider == "ollama":
        raise HTTPException(400, "Ollama does not require an API key")

    encrypted = encrypt_value(req.api_key)

    result = await db.execute(
        select(LLMProviderConfig).where(LLMProviderConfig.provider == req.provider)
    )
    cfg = result.scalar_one_or_none()

    if cfg:
        cfg.api_key_encrypted = encrypted
        cfg.updated_at = datetime.utcnow()
    else:
        cfg = LLMProviderConfig(
            provider=req.provider,
            api_key_encrypted=encrypted,
            is_enabled=True,
        )
        db.add(cfg)

    await db.commit()

    # Invalidate router cache so agents pick up new keys
    llm_router.invalidate_cache()

    return {"status": "saved", "provider": req.provider}


@router.delete("/providers/{provider}/key")
async def delete_provider_key(
    provider: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Remove an API key for a provider."""
    result = await db.execute(
        select(LLMProviderConfig).where(LLMProviderConfig.provider == provider)
    )
    cfg = result.scalar_one_or_none()
    if cfg:
        await db.delete(cfg)
        await db.commit()
        llm_router.invalidate_cache()

    return {"status": "deleted", "provider": provider}


@router.post("/providers/{provider}/test")
async def test_provider(
    provider: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Test connectivity to a provider."""
    if provider not in PROVIDER_MODELS:
        raise HTTPException(400, f"Unknown provider: {provider}")

    try:
        if provider == "ollama":
            from config import settings
            from brain.providers.ollama_provider import OllamaProvider
            p = OllamaProvider(host=settings.ollama_host, model=settings.ollama_model)
        else:
            result = await db.execute(
                select(LLMProviderConfig).where(LLMProviderConfig.provider == provider)
            )
            cfg = result.scalar_one_or_none()
            if not cfg or not cfg.api_key_encrypted:
                raise HTTPException(400, f"No API key configured for {provider}")

            api_key = decrypt_value(cfg.api_key_encrypted)
            default_model = PROVIDER_MODELS[provider][0]
            p = create_provider(provider, default_model, api_key=api_key)

        healthy = await p.health_check()

        # Update test status in DB
        if provider != "ollama":
            result = await db.execute(
                select(LLMProviderConfig).where(LLMProviderConfig.provider == provider)
            )
            cfg = result.scalar_one_or_none()
            if cfg:
                cfg.test_status = "connected" if healthy else "failed"
                cfg.last_tested_at = datetime.utcnow()
                await db.commit()

        return {
            "status": "connected" if healthy else "failed",
            "message": f"{provider} is {'connected' if healthy else 'unreachable'}",
        }
    except HTTPException:
        raise
    except Exception as e:
        return {"status": "failed", "message": str(e)}


# ─── Agent Model Assignments ───────────────────────────────────────────────

@router.get("/agents")
async def list_agent_configs(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Get LLM configuration for each agent."""
    result = await db.execute(select(AgentModelConfig))
    configs = {c.agent_id: c for c in result.scalars().all()}

    from config import settings

    agents = []
    for agent_id in AGENT_IDS:
        cfg = configs.get(agent_id)
        agents.append({
            "agent_id": agent_id,
            "provider": cfg.provider if cfg and cfg.is_custom else "ollama",
            "model": cfg.model if cfg and cfg.is_custom else settings.ollama_model,
            "is_custom": cfg.is_custom if cfg else False,
        })

    return agents


@router.post("/agents/assign")
async def assign_agent_model(
    req: AgentModelRequest,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Assign a specific LLM provider and model to an agent."""
    if req.agent_id not in AGENT_IDS:
        raise HTTPException(400, f"Unknown agent: {req.agent_id}")
    if req.provider not in PROVIDER_MODELS:
        raise HTTPException(400, f"Unknown provider: {req.provider}")
    if req.model not in PROVIDER_MODELS[req.provider]:
        raise HTTPException(400, f"Model '{req.model}' not available for {req.provider}")

    # Verify provider has an API key (except ollama)
    if req.provider != "ollama":
        result = await db.execute(
            select(LLMProviderConfig).where(LLMProviderConfig.provider == req.provider)
        )
        cfg = result.scalar_one_or_none()
        if not cfg or not cfg.api_key_encrypted:
            raise HTTPException(400, f"Please add an API key for {req.provider} first")

    # Upsert agent config
    result = await db.execute(
        select(AgentModelConfig).where(AgentModelConfig.agent_id == req.agent_id)
    )
    agent_cfg = result.scalar_one_or_none()

    if agent_cfg:
        agent_cfg.provider = req.provider
        agent_cfg.model = req.model
        agent_cfg.is_custom = True
        agent_cfg.updated_at = datetime.utcnow()
    else:
        agent_cfg = AgentModelConfig(
            agent_id=req.agent_id,
            provider=req.provider,
            model=req.model,
            is_custom=True,
        )
        db.add(agent_cfg)

    await db.commit()
    llm_router.invalidate_cache(req.agent_id)

    return {
        "status": "assigned",
        "agent_id": req.agent_id,
        "provider": req.provider,
        "model": req.model,
    }


@router.post("/agents/reset")
async def reset_agent_model(
    req: ResetAgentRequest,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Reset an agent to use the default Ollama provider."""
    result = await db.execute(
        select(AgentModelConfig).where(AgentModelConfig.agent_id == req.agent_id)
    )
    agent_cfg = result.scalar_one_or_none()

    if agent_cfg:
        agent_cfg.is_custom = False
        agent_cfg.provider = "ollama"
        from config import settings
        agent_cfg.model = settings.ollama_model
        agent_cfg.updated_at = datetime.utcnow()
        await db.commit()

    llm_router.invalidate_cache(req.agent_id)
    return {"status": "reset", "agent_id": req.agent_id}
