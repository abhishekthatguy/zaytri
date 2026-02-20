"""
Zaytri — Auth Utilities
Password hashing, OTP generation, TOTP 2FA, rate limiting, JWT helpers.
All passwords are bcrypt-hashed — never stored or returned in plain text.
"""

import secrets
import string
import hashlib
import hmac
import base64
from datetime import datetime, timedelta
from typing import Optional, Tuple
from collections import defaultdict

from jose import jwt, JWTError
from passlib.context import CryptContext

from config import settings

# ─── Password Hashing (bcrypt) ──────────────────────────────────────────────

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _truncate_for_bcrypt(password: str) -> str:
    """Truncate password to 72 bytes (bcrypt limit). Newer bcrypt versions raise errors instead of silently truncating."""
    return password.encode("utf-8")[:72].decode("utf-8", errors="ignore")


def hash_password(password: str) -> str:
    """Hash password with bcrypt. Result is irreversible — no one can see the original."""
    return pwd_context.hash(_truncate_for_bcrypt(password))


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain password against bcrypt hash."""
    return pwd_context.verify(_truncate_for_bcrypt(plain), hashed)


# ─── JWT Tokens ──────────────────────────────────────────────────────────────

def create_access_token(
    user_id: str,
    extra_claims: Optional[dict] = None,
    expires_minutes: Optional[int] = None,
) -> str:
    """Create a JWT access token."""
    expire = datetime.utcnow() + timedelta(
        minutes=expires_minutes or settings.jwt_access_token_expire_minutes
    )
    payload = {"sub": user_id, "exp": expire, "type": "access"}
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(user_id: str) -> str:
    """Create a longer-lived refresh token."""
    expire = datetime.utcnow() + timedelta(days=30)
    payload = {"sub": user_id, "exp": expire, "type": "refresh"}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> Optional[dict]:
    """Decode a JWT token. Returns None if invalid."""
    try:
        return jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
    except JWTError:
        return None


# ─── OTP Generation ─────────────────────────────────────────────────────────

def generate_otp(length: int = 6) -> str:
    """Generate a secure random numeric OTP."""
    return "".join(secrets.choice(string.digits) for _ in range(length))


def generate_reset_token() -> str:
    """Generate a secure URL-safe reset token."""
    return secrets.token_urlsafe(48)


# ─── TOTP (2FA with Authenticator Apps) ──────────────────────────────────────

try:
    import pyotp

    def generate_totp_secret() -> str:
        """Generate a new TOTP secret for 2FA setup."""
        return pyotp.random_base32()

    def get_totp_uri(secret: str, email: str) -> str:
        """Get the TOTP provisioning URI for QR code generation."""
        totp = pyotp.TOTP(secret)
        return totp.provisioning_uri(
            name=email,
            issuer_name="Zaytri",
        )

    def verify_totp(secret: str, code: str) -> bool:
        """Verify a TOTP code against the secret. Allows ±1 window for clock skew."""
        totp = pyotp.TOTP(secret)
        return totp.verify(code, valid_window=1)

except ImportError:
    # Graceful fallback if pyotp not installed
    def generate_totp_secret() -> str:
        return base64.b32encode(secrets.token_bytes(20)).decode("utf-8")

    def get_totp_uri(secret: str, email: str) -> str:
        return f"otpauth://totp/Zaytri:{email}?secret={secret}&issuer=Zaytri"

    def verify_totp(secret: str, code: str) -> bool:
        return False  # Cannot verify without pyotp


# ─── Rate Limiting (in-memory, per-IP) ──────────────────────────────────────

class RateLimiter:
    """Simple in-memory rate limiter for anti-scraping protection."""

    def __init__(self):
        self._attempts: dict[str, list[datetime]] = defaultdict(list)

    def is_rate_limited(
        self,
        key: str,
        max_attempts: int = 10,
        window_minutes: int = 15,
    ) -> Tuple[bool, int]:
        """
        Check if a key is rate limited.
        Returns (is_limited, seconds_until_reset).
        """
        now = datetime.utcnow()
        cutoff = now - timedelta(minutes=window_minutes)

        # Clean old entries
        self._attempts[key] = [
            t for t in self._attempts[key] if t > cutoff
        ]

        if len(self._attempts[key]) >= max_attempts:
            oldest = min(self._attempts[key])
            reset_at = oldest + timedelta(minutes=window_minutes)
            seconds_left = max(0, int((reset_at - now).total_seconds()))
            return True, seconds_left

        return False, 0

    def record_attempt(self, key: str) -> None:
        """Record an attempt for rate limiting."""
        self._attempts[key].append(datetime.utcnow())

    def reset(self, key: str) -> None:
        """Reset rate limit for a key (e.g., after successful login)."""
        self._attempts.pop(key, None)


# Singleton rate limiters
login_rate_limiter = RateLimiter()
otp_rate_limiter = RateLimiter()
signup_rate_limiter = RateLimiter()


# ─── Account Lockout ────────────────────────────────────────────────────────

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 15


def is_account_locked(locked_until: Optional[datetime]) -> bool:
    """Check if an account is currently locked."""
    if locked_until is None:
        return False
    return datetime.utcnow() < locked_until


def get_lockout_time() -> datetime:
    """Get the lockout expiry time."""
    return datetime.utcnow() + timedelta(minutes=LOCKOUT_DURATION_MINUTES)


# ─── Input Validation ───────────────────────────────────────────────────────

import re

EMAIL_REGEX = re.compile(
    r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
)

PHONE_REGEX = re.compile(
    r"^\+?[1-9]\d{6,14}$"
)


def is_valid_email(email: str) -> bool:
    """Validate email format."""
    return bool(EMAIL_REGEX.match(email))


def is_valid_phone(phone: str) -> bool:
    """Validate phone number format (E.164-like)."""
    cleaned = phone.replace(" ", "").replace("-", "")
    return bool(PHONE_REGEX.match(cleaned))


def sanitize_input(value: str, max_length: int = 255) -> str:
    """Sanitize user input to prevent injection and limit length."""
    if not value:
        return ""
    # Strip whitespace, limit length
    value = value.strip()[:max_length]
    # Remove null bytes and control characters
    value = "".join(c for c in value if c.isprintable() or c in ("\n", "\t"))
    return value
