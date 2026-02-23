"""
Zaytri — Circuit Breaker for LLM Providers
Prevents cascading failures by temporarily disabling failing providers.

States:
  CLOSED  → Normal operation, requests pass through
  OPEN    → Provider disabled, skip to next
  HALF_OPEN → One test request allowed after cooldown
"""

import time
import logging
from enum import Enum

logger = logging.getLogger(__name__)


class CircuitState(Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitBreaker:
    """
    Per-provider circuit breaker.

    After `failure_threshold` consecutive failures, the circuit opens
    and the provider is skipped for `cooldown_seconds`. After cooldown,
    one test request is allowed (half-open). If it succeeds, the circuit
    closes. If it fails, the circuit reopens.
    """

    def __init__(
        self,
        provider_name: str,
        failure_threshold: int = 5,
        cooldown_seconds: float = 60.0,
    ):
        self.provider_name = provider_name
        self.failure_threshold = failure_threshold
        self.cooldown_seconds = cooldown_seconds

        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._last_failure_time = 0.0
        self._success_count = 0

    @property
    def state(self) -> CircuitState:
        """Current state, accounting for cooldown expiry."""
        if self._state == CircuitState.OPEN:
            elapsed = time.monotonic() - self._last_failure_time
            if elapsed >= self.cooldown_seconds:
                self._state = CircuitState.HALF_OPEN
                logger.info(
                    f"[CircuitBreaker] {self.provider_name}: OPEN → HALF_OPEN "
                    f"(cooldown {self.cooldown_seconds}s expired)"
                )
        return self._state

    @property
    def is_open(self) -> bool:
        """True if the provider should be skipped."""
        return self.state == CircuitState.OPEN

    @property
    def is_half_open(self) -> bool:
        return self.state == CircuitState.HALF_OPEN

    def record_success(self):
        """Record a successful request. Closes the circuit if half-open."""
        if self._state in (CircuitState.HALF_OPEN, CircuitState.OPEN):
            logger.info(
                f"[CircuitBreaker] {self.provider_name}: {self._state.value} → CLOSED"
            )
        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._success_count += 1

    def record_failure(self):
        """Record a failed request. Opens the circuit after threshold."""
        self._failure_count += 1
        self._last_failure_time = time.monotonic()

        if self._state == CircuitState.HALF_OPEN:
            # Test request failed → reopen
            self._state = CircuitState.OPEN
            logger.warning(
                f"[CircuitBreaker] {self.provider_name}: HALF_OPEN → OPEN "
                f"(test request failed)"
            )
        elif self._failure_count >= self.failure_threshold:
            self._state = CircuitState.OPEN
            logger.warning(
                f"[CircuitBreaker] {self.provider_name}: CLOSED → OPEN "
                f"({self._failure_count} consecutive failures)"
            )

    def reset(self):
        """Force-reset to closed state."""
        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._success_count = 0

    def stats(self) -> dict:
        """Return current breaker stats for monitoring."""
        return {
            "provider": self.provider_name,
            "state": self.state.value,
            "failure_count": self._failure_count,
            "success_count": self._success_count,
            "threshold": self.failure_threshold,
            "cooldown_seconds": self.cooldown_seconds,
        }
