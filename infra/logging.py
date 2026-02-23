"""
Zaytri — Structured Logging with Async-Safe Context Propagation
Carries request_id, task_id, brand_id, agent_name through the entire call stack.
"""

import logging
import uuid
from contextvars import ContextVar
from typing import Optional

# ─── Context Variables (async-safe) ──────────────────────────────────────────
_request_id: ContextVar[Optional[str]] = ContextVar("request_id", default=None)
_task_id: ContextVar[Optional[str]] = ContextVar("task_id", default=None)
_brand_id: ContextVar[Optional[str]] = ContextVar("brand_id", default=None)
_agent_name: ContextVar[Optional[str]] = ContextVar("agent_name", default=None)


def set_request_id(rid: Optional[str] = None) -> str:
    """Set request_id for the current async context. Auto-generates if None."""
    rid = rid or str(uuid.uuid4())[:8]
    _request_id.set(rid)
    return rid


def set_task_context(
    task_id: Optional[str] = None,
    brand_id: Optional[str] = None,
    agent_name: Optional[str] = None,
):
    """Set task-level context for structured logging."""
    if task_id:
        _task_id.set(task_id)
    if brand_id:
        _brand_id.set(brand_id)
    if agent_name:
        _agent_name.set(agent_name)


def clear_context():
    """Reset all context vars (call at end of request)."""
    _request_id.set(None)
    _task_id.set(None)
    _brand_id.set(None)
    _agent_name.set(None)


# ─── Structured Log Formatter ────────────────────────────────────────────────

class ZaytriLogFormatter(logging.Formatter):
    """
    Injects request_id, task_id, brand_id, agent_name into every log line.
    Format: 2026-02-23 01:50:00 | INFO     | req=abc12345 | task=uuid | brand=MyBrand | agent=ContentAgent | message
    """

    def format(self, record: logging.LogRecord) -> str:
        parts = [
            self.formatTime(record, self.datefmt),
            f"| {record.levelname:<8}",
        ]

        rid = _request_id.get()
        tid = _task_id.get()
        bid = _brand_id.get()
        agent = _agent_name.get()

        if rid:
            parts.append(f"| req={rid}")
        if tid:
            parts.append(f"| task={tid[:8]}")
        if bid:
            parts.append(f"| brand={bid[:8]}")
        if agent:
            parts.append(f"| agent={agent}")

        parts.append(f"| {record.name}")
        parts.append(f"| {record.getMessage()}")

        return " ".join(parts)


def setup_logging(level: str = "INFO"):
    """Configure root logger with ZaytriLogFormatter."""
    handler = logging.StreamHandler()
    handler.setFormatter(ZaytriLogFormatter(datefmt="%Y-%m-%d %H:%M:%S"))
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(getattr(logging, level.upper(), logging.INFO))


def get_logger(name: str) -> logging.Logger:
    """Get a named logger (convenience wrapper)."""
    return logging.getLogger(f"zaytri.{name}")
