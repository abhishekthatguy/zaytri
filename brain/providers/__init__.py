"""
Zaytri — LLM Provider Abstraction
Base class for all LLM providers (Ollama, OpenAI, Gemini, Anthropic, Groq).
"""

import json
import logging
from abc import ABC, abstractmethod
from typing import Optional

logger = logging.getLogger(__name__)


class BaseLLMProvider(ABC):
    """Abstract base class for LLM providers."""

    provider_name: str = "base"

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        json_mode: bool = False,
    ) -> str:
        """Generate a text completion."""
        pass

    async def generate_json(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
    ) -> dict:
        """Generate and parse a JSON response."""
        raw = await self.generate(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=temperature,
            json_mode=True,
        )
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            logger.warning(f"[{self.provider_name}] Failed to parse JSON, attempting extraction...")
            if "```json" in raw:
                raw = raw.split("```json")[1].split("```")[0].strip()
            elif "```" in raw:
                raw = raw.split("```")[1].split("```")[0].strip()
            return json.loads(raw)

    @abstractmethod
    async def health_check(self) -> bool:
        """Check if the provider is reachable and functional."""
        pass
