"""
Zaytri — Social Connections API Router
Connect, list, disconnect social media accounts via OAuth.
"""

import logging
from datetime import datetime, timedelta
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from auth.dependencies import get_current_user, get_db
from auth.models import User
from db.social_connections import SocialConnection
from db.models import Platform
from api.social_oauth import (
    get_social_connect_url,
    handle_social_callback,
    get_configured_social_platforms,
    SOCIAL_OAUTH_CONFIGS,
)
from utils.crypto import encrypt_value, decrypt_value

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/social", tags=["Social Connections"])


# ─── Schemas ────────────────────────────────────────────────────────────────

class SocialConnectionResponse(BaseModel):
    id: str
    platform: str
    platform_account_id: str
    platform_username: Optional[str] = None
    platform_avatar_url: Optional[str] = None
    account_type: Optional[str] = None
    is_active: bool = True
    connected_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None
    last_error: Optional[str] = None
    brand_id: Optional[str] = None

    model_config = {"from_attributes": True}

class UpdateConnectionRequest(BaseModel):
    brand_id: Optional[str] = None


class PlatformInfo(BaseModel):
    platform: str
    display_name: str
    icon: str
    configured: bool
    connected_accounts: int = 0
    note: str = ""


class ConnectURLResponse(BaseModel):
    url: str
    platform: str


class CallbackRequest(BaseModel):
    code: str
    redirect_uri: str
    state: Optional[str] = None


# ─── Endpoints ──────────────────────────────────────────────────────────────

@router.get("/platforms", response_model=List[PlatformInfo])
async def list_social_platforms(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all supported platforms with connection status."""
    platforms_config = get_configured_social_platforms()

    # Count connected accounts per platform
    result = await db.execute(
        select(SocialConnection.platform, SocialConnection.id)
        .where(
            SocialConnection.user_id == user.id,
            SocialConnection.is_active == True,
        )
    )
    connections = result.all()
    counts: dict = {}
    for conn in connections:
        p = conn[0].value if hasattr(conn[0], 'value') else str(conn[0])
        counts[p] = counts.get(p, 0) + 1

    return [
        PlatformInfo(
            platform=platform,
            display_name=info["display_name"],
            icon=info["icon"],
            configured=info["configured"],
            connected_accounts=counts.get(platform, 0),
            note=info.get("note", ""),
        )
        for platform, info in platforms_config.items()
    ]


@router.get("/connect/{platform}", response_model=ConnectURLResponse)
async def get_connect_url(
    platform: str,
    redirect_uri: str = Query(..., description="Frontend callback URL"),
    user: User = Depends(get_current_user),
):
    """Generate OAuth authorization URL for connecting a social platform."""
    if platform not in SOCIAL_OAUTH_CONFIGS:
        raise HTTPException(status_code=400, detail=f"Unsupported platform: {platform}")

    url = get_social_connect_url(platform, redirect_uri, state=str(user.id))
    if not url:
        raise HTTPException(
            status_code=400,
            detail=f"OAuth not configured for {platform}. Add credentials to .env.",
        )

    return ConnectURLResponse(url=url, platform=platform)


@router.post("/callback/{platform}", response_model=SocialConnectionResponse)
async def handle_callback(
    platform: str,
    request: CallbackRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Handle OAuth callback — exchange code, store tokens, return connection info."""
    if platform not in SOCIAL_OAUTH_CONFIGS:
        raise HTTPException(status_code=400, detail=f"Unsupported platform: {platform}")

    # Exchange code for tokens + account info
    account_info = await handle_social_callback(platform, request.code, request.redirect_uri)
    if not account_info:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to connect {platform}. OAuth flow returned no data.",
        )

    # Validate platform enum
    try:
        platform_enum = Platform(platform)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid platform: {platform}")

    # Check if this account is already connected
    existing = await db.execute(
        select(SocialConnection).where(
            SocialConnection.user_id == user.id,
            SocialConnection.platform == platform_enum,
            SocialConnection.platform_account_id == account_info.platform_account_id,
        )
    )
    existing_conn = existing.scalar_one_or_none()

    # Calculate token expiry
    token_expires = None
    if account_info.token_expires_in:
        token_expires = datetime.utcnow() + timedelta(seconds=account_info.token_expires_in)

    if existing_conn:
        # Update existing connection
        existing_conn.access_token_encrypted = encrypt_value(account_info.access_token)
        if account_info.refresh_token:
            existing_conn.refresh_token_encrypted = encrypt_value(account_info.refresh_token)
        existing_conn.token_expires_at = token_expires
        existing_conn.platform_username = account_info.username
        existing_conn.platform_avatar_url = account_info.avatar_url
        existing_conn.account_type = account_info.account_type
        existing_conn.scopes = account_info.scopes
        existing_conn.is_active = True
        existing_conn.last_error = None
        existing_conn.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(existing_conn)

        logger.info(f"Updated social connection: {platform}/{account_info.username} for user {user.id}")
        return _to_response(existing_conn)
    else:
        # Create new connection
        new_conn = SocialConnection(
            user_id=user.id,
            platform=platform_enum,
            platform_account_id=account_info.platform_account_id,
            platform_username=account_info.username,
            platform_avatar_url=account_info.avatar_url,
            account_type=account_info.account_type,
            access_token_encrypted=encrypt_value(account_info.access_token),
            refresh_token_encrypted=encrypt_value(account_info.refresh_token) if account_info.refresh_token else None,
            token_expires_at=token_expires,
            scopes=account_info.scopes,
            is_active=True,
        )
        db.add(new_conn)
        await db.commit()
        await db.refresh(new_conn)

        logger.info(f"New social connection: {platform}/{account_info.username} for user {user.id}")
        return _to_response(new_conn)


@router.get("/connections", response_model=List[SocialConnectionResponse])
async def list_connections(
    platform: Optional[str] = Query(None, description="Filter by platform"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all connected social accounts for the current user."""
    query = select(SocialConnection).where(SocialConnection.user_id == user.id)
    if platform:
        try:
            platform_enum = Platform(platform)
            query = query.where(SocialConnection.platform == platform_enum)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid platform: {platform}")

    query = query.order_by(SocialConnection.connected_at.desc())
    result = await db.execute(query)
    connections = result.scalars().all()

    return [_to_response(conn) for conn in connections]


@router.delete("/connections/{connection_id}")
async def disconnect_account(
    connection_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Disconnect a social account (soft delete — deactivates)."""
    try:
        conn_uuid = UUID(connection_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid connection ID")

    result = await db.execute(
        select(SocialConnection).where(
            SocialConnection.id == conn_uuid,
            SocialConnection.user_id == user.id,
        )
    )
    conn = result.scalar_one_or_none()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")

    # Soft delete: deactivate and clear tokens
    conn.is_active = False
    conn.access_token_encrypted = encrypt_value("")  # Clear token
    conn.refresh_token_encrypted = None
    conn.updated_at = datetime.utcnow()
    await db.commit()

    logger.info(f"Disconnected social connection: {conn.platform.value}/{conn.platform_username} for user {user.id}")
    return {"message": f"Disconnected {conn.platform.value} account", "id": connection_id}


@router.put("/connections/{connection_id}", response_model=SocialConnectionResponse)
async def update_connection(
    connection_id: str,
    request: UpdateConnectionRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update connection settings (e.g. associate with a specific brand)."""
    try:
        conn_uuid = UUID(connection_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid connection ID")

    result = await db.execute(
        select(SocialConnection).where(
            SocialConnection.id == conn_uuid,
            SocialConnection.user_id == user.id,
        )
    )
    conn = result.scalar_one_or_none()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")

    if request.brand_id is not None:
        if request.brand_id == "":
            conn.brand_id = None
        else:
            try:
                conn.brand_id = UUID(request.brand_id)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid brand ID")

    conn.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(conn)

    return _to_response(conn)


@router.delete("/connections/{connection_id}/permanent")
async def permanently_delete_connection(
    connection_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Permanently delete a social connection record."""
    try:
        conn_uuid = UUID(connection_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid connection ID")

    result = await db.execute(
        delete(SocialConnection).where(
            SocialConnection.id == conn_uuid,
            SocialConnection.user_id == user.id,
        )
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Connection not found")

    await db.commit()
    return {"message": "Connection permanently deleted", "id": connection_id}


@router.post("/connections/{connection_id}/refresh")
async def refresh_token(
    connection_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Attempt to refresh an expired OAuth token."""
    try:
        conn_uuid = UUID(connection_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid connection ID")

    result = await db.execute(
        select(SocialConnection).where(
            SocialConnection.id == conn_uuid,
            SocialConnection.user_id == user.id,
        )
    )
    conn = result.scalar_one_or_none()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")

    if not conn.refresh_token_encrypted:
        raise HTTPException(
            status_code=400,
            detail="No refresh token available. Please reconnect the account.",
        )

    # TODO: Implement platform-specific token refresh logic
    # For now, return a message indicating the user should reconnect
    raise HTTPException(
        status_code=501,
        detail="Token refresh not yet implemented. Please disconnect and reconnect the account.",
    )


# ─── Helpers ────────────────────────────────────────────────────────────────

def _to_response(conn: SocialConnection) -> SocialConnectionResponse:
    """Convert a SocialConnection ORM object to a response schema."""
    return SocialConnectionResponse(
        id=str(conn.id),
        platform=conn.platform.value if hasattr(conn.platform, 'value') else str(conn.platform),
        platform_account_id=conn.platform_account_id,
        platform_username=conn.platform_username,
        platform_avatar_url=conn.platform_avatar_url,
        account_type=conn.account_type,
        is_active=conn.is_active,
        connected_at=conn.connected_at,
        last_used_at=conn.last_used_at,
        last_error=conn.last_error,
        brand_id=str(conn.brand_id) if conn.brand_id else None,
    )
