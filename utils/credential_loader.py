"""
Zaytri — Platform Credential Loader (v2)
Resolves OAuth tokens from the SocialConnection model.
Falls back to legacy .env credentials during migration.
"""

import logging
from typing import Optional
from uuid import UUID

from utils.crypto import decrypt_value

logger = logging.getLogger(__name__)


async def get_social_connection_for_platform(
    platform: str,
    user_id: UUID,
    connection_id: Optional[UUID] = None,
):
    """
    Resolve an active SocialConnection for a platform + user.

    Priority:
    1. If `connection_id` is given, fetch that specific connection.
    2. Otherwise, pick the first active connection for the user on this platform.

    Returns:
        A SocialConnection ORM instance, or None.
    """
    from sqlalchemy import select
    from db.database import async_session
    from db.social_connections import SocialConnection
    from db.models import Platform as PlatformEnum

    try:
        async with async_session() as session:
            if connection_id:
                result = await session.execute(
                    select(SocialConnection).where(
                        SocialConnection.id == connection_id,
                        SocialConnection.is_active == True,
                    )
                )
            else:
                result = await session.execute(
                    select(SocialConnection).where(
                        SocialConnection.user_id == user_id,
                        SocialConnection.platform == PlatformEnum(platform),
                        SocialConnection.is_active == True,
                    ).order_by(SocialConnection.connected_at.desc())
                )

            conn = result.scalar_one_or_none()
            if conn:
                logger.info(f"Resolved SocialConnection for {platform}: @{conn.platform_username} (id={conn.id})")
            return conn

    except Exception as e:
        logger.error(f"Failed to resolve SocialConnection for {platform}: {e}")
        return None


def decrypt_token(encrypted_token: str) -> str:
    """Decrypt an encrypted OAuth token."""
    try:
        return decrypt_value(encrypted_token)
    except Exception as e:
        logger.error(f"Failed to decrypt token: {e}")
        return ""


async def get_platform_client(
    platform: str,
    user_id: UUID,
    connection_id: Optional[UUID] = None,
):
    """
    Get an initialized platform API client for a given platform + user.

    Resolves OAuth credentials from SocialConnection, decrypts the access token,
    and returns a ready-to-use platform client instance.

    Falls back to legacy .env credentials if no SocialConnection exists.

    Returns:
        A BasePlatform subclass instance, or None if no credentials are available.
    """
    # Try SocialConnection first (OAuth-connected accounts)
    social_conn = await get_social_connection_for_platform(platform, user_id, connection_id)

    if social_conn:
        access_token = decrypt_token(social_conn.access_token_encrypted)
        if not access_token:
            logger.error(f"Failed to decrypt access token for {platform} connection {social_conn.id}")
            return None

        return _build_client(
            platform=platform,
            access_token=access_token,
            platform_account_id=social_conn.platform_account_id,
        )

    # Fallback to legacy .env credentials during migration
    logger.info(f"No SocialConnection found for {platform}, trying legacy .env fallback")
    return _build_client_from_env(platform)


def _build_client(platform: str, access_token: str, platform_account_id: str = ""):
    """Build a platform client from an OAuth access token."""

    if platform == "facebook":
        from platforms.facebook import FacebookClient
        return FacebookClient(access_token=access_token, page_id=platform_account_id)

    elif platform == "instagram":
        from platforms.instagram import InstagramClient
        return InstagramClient(access_token=access_token, business_account_id=platform_account_id)

    elif platform == "twitter":
        from platforms.twitter import TwitterClient
        return TwitterClient(access_token=access_token)

    elif platform == "youtube":
        from platforms.youtube import YouTubeClient
        return YouTubeClient(access_token=access_token)

    elif platform == "linkedin":
        from platforms.linkedin import LinkedInClient
        return LinkedInClient(access_token=access_token, person_urn=platform_account_id)

    elif platform == "reddit":
        from platforms.reddit import RedditClient
        return RedditClient(access_token=access_token)

    elif platform == "medium":
        from platforms.medium import MediumClient
        return MediumClient(access_token=access_token, author_id=platform_account_id)

    logger.warning(f"No platform client implementation for: {platform}")
    return None


def _build_client_from_env(platform: str):
    """
    Legacy fallback: build a platform client from .env config.
    This will be removed once all users have migrated to OAuth connections.
    """
    try:
        from config import settings

        if platform == "facebook":
            if settings.facebook_access_token and settings.facebook_page_id:
                from platforms.facebook import FacebookClient
                return FacebookClient(
                    access_token=settings.facebook_access_token,
                    page_id=settings.facebook_page_id,
                )

        elif platform == "instagram":
            if settings.instagram_access_token and settings.instagram_business_account_id:
                from platforms.instagram import InstagramClient
                return InstagramClient(
                    access_token=settings.instagram_access_token,
                    business_account_id=settings.instagram_business_account_id,
                )

        elif platform == "twitter":
            if settings.twitter_bearer_token:
                from platforms.twitter import TwitterClient
                return TwitterClient(access_token=settings.twitter_bearer_token)

        elif platform == "youtube":
            if settings.youtube_api_key:
                from platforms.youtube import YouTubeClient
                return YouTubeClient(access_token=settings.youtube_api_key)

    except Exception as e:
        logger.error(f"Legacy .env fallback failed for {platform}: {e}")

    return None


# ── Legacy compatibility ─────────────────────────────────────────────────────
# The old `get_platform_credentials()` function is preserved for backward
# compatibility during migration. New code should use `get_platform_client()`
# directly.

async def get_platform_credentials(platform: str):
    """
    DEPRECATED: Use get_platform_client() instead.
    Returns a dict of legacy credentials from .env for backward compatibility.
    """
    logger.warning(
        f"get_platform_credentials('{platform}') is deprecated. "
        "Use get_platform_client() instead."
    )
    try:
        from config import settings

        if platform == "facebook":
            if settings.facebook_access_token and settings.facebook_page_id:
                return {"access_token": settings.facebook_access_token, "page_id": settings.facebook_page_id}
        elif platform == "instagram":
            if settings.instagram_access_token and settings.instagram_business_account_id:
                return {"access_token": settings.instagram_access_token, "business_account_id": settings.instagram_business_account_id}
        elif platform == "twitter":
            if settings.twitter_bearer_token:
                return {"access_token": settings.twitter_bearer_token}
        elif platform == "youtube":
            if settings.youtube_api_key:
                return {"api_key": settings.youtube_api_key}
    except Exception:
        pass
    return None
