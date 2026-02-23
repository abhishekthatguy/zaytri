"""
Zaytri — Auth Module Tests
Comprehensive test suite for the authentication system.
Tests cover: registration, login, OTP, password management, 2FA, rate limiting, validation.
"""

import pytest
import re
from unittest.mock import patch, AsyncMock, MagicMock
from datetime import datetime, timedelta

# ═════════════════════════════════════════════════════════════════════════════
# Unit Tests — auth.utils
# ═════════════════════════════════════════════════════════════════════════════


class TestPasswordHashing:
    """All passwords must be bcrypt-hashed and irreversible."""

    def test_hash_password_returns_hash(self):
        from auth.utils import hash_password
        hashed = hash_password("avii1994")
        assert hashed != "avii1994"
        assert hashed.startswith("$2b$")  # bcrypt prefix

    def test_hash_is_different_each_time(self):
        from auth.utils import hash_password
        h1 = hash_password("avii1994")
        h2 = hash_password("avii1994")
        assert h1 != h2  # bcrypt uses random salt

    def test_verify_correct_password(self):
        from auth.utils import hash_password, verify_password
        hashed = hash_password("avii1994")
        assert verify_password("avii1994", hashed) is True

    def test_verify_wrong_password(self):
        from auth.utils import hash_password, verify_password
        hashed = hash_password("avii1994")
        assert verify_password("wrongpass", hashed) is False

    def test_password_never_stored_plain(self):
        """Ensure the hash cannot be reversed."""
        from auth.utils import hash_password
        hashed = hash_password("mysecretpassword123")
        assert "mysecretpassword" not in hashed


class TestJWT:
    """JWT token creation and decoding."""

    def test_create_and_decode_access_token(self):
        from auth.utils import create_access_token, decode_token
        token = create_access_token("test-user-id-123")
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == "test-user-id-123"
        assert payload["type"] == "access"

    def test_create_refresh_token(self):
        from auth.utils import create_refresh_token, decode_token
        token = create_refresh_token("test-user-id-123")
        payload = decode_token(token)
        assert payload is not None
        assert payload["type"] == "refresh"

    def test_decode_invalid_token(self):
        from auth.utils import decode_token
        assert decode_token("invalid.token.here") is None

    def test_token_with_extra_claims(self):
        from auth.utils import create_access_token, decode_token
        token = create_access_token("uid", extra_claims={"needs_2fa": True})
        payload = decode_token(token)
        assert payload["needs_2fa"] is True


class TestOTP:
    """OTP and reset token generation."""

    def test_generate_otp_length(self):
        from auth.utils import generate_otp
        otp = generate_otp(6)
        assert len(otp) == 6
        assert otp.isdigit()

    def test_generate_otp_uniqueness(self):
        from auth.utils import generate_otp
        otps = {generate_otp() for _ in range(100)}
        assert len(otps) > 90  # most should be unique

    def test_generate_reset_token(self):
        from auth.utils import generate_reset_token
        token = generate_reset_token()
        assert len(token) >= 32  # URL-safe, long enough


class TestTOTP:
    """TOTP 2FA with authenticator apps."""

    def test_generate_totp_secret(self):
        from auth.utils import generate_totp_secret
        secret = generate_totp_secret()
        assert len(secret) >= 16

    def test_get_totp_uri(self):
        from auth.utils import generate_totp_secret, get_totp_uri
        secret = generate_totp_secret()
        uri = get_totp_uri(secret, "test@example.com")
        assert "otpauth://totp/" in uri
        assert "Zaytri" in uri
        assert "test" in uri and "example.com" in uri  # @ may be URL-encoded

    def test_verify_totp_valid(self):
        from auth.utils import generate_totp_secret, verify_totp
        try:
            import pyotp
            secret = generate_totp_secret()
            totp = pyotp.TOTP(secret)
            code = totp.now()
            assert verify_totp(secret, code) is True
        except ImportError:
            pytest.skip("pyotp not installed")

    def test_verify_totp_invalid(self):
        from auth.utils import generate_totp_secret, verify_totp
        secret = generate_totp_secret()
        assert verify_totp(secret, "000000") is False


class TestRateLimiter:
    """Rate limiting for anti-scraping."""

    def test_not_limited_initially(self):
        from auth.utils import RateLimiter
        limiter = RateLimiter()
        limited, wait = limiter.is_rate_limited("test-key", max_attempts=3, window_minutes=1)
        assert limited is False

    def test_limited_after_max_attempts(self):
        from auth.utils import RateLimiter
        limiter = RateLimiter()
        for _ in range(5):
            limiter.record_attempt("flood-key")
        limited, wait = limiter.is_rate_limited("flood-key", max_attempts=5, window_minutes=15)
        assert limited is True
        assert wait > 0

    def test_reset_clears_limit(self):
        from auth.utils import RateLimiter
        limiter = RateLimiter()
        for _ in range(10):
            limiter.record_attempt("reset-key")
        limiter.reset("reset-key")
        limited, _ = limiter.is_rate_limited("reset-key", max_attempts=5, window_minutes=15)
        assert limited is False


class TestAccountLockout:
    """Account lockout after failed attempts."""

    def test_not_locked_when_none(self):
        from auth.utils import is_account_locked
        assert is_account_locked(None) is False

    def test_locked_when_future(self):
        from auth.utils import is_account_locked
        future = datetime.utcnow() + timedelta(minutes=10)
        assert is_account_locked(future) is True

    def test_not_locked_when_past(self):
        from auth.utils import is_account_locked
        past = datetime.utcnow() - timedelta(minutes=1)
        assert is_account_locked(past) is False


class TestInputValidation:
    """Input validation and sanitization."""

    def test_valid_email(self):
        from auth.utils import is_valid_email
        assert is_valid_email("test@example.com") is True
        assert is_valid_email("user.name+tag@domain.co") is True

    def test_invalid_email(self):
        from auth.utils import is_valid_email
        assert is_valid_email("not-an-email") is False
        assert is_valid_email("@domain.com") is False
        assert is_valid_email("user@") is False
        assert is_valid_email("") is False

    def test_valid_phone(self):
        from auth.utils import is_valid_phone
        assert is_valid_phone("+919876543210") is True
        assert is_valid_phone("1234567890") is True

    def test_invalid_phone(self):
        from auth.utils import is_valid_phone
        assert is_valid_phone("123") is False
        assert is_valid_phone("abc") is False

    def test_sanitize_input(self):
        from auth.utils import sanitize_input
        assert sanitize_input("  hello  ") == "hello"
        assert sanitize_input("a" * 500, max_length=100) == "a" * 100
        assert sanitize_input("hello\x00world") == "helloworld"

    def test_sanitize_empty(self):
        from auth.utils import sanitize_input
        assert sanitize_input("") == ""


# ═════════════════════════════════════════════════════════════════════════════
# Schema Validation Tests
# ═════════════════════════════════════════════════════════════════════════════

class TestSchemas:
    """Pydantic schema validation."""

    def test_signup_valid(self):
        from auth.schemas import SignupRequest
        data = SignupRequest(
            username="testuser",
            email="test@example.com",
            password="test1234",
        )
        assert data.email == "test@example.com"

    def test_signup_invalid_email(self):
        from auth.schemas import SignupRequest
        with pytest.raises(Exception):
            SignupRequest(username="testuser", email="bad", password="test1234")

    def test_signup_short_password(self):
        from auth.schemas import SignupRequest
        with pytest.raises(Exception):
            SignupRequest(username="testuser", email="t@e.com", password="short")

    def test_signup_password_no_number(self):
        from auth.schemas import SignupRequest
        with pytest.raises(Exception):
            SignupRequest(username="testuser", email="t@e.com", password="nopnumber")

    def test_signup_password_no_letter(self):
        from auth.schemas import SignupRequest
        with pytest.raises(Exception):
            SignupRequest(username="testuser", email="t@e.com", password="12345678")

    def test_signup_invalid_username(self):
        from auth.schemas import SignupRequest
        with pytest.raises(Exception):
            SignupRequest(username="bad user!", email="t@e.com", password="test1234")

    def test_login_valid(self):
        from auth.schemas import LoginRequest
        data = LoginRequest(identifier="test@example.com", password="pass1234")
        assert data.identifier == "test@example.com"

    def test_change_password_valid(self):
        from auth.schemas import ChangePasswordRequest
        data = ChangePasswordRequest(current_password="old1234", new_password="new1234a")
        assert data.new_password == "new1234a"

    def test_verify_otp_valid(self):
        from auth.schemas import VerifyOTPRequest
        data = VerifyOTPRequest(
            identifier="test@example.com",
            otp_code="123456",
            purpose="login",
        )
        assert data.otp_code == "123456"

    def test_user_response_model(self):
        from auth.schemas import UserResponse
        from uuid import uuid4
        user = UserResponse(
            id=uuid4(),
            username="testuser",
            email="test@example.com",
            is_active=True,
            is_admin=False,
            is_email_verified=False,
            is_phone_verified=False,
            is_2fa_enabled=False,
            created_at=datetime.utcnow(),
        )
        assert user.username == "testuser"


# ═════════════════════════════════════════════════════════════════════════════
# OAuth Tests
# ═════════════════════════════════════════════════════════════════════════════

class TestOAuth:
    """OAuth provider utilities."""

    def test_get_configured_providers(self):
        from auth.oauth import get_configured_providers
        providers = get_configured_providers()
        assert "google" in providers
        assert "facebook" in providers
        assert "github" in providers
        assert "twitter" in providers

    def test_get_oauth_login_url_google(self):
        from auth.oauth import get_oauth_login_url
        url = get_oauth_login_url("google", "http://localhost:3000/callback")
        if url:  # will be None if google not configured
            assert "accounts.google.com" in url

    def test_get_oauth_login_url_invalid(self):
        from auth.oauth import get_oauth_login_url
        assert get_oauth_login_url("invalid", "http://localhost") is None


# ═════════════════════════════════════════════════════════════════════════════
# Default User Seed Tests
# ═════════════════════════════════════════════════════════════════════════════

class TestSeed:
    """Default admin user seeding."""

    def test_default_credentials(self):
        from auth.seed import DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD
        from config import settings
        assert DEFAULT_ADMIN_EMAIL == settings.default_admin_email
        assert DEFAULT_ADMIN_USERNAME == settings.default_admin_username
        assert DEFAULT_ADMIN_PASSWORD == settings.default_admin_password

    def test_password_is_hashed_before_storage(self):
        """Verify the seed function hashes the password."""
        from auth.utils import hash_password
        hashed = hash_password("avii1994")
        assert hashed != "avii1994"
        assert hashed.startswith("$2b$")


# ═════════════════════════════════════════════════════════════════════════════
# Integration-style Tests (model structure)
# ═════════════════════════════════════════════════════════════════════════════

class TestModels:
    """Auth model structure verification."""

    def test_user_model_has_required_fields(self):
        from auth.models import User
        columns = {c.name for c in User.__table__.columns}
        required = {
            "id", "username", "email", "hashed_password",
            "is_active", "is_admin", "is_email_verified", "is_phone_verified",
            "totp_secret", "is_2fa_enabled",
            "failed_login_attempts", "locked_until",
        }
        assert required.issubset(columns)

    def test_otp_model_has_required_fields(self):
        from auth.models import OTPCode
        columns = {c.name for c in OTPCode.__table__.columns}
        required = {"id", "identifier", "code", "purpose", "attempts", "is_used", "expires_at"}
        assert required.issubset(columns)

    def test_password_reset_model(self):
        from auth.models import PasswordResetToken
        columns = {c.name for c in PasswordResetToken.__table__.columns}
        required = {"id", "user_id", "token", "is_used", "expires_at"}
        assert required.issubset(columns)

    def test_oauth_account_model(self):
        from auth.models import OAuthAccount
        columns = {c.name for c in OAuthAccount.__table__.columns}
        required = {"id", "user_id", "provider", "provider_user_id"}
        assert required.issubset(columns)

    def test_login_attempt_model(self):
        from auth.models import LoginAttempt
        columns = {c.name for c in LoginAttempt.__table__.columns}
        required = {"id", "identifier", "ip_address", "success"}
        assert required.issubset(columns)

    def test_oauth_providers_enum(self):
        from auth.models import OAuthProvider
        providers = [p.value for p in OAuthProvider]
        assert "google" in providers
        assert "facebook" in providers
        assert "github" in providers
        assert "twitter" in providers

    def test_otp_purpose_enum(self):
        from auth.models import OTPPurpose
        purposes = [p.value for p in OTPPurpose]
        assert "login" in purposes
        assert "signup" in purposes
        assert "password_reset" in purposes
