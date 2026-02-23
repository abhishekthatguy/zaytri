"""
Zaytri — Social Connection Models
OAuth-connected social media accounts with multi-account support.
"""

import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Text, Boolean, DateTime,
    ForeignKey, Enum as SAEnum, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from db.database import Base
from db.base_enums import Platform


class SocialConnection(Base):
    """
    Stores OAuth tokens for connected social media accounts.
    A user can connect multiple accounts per platform.
    """
    __tablename__ = "social_connections"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Platform identity
    platform = Column(SAEnum(Platform), nullable=False)
    platform_account_id = Column(String(255), nullable=False)    # Platform-specific user/page ID
    platform_username = Column(String(255), nullable=True)        # Display name (e.g. @handle)
    platform_avatar_url = Column(String(500), nullable=True)      # Profile picture URL
    account_type = Column(String(50), nullable=True)              # "personal", "page", "business", etc.

    # OAuth tokens (encrypted at rest via application-level encryption)
    access_token_encrypted = Column(Text, nullable=False)
    refresh_token_encrypted = Column(Text, nullable=True)
    token_expires_at = Column(DateTime, nullable=True)
    scopes = Column(Text, nullable=True)                          # Comma-separated scopes granted

    # Status
    is_active = Column(Boolean, default=True)
    last_error = Column(Text, nullable=True)                      # Last error message (e.g. token expired)

    # Timestamps
    connected_at = Column(DateTime, default=datetime.utcnow)
    last_used_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Constraints: one user can't connect the same platform account twice
    __table_args__ = (
        UniqueConstraint(
            "user_id", "platform", "platform_account_id",
            name="uq_user_platform_account"
        ),
    )

    # Relationships
    user = relationship("User", back_populates="social_connections")
    contents = relationship("Content", back_populates="social_connection")
