"""
Zaytri — Tests for Multi-Provider LLM System
Tests LLM providers, router, and agent model configuration.
"""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

# ─── Provider Tests ─────────────────────────────────────────────────────────


class TestBaseLLMProvider:
    """Test the BaseLLMProvider abstract class."""

    @pytest.mark.asyncio
    async def test_generate_json_parses_valid_json(self):
        from brain.providers import BaseLLMProvider

        class MockProvider(BaseLLMProvider):
            provider_name = "mock"

            async def generate(self, prompt, system_prompt=None, temperature=0.7,
                             max_tokens=2048, json_mode=False):
                return '{"key": "value", "count": 42}'

            async def health_check(self):
                return True

        provider = MockProvider()
        result = await provider.generate_json("test prompt")
        assert result == {"key": "value", "count": 42}

    @pytest.mark.asyncio
    async def test_generate_json_extracts_from_code_block(self):
        from brain.providers import BaseLLMProvider

        class MockProvider(BaseLLMProvider):
            provider_name = "mock"

            async def generate(self, prompt, system_prompt=None, temperature=0.7,
                             max_tokens=2048, json_mode=False):
                return '```json\n{"key": "extracted"}\n```'

            async def health_check(self):
                return True

        provider = MockProvider()
        result = await provider.generate_json("test prompt")
        assert result == {"key": "extracted"}

    @pytest.mark.asyncio
    async def test_generate_json_raises_on_invalid_json(self):
        from brain.providers import BaseLLMProvider

        class MockProvider(BaseLLMProvider):
            provider_name = "mock"

            async def generate(self, prompt, system_prompt=None, temperature=0.7,
                             max_tokens=2048, json_mode=False):
                return "not json at all"

            async def health_check(self):
                return True

        provider = MockProvider()
        with pytest.raises(json.JSONDecodeError):
            await provider.generate_json("test prompt")


class TestOllamaProvider:
    """Test the Ollama provider."""

    @pytest.mark.asyncio
    async def test_generate_success(self):
        from brain.providers.ollama_provider import OllamaProvider

        provider = OllamaProvider(host="http://test:11434", model="llama3")

        mock_response = MagicMock()
        mock_response.json.return_value = {"response": "Hello, world!"}
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client:
            mock_instance = AsyncMock()
            mock_instance.post.return_value = mock_response
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=False)
            mock_client.return_value = mock_instance

            result = await provider.generate("test prompt")
            assert result == "Hello, world!"

    @pytest.mark.asyncio
    async def test_generate_with_system_prompt(self):
        from brain.providers.ollama_provider import OllamaProvider

        provider = OllamaProvider(host="http://test:11434", model="llama3")

        mock_response = MagicMock()
        mock_response.json.return_value = {"response": "result"}
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client:
            mock_instance = AsyncMock()
            mock_instance.post.return_value = mock_response
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=False)
            mock_client.return_value = mock_instance

            result = await provider.generate("test", system_prompt="You are helpful")
            assert result == "result"

            # Verify system prompt was included
            call_args = mock_instance.post.call_args
            payload = call_args[1]["json"]
            assert payload["system"] == "You are helpful"

    @pytest.mark.asyncio
    async def test_generate_json_mode(self):
        from brain.providers.ollama_provider import OllamaProvider

        provider = OllamaProvider(host="http://test:11434", model="llama3")

        mock_response = MagicMock()
        mock_response.json.return_value = {"response": "result"}
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client:
            mock_instance = AsyncMock()
            mock_instance.post.return_value = mock_response
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=False)
            mock_client.return_value = mock_instance

            await provider.generate("test", json_mode=True)

            call_args = mock_instance.post.call_args
            payload = call_args[1]["json"]
            assert payload["format"] == "json"

    @pytest.mark.asyncio
    async def test_health_check_success(self):
        from brain.providers.ollama_provider import OllamaProvider

        provider = OllamaProvider(host="http://test:11434", model="llama3")

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "models": [{"name": "llama3"}, {"name": "mistral"}]
        }
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client:
            mock_instance = AsyncMock()
            mock_instance.get.return_value = mock_response
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=False)
            mock_client.return_value = mock_instance

            result = await provider.health_check()
            assert result is True

    @pytest.mark.asyncio
    async def test_health_check_model_not_found(self):
        from brain.providers.ollama_provider import OllamaProvider

        provider = OllamaProvider(host="http://test:11434", model="nonexistent")

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "models": [{"name": "llama3"}]
        }
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client:
            mock_instance = AsyncMock()
            mock_instance.get.return_value = mock_response
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=False)
            mock_client.return_value = mock_instance

            result = await provider.health_check()
            assert result is False


class TestOpenAIProvider:
    """Test the OpenAI provider."""

    @pytest.mark.asyncio
    async def test_generate_success(self):
        from brain.providers.openai_provider import OpenAIProvider

        provider = OpenAIProvider(api_key="sk-test", model="gpt-4o-mini")

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "Hello from GPT!"}}]
        }
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client:
            mock_instance = AsyncMock()
            mock_instance.post.return_value = mock_response
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=False)
            mock_client.return_value = mock_instance

            result = await provider.generate("test prompt")
            assert result == "Hello from GPT!"

            # Verify auth header
            call_args = mock_instance.post.call_args
            headers = call_args[1]["headers"]
            assert headers["Authorization"] == "Bearer sk-test"

    @pytest.mark.asyncio
    async def test_generate_json_mode_sets_response_format(self):
        from brain.providers.openai_provider import OpenAIProvider

        provider = OpenAIProvider(api_key="sk-test", model="gpt-4o-mini")

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "choices": [{"message": {"content": '{"test": true}'}}]
        }
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client:
            mock_instance = AsyncMock()
            mock_instance.post.return_value = mock_response
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=False)
            mock_client.return_value = mock_instance

            await provider.generate("test", json_mode=True)

            call_args = mock_instance.post.call_args
            payload = call_args[1]["json"]
            assert payload["response_format"] == {"type": "json_object"}


class TestGeminiProvider:
    """Test the Gemini provider."""

    @pytest.mark.asyncio
    async def test_generate_success(self):
        from brain.providers.gemini_provider import GeminiProvider

        provider = GeminiProvider(api_key="test-key", model="gemini-2.0-flash")

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "candidates": [
                {"content": {"parts": [{"text": "Hello from Gemini!"}]}}
            ]
        }
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client:
            mock_instance = AsyncMock()
            mock_instance.post.return_value = mock_response
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=False)
            mock_client.return_value = mock_instance

            result = await provider.generate("test prompt")
            assert result == "Hello from Gemini!"

    @pytest.mark.asyncio
    async def test_generate_with_system_prompt(self):
        from brain.providers.gemini_provider import GeminiProvider

        provider = GeminiProvider(api_key="test-key", model="gemini-2.0-flash")

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "candidates": [
                {"content": {"parts": [{"text": "result"}]}}
            ]
        }
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client:
            mock_instance = AsyncMock()
            mock_instance.post.return_value = mock_response
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=False)
            mock_client.return_value = mock_instance

            result = await provider.generate("test", system_prompt="Be helpful")
            assert result == "result"

            # System prompt should create 3 messages (system instruction + ack + user)
            call_args = mock_instance.post.call_args
            payload = call_args[1]["json"]
            assert len(payload["contents"]) == 3


class TestAnthropicProvider:
    """Test the Anthropic provider."""

    @pytest.mark.asyncio
    async def test_generate_success(self):
        from brain.providers.anthropic_provider import AnthropicProvider

        provider = AnthropicProvider(api_key="test-key", model="claude-sonnet-4-20250514")

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "content": [{"text": "Hello from Claude!"}]
        }
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client:
            mock_instance = AsyncMock()
            mock_instance.post.return_value = mock_response
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=False)
            mock_client.return_value = mock_instance

            result = await provider.generate("test prompt")
            assert result == "Hello from Claude!"

            # Verify Anthropic-specific headers
            call_args = mock_instance.post.call_args
            headers = call_args[1]["headers"]
            assert headers["x-api-key"] == "test-key"
            assert headers["anthropic-version"] == "2023-06-01"

    @pytest.mark.asyncio
    async def test_json_mode_modifies_system_prompt(self):
        from brain.providers.anthropic_provider import AnthropicProvider

        provider = AnthropicProvider(api_key="test-key", model="claude-sonnet-4-20250514")

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "content": [{"text": '{"result": true}'}]
        }
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client:
            mock_instance = AsyncMock()
            mock_instance.post.return_value = mock_response
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=False)
            mock_client.return_value = mock_instance

            await provider.generate("test", json_mode=True)

            call_args = mock_instance.post.call_args
            payload = call_args[1]["json"]
            assert "JSON" in payload["system"]


class TestGroqProvider:
    """Test the Groq provider."""

    @pytest.mark.asyncio
    async def test_generate_success(self):
        from brain.providers.groq_provider import GroqProvider

        provider = GroqProvider(api_key="gsk-test", model="llama-3.3-70b-versatile")

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "Hello from Groq!"}}]
        }
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client:
            mock_instance = AsyncMock()
            mock_instance.post.return_value = mock_response
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=False)
            mock_client.return_value = mock_instance

            result = await provider.generate("test prompt")
            assert result == "Hello from Groq!"

            # Verify Groq API URL
            call_args = mock_instance.post.call_args
            url = call_args[0][0]
            assert "groq.com" in url


# ─── Router Tests ───────────────────────────────────────────────────────────


class TestLLMRouter:
    """Test the LLM Router."""

    def test_get_default_provider(self):
        from brain.llm_router import LLMRouter
        from brain.providers.ollama_provider import OllamaProvider

        with patch("brain.llm_router.OllamaProvider") as mock_cls:
            mock_instance = MagicMock()
            mock_cls.return_value = mock_instance

            router = LLMRouter()
            with patch("config.settings") as mock_settings:
                mock_settings.ollama_host = "http://localhost:11434"
                mock_settings.ollama_model = "llama3"
                provider = router.get_default_provider()

            assert provider is not None

    def test_get_provider_returns_default_for_unconfigured_agent(self):
        from brain.llm_router import LLMRouter

        router = LLMRouter()
        with patch.object(router, "get_default_provider") as mock_default:
            mock_default.return_value = MagicMock()
            with patch.object(router, "_load_agent_config", return_value=None):
                provider = router.get_provider("content_creator")

            assert provider is mock_default.return_value

    def test_invalidate_cache_clears_specific_agent(self):
        from brain.llm_router import LLMRouter

        router = LLMRouter()
        router._cache["content_creator"] = MagicMock()
        router._cache["hashtag_generator"] = MagicMock()

        router.invalidate_cache("content_creator")

        assert "content_creator" not in router._cache
        assert "hashtag_generator" in router._cache

    def test_invalidate_cache_clears_all(self):
        from brain.llm_router import LLMRouter

        router = LLMRouter()
        router._cache["content_creator"] = MagicMock()
        router._cache["hashtag_generator"] = MagicMock()

        router.invalidate_cache()
        assert len(router._cache) == 0


class TestCreateProvider:
    """Test the provider factory function."""

    def test_create_ollama(self):
        from brain.llm_router import create_provider
        from brain.providers.ollama_provider import OllamaProvider

        with patch("config.settings") as mock_settings:
            mock_settings.ollama_host = "http://localhost:11434"
            provider = create_provider("ollama", "llama3")

        assert isinstance(provider, OllamaProvider)

    def test_create_openai(self):
        from brain.llm_router import create_provider
        from brain.providers.openai_provider import OpenAIProvider

        provider = create_provider("openai", "gpt-4o", api_key="sk-test")
        assert isinstance(provider, OpenAIProvider)

    def test_create_gemini(self):
        from brain.llm_router import create_provider
        from brain.providers.gemini_provider import GeminiProvider

        provider = create_provider("gemini", "gemini-2.0-flash", api_key="test-key")
        assert isinstance(provider, GeminiProvider)

    def test_create_anthropic(self):
        from brain.llm_router import create_provider
        from brain.providers.anthropic_provider import AnthropicProvider

        provider = create_provider("anthropic", "claude-sonnet-4-20250514", api_key="test-key")
        assert isinstance(provider, AnthropicProvider)

    def test_create_groq(self):
        from brain.llm_router import create_provider
        from brain.providers.groq_provider import GroqProvider

        provider = create_provider("groq", "llama-3.3-70b-versatile", api_key="gsk-test")
        assert isinstance(provider, GroqProvider)

    def test_create_unknown_raises(self):
        from brain.llm_router import create_provider

        with pytest.raises(ValueError, match="Unknown provider"):
            create_provider("unknown_provider", "model")

    def test_create_openai_without_key_raises(self):
        from brain.llm_router import create_provider

        with pytest.raises(ValueError, match="API key is required"):
            create_provider("openai", "gpt-4o")


class TestGetLLM:
    """Test the convenience get_llm function."""

    def test_get_llm_delegates_to_router(self):
        from brain.llm_router import get_llm, llm_router

        mock_provider = MagicMock()
        with patch.object(llm_router, "get_provider", return_value=mock_provider) as mock_get:
            result = get_llm("content_creator")

        mock_get.assert_called_once_with("content_creator")
        assert result is mock_provider


# ─── Agent Integration Tests ───────────────────────────────────────────────


class TestAgentUsesRouter:
    """Test that agents correctly use get_llm() instead of the old llm singleton."""

    @pytest.mark.asyncio
    async def test_content_creator_uses_get_llm(self):
        with patch("agents.content_creator.get_llm") as mock_get_llm:
            mock_provider = AsyncMock()
            mock_provider.generate_json.return_value = {
                "caption": "Test caption",
                "hook": "Hook",
                "cta": "CTA",
                "post_text": "Post text",
            }
            mock_get_llm.return_value = mock_provider

            from agents.content_creator import ContentCreatorAgent
            agent = ContentCreatorAgent()
            result = await agent.run({
                "topic": "AI",
                "platform": "instagram",
                "tone": "professional",
            })

            mock_get_llm.assert_called_with("content_creator")
            assert result["caption"] == "Test caption"

    @pytest.mark.asyncio
    async def test_hashtag_generator_uses_get_llm(self):
        with patch("agents.hashtag_generator.get_llm") as mock_get_llm:
            mock_provider = AsyncMock()
            mock_provider.generate_json.return_value = {
                "niche_hashtags": ["#AI", "#ML"],
                "broad_hashtags": ["#tech"],
            }
            mock_get_llm.return_value = mock_provider

            from agents.hashtag_generator import HashtagGeneratorAgent
            agent = HashtagGeneratorAgent()
            result = await agent.run({
                "platform": "instagram",
                "topic": "AI",
            })

            mock_get_llm.assert_called_with("hashtag_generator")
            assert len(result["niche_hashtags"]) == 2

    @pytest.mark.asyncio
    async def test_review_agent_uses_get_llm(self):
        with patch("agents.review_agent.get_llm") as mock_get_llm:
            mock_provider = AsyncMock()
            mock_provider.generate_json.return_value = {
                "grammar_score": 9,
                "engagement_score": 8,
                "hook_score": 7,
                "compliance_score": 10,
                "overall_score": 8.5,
                "issues": [],
                "improvements": [],
                "is_approved": True,
            }
            mock_get_llm.return_value = mock_provider

            from agents.review_agent import ReviewAgent
            agent = ReviewAgent()
            result = await agent.run({
                "platform": "instagram",
                "caption": "Test",
                "post_text": "Test text",
            })

            mock_get_llm.assert_called_with("review_agent")
            assert result["is_approved"] is True


# ─── Constants Tests ────────────────────────────────────────────────────────


class TestConstants:
    """Test provider and agent constants."""

    def test_all_agents_listed(self):
        from brain.llm_router import AGENT_IDS
        expected = [
            "content_creator", "hashtag_generator",
            "review_agent", "engagement_bot", "analytics_agent",
            "master_agent",
        ]
        assert AGENT_IDS == expected

    def test_all_providers_have_models(self):
        from brain.llm_router import PROVIDER_MODELS
        for provider, models in PROVIDER_MODELS.items():
            assert len(models) > 0, f"Provider {provider} has no models"

    def test_provider_models_include_major_providers(self):
        from brain.llm_router import PROVIDER_MODELS
        expected_providers = {"ollama", "openai", "gemini", "anthropic", "groq", "openrouter"}
        assert set(PROVIDER_MODELS.keys()) == expected_providers
