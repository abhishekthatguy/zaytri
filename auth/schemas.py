"""
Zaytri — Auth Pydantic Schemas
Request/response models for all auth endpoints.
"""

from pydantic import BaseModel, Field, field_validator
from uuid import UUID
from datetime import datetime
from typing import Optional, List
import re


# ─── Registration ────────────────────────────────────────────────────────────

class SignupRequest(BaseModel):
    """Register via email + password."""
    username: str = Field(..., min_length=3, max_length=100)
    email: str = Field(..., max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    phone: Optional[str] = Field(None, max_length=20)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if not re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", v):
            raise ValueError("Invalid email format")
        return v.lower().strip()

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        if not re.match(r"^[a-zA-Z0-9_.-]+$", v):
            raise ValueError("Username can only contain letters, numbers, dots, hyphens, underscores")
        return v.strip()

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Za-z]", v):
            raise ValueError("Password must contain at least one letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one number")
        return v


class SignupWithOTPRequest(BaseModel):
    """Start signup with OTP verification (email or phone)."""
    identifier: str = Field(..., max_length=255)  # email or phone
    method: str = Field(..., pattern="^(email|phone)$")


# ─── Login ───────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    """Login with email/phone/username + password."""
    identifier: str = Field(..., max_length=255)  # email, phone, or username
    password: str = Field(..., max_length=128)


class LoginWithOTPRequest(BaseModel):
    """Login with email/phone + OTP code."""
    identifier: str = Field(..., max_length=255)
    otp_code: str = Field(..., min_length=6, max_length=6)


# ─── OTP ─────────────────────────────────────────────────────────────────────

class SendOTPRequest(BaseModel):
    """Request OTP for email or phone."""
    identifier: str = Field(..., max_length=255)
    purpose: str = Field(
        ...,
        pattern="^(login|signup|password_reset|verify_email|verify_phone)$",
    )


class VerifyOTPRequest(BaseModel):
    """Verify an OTP code."""
    identifier: str = Field(..., max_length=255)
    otp_code: str = Field(..., min_length=6, max_length=6)
    purpose: str = Field(
        ...,
        pattern="^(login|signup|password_reset|verify_email|verify_phone)$",
    )


# ─── Password ───────────────────────────────────────────────────────────────

class ForgotPasswordRequest(BaseModel):
    """Request password reset link/OTP."""
    email: str = Field(..., max_length=255)


class ResetPasswordRequest(BaseModel):
    """Reset password via token (from email link)."""
    token: str = Field(..., max_length=255)
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not re.search(r"[A-Za-z]", v):
            raise ValueError("Password must contain at least one letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one number")
        return v


class ResetPasswordOTPRequest(BaseModel):
    """Reset password via OTP verification."""
    email: str = Field(..., max_length=255)
    otp_code: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=8, max_length=128)


class ChangePasswordRequest(BaseModel):
    """Change password (authenticated, knows current password)."""
    current_password: str = Field(..., max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not re.search(r"[A-Za-z]", v):
            raise ValueError("Password must contain at least one letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one number")
        return v


# ─── 2FA ─────────────────────────────────────────────────────────────────────

class Setup2FAResponse(BaseModel):
    """Response with TOTP setup data."""
    secret: str
    uri: str  # otpauth:// URI for QR code
    qr_code_base64: Optional[str] = None


class Verify2FARequest(BaseModel):
    """Verify 2FA code during login or setup."""
    code: str = Field(..., min_length=6, max_length=6)


class Enable2FARequest(BaseModel):
    """Enable 2FA after verifying a code."""
    code: str = Field(..., min_length=6, max_length=6)


# ─── OAuth ───────────────────────────────────────────────────────────────────

class OAuthCallbackRequest(BaseModel):
    """OAuth callback data from social providers."""
    provider: str = Field(..., pattern="^(google|facebook|github|twitter)$")
    code: str  # authorization code
    redirect_uri: Optional[str] = None


# ─── Responses ───────────────────────────────────────────────────────────────

class UserResponse(BaseModel):
    """Public user profile."""
    id: UUID
    username: str
    email: str
    phone: Optional[str] = None
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: bool
    is_admin: bool
    is_email_verified: bool
    is_phone_verified: bool
    is_2fa_enabled: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    """Login/register response with tokens."""
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    user: UserResponse
    requires_2fa: bool = False


class Token(BaseModel):
    """JWT token response (backward compat)."""
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Decoded token data."""
    user_id: Optional[str] = None


class MessageResponse(BaseModel):
    """Simple status message."""
    message: str
    success: bool = True
