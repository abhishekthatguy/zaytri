"""
Zaytri — LLM Router
Routes agent LLM requests to the correct provider based on per-agent configuration.
Falls back to default Ollama if no override is set.
"""

import logging
from typing import Optional, Dict
from brain.providers import BaseLLMProvider
from brain.providers.ollama_provider import OllamaProvider
from brain.providers.openai_provider import OpenAIProvider
from brain.providers.gemini_provider import GeminiProvider
from brain.providers.anthropic_provider import AnthropicProvider
from brain.providers.groq_provider import GroqProvider
from brain.providers.openrouter_provider import OpenRouterProvider
from brain.providers.load_balancer import LoadBalancerProvider

logger = logging.getLogger(__name__)

# ─── Agent identifiers ─────────────────────────────────────────────────────
AGENT_IDS = [
    "content_creator",
    "hashtag_generator",
    "review_agent",
    "engagement_bot",
    "analytics_agent",
    "master_agent",
]

# ─── Provider registry ─────────────────────────────────────────────────────
PROVIDER_MODELS: Dict[str, list] = {
    "ollama": ["llama3", "llama3.1", "llama3.2", "mistral", "gemma2", "phi3", "codellama", "deepseek-r1"],
    "openai": ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo", "o1", "o1-mini"],
    "gemini": ["gemini-2.0-flash", "gemini-2.5-pro", "gemini-2.5-flash", "gemini-1.5-pro"],
    "anthropic": ["claude-sonnet-4-20250514", "claude-opus-4-20250514", "claude-haiku-3-20240307"],
    "groq": ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768", "gemma2-9b-it"],
    "openrouter": ["google/gemini-2.0-flash-001", "anthropic/claude-3.5-sonnet", "openai/gpt-4o"],
}


def create_provider(
    provider_name: str,
    model: str,
    api_key: Optional[str] = None,
    ollama_host: Optional[str] = None,
) -> BaseLLMProvider:
    """Factory: create a provider instance by name."""
    if provider_name == "ollama":
        from config import settings
        host = ollama_host or settings.ollama_host
        return OllamaProvider(host=host, model=model)
    elif provider_name == "openai":
        if not api_key:
            raise ValueError("OpenAI API key is required")
        return OpenAIProvider(api_key=api_key, model=model)
    elif provider_name == "gemini":
        if not api_key:
            raise ValueError("Gemini API key is required")
        return GeminiProvider(api_key=api_key, model=model)
    elif provider_name == "anthropic":
        if not api_key:
            raise ValueError("Anthropic API key is required")
        return AnthropicProvider(api_key=api_key, model=model)
    elif provider_name == "groq":
        if not api_key:
            raise ValueError("Groq API key is required")
        return GroqProvider(api_key=api_key, model=model)
    elif provider_name == "openrouter":
        if not api_key:
            from config import settings
            api_key = settings.open_router_api_key
        if not api_key:
            raise ValueError("OpenRouter API key is required")
        return OpenRouterProvider(api_key=api_key, model=model)
    else:
        raise ValueError(f"Unknown provider: {provider_name}")


class LLMRouter:
    """
    Routes LLM requests to the correct provider based on agent configuration.
    Implements a fallback-enabled default provider using a LoadBalancer.

    Usage:
        router = LLMRouter()
        llm = router.get_provider("content_creator")
        result = await llm.generate_json(...)
    """

    def __init__(self):
        self._cache: Dict[str, BaseLLMProvider] = {}

    def get_default_provider(self) -> BaseLLMProvider:
        """
        Get the default balanced provider.
        Primary: OpenRouter
        Fallbacks: Ollama (llama3.2, deepseek, mistral)
        """
        if "_default" not in self._cache:
            from config import settings
            
            providers = []
            
            # 1. Primary: OpenRouter
            if settings.open_router_api_key:
                providers.append(
                    OpenRouterProvider(
                        api_key=settings.open_router_api_key,
                        model="google/gemini-2.0-flash-001" # Fast & Cheap primary
                    )
                )
            
            # 2. Fallbacks: Ollama
            # We use common model tags and include the user's preferred model first
            fallback_models = [settings.ollama_model]
            for m in ["llama3:latest", "mistral:latest", "llama3.2:latest"]:
                if m not in fallback_models:
                    fallback_models.append(m)

            for fallback_model in fallback_models:
                providers.append(
                    OllamaProvider(
                        host=settings.ollama_host,
                        model=fallback_model
                    )
                )
            
            if not providers:
                # Absolute fallback if nothing is configured
                providers.append(OllamaProvider(host=settings.ollama_host, model=settings.ollama_model))

            self._cache["_default"] = LoadBalancerProvider(
                providers=providers,
                requests_per_minute=20, # Safe default for OpenRouter free tier / Local Ollama
                max_retries=1
            )
            
        return self._cache["_default"]

    def get_provider(self, agent_id: str) -> BaseLLMProvider:
        """
        Get the LLM provider for a specific agent.
        Returns the configured override, or falls back to default Balanced Provider.
        """
        if agent_id in self._cache:
            return self._cache[agent_id]

        # Try to load from database config
        try:
            provider = self._load_agent_config(agent_id)
            if provider:
                self._cache[agent_id] = provider
                return provider
        except Exception as e:
            logger.warning(f"Failed to load LLM config for {agent_id}, using default: {e}")

        return self.get_default_provider()

    def get_provider_for_model_override(self, model_val: str) -> BaseLLMProvider:
        """Get LLM Provider from frontend display name/value"""
        if not model_val: return self.get_default_provider()
        
        mdl = model_val.lower()
        from config import settings
        from brain.providers.ollama_provider import OllamaProvider
        from brain.providers.openai_provider import OpenAIProvider
        from brain.providers.openrouter_provider import OpenRouterProvider
        
        if "mistral" in mdl:
            return OllamaProvider(host=settings.ollama_host, model="mistral:latest")
        elif "ollama" in mdl or "llama 3" in mdl:
            return OllamaProvider(host=settings.ollama_host, model="llama3:latest")
        elif "deepseek" in mdl:
            return OllamaProvider(host=settings.ollama_host, model="deepseek-r1:latest")
        elif "gpt" in mdl:
            try:
                from sqlalchemy import create_engine, select
                from sqlalchemy.orm import Session
                from db.settings_models import LLMProviderConfig
                from utils.crypto import decrypt_value
                sync_url = settings.database_url.replace("+asyncpg", "").replace("postgresql://", "postgresql://")
                engine = create_engine(sync_url)
                with Session(engine) as session:
                    cfg = session.execute(select(LLMProviderConfig).where(LLMProviderConfig.provider == "openai")).scalar_one_or_none()
                    if cfg and cfg.api_key_encrypted:
                        return OpenAIProvider(api_key=decrypt_value(cfg.api_key_encrypted), model="gpt-4o")
            except Exception:
                pass
            return self.get_default_provider()
        elif "/" in mdl:
            if settings.open_router_api_key:
                 return OpenRouterProvider(api_key=settings.open_router_api_key, model=model_val)
        
        return self.get_default_provider()


    def _load_agent_config(self, agent_id: str) -> Optional[BaseLLMProvider]:
        """Load agent-specific LLM config from DB (sync)."""
        try:
            from sqlalchemy import create_engine, select
            from sqlalchemy.orm import Session
            from config import settings
            from db.settings_models import AgentModelConfig, LLMProviderConfig
            from utils.crypto import decrypt_value

            sync_url = settings.database_url.replace("+asyncpg", "").replace("postgresql://", "postgresql://")
            engine = create_engine(sync_url)

            with Session(engine) as session:
                # Get agent config
                agent_cfg = session.execute(
                    select(AgentModelConfig).where(AgentModelConfig.agent_id == agent_id)
                ).scalar_one_or_none()

                if not agent_cfg or not agent_cfg.is_custom:
                    return None

                provider_name = agent_cfg.provider
                model = agent_cfg.model

                if provider_name == "ollama":
                    return OllamaProvider(
                        host=settings.ollama_host,
                        model=model,
                    )

                # Get provider API key
                provider_cfg = session.execute(
                    select(LLMProviderConfig).where(
                        LLMProviderConfig.provider == provider_name
                    )
                ).scalar_one_or_none()

                if not provider_cfg or (provider_name != "openrouter" and not provider_cfg.api_key_encrypted):
                    # For OpenRouter, we can fall back to settings.open_router_api_key if not in DB
                    if provider_name == "openrouter" and settings.open_router_api_key:
                        return OpenRouterProvider(api_key=settings.open_router_api_key, model=model)
                    
                    logger.warning(f"No API key for provider {provider_name}")
                    return None

                api_key = decrypt_value(provider_cfg.api_key_encrypted) if provider_cfg.api_key_encrypted else settings.open_router_api_key
                return create_provider(provider_name, model, api_key=api_key)

            engine.dispose()
        except Exception as e:
            logger.debug(f"Could not load agent config from DB: {e}")
            return None

    def invalidate_cache(self, agent_id: Optional[str] = None):
        """Clear cached providers. Called when settings change."""
        if agent_id:
            self._cache.pop(agent_id, None)
        else:
            self._cache.clear()


# ─── Singleton ──────────────────────────────────────────────────────────────
llm_router = LLMRouter()


def get_llm(agent_id: str) -> BaseLLMProvider:
    """Convenience function to get the LLM provider for an agent."""
    return llm_router.get_provider(agent_id)
