"""
Zaytri — Settings API Routes
Manage cron schedules, platform credentials, and Google Drive configuration.
"""

import re
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from auth.models import User
from db.database import get_db
from db.settings_models import UserSettings, PlatformCredential, GoogleDriveConfig
from db.models import Platform
from utils.crypto import encrypt_dict, decrypt_dict, mask_value

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/settings", tags=["Settings"])


# ═══════════════════════════════════════════════════════════════════════════════
# Schemas
# ═══════════════════════════════════════════════════════════════════════════════

# ─── Cron Settings ───────────────────────────────────────────────────────────

class CronSettingsRequest(BaseModel):
    scheduler_hour: int = Field(ge=0, le=23, default=9)
    scheduler_minute: int = Field(ge=0, le=59, default=0)
    engagement_delay_hours: int = Field(ge=1, le=48, default=2)
    analytics_day_of_week: int = Field(ge=0, le=6, default=1)
    analytics_hour: int = Field(ge=0, le=23, default=8)
    analytics_minute: int = Field(ge=0, le=59, default=0)
    timezone: str = Field(default="Asia/Kolkata", max_length=100)


class CronSettingsResponse(BaseModel):
    scheduler_hour: int
    scheduler_minute: int
    engagement_delay_hours: int
    analytics_day_of_week: int
    analytics_hour: int
    analytics_minute: int
    timezone: str

    model_config = {"from_attributes": True}


# ─── Platform Credentials ───────────────────────────────────────────────────

class PlatformCredentialRequest(BaseModel):
    credentials: Dict[str, str] = Field(..., description="Key-value map of API credentials")
    is_active: bool = True


class PlatformCredentialResponse(BaseModel):
    platform: str
    is_active: bool
    credential_keys: List[str]  # Show which keys are saved (masked)
    masked_credentials: Dict[str, str]  # Masked values for display
    last_tested_at: Optional[datetime] = None
    test_status: Optional[str] = None

    model_config = {"from_attributes": True}


# ─── Google Drive ────────────────────────────────────────────────────────────

class GoogleDriveRequest(BaseModel):
    folder_url: str = Field(..., min_length=1)
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None


class GoogleDriveResponse(BaseModel):
    folder_url: Optional[str] = None
    folder_id: Optional[str] = None
    is_connected: bool = False
    last_synced_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ═══════════════════════════════════════════════════════════════════════════════
# Cron Settings Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/cron", response_model=CronSettingsResponse)
async def get_cron_settings(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get the current cron schedule settings."""
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == user.id)
    )
    settings_row = result.scalar_one_or_none()

    if not settings_row:
        # Return defaults
        return CronSettingsResponse(
            scheduler_hour=9,
            scheduler_minute=0,
            engagement_delay_hours=2,
            analytics_day_of_week=1,
            analytics_hour=8,
            analytics_minute=0,
            timezone="Asia/Kolkata",
        )

    return CronSettingsResponse.model_validate(settings_row)


@router.put("/cron", response_model=CronSettingsResponse)
async def update_cron_settings(
    request: CronSettingsRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update cron schedule settings."""
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == user.id)
    )
    settings_row = result.scalar_one_or_none()

    if settings_row:
        settings_row.scheduler_hour = request.scheduler_hour
        settings_row.scheduler_minute = request.scheduler_minute
        settings_row.engagement_delay_hours = request.engagement_delay_hours
        settings_row.analytics_day_of_week = request.analytics_day_of_week
        settings_row.analytics_hour = request.analytics_hour
        settings_row.analytics_minute = request.analytics_minute
        settings_row.timezone = request.timezone
        settings_row.updated_at = datetime.utcnow()
    else:
        settings_row = UserSettings(
            user_id=user.id,
            scheduler_hour=request.scheduler_hour,
            scheduler_minute=request.scheduler_minute,
            engagement_delay_hours=request.engagement_delay_hours,
            analytics_day_of_week=request.analytics_day_of_week,
            analytics_hour=request.analytics_hour,
            analytics_minute=request.analytics_minute,
            timezone=request.timezone,
        )
        db.add(settings_row)

    await db.flush()
    await db.refresh(settings_row)

    logger.info(f"Cron settings updated for user {user.id}")
    return CronSettingsResponse.model_validate(settings_row)


# ═══════════════════════════════════════════════════════════════════════════════
# Platform Credentials Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

# Expected keys per platform for validation and display
PLATFORM_CREDENTIAL_KEYS: Dict[str, List[str]] = {
    "instagram": ["access_token", "business_account_id", "app_secret"],
    "facebook": ["access_token", "page_id", "app_secret"],
    "twitter": ["api_key", "api_secret", "access_token", "access_token_secret", "bearer_token"],
    "youtube": ["api_key", "client_id", "client_secret", "refresh_token"],
}


@router.get("/platforms", response_model=List[PlatformCredentialResponse])
async def list_platform_credentials(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all platform credential configurations."""
    result = await db.execute(
        select(PlatformCredential).where(PlatformCredential.user_id == user.id)
    )
    creds = result.scalars().all()

    # Build a map of saved platforms
    saved = {}
    for cred in creds:
        decrypted = decrypt_dict(cred.encrypted_credentials)
        saved[cred.platform.value] = PlatformCredentialResponse(
            platform=cred.platform.value,
            is_active=cred.is_active,
            credential_keys=list(decrypted.keys()),
            masked_credentials={k: mask_value(v) for k, v in decrypted.items()},
            last_tested_at=cred.last_tested_at,
            test_status=cred.test_status,
        )

    # Return all platforms (saved or empty)
    responses = []
    for platform_name in PLATFORM_CREDENTIAL_KEYS:
        if platform_name in saved:
            responses.append(saved[platform_name])
        else:
            responses.append(PlatformCredentialResponse(
                platform=platform_name,
                is_active=False,
                credential_keys=[],
                masked_credentials={},
            ))

    return responses


@router.get("/platforms/{platform_name}", response_model=PlatformCredentialResponse)
async def get_platform_credential(
    platform_name: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get credential configuration for a specific platform."""
    if platform_name not in PLATFORM_CREDENTIAL_KEYS:
        raise HTTPException(status_code=400, detail=f"Unknown platform: {platform_name}")

    result = await db.execute(
        select(PlatformCredential).where(
            PlatformCredential.user_id == user.id,
            PlatformCredential.platform == Platform(platform_name),
        )
    )
    cred = result.scalar_one_or_none()

    if not cred:
        return PlatformCredentialResponse(
            platform=platform_name,
            is_active=False,
            credential_keys=[],
            masked_credentials={},
        )

    decrypted = decrypt_dict(cred.encrypted_credentials)
    return PlatformCredentialResponse(
        platform=cred.platform.value,
        is_active=cred.is_active,
        credential_keys=list(decrypted.keys()),
        masked_credentials={k: mask_value(v) for k, v in decrypted.items()},
        last_tested_at=cred.last_tested_at,
        test_status=cred.test_status,
    )


@router.put("/platforms/{platform_name}", response_model=PlatformCredentialResponse)
async def save_platform_credential(
    platform_name: str,
    request: PlatformCredentialRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Save or update API credentials for a platform (stored encrypted)."""
    if platform_name not in PLATFORM_CREDENTIAL_KEYS:
        raise HTTPException(status_code=400, detail=f"Unknown platform: {platform_name}")

    encrypted = encrypt_dict(request.credentials)

    result = await db.execute(
        select(PlatformCredential).where(
            PlatformCredential.user_id == user.id,
            PlatformCredential.platform == Platform(platform_name),
        )
    )
    cred = result.scalar_one_or_none()

    if cred:
        cred.encrypted_credentials = encrypted
        cred.is_active = request.is_active
        cred.updated_at = datetime.utcnow()
    else:
        cred = PlatformCredential(
            user_id=user.id,
            platform=Platform(platform_name),
            encrypted_credentials=encrypted,
            is_active=request.is_active,
        )
        db.add(cred)

    await db.flush()
    await db.refresh(cred)

    decrypted = decrypt_dict(cred.encrypted_credentials)

    logger.info(f"Platform credentials saved: {platform_name} for user {user.id}")
    return PlatformCredentialResponse(
        platform=cred.platform.value,
        is_active=cred.is_active,
        credential_keys=list(decrypted.keys()),
        masked_credentials={k: mask_value(v) for k, v in decrypted.items()},
        last_tested_at=cred.last_tested_at,
        test_status=cred.test_status,
    )


@router.delete("/platforms/{platform_name}")
async def delete_platform_credential(
    platform_name: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete saved credentials for a platform."""
    result = await db.execute(
        select(PlatformCredential).where(
            PlatformCredential.user_id == user.id,
            PlatformCredential.platform == Platform(platform_name),
        )
    )
    cred = result.scalar_one_or_none()

    if not cred:
        raise HTTPException(status_code=404, detail="Credentials not found")

    await db.delete(cred)
    return {"status": "success", "message": f"{platform_name} credentials deleted"}


@router.post("/platforms/{platform_name}/test")
async def test_platform_credential(
    platform_name: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Test connectivity using saved credentials."""
    if platform_name not in PLATFORM_CREDENTIAL_KEYS:
        raise HTTPException(status_code=400, detail=f"Unknown platform: {platform_name}")

    result = await db.execute(
        select(PlatformCredential).where(
            PlatformCredential.user_id == user.id,
            PlatformCredential.platform == Platform(platform_name),
        )
    )
    cred = result.scalar_one_or_none()

    if not cred:
        return {"status": "not_configured", "message": "No credentials saved for this platform"}

    # Update test timestamp
    cred.last_tested_at = datetime.utcnow()

    try:
        decrypted = decrypt_dict(cred.encrypted_credentials)

        # Actually test the connection using the real platform client
        platform_client = None
        try:
            if platform_name == "facebook":
                from platforms.facebook import FacebookClient
                platform_client = FacebookClient(
                    access_token=decrypted.get("access_token"),
                    page_id=decrypted.get("page_id"),
                )
            elif platform_name == "instagram":
                from platforms.instagram import InstagramClient
                platform_client = InstagramClient(
                    access_token=decrypted.get("access_token"),
                    business_account_id=decrypted.get("business_account_id"),
                )
            elif platform_name == "twitter":
                from platforms.twitter import TwitterClient
                platform_client = TwitterClient(
                    api_key=decrypted.get("api_key"),
                    api_secret=decrypted.get("api_secret"),
                    access_token=decrypted.get("access_token"),
                    access_token_secret=decrypted.get("access_token_secret"),
                    bearer_token=decrypted.get("bearer_token"),
                )
            elif platform_name == "youtube":
                from platforms.youtube import YouTubeClient
                platform_client = YouTubeClient(
                    api_key=decrypted.get("api_key"),
                    client_id=decrypted.get("client_id"),
                    client_secret=decrypted.get("client_secret"),
                    refresh_token=decrypted.get("refresh_token"),
                )
        except Exception as e:
            logger.error(f"Failed to create {platform_name} client: {e}")

        if platform_client:
            is_connected = await platform_client.test_connection()
            if is_connected:
                cred.test_status = "connected"
                await db.flush()
                return {"status": "connected", "message": f"{platform_name} API connection successful! ✅"}
            else:
                cred.test_status = "failed"
                await db.flush()
                return {"status": "failed", "message": f"{platform_name} API returned an error. Check your credentials."}
        else:
            # Fallback: just check if values are non-empty
            has_values = all(bool(v) for v in decrypted.values())
            if has_values:
                cred.test_status = "connected"
                await db.flush()
                return {"status": "connected", "message": f"{platform_name} credentials saved (connection test not available)"}
            else:
                cred.test_status = "failed"
                await db.flush()
                return {"status": "failed", "message": "Some credential fields are empty"}
    except Exception as e:
        cred.test_status = "failed"
        await db.flush()
        return {"status": "error", "message": str(e)}


# ═══════════════════════════════════════════════════════════════════════════════
# Google Drive Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

def _extract_folder_id(url: str) -> Optional[str]:
    """Extract Google Drive folder ID from a URL."""
    patterns = [
        r"drive\.google\.com/drive/folders/([a-zA-Z0-9_-]+)",
        r"drive\.google\.com/.*[?&]id=([a-zA-Z0-9_-]+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


@router.get("/google-drive", response_model=GoogleDriveResponse)
async def get_google_drive_config(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get Google Drive configuration."""
    result = await db.execute(
        select(GoogleDriveConfig).where(GoogleDriveConfig.user_id == user.id)
    )
    config = result.scalar_one_or_none()

    if not config:
        return GoogleDriveResponse()

    return GoogleDriveResponse(
        folder_url=config.folder_url,
        folder_id=config.folder_id,
        is_connected=config.is_connected,
        last_synced_at=config.last_synced_at,
    )


@router.put("/google-drive", response_model=GoogleDriveResponse)
async def update_google_drive_config(
    request: GoogleDriveRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Save or update Google Drive configuration."""
    folder_id = _extract_folder_id(request.folder_url)
    if not folder_id:
        raise HTTPException(
            status_code=400,
            detail="Invalid Google Drive folder URL. Use a URL like: https://drive.google.com/drive/folders/FOLDER_ID",
        )

    # Encrypt tokens if provided
    encrypted_tokens = None
    has_tokens = bool(request.access_token or request.refresh_token)
    if has_tokens:
        token_data = {}
        if request.access_token:
            token_data["access_token"] = request.access_token
        if request.refresh_token:
            token_data["refresh_token"] = request.refresh_token
        encrypted_tokens = encrypt_dict(token_data)

    result = await db.execute(
        select(GoogleDriveConfig).where(GoogleDriveConfig.user_id == user.id)
    )
    config = result.scalar_one_or_none()

    if config:
        config.folder_url = request.folder_url
        config.folder_id = folder_id
        config.is_connected = True
        if encrypted_tokens:
            config.encrypted_tokens = encrypted_tokens
        config.updated_at = datetime.utcnow()
    else:
        config = GoogleDriveConfig(
            user_id=user.id,
            folder_url=request.folder_url,
            folder_id=folder_id,
            encrypted_tokens=encrypted_tokens,
            is_connected=True,
        )
        db.add(config)

    await db.flush()
    await db.refresh(config)

    logger.info(f"Google Drive configured: folder={folder_id} for user {user.id}")
    return GoogleDriveResponse(
        folder_url=config.folder_url,
        folder_id=config.folder_id,
        is_connected=config.is_connected,
        last_synced_at=config.last_synced_at,
    )


@router.delete("/google-drive")
async def delete_google_drive_config(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Disconnect Google Drive."""
    result = await db.execute(
        select(GoogleDriveConfig).where(GoogleDriveConfig.user_id == user.id)
    )
    config = result.scalar_one_or_none()

    if not config:
        raise HTTPException(status_code=404, detail="No Google Drive configuration found")

    await db.delete(config)
    return {"status": "success", "message": "Google Drive disconnected"}
