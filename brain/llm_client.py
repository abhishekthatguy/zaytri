"""
Zaytri — Ollama LLM Client
Async wrapper around the Ollama HTTP API for local LLM inference.
"""

import json
import logging
import httpx
from typing import Optional
from config import settings

logger = logging.getLogger(__name__)

# ─── Default generation parameters ──────────────────────────────────────────
DEFAULT_TEMPERATURE = 0.7
DEFAULT_MAX_TOKENS = 1024
REQUEST_TIMEOUT = 45.0  # seconds — keep short to fail fast to fallback providers
MAX_RETRIES = 2


class OllamaClient:
    """Async client for Ollama local LLM API."""

    def __init__(
        self,
        host: Optional[str] = None,
        model: Optional[str] = None,
    ):
        self.host = (host or settings.ollama_host).rstrip("/")
        self.model = model or settings.ollama_model
        self.base_url = f"{self.host}/api"

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = DEFAULT_TEMPERATURE,
        max_tokens: int = DEFAULT_MAX_TOKENS,
        json_mode: bool = False,
    ) -> str:
        """
        Generate a completion from the Ollama LLM.

        Args:
            prompt: The user prompt
            system_prompt: Optional system-level instruction
            temperature: Creativity control (0.0 - 1.0)
            max_tokens: Maximum tokens in response
            json_mode: If True, request JSON-formatted output

        Returns:
            The generated text response
        """
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
                    response = await client.post(
                        f"{self.base_url}/generate",
                        json=payload,
                    )
                    response.raise_for_status()
                    data = response.json()
                    return data.get("response", "").strip()

            except httpx.TimeoutException as e:
                last_error = e
                logger.warning(f"Ollama timeout (attempt {attempt}/{MAX_RETRIES}): {e}")
            except httpx.HTTPStatusError as e:
                last_error = e
                logger.error(f"Ollama HTTP error: {e.response.status_code} — {e.response.text}")
                raise
            except Exception as e:
                last_error = e
                logger.error(f"Ollama error (attempt {attempt}/{MAX_RETRIES}): {e}")

        raise ConnectionError(f"Failed to connect to Ollama after {MAX_RETRIES} attempts: {last_error}")

    async def generate_json(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = DEFAULT_TEMPERATURE,
    ) -> dict:
        """Generate and parse a JSON response from the LLM."""
        raw = await self.generate(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=temperature,
            json_mode=True,
        )
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse JSON from LLM, attempting extraction...")
            # Try to extract JSON from markdown code blocks
            if "```json" in raw:
                raw = raw.split("```json")[1].split("```")[0].strip()
            elif "```" in raw:
                raw = raw.split("```")[1].split("```")[0].strip()
            return json.loads(raw)

    async def chat(
        self,
        messages: list[dict],
        temperature: float = DEFAULT_TEMPERATURE,
        json_mode: bool = False,
    ) -> str:
        """
        Chat-style completion using Ollama's /api/chat endpoint.

        Args:
            messages: List of {"role": "system"|"user"|"assistant", "content": "..."}
            temperature: Creativity control
            json_mode: Request JSON output

        Returns:
            The assistant's response text
        """
        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": temperature,
            },
        }

        if json_mode:
            payload["format"] = "json"

        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            response = await client.post(
                f"{self.base_url}/chat",
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
            return data.get("message", {}).get("content", "").strip()

    async def health_check(self) -> bool:
        """Check if Ollama is running and the model is available."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.host}/api/tags")
                response.raise_for_status()
                models = response.json().get("models", [])
                available = [m["name"] for m in models]
                if self.model in available or any(self.model in m for m in available):
                    return True
                logger.warning(f"Model '{self.model}' not found. Available: {available}")
                return False
        except Exception as e:
            logger.error(f"Ollama health check failed: {e}")
            return False


# ─── Singleton ──────────────────────────────────────────────────────────────
llm = OllamaClient()
