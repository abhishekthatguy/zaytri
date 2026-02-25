"""
Zaytri — Central Model Registration

This module MUST be imported before any SQLAlchemy ORM session or query is created.
It ensures all models are registered with Base.metadata and all relationship()
string references (e.g. "SocialConnection", "User", "Content") are resolvable
before SQLAlchemy's mapper configuration runs.

Usage:
    import db.register_models  # noqa: F401  — MUST be first DB-related import

Why this exists:
    SQLAlchemy resolves relationship("ClassName") lazily, but the target class
    must be registered in the same MetaData/registry BEFORE the mapper is
    configured (which happens on first ORM query). If models are imported in
    the wrong order, you get:
        sqlalchemy.exc.InvalidRequestError: ... expression 'SocialConnection'
        failed to locate a name ...
    (Background: https://sqlalche.me/e/20/gkpj)

The fix: import every model module here, then call configure_mappers() to
eagerly resolve all relationships upfront.
"""

# ─── Step 1: Import all model modules in dependency order ────────────────────
# Base models (no foreign relationships to other app models)
import auth.models  # noqa: F401  — User, OAuth, OTP
import db.models  # noqa: F401  — Content, ContentStatus

# Models referenced by relationship() strings in other models
import db.social_connections  # noqa: F401  — SocialConnection (referenced by BrandSettings & User)

# Models that USE relationship() strings pointing to the above
import db.settings_models  # noqa: F401  — BrandSettings, KnowledgeSource, DocumentEmbedding, ChatMessage

# Remaining models (order doesn't matter as long as the above are done)
import db.whatsapp_approval  # noqa: F401  — WhatsAppApproval
import db.calendar_models  # noqa: F401  — CalendarUpload, CalendarEntry
import db.task_models  # noqa: F401  — TaskExecution

# ─── Step 2: Eagerly configure all mappers ───────────────────────────────────
# This resolves ALL relationship() string references NOW, not lazily on first query.
# If any reference is missing, this will fail LOUDLY at import time, not silently
# during a commit() deep in the application.
from sqlalchemy.orm import configure_mappers

configure_mappers()
