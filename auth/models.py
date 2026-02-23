"""
Zaytri — Auth Models
User model with OAuth, OTP, 2FA, password reset, and login tracking.
"""

import uuid
import enum
from datetime import datetime
from sqlalchemy import (
    Column, String, Text, Boolean, DateTime, Integer,
    ForeignKey, Enum as SAEnum, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from db.database import Base
from utils.time import utc_now


# ─── Enums ───────────────────────────────────────────────────────────────────

class OAuthProvider(str, enum.Enum):
    GOOGLE = "google"
    FACEBOOK = "facebook"
    GITHUB = "github"
    TWITTER = "twitter"


class OTPPurpose(str, enum.Enum):
    LOGIN = "login"
    SIGNUP = "signup"
    PASSWORD_RESET = "password_reset"
    VERIFY_EMAIL = "verify_email"
    VERIFY_PHONE = "verify_phone"


# ─── User Model ──────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(20), unique=True, nullable=True, index=True)
    hashed_password = Column(String(255), nullable=False)

    # Profile
    display_name = Column(String(200), nullable=True)
    avatar_url = Column(String(500), nullable=True)

    # Status
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    is_email_verified = Column(Boolean, default=False)
    is_phone_verified = Column(Boolean, default=False)

    # 2FA
    totp_secret = Column(String(64), nullable=True)   # encrypted TOTP secret
    is_2fa_enabled = Column(Boolean, default=False)

    # Security
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)
    last_login_at = Column(DateTime, nullable=True)
    last_login_ip = Column(String(50), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    # Relationships
    oauth_accounts = relationship("OAuthAccount", back_populates="user", cascade="all, delete-orphan")
    otp_codes = relationship("OTPCode", back_populates="user", cascade="all, delete-orphan")
    password_resets = relationship("PasswordResetToken", back_populates="user", cascade="all, delete-orphan")
    login_history = relationship("LoginAttempt", back_populates="user", cascade="all, delete-orphan")
    social_connections = relationship("SocialConnection", back_populates="user", cascade="all, delete-orphan")


# ─── OAuth Accounts ─────────────────────────────────────────────────────────

class OAuthAccount(Base):
    __tablename__ = "oauth_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    provider = Column(SAEnum(OAuthProvider), nullable=False)
    provider_user_id = Column(String(255), nullable=False)
    provider_email = Column(String(255), nullable=True)
    access_token = Column(Text, nullable=True)
    refresh_token = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    # Constraints
    __table_args__ = (
        UniqueConstraint("provider", "provider_user_id", name="uq_oauth_provider_user"),
    )

    # Relationships
    user = relationship("User", back_populates="oauth_accounts")


# ─── OTP Codes ───────────────────────────────────────────────────────────────

class OTPCode(Base):
    __tablename__ = "otp_codes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    identifier = Column(String(255), nullable=False, index=True)  # email or phone
    code = Column(String(10), nullable=False)
    purpose = Column(SAEnum(OTPPurpose), nullable=False)
    attempts = Column(Integer, default=0)
    max_attempts = Column(Integer, default=5)
    is_used = Column(Boolean, default=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=utc_now)

    # Relationships
    user = relationship("User", back_populates="otp_codes")


# ─── Password Reset Tokens ──────────────────────────────────────────────────

class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(255), unique=True, nullable=False, index=True)
    is_used = Column(Boolean, default=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=utc_now)

    # Relationships
    user = relationship("User", back_populates="password_resets")


# ─── Login Attempts (audit + anti-scraping) ──────────────────────────────────

class LoginAttempt(Base):
    __tablename__ = "login_attempts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    identifier = Column(String(255), nullable=False)  # email/phone/username used
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(500), nullable=True)
    success = Column(Boolean, default=False)
    failure_reason = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=utc_now)

    # Relationships
    user = relationship("User", back_populates="login_history")
