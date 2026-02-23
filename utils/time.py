"""
Zaytri — Time Utilities
Consolidated time handling to avoid deprecation warnings and ensure consistency.
"""

from datetime import datetime, timezone

def utc_now() -> datetime:
    """
    Get current UTC time.
    Returns a naive datetime object representing UTC time, 
    to maintain compatibility with existing SQLAlchemy columns.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)

def utc_now_aware() -> datetime:
    """Get current UTC time with timezone awareness."""
    return datetime.now(timezone.utc)
