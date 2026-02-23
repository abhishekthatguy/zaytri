"""
Zaytri — Settings Database Models
Models for user-configurable settings: cron schedules, platform credentials, Google Drive.
"""

import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Text, Integer, Float, Boolean,
    DateTime, ForeignKey, Enum as SAEnum, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from db.database import Base
from db.base_enums import Platform


# ─── User Settings (Cron Schedules) ─────────────────────────────────────────

class UserSettings(Base):
    """Per-user cron schedule and general settings."""
    __tablename__ = "user_settings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)

    # Scheduler Bot cron
    scheduler_hour = Column(Integer, default=9)
    scheduler_minute = Column(Integer, default=0)

    # Engagement Bot
    engagement_delay_hours = Column(Integer, default=2)

    # Analytics Agent cron
    analytics_day_of_week = Column(Integer, default=1)  # 1 = Monday
    analytics_hour = Column(Integer, default=8)
    analytics_minute = Column(Integer, default=0)

    # Timezone
    timezone = Column(String(100), default="Asia/Kolkata")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# ─── Brand Settings (RAG Memory) ─────────────────────────────────────────────

class BrandSettings(Base):
    """Brand identity, tone, and memory for RAG context."""
    __tablename__ = "brand_settings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    brand_name = Column(String(255), nullable=False)
    target_audience = Column(Text, nullable=True)
    brand_tone = Column(String(255), nullable=True, default="professional")
    brand_guidelines = Column(Text, nullable=True) # Rules, 'do not say' etc
    core_values = Column(Text, nullable=True)
    
    # Allows multi-tenant isolation per brand
    __table_args__ = (
        UniqueConstraint("user_id", "brand_name", name="uq_user_brand"),
    )

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ─── Platform Credentials ───────────────────────────────────────────────────

class PlatformCredential(Base):
    """Encrypted API credentials per platform per user."""
    __tablename__ = "platform_credentials"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    platform = Column(SAEnum(Platform), nullable=False)

    # Encrypted JSON blob of all credentials for this platform
    encrypted_credentials = Column(Text, nullable=False)

    is_active = Column(Boolean, default=True)
    last_tested_at = Column(DateTime, nullable=True)
    test_status = Column(String(50), nullable=True)  # "connected" | "failed" | null

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("user_id", "platform", name="uq_user_platform"),
    )


# ─── Google Drive Configuration ─────────────────────────────────────────────

class GoogleDriveConfig(Base):
    """Google Drive folder connection per user."""
    __tablename__ = "google_drive_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)

    folder_url = Column(String(500), nullable=True)
    folder_id = Column(String(255), nullable=True)  # Extracted from URL

    # OAuth tokens (encrypted)
    encrypted_tokens = Column(Text, nullable=True)

    is_connected = Column(Boolean, default=False)
    last_synced_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ─── LLM Provider Configuration ────────────────────────────────────────────

class LLMProviderConfig(Base):
    """API keys and settings for each LLM provider."""
    __tablename__ = "llm_provider_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider = Column(String(50), unique=True, nullable=False)  # ollama, openai, gemini, anthropic, groq
    api_key_encrypted = Column(Text, nullable=True)  # Encrypted API key (null for ollama)
    is_enabled = Column(Boolean, default=True)
    last_tested_at = Column(DateTime, nullable=True)
    test_status = Column(String(50), nullable=True)  # "connected" | "failed" | null

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AgentModelConfig(Base):
    """Per-agent LLM provider and model assignment."""
    __tablename__ = "agent_model_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(String(50), unique=True, nullable=False)  # e.g. "content_creator"
    provider = Column(String(50), nullable=False, default="ollama")
    model = Column(String(100), nullable=False, default="llama3")
    is_custom = Column(Boolean, default=False)  # False = using default, True = user overrode

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ─── Chat Messages (Master Agent) ──────────────────────────────────────────

class ChatMessage(Base):
    """Conversation messages between users and the Master Agent."""
    __tablename__ = "chat_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(String(50), nullable=False, index=True)
    user_id = Column(String(50), nullable=False, index=True)
    role = Column(String(20), nullable=False)  # "user" | "assistant"
    content = Column(Text, nullable=False)
    intent = Column(String(50), nullable=True)  # Classified intent (assistant only)
    model_used = Column(String(100), nullable=True)
    token_cost = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
