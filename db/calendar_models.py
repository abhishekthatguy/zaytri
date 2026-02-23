"""
Zaytri — Calendar Database Models
Models for content calendar uploads, parsed entries, and pipeline tracking.
"""

import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Text, Integer, Float, Boolean,
    DateTime, ForeignKey, JSON, Enum as SAEnum,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from db.database import Base
from db.base_enums import Platform
import enum


# ─── Enums ───────────────────────────────────────────────────────────────────

class CalendarSourceType(str, enum.Enum):
    CSV_FILE = "csv_file"
    GOOGLE_SHEET = "google_sheet"
    GOOGLE_DOC = "google_doc"
    JSON_FILE = "json_file"
    MANUAL = "manual"


class CalendarEntryStatus(str, enum.Enum):
    PENDING = "pending"
    QUEUED = "queued"
    CONTENT_GENERATED = "content_generated"
    REVIEW_PASSED = "review_passed"
    APPROVAL_SENT = "approval_sent"
    APPROVED = "approved"
    REJECTED = "rejected"
    SCHEDULED = "scheduled"
    PUBLISHED = "published"
    FAILED = "failed"


class PipelineStage(str, enum.Enum):
    PARSED = "parsed"
    CONTENT_CREATION = "content_creation"
    HASHTAG_GENERATION = "hashtag_generation"
    REVIEW = "review"
    APPROVAL = "approval"
    SCHEDULING = "scheduling"
    PUBLISHING = "publishing"
    ENGAGEMENT = "engagement"
    ANALYTICS = "analytics"
    COMPLETED = "completed"
    FAILED = "failed"


# ─── Calendar Upload ────────────────────────────────────────────────────────

class CalendarUpload(Base):
    """Represents a single calendar file upload or Google Sheet connection."""
    __tablename__ = "calendar_uploads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)  # User-friendly name

    source_type = Column(SAEnum(CalendarSourceType), nullable=False)
    source_url = Column(String(1000), nullable=True)  # For Google Sheets/Docs
    original_filename = Column(String(255), nullable=True)

    # Parsing results
    total_rows = Column(Integer, default=0)
    parsed_rows = Column(Integer, default=0)
    failed_rows = Column(Integer, default=0)
    parse_errors = Column(JSON, nullable=True)  # List of error strings

    # Status
    is_processed = Column(Boolean, default=False)
    processed_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    entries = relationship("CalendarEntry", back_populates="upload", cascade="all, delete-orphan")


# ─── Calendar Entry ─────────────────────────────────────────────────────────

class CalendarEntry(Base):
    """
    A single parsed row from a content calendar.
    Each entry maps to one content piece (may publish to multiple platforms).
    """
    __tablename__ = "calendar_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    upload_id = Column(UUID(as_uuid=True), ForeignKey("calendar_uploads.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # Calendar Data (from parsed row)
    row_number = Column(Integer, nullable=True)
    date = Column(String(50), nullable=True)  # Original date from calendar
    scheduled_date = Column(DateTime, nullable=True)  # Parsed datetime
    brand = Column(String(255), nullable=True)
    content_type = Column(String(100), nullable=True)  # Build in Public, Deep Dive, etc.
    topic = Column(String(500), nullable=False)
    tone = Column(String(100), default="professional")
    cta = Column(Text, nullable=True)  # From sheet or AI-generated
    link = Column(String(1000), nullable=True)  # From sheet

    # Platform routing (parsed from "LinkedIn, X, Instagram" → JSON list)
    platforms = Column(JSON, nullable=False, default=list)  # ["linkedin", "twitter", "instagram"]

    # Hashtags
    default_hashtags = Column(JSON, nullable=True)   # From sheet
    generated_hashtags = Column(JSON, nullable=True)  # AI-generated

    # Approval
    approval_required = Column(Boolean, default=False)

    # Model assignment (optional per-entry override)
    model_provider = Column(String(50), nullable=True)
    model_name = Column(String(100), nullable=True)

    # Pipeline tracking
    status = Column(SAEnum(CalendarEntryStatus), default=CalendarEntryStatus.PENDING)
    pipeline_stage = Column(SAEnum(PipelineStage), default=PipelineStage.PARSED)
    pipeline_errors = Column(JSON, nullable=True)  # List of error strings per stage

    # Generated content (linked to Content model)
    content_ids = Column(JSON, nullable=True)  # UUIDs of generated Content records

    # Raw data (original row for debugging)
    raw_data = Column(JSON, nullable=True)

    # Notes
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    upload = relationship("CalendarUpload", back_populates="entries")
