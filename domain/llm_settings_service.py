"""
Zaytri — LLM Settings Service (Domain Layer)
Provider key management, agent model assignment.
Extracted from ActionExecutor LLM-related handlers.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.settings_models import LLMProviderConfig, AgentModelConfig
from infra.logging import get_logger

logger = get_logger("domain.llm_settings_service")


class LLMSettingsService:
    """LLM provider and agent model management."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def assign_key(
        self,
        provider: str,
        api_key: str,
    ) -> Dict[str, Any]:
        """Save or update an API key for a provider."""
        from utils.crypto import encrypt_value

        provider = provider.lower()
        if not provider or not api_key:
            return {"success": False, "message": "Provider and API key are required"}

        result = await self.session.execute(
            select(LLMProviderConfig).where(LLMProviderConfig.provider == provider)
        )
        cfg = result.scalar_one_or_none()
        encrypted = encrypt_value(api_key)

        if cfg:
            cfg.api_key_encrypted = encrypted
            cfg.updated_at = datetime.utcnow()
        else:
            cfg = LLMProviderConfig(
                provider=provider, api_key_encrypted=encrypted, is_enabled=True
            )
            self.session.add(cfg)

        logger.info(f"API key saved for provider: {provider}")
        return {"success": True, "message": f"{provider} API key saved"}

    async def delete_key(self, provider: str) -> Dict[str, Any]:
        """Remove a provider's API key."""
        provider = provider.lower()
        result = await self.session.execute(
            select(LLMProviderConfig).where(LLMProviderConfig.provider == provider)
        )
        cfg = result.scalar_one_or_none()
        if cfg:
            await self.session.delete(cfg)

        logger.info(f"API key removed for provider: {provider}")
        return {"success": True, "message": f"{provider} API key removed"}

    async def test_provider(self, provider: str) -> Dict[str, Any]:
        """Test connectivity for a provider."""
        from brain.llm_router import create_provider, PROVIDER_MODELS

        provider = provider.lower()
        if provider not in PROVIDER_MODELS:
            return {"success": False, "message": f"Unknown provider: {provider}"}

        try:
            if provider == "ollama":
                from config import settings
                p = create_provider("ollama", settings.ollama_model)
            else:
                from utils.crypto import decrypt_value
                result = await self.session.execute(
                    select(LLMProviderConfig).where(LLMProviderConfig.provider == provider)
                )
                cfg = result.scalar_one_or_none()
                if not cfg or not cfg.api_key_encrypted:
                    return {"success": False, "message": f"No API key for {provider}"}
                api_key = decrypt_value(cfg.api_key_encrypted)
                p = create_provider(provider, PROVIDER_MODELS[provider][0], api_key=api_key)

            healthy = await p.health_check()
            return {"success": healthy, "message": f"{provider} {'connected' if healthy else 'unreachable'}"}
        except Exception as e:
            return {"success": False, "message": str(e)}

    async def assign_agent_model(
        self,
        agent_id: str,
        provider: str,
        model: str,
    ) -> Dict[str, Any]:
        """Assign a specific LLM to an agent."""
        result = await self.session.execute(
            select(AgentModelConfig).where(AgentModelConfig.agent_id == agent_id)
        )
        cfg = result.scalar_one_or_none()
        if cfg:
            cfg.provider = provider
            cfg.model = model
            cfg.is_custom = True
            cfg.updated_at = datetime.utcnow()
        else:
            cfg = AgentModelConfig(
                agent_id=agent_id, provider=provider, model=model, is_custom=True
            )
            self.session.add(cfg)

        return {"success": True, "message": f"{agent_id} → {provider}/{model}"}

    async def reset_agent_model(self, agent_id: str) -> Dict[str, Any]:
        """Reset agent to default Ollama."""
        from config import settings

        result = await self.session.execute(
            select(AgentModelConfig).where(AgentModelConfig.agent_id == agent_id)
        )
        cfg = result.scalar_one_or_none()
        if cfg:
            cfg.is_custom = False
            cfg.provider = "ollama"
            cfg.model = settings.ollama_model

        return {"success": True, "message": f"{agent_id} reset to Ollama default"}

    async def list_providers(self) -> Dict[str, Any]:
        """List all configured providers."""
        from brain.llm_router import PROVIDER_MODELS

        result = await self.session.execute(select(LLMProviderConfig))
        configs = {c.provider: c for c in result.scalars().all()}

        providers = []
        for prov, models in PROVIDER_MODELS.items():
            cfg = configs.get(prov)
            providers.append({
                "provider": prov,
                "configured": prov == "ollama" or (cfg is not None and cfg.api_key_encrypted is not None),
                "status": cfg.test_status if cfg else ("ok" if prov == "ollama" else None),
                "models_count": len(models),
            })

        return {"success": True, "message": "Provider list", "data": providers}

    async def list_agents(self) -> Dict[str, Any]:
        """List all agent model configurations."""
        from brain.llm_router import AGENT_IDS
        from config import settings

        result = await self.session.execute(select(AgentModelConfig))
        configs = {c.agent_id: c for c in result.scalars().all()}

        agents = []
        for aid in AGENT_IDS:
            cfg = configs.get(aid)
            agents.append({
                "agent_id": aid,
                "provider": cfg.provider if cfg and cfg.is_custom else "ollama",
                "model": cfg.model if cfg and cfg.is_custom else settings.ollama_model,
                "is_custom": cfg.is_custom if cfg else False,
            })

        return {"success": True, "message": "Agent configurations", "data": agents}
