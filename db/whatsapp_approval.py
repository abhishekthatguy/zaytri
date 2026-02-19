"""
Zaytri — WhatsApp Approval Model
Tracks content approval requests sent via WhatsApp Business API.
"""

import uuid
import enum
from datetime import datetime
from sqlalchemy import (
    Column, String, Text, Boolean, DateTime,
    ForeignKey, Enum as SAEnum,
)
from sqlalchemy.dialects.postgresql import UUID
from db.database import Base


class ApprovalStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"


class WhatsAppApproval(Base):
    """Tracks content approval requests sent via WhatsApp."""
    __tablename__ = "whatsapp_approvals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    content_id = Column(UUID(as_uuid=True), ForeignKey("contents.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # WhatsApp message tracking
    whatsapp_message_id = Column(String(255), nullable=True)  # Message ID from WA API
    phone_number = Column(String(50), nullable=False)         # Recipient phone

    # Approval state
    status = Column(SAEnum(ApprovalStatus), default=ApprovalStatus.PENDING, nullable=False)
    approval_token = Column(String(100), nullable=False, unique=True)  # Used in callback URL

    # Timestamps
    sent_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    responded_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)

    # Response details
    response_text = Column(Text, nullable=True)  # Any message the user typed back
