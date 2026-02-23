"""
Zaytri — User Memory (Orchestration Layer)
Per-user interaction pattern tracking for LLM personalization.
Extracted from master_agent.py UserMemory class + singleton.
"""

from collections import Counter, defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional


class UserMemory:
    """
    In-memory tracker for per-user interaction patterns.
    Stores intent frequency, preferred language, and interaction history
    to personalize responses over time.

    NOTE: This is a lightweight in-process cache. For persistence across
    restarts, the ChatMessage table serves as the durable store and can
    be loaded on demand.
    """

    def __init__(self):
        self._store: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
            "intent_counts": Counter(),
            "topics": [],
            "last_language": "en",
            "message_count": 0,
            "first_seen": None,
            "last_seen": None,
            "preferred_platform": None,
            "preferred_tone": None,
        })

    def record_interaction(
        self,
        user_id: str,
        intent: str,
        message: str,
        params: Optional[dict] = None,
    ):
        """Record an interaction for pattern tracking."""
        mem = self._store[user_id]
        now = datetime.utcnow()

        mem["intent_counts"][intent] += 1
        mem["message_count"] += 1
        mem["last_seen"] = now

        if mem["first_seen"] is None:
            mem["first_seen"] = now

        if params and "topic" in params:
            mem["topics"].append(params["topic"])
            mem["topics"] = mem["topics"][-50:]

        if params:
            if "platform" in params:
                mem["preferred_platform"] = params["platform"]
            if "tone" in params:
                mem["preferred_tone"] = params["tone"]

    def get_context(self, user_id: str) -> str:
        """Get a brief context string about the user for the LLM."""
        mem = self._store[user_id]
        if mem["message_count"] == 0:
            return ""

        parts = [f"User has sent {mem['message_count']} messages."]

        top = mem["intent_counts"].most_common(3)
        if top:
            intent_str = ", ".join(f"{k}({v})" for k, v in top)
            parts.append(f"Frequent intents: {intent_str}.")

        if mem["topics"]:
            recent = mem["topics"][-3:]
            parts.append(f"Recent topics: {', '.join(recent)}.")

        if mem["preferred_platform"]:
            parts.append(f"Preferred platform: {mem['preferred_platform']}.")
        if mem["preferred_tone"]:
            parts.append(f"Preferred tone: {mem['preferred_tone']}.")

        return " ".join(parts)

    def get_stats(self, user_id: str) -> dict:
        """Return raw stats for a user."""
        mem = self._store[user_id]
        return {
            "message_count": mem["message_count"],
            "top_intents": dict(mem["intent_counts"].most_common(5)),
            "recent_topics": mem["topics"][-5:],
            "preferred_platform": mem["preferred_platform"],
            "preferred_tone": mem["preferred_tone"],
            "first_seen": mem["first_seen"].isoformat() if mem["first_seen"] else None,
            "last_seen": mem["last_seen"].isoformat() if mem["last_seen"] else None,
        }
