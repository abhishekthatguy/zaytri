"""
Zaytri — Ollama Provider
Local LLM via Ollama HTTP API. Default provider.
"""

import httpx
import logging
from typing import Optional

from brain.providers import BaseLLMProvider

logger = logging.getLogger(__name__)

REQUEST_TIMEOUT = 120.0
MAX_RETRIES = 3


class OllamaProvider(BaseLLMProvider):
    """Ollama local LLM provider."""

    provider_name = "ollama"

    def __init__(self, host: str = "http://localhost:11434", model: str = "llama3"):
        self.host = host.rstrip("/")
        self.model = model
        self.base_url = f"{self.host}/api"

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        json_mode: bool = False,
    ) -> str:
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
        }
        if system_prompt:
            payload["system"] = system_prompt
        if json_mode:
            payload["format"] = "json"

        last_error = None
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                    response = await client.post(f"{self.base_url}/generate", json=payload)
                    response.raise_for_status()
                    return response.json().get("response", "").strip()
            except httpx.TimeoutException as e:
                last_error = e
                logger.warning(f"Ollama timeout (attempt {attempt}/{MAX_RETRIES})")
            except httpx.HTTPStatusError as e:
                logger.error(f"Ollama HTTP error: {e.response.status_code}")
                raise
            except Exception as e:
                last_error = e
                logger.error(f"Ollama error (attempt {attempt}/{MAX_RETRIES}): {e}")

        raise ConnectionError(f"Failed after {MAX_RETRIES} attempts: {last_error}")

    async def health_check(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.host}/api/tags")
                response.raise_for_status()
                models = response.json().get("models", [])
                available = [m["name"] for m in models]
                return self.model in available or any(self.model in m for m in available)
        except Exception as e:
            logger.error(f"Ollama health check failed: {e}")
            return False
