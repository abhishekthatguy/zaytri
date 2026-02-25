"""
Zaytri — LLM Load Balancer & Fallback Handler
Manages multiple LLM providers with rate limiting, circuit breaker, and automatic fallback logic.
"""

import asyncio
import logging
import time
from typing import List, Optional, Any, Dict
from brain.providers import BaseLLMProvider
from brain.providers.circuit_breaker import CircuitBreaker

logger = logging.getLogger(__name__)

class RateLimiter:
    """Simple token-bucket rate limiter."""
    def __init__(self, requests_per_minute: int):
        self.requests_per_minute = requests_per_minute
        self.interval = 60.0 / requests_per_minute if requests_per_minute > 0 else 0
        self.last_request_time = 0.0

    async def wait(self):
        if self.interval <= 0:
            return
        
        now = time.time()
        elapsed = now - self.last_request_time
        if elapsed < self.interval:
            wait_time = self.interval - elapsed
            await asyncio.sleep(wait_time)
        
        self.last_request_time = time.time()

class LoadBalancerProvider(BaseLLMProvider):
    """
    Load balances and handles fallbacks across multiple LLM providers.
    Integrates per-provider circuit breakers to prevent cascading failures.
    """
    
    provider_name = "load_balancer"

    def __init__(
        self,
        providers: List[BaseLLMProvider],
        requests_per_minute: int = 60,
        max_retries: int = 2,
        circuit_failure_threshold: int = 5,
        circuit_cooldown_seconds: float = 60.0,
    ):
        self.providers = providers
        self.rate_limiter = RateLimiter(requests_per_minute)
        self.max_retries = max_retries
        self._current_index = 0

        # Per-provider circuit breakers
        self._breakers: Dict[str, CircuitBreaker] = {}
        for p in providers:
            key = f"{p.provider_name}:{getattr(p, 'model', 'default')}"
            self._breakers[key] = CircuitBreaker(
                provider_name=key,
                failure_threshold=circuit_failure_threshold,
                cooldown_seconds=circuit_cooldown_seconds,
            )

    def _get_breaker(self, provider: BaseLLMProvider) -> CircuitBreaker:
        """Get the circuit breaker for a provider."""
        key = f"{provider.provider_name}:{getattr(provider, 'model', 'default')}"
        return self._breakers[key]

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        json_mode: bool = False,
    ) -> str:
        last_error = None
        
        for i, provider in enumerate(self.providers):
            breaker = self._get_breaker(provider)

            # Skip providers with open circuits
            if breaker.is_open:
                logger.info(
                    f"[LoadBalancer] Skipping {provider.provider_name} — circuit OPEN"
                )
                continue

            for retry in range(self.max_retries + 1):
                try:
                    await self.rate_limiter.wait()
                    logger.info(
                        f"[LoadBalancer] Attempting {provider.provider_name} "
                        f"(circuit: {breaker.state.value}, attempt {retry+1})"
                    )
                    result = await provider.generate(
                        prompt=prompt,
                        system_prompt=system_prompt,
                        temperature=temperature,
                        max_tokens=max_tokens,
                        json_mode=json_mode
                    )
                    breaker.record_success()
                    return result
                except Exception as e:
                    last_error = e
                    breaker.record_failure()
                    
                    # Optimization: If the error is a 404 (model missing), don't retry this provider
                    error_str = str(e).lower()
                    if "404" in error_str or "not found" in error_str:
                        logger.warning(
                            f"[LoadBalancer] {provider.provider_name} missing model or endpoint (404). "
                            "Skipping retries for this provider."
                        )
                        break

                    logger.warning(
                        f"[LoadBalancer] {provider.provider_name} failed "
                        f"(attempt {retry+1}): {e}"
                    )
                    if retry < self.max_retries:
                        await asyncio.sleep(2 ** retry)
                    else:
                        break
            
            logger.error(
                f"[LoadBalancer] {provider.provider_name} exhausted "
                f"(circuit: {breaker.state.value}). Falling back..."
            )
        
        raise Exception(f"All LLM providers failed. Last error: {last_error}")

    async def health_check(self) -> bool:
        """Check if at least one provider is healthy and circuit-closed."""
        for provider in self.providers:
            breaker = self._get_breaker(provider)
            if not breaker.is_open and await provider.health_check():
                return True
        return False

    def get_circuit_stats(self) -> List[dict]:
        """Get circuit breaker stats for all providers."""
        return [b.stats() for b in self._breakers.values()]

