"""
Zaytri — Anthropic Provider
Supports Claude Sonnet, Opus, Haiku.
"""

import httpx
import logging
from typing import Optional

from brain.providers import BaseLLMProvider

logger = logging.getLogger(__name__)

REQUEST_TIMEOUT = 60.0


class AnthropicProvider(BaseLLMProvider):
    """Anthropic Claude API provider."""

    provider_name = "anthropic"
    API_URL = "https://api.anthropic.com/v1/messages"

    def __init__(self, api_key: str, model: str = "claude-sonnet-4-20250514"):
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
        if json_mode and system_prompt:
            system_prompt += "\n\nYou MUST respond with valid JSON only. No markdown, no explanation."
        elif json_mode:
            system_prompt = "You MUST respond with valid JSON only. No markdown, no explanation."

        messages = [{"role": "user", "content": prompt}]

        payload = {
            "model": self.model,
            "max_tokens": max_tokens,
            "messages": messages,
        }
        if system_prompt:
            payload["system"] = system_prompt

        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            response = await client.post(self.API_URL, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            content = data.get("content", [])
            if content:
                return content[0].get("text", "").strip()
            return ""

    async def health_check(self) -> bool:
        try:
            # Anthropic doesn't have a dedicated health endpoint;
            # we send a minimal request to verify the key works
            headers = {
                "x-api-key": self.api_key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            }
            payload = {
                "model": self.model,
                "max_tokens": 10,
                "messages": [{"role": "user", "content": "Hi"}],
            }
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(self.API_URL, json=payload, headers=headers)
                return response.status_code == 200
        except Exception as e:
            logger.error(f"Anthropic health check failed: {e}")
            return False
