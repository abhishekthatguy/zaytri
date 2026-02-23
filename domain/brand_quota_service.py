"""
Zaytri — Brand Quota Service (Domain Layer)
Per-brand rate limiting to prevent resource overuse.
"""

import time
from collections import defaultdict
from typing import Dict, Optional

from infra.logging import get_logger

logger = get_logger("domain.brand_quota_service")


class BrandQuotaService:
    """
    Tracks LLM request count and token usage per brand.
    Prevents a single brand from consuming all resources.

    Uses in-memory counters with sliding window.
    For production scale, migrate to Redis.
    """

    def __init__(
        self,
        max_requests_per_minute: int = 30,
        max_tokens_per_minute: int = 50000,
    ):
        self.max_requests_per_minute = max_requests_per_minute
        self.max_tokens_per_minute = max_tokens_per_minute

        # brand_id → list of (timestamp, token_count)
        self._usage: Dict[str, list] = defaultdict(list)

    def _cleanup_window(self, brand_id: str):
        """Remove entries older than 60 seconds."""
        cutoff = time.monotonic() - 60.0
        self._usage[brand_id] = [
            (ts, tokens) for ts, tokens in self._usage[brand_id]
            if ts > cutoff
        ]

    def check_quota(self, brand_id: str) -> bool:
        """
        Check if a brand is within its quota.
        Returns True if the brand can make another request.
        """
        if not brand_id:
            return True  # No brand = no limit (backwards compat)

        self._cleanup_window(brand_id)
        entries = self._usage[brand_id]

        request_count = len(entries)
        token_count = sum(t for _, t in entries)

        if request_count >= self.max_requests_per_minute:
            logger.warning(
                f"Brand {brand_id[:8]} rate limited: "
                f"{request_count}/{self.max_requests_per_minute} requests/min"
            )
            return False

        if token_count >= self.max_tokens_per_minute:
            logger.warning(
                f"Brand {brand_id[:8]} token limited: "
                f"{token_count}/{self.max_tokens_per_minute} tokens/min"
            )
            return False

        return True

    def record_usage(self, brand_id: str, tokens_used: int = 0):
        """Record a request and its token usage."""
        if not brand_id:
            return
        self._usage[brand_id].append((time.monotonic(), tokens_used))

    def get_usage(self, brand_id: str) -> Dict[str, int]:
        """Get current window usage stats for a brand."""
        self._cleanup_window(brand_id)
        entries = self._usage.get(brand_id, [])
        return {
            "requests_in_window": len(entries),
            "tokens_in_window": sum(t for _, t in entries),
            "max_requests": self.max_requests_per_minute,
            "max_tokens": self.max_tokens_per_minute,
        }
