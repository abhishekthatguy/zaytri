"""
Zaytri — Auth Router
Complete authentication API: register, login, OTP, OAuth, 2FA, password management.
All passwords are bcrypt-hashed — nobody (not the system, not the user) can see them.
"""

import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from config import settings
from db.database import get_db
from auth.models import (
    User, OAuthAccount, OTPCode, PasswordResetToken, LoginAttempt,
    OTPPurpose, OAuthProvider,
)
from auth.schemas import (
    SignupRequest, LoginRequest, LoginWithOTPRequest,
    SendOTPRequest, VerifyOTPRequest,
    ForgotPasswordRequest, ResetPasswordRequest, ResetPasswordOTPRequest,
    ChangePasswordRequest,
    Setup2FAResponse, Verify2FARequest, Enable2FARequest,
    OAuthCallbackRequest,
    UserResponse, AuthResponse, Token, MessageResponse,
)
from auth.utils import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    generate_otp, generate_reset_token,
    generate_totp_secret, get_totp_uri, verify_totp,
    login_rate_limiter, otp_rate_limiter, signup_rate_limiter,
    is_account_locked, get_lockout_time,
    MAX_FAILED_ATTEMPTS,
    is_valid_email, is_valid_phone, sanitize_input,
)
from auth.oauth import handle_oauth_callback, get_oauth_login_url, get_configured_providers
from auth.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _get_client_ip(request: Request) -> str:
    """Get client IP from request."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _build_auth_response(user: User, include_refresh: bool = True) -> AuthResponse:
    """Build auth response with tokens."""
    access = create_access_token(str(user.id))
    refresh = create_refresh_token(str(user.id)) if include_refresh else None
    return AuthResponse(
        access_token=access,
        refresh_token=refresh,
        user=UserResponse.model_validate(user),
        requires_2fa=user.is_2fa_enabled,
    )


async def _record_login_attempt(
    db: AsyncSession,
    identifier: str,
    request: Request,
    user: Optional[User],
    success: bool,
    reason: Optional[str] = None,
) -> None:
    """Record a login attempt for audit trail."""
    attempt = LoginAttempt(
        user_id=user.id if user else None,
        identifier=identifier,
        ip_address=_get_client_ip(request),
        user_agent=request.headers.get("User-Agent", "")[:500],
        success=success,
        failure_reason=reason,
    )
    db.add(attempt)


async def _find_user_by_identifier(
    db: AsyncSession, identifier: str
) -> Optional[User]:
    """Find user by email, phone, or username."""
    identifier = identifier.strip().lower()
    result = await db.execute(
        select(User).where(
            or_(
                User.email == identifier,
                User.phone == identifier,
                User.username == identifier,
            )
        )
    )
    return result.scalar_one_or_none()


# ═════════════════════════════════════════════════════════════════════════════
# Registration
# ═════════════════════════════════════════════════════════════════════════════

@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(
    data: SignupRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Register a new user with email + password."""
    ip = _get_client_ip(request)

    # Rate limit signups
    is_limited, wait = signup_rate_limiter.is_rate_limited(ip, max_attempts=5, window_minutes=15)
    if is_limited:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many signup attempts. Try again in {wait} seconds.",
        )
    signup_rate_limiter.record_attempt(ip)

    # Sanitize inputs
    username = sanitize_input(data.username, 100)
    email = sanitize_input(data.email, 255).lower()

    # Validate email format
    if not is_valid_email(email):
        raise HTTPException(status_code=400, detail="Invalid email format")

    # Check duplicates
    existing = await db.execute(
        select(User).where(
            or_(User.username == username, User.email == email)
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email already registered",
        )

    # Validate phone if provided
    if data.phone:
        if not is_valid_phone(data.phone):
            raise HTTPException(status_code=400, detail="Invalid phone number format")
        phone_exists = await db.execute(select(User).where(User.phone == data.phone))
        if phone_exists.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Phone number already registered")

    user = User(
        username=username,
        email=email,
        phone=data.phone,
        hashed_password=hash_password(data.password),
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    await _record_login_attempt(db, email, request, user, True)
    logger.info(f"New user registered: {email}")

    return _build_auth_response(user)


# ═════════════════════════════════════════════════════════════════════════════
# Login — Email/Phone/Username + Password
# ═════════════════════════════════════════════════════════════════════════════

@router.post("/login", response_model=AuthResponse)
async def login(
    data: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Login with email/phone/username + password."""
    ip = _get_client_ip(request)
    identifier = sanitize_input(data.identifier, 255).lower()

    # Rate limit logins per IP
    is_limited, wait = login_rate_limiter.is_rate_limited(ip, max_attempts=10, window_minutes=15)
    if is_limited:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many login attempts. Try again in {wait} seconds.",
        )
    login_rate_limiter.record_attempt(ip)

    # Find user
    user = await _find_user_by_identifier(db, identifier)
    if not user:
        await _record_login_attempt(db, identifier, request, None, False, "user_not_found")
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Check account lockout
    if is_account_locked(user.locked_until):
        remaining = int((user.locked_until - datetime.utcnow()).total_seconds())
        await _record_login_attempt(db, identifier, request, user, False, "account_locked")
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Account locked. Try again in {remaining} seconds.",
        )

    # Verify password
    if not verify_password(data.password, user.hashed_password):
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
            user.locked_until = get_lockout_time()
            user.failed_login_attempts = 0
            logger.warning(f"Account locked: {identifier}")
        await _record_login_attempt(db, identifier, request, user, False, "wrong_password")
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.is_active:
        await _record_login_attempt(db, identifier, request, user, False, "account_disabled")
        raise HTTPException(status_code=403, detail="Account is disabled")

    # Success — reset counters
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = datetime.utcnow()
    user.last_login_ip = ip
    login_rate_limiter.reset(ip)

    await _record_login_attempt(db, identifier, request, user, True)

    # Check if 2FA is enabled
    if user.is_2fa_enabled:
        # Return a temporary token that requires 2FA verification
        temp_token = create_access_token(str(user.id), extra_claims={"needs_2fa": True}, expires_minutes=5)
        return AuthResponse(
            access_token=temp_token,
            user=UserResponse.model_validate(user),
            requires_2fa=True,
        )

    return _build_auth_response(user)


# ═════════════════════════════════════════════════════════════════════════════
# Login with OTP
# ═════════════════════════════════════════════════════════════════════════════

@router.post("/login/otp", response_model=AuthResponse)
async def login_with_otp(
    data: LoginWithOTPRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Login with email/phone + OTP code (passwordless)."""
    identifier = sanitize_input(data.identifier, 255).lower()

    # Find and verify OTP
    otp_result = await db.execute(
        select(OTPCode).where(
            OTPCode.identifier == identifier,
            OTPCode.purpose == OTPPurpose.LOGIN,
            OTPCode.is_used == False,
            OTPCode.expires_at > datetime.utcnow(),
        ).order_by(OTPCode.created_at.desc())
    )
    otp = otp_result.scalar_one_or_none()

    if not otp:
        raise HTTPException(status_code=400, detail="No valid OTP found. Request a new one.")

    if otp.attempts >= otp.max_attempts:
        otp.is_used = True
        raise HTTPException(status_code=400, detail="Too many failed OTP attempts. Request a new one.")

    if otp.code != data.otp_code:
        otp.attempts += 1
        raise HTTPException(status_code=400, detail="Invalid OTP code")

    # Mark OTP as used
    otp.is_used = True

    # Find user
    user = await _find_user_by_identifier(db, identifier)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.last_login_at = datetime.utcnow()
    user.last_login_ip = _get_client_ip(request)
    await _record_login_attempt(db, identifier, request, user, True)

    return _build_auth_response(user)


# ═════════════════════════════════════════════════════════════════════════════
# OTP Management
# ═════════════════════════════════════════════════════════════════════════════

@router.post("/otp/send", response_model=MessageResponse)
async def send_otp(
    data: SendOTPRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Generate and 'send' an OTP.
    NOTE: We don't use 3rd party SMS/email services. The OTP is stored in DB
    and returned in the response for development. In production, hook up your
    own email/SMS service to actually deliver the OTP.
    """
    ip = _get_client_ip(request)
    identifier = sanitize_input(data.identifier, 255).lower()

    # Rate limit OTP requests
    is_limited, wait = otp_rate_limiter.is_rate_limited(
        f"{ip}:{identifier}", max_attempts=5, window_minutes=10
    )
    if is_limited:
        raise HTTPException(
            status_code=429,
            detail=f"Too many OTP requests. Try again in {wait} seconds.",
        )
    otp_rate_limiter.record_attempt(f"{ip}:{identifier}")

    # Validate identifier format
    if not is_valid_email(identifier) and not is_valid_phone(identifier):
        raise HTTPException(status_code=400, detail="Provide a valid email or phone number")

    # For login/password_reset, user must exist
    purpose = OTPPurpose(data.purpose)
    if purpose in (OTPPurpose.LOGIN, OTPPurpose.PASSWORD_RESET):
        user = await _find_user_by_identifier(db, identifier)
        if not user:
            # Don't reveal that user doesn't exist
            return MessageResponse(message="If the account exists, an OTP has been sent.")

    # Invalidate old OTPs for same identifier + purpose
    old_otps = await db.execute(
        select(OTPCode).where(
            OTPCode.identifier == identifier,
            OTPCode.purpose == purpose,
            OTPCode.is_used == False,
        )
    )
    for old in old_otps.scalars():
        old.is_used = True

    # Generate new OTP
    code = generate_otp()
    otp = OTPCode(
        identifier=identifier,
        code=code,
        purpose=purpose,
        expires_at=datetime.utcnow() + timedelta(minutes=10),
    )
    db.add(otp)
    await db.flush()

    # In development: return OTP in response.
    # In production: send via your own email/SMS service and remove from response.
    logger.info(f"OTP generated for {identifier}: {code} (purpose: {data.purpose})")

    return MessageResponse(
        message=f"OTP sent to {identifier}. Valid for 10 minutes. [Dev OTP: {code}]"
    )


@router.post("/otp/verify", response_model=MessageResponse)
async def verify_otp_code(
    data: VerifyOTPRequest,
    db: AsyncSession = Depends(get_db),
):
    """Verify an OTP code."""
    identifier = sanitize_input(data.identifier, 255).lower()
    purpose = OTPPurpose(data.purpose)

    result = await db.execute(
        select(OTPCode).where(
            OTPCode.identifier == identifier,
            OTPCode.purpose == purpose,
            OTPCode.is_used == False,
            OTPCode.expires_at > datetime.utcnow(),
        ).order_by(OTPCode.created_at.desc())
    )
    otp = result.scalar_one_or_none()

    if not otp:
        raise HTTPException(status_code=400, detail="No valid OTP found")

    if otp.attempts >= otp.max_attempts:
        otp.is_used = True
        raise HTTPException(status_code=400, detail="Too many failed attempts")

    if otp.code != data.otp_code:
        otp.attempts += 1
        raise HTTPException(status_code=400, detail="Invalid OTP code")

    otp.is_used = True

    # If verify_email or verify_phone, update user
    if purpose in (OTPPurpose.VERIFY_EMAIL, OTPPurpose.VERIFY_PHONE):
        user = await _find_user_by_identifier(db, identifier)
        if user:
            if purpose == OTPPurpose.VERIFY_EMAIL:
                user.is_email_verified = True
            else:
                user.is_phone_verified = True

    return MessageResponse(message="OTP verified successfully")


# ═════════════════════════════════════════════════════════════════════════════
# Password Management
# ═════════════════════════════════════════════════════════════════════════════

@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(
    data: ForgotPasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Send password reset link/OTP.
    Generates both a reset token (for link) and OTP (for code verification).
    """
    ip = _get_client_ip(request)
    email = sanitize_input(data.email, 255).lower()

    # Rate limit
    is_limited, wait = otp_rate_limiter.is_rate_limited(
        f"reset:{ip}", max_attempts=3, window_minutes=15
    )
    if is_limited:
        raise HTTPException(status_code=429, detail=f"Try again in {wait} seconds.")
    otp_rate_limiter.record_attempt(f"reset:{ip}")

    user = await _find_user_by_identifier(db, email)
    if not user:
        # Don't reveal if user exists
        return MessageResponse(message="If the email is registered, a reset link has been sent.")

    # Generate reset token (for link-based reset)
    token = generate_reset_token()
    reset = PasswordResetToken(
        user_id=user.id,
        token=token,
        expires_at=datetime.utcnow() + timedelta(hours=1),
    )
    db.add(reset)

    # Also generate OTP (for OTP-based reset)
    code = generate_otp()
    otp = OTPCode(
        user_id=user.id,
        identifier=email,
        code=code,
        purpose=OTPPurpose.PASSWORD_RESET,
        expires_at=datetime.utcnow() + timedelta(minutes=10),
    )
    db.add(otp)
    await db.flush()

    # In production: send email with link & OTP via your own service
    frontend_url = f"http://localhost:{settings.frontend_port}"
    reset_url = f"{frontend_url}/reset-password?token={token}"

    logger.info(f"Password reset for {email}: link={reset_url}, OTP={code}")

    return MessageResponse(
        message=f"Reset link sent to {email}. [Dev: token={token}, OTP={code}]"
    )


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password_with_token(
    data: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Reset password using a reset token (from email link)."""
    result = await db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.token == data.token,
            PasswordResetToken.is_used == False,
            PasswordResetToken.expires_at > datetime.utcnow(),
        )
    )
    reset_token = result.scalar_one_or_none()
    if not reset_token:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    # Get user and update password
    user_result = await db.execute(select(User).where(User.id == reset_token.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = hash_password(data.new_password)
    user.failed_login_attempts = 0
    user.locked_until = None
    reset_token.is_used = True

    logger.info(f"Password reset via token for user: {user.email}")
    return MessageResponse(message="Password reset successfully. You can now log in with your new password.")


@router.post("/reset-password/otp", response_model=MessageResponse)
async def reset_password_with_otp(
    data: ResetPasswordOTPRequest,
    db: AsyncSession = Depends(get_db),
):
    """Reset password using email + OTP verification."""
    email = sanitize_input(data.email, 255).lower()

    # Verify OTP
    otp_result = await db.execute(
        select(OTPCode).where(
            OTPCode.identifier == email,
            OTPCode.purpose == OTPPurpose.PASSWORD_RESET,
            OTPCode.is_used == False,
            OTPCode.expires_at > datetime.utcnow(),
        ).order_by(OTPCode.created_at.desc())
    )
    otp = otp_result.scalar_one_or_none()

    if not otp or otp.code != data.otp_code:
        if otp:
            otp.attempts += 1
        raise HTTPException(status_code=400, detail="Invalid OTP code")

    otp.is_used = True

    # Update password
    user = await _find_user_by_identifier(db, email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = hash_password(data.new_password)
    user.failed_login_attempts = 0
    user.locked_until = None

    logger.info(f"Password reset via OTP for user: {email}")
    return MessageResponse(message="Password reset successfully.")


@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    data: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change password (must know current password)."""
    if not verify_password(data.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if data.current_password == data.new_password:
        raise HTTPException(status_code=400, detail="New password must be different from current password")

    user.hashed_password = hash_password(data.new_password)
    logger.info(f"Password changed for user: {user.email}")
    return MessageResponse(message="Password changed successfully.")


# ═════════════════════════════════════════════════════════════════════════════
# 2FA (TOTP — Google/Microsoft Authenticator)
# ═════════════════════════════════════════════════════════════════════════════

@router.post("/2fa/setup", response_model=Setup2FAResponse)
async def setup_2fa(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate TOTP secret and QR code for 2FA setup."""
    if user.is_2fa_enabled:
        raise HTTPException(status_code=400, detail="2FA is already enabled")

    secret = generate_totp_secret()
    uri = get_totp_uri(secret, user.email)

    # Store secret temporarily (not enabled until verified)
    user.totp_secret = secret

    # Generate QR code as base64
    qr_base64 = None
    try:
        import qrcode
        import io
        import base64
        qr = qrcode.make(uri)
        buf = io.BytesIO()
        qr.save(buf, format="PNG")
        qr_base64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    except ImportError:
        pass  # QR code optional

    return Setup2FAResponse(
        secret=secret,
        uri=uri,
        qr_code_base64=qr_base64,
    )


@router.post("/2fa/enable", response_model=MessageResponse)
async def enable_2fa(
    data: Enable2FARequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Enable 2FA after verifying a TOTP code."""
    if user.is_2fa_enabled:
        raise HTTPException(status_code=400, detail="2FA is already enabled")

    if not user.totp_secret:
        raise HTTPException(status_code=400, detail="Run /auth/2fa/setup first")

    if not verify_totp(user.totp_secret, data.code):
        raise HTTPException(status_code=400, detail="Invalid 2FA code. Check your authenticator app.")

    user.is_2fa_enabled = True
    logger.info(f"2FA enabled for user: {user.email}")
    return MessageResponse(message="2FA enabled successfully!")


@router.post("/2fa/disable", response_model=MessageResponse)
async def disable_2fa(
    data: Verify2FARequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Disable 2FA (requires current TOTP code)."""
    if not user.is_2fa_enabled:
        raise HTTPException(status_code=400, detail="2FA is not enabled")

    if not verify_totp(user.totp_secret, data.code):
        raise HTTPException(status_code=400, detail="Invalid 2FA code")

    user.is_2fa_enabled = False
    user.totp_secret = None
    logger.info(f"2FA disabled for user: {user.email}")
    return MessageResponse(message="2FA disabled.")


@router.post("/2fa/verify", response_model=AuthResponse)
async def verify_2fa_login(
    data: Verify2FARequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Verify 2FA code during login (completes the 2FA login flow)."""
    from auth.utils import decode_token

    # Get the temp token from header
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization")

    token = auth_header.split(" ")[1]
    payload = decode_token(token)
    if not payload or not payload.get("needs_2fa"):
        raise HTTPException(status_code=401, detail="Invalid or expired 2FA session")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_totp(user.totp_secret, data.code):
        raise HTTPException(status_code=400, detail="Invalid 2FA code")

    # Issue full tokens
    return _build_auth_response(user)


# ═════════════════════════════════════════════════════════════════════════════
# OAuth (Social Login)
# ═════════════════════════════════════════════════════════════════════════════

@router.get("/oauth/providers")
async def list_oauth_providers():
    """List available OAuth providers and their configuration status."""
    return get_configured_providers()


@router.get("/oauth/{provider}/url")
async def get_oauth_url(provider: str, redirect_uri: str):
    """Get OAuth authorization URL for a provider."""
    if provider not in ("google", "facebook", "github", "twitter"):
        raise HTTPException(status_code=400, detail="Unsupported provider")

    url = get_oauth_login_url(provider, redirect_uri)
    if not url:
        raise HTTPException(status_code=400, detail=f"{provider} OAuth is not configured")

    return {"url": url, "provider": provider}


@router.post("/oauth/callback", response_model=AuthResponse)
async def oauth_callback(
    data: OAuthCallbackRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Handle OAuth callback — creates account or logs in existing user."""
    redirect_uri = data.redirect_uri or f"http://localhost:{settings.frontend_port}/auth/callback"

    user_info = await handle_oauth_callback(data.provider, data.code, redirect_uri)
    if not user_info:
        raise HTTPException(status_code=400, detail="OAuth authentication failed")

    # Check if this OAuth account is already linked
    provider_enum = OAuthProvider(data.provider)
    result = await db.execute(
        select(OAuthAccount).where(
            OAuthAccount.provider == provider_enum,
            OAuthAccount.provider_user_id == user_info.provider_user_id,
        )
    )
    existing_oauth = result.scalar_one_or_none()

    if existing_oauth:
        # Existing OAuth user — log in
        user_result = await db.execute(select(User).where(User.id == existing_oauth.user_id))
        user = user_result.scalar_one()
        user.last_login_at = datetime.utcnow()
        user.last_login_ip = _get_client_ip(request)
        await _record_login_attempt(db, user_info.email or data.provider, request, user, True)
        return _build_auth_response(user)

    # Check if email matches an existing user
    user = None
    if user_info.email:
        user_result = await db.execute(select(User).where(User.email == user_info.email))
        user = user_result.scalar_one_or_none()

    if not user:
        # Create new user
        username = (user_info.name or user_info.email or f"{data.provider}_{user_info.provider_user_id}")
        username = username.replace(" ", "_").lower()[:100]

        # Ensure unique username
        base_username = username
        counter = 1
        while True:
            exists = await db.execute(select(User).where(User.username == username))
            if not exists.scalar_one_or_none():
                break
            username = f"{base_username}_{counter}"
            counter += 1

        user = User(
            username=username,
            email=user_info.email or f"{data.provider}_{user_info.provider_user_id}@oauth.local",
            hashed_password=hash_password(generate_reset_token()),  # random password for OAuth users
            display_name=user_info.name,
            avatar_url=user_info.avatar_url,
            is_email_verified=bool(user_info.email),
            is_active=True,
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)

    # Link OAuth account
    oauth_account = OAuthAccount(
        user_id=user.id,
        provider=provider_enum,
        provider_user_id=user_info.provider_user_id,
        provider_email=user_info.email,
        access_token=user_info.access_token,
        refresh_token=user_info.refresh_token,
    )
    db.add(oauth_account)

    user.last_login_at = datetime.utcnow()
    user.last_login_ip = _get_client_ip(request)
    await _record_login_attempt(db, user_info.email or data.provider, request, user, True)

    logger.info(f"OAuth login: {data.provider} → {user.email}")
    return _build_auth_response(user)


# ═════════════════════════════════════════════════════════════════════════════
# User Profile
# ═════════════════════════════════════════════════════════════════════════════

@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    """Get current user profile."""
    return UserResponse.model_validate(user)


@router.put("/me", response_model=UserResponse)
async def update_me(
    display_name: Optional[str] = None,
    avatar_url: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update current user profile (display name, avatar)."""
    if display_name is not None:
        user.display_name = sanitize_input(display_name)
    if avatar_url is not None:
        user.avatar_url = avatar_url
    await db.commit()
    await db.refresh(user)
    return UserResponse.model_validate(user)


@router.post("/refresh", response_model=Token)
async def refresh_token(request: Request, db: AsyncSession = Depends(get_db)):
    """Refresh access token using refresh token."""
    from auth.utils import decode_token

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")

    token = auth_header.split(" ")[1]
    payload = decode_token(token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid token")

    new_token = create_access_token(str(user.id))
    return Token(access_token=new_token)
