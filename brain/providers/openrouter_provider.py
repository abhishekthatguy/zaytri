"""
Zaytri — OpenRouter Provider
Supports all models available via OpenRouter.
"""

import httpx
import logging
from typing import Optional, Dict, Any

from brain.providers import BaseLLMProvider

logger = logging.getLogger(__name__)

REQUEST_TIMEOUT = 120.0


class OpenRouterProvider(BaseLLMProvider):
    """OpenRouter API provider."""

    provider_name = "openrouter"
    API_URL = "https://openrouter.ai/api/v1/chat/completions"

    def __init__(self, api_key: str, model: str = "google/gemini-2.0-flash-001"):
        self.api_key = api_key
        self.model = model

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        json_mode: bool = False,
    ) -> str:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if json_mode:
            # Some models on OpenRouter might not support response_format
            # but we try to use it if available
            payload["response_format"] = {"type": "json_object"}

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://zaytri.com",  # Required by OpenRouter for some models
            "X-Title": "Zaytri",
        }

        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            response = await client.post(self.API_URL, json=payload, headers=headers)
            if response.status_code != 200:
                logger.error(f"OpenRouter Error: {response.status_code} - {response.text}")
                response.raise_for_status()
            
            data = response.json()
            return str(data["choices"][0]["message"]["content"]).strip()

    async def health_check(self) -> bool:
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            }
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Use a lightweight endpoint for health check
                response = await client.get(
                    "https://openrouter.ai/api/v1/models",
                    headers=headers,
                )
                return response.status_code == 200
        except Exception as e:
            logger.error(f"OpenRouter health check failed: {e}")
            return False
