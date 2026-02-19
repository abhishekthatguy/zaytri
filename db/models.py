"""
Zaytri — Database Models
All SQLAlchemy ORM models for content, schedules, analytics, and engagement.
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
import enum


# ─── Enums ───────────────────────────────────────────────────────────────────

class ContentStatus(str, enum.Enum):
    DRAFT = "draft"
    REVIEWED = "reviewed"
    APPROVED = "approved"
    SCHEDULED = "scheduled"
    PUBLISHED = "published"
    FAILED = "failed"


class Platform(str, enum.Enum):
    INSTAGRAM = "instagram"
    FACEBOOK = "facebook"
    TWITTER = "twitter"
    YOUTUBE = "youtube"
    LINKEDIN = "linkedin"
    REDDIT = "reddit"
    MEDIUM = "medium"
    BLOGGER = "blogger"
    GMAIL = "gmail"


class PublishMode(str, enum.Enum):
    """How content gets published: manually by user, scheduled, or via AI agent."""
    MANUAL = "manual"          # User clicks "Publish Now"
    SCHEDULED = "scheduled"    # User sets a date/time
    AI_AGENT = "ai_agent"      # AI agent decides when to publish


# ─── Content Model ──────────────────────────────────────────────────────────

class Content(Base):
    __tablename__ = "contents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    topic = Column(String(500), nullable=False)
    platform = Column(SAEnum(Platform), nullable=False)
    tone = Column(String(100), nullable=False, default="professional")

    # Generated content
    caption = Column(Text, nullable=True)
    hook = Column(Text, nullable=True)
    cta = Column(Text, nullable=True)
    post_text = Column(Text, nullable=True)

    # Hashtags
    niche_hashtags = Column(JSON, nullable=True)  # list of strings
    broad_hashtags = Column(JSON, nullable=True)  # list of strings

    # Review
    review_score = Column(Float, nullable=True)
    review_feedback = Column(Text, nullable=True)
    improved_text = Column(Text, nullable=True)

    # Status & Publish Mode
    status = Column(SAEnum(ContentStatus), default=ContentStatus.DRAFT, nullable=False)
    publish_mode = Column(SAEnum(PublishMode), default=PublishMode.MANUAL, nullable=False)

    # Target social account (which connected account to publish to)
    social_connection_id = Column(UUID(as_uuid=True), ForeignKey("social_connections.id"), nullable=True)

    # Metadata
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    schedules = relationship("Schedule", back_populates="content", cascade="all, delete-orphan")
    analytics = relationship("AnalyticsRecord", back_populates="content", cascade="all, delete-orphan")
    engagements = relationship("EngagementLog", back_populates="content", cascade="all, delete-orphan")
    social_connection = relationship("SocialConnection", back_populates="contents")


# ─── Schedule Model ─────────────────────────────────────────────────────────

class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    content_id = Column(UUID(as_uuid=True), ForeignKey("contents.id"), nullable=False)
    platform = Column(SAEnum(Platform), nullable=False)
    scheduled_at = Column(DateTime, nullable=False)
    published_at = Column(DateTime, nullable=True)
    is_published = Column(Boolean, default=False)
    platform_post_id = Column(String(255), nullable=True)  # ID returned by platform after publish
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    content = relationship("Content", back_populates="schedules")


# ─── Analytics Record ───────────────────────────────────────────────────────

class AnalyticsRecord(Base):
    __tablename__ = "analytics_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    content_id = Column(UUID(as_uuid=True), ForeignKey("contents.id"), nullable=False)
    platform = Column(SAEnum(Platform), nullable=False)

    likes = Column(Integer, default=0)
    comments = Column(Integer, default=0)
    shares = Column(Integer, default=0)
    reach = Column(Integer, default=0)
    impressions = Column(Integer, default=0)
    engagement_rate = Column(Float, default=0.0)

    fetched_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    content = relationship("Content", back_populates="analytics")


# ─── Engagement Log ─────────────────────────────────────────────────────────

class EngagementLog(Base):
    __tablename__ = "engagement_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    content_id = Column(UUID(as_uuid=True), ForeignKey("contents.id"), nullable=False)
    platform = Column(SAEnum(Platform), nullable=False)

    comment_id = Column(String(255), nullable=True)
    comment_text = Column(Text, nullable=True)
    reply_text = Column(Text, nullable=True)
    is_auto_replied = Column(Boolean, default=False)
    is_flagged = Column(Boolean, default=False)  # sensitive/spam
    flag_reason = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    content = relationship("Content", back_populates="engagements")
