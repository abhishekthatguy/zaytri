"""
Zaytri — Platform Configuration API Routes
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Dict

from auth.dependencies import get_current_user
from auth.models import User
from config import settings

router = APIRouter(prefix="/platforms", tags=["Platforms"])


class PlatformStatus(BaseModel):
    name: str
    configured: bool
    connected: bool = False


@router.get("", response_model=list[PlatformStatus])
async def list_platforms(
    user: User = Depends(get_current_user),
):
    """List all platforms and their configuration status."""
    return [
        PlatformStatus(name="instagram", configured=settings.is_instagram_configured),
        PlatformStatus(name="facebook", configured=settings.is_facebook_configured),
        PlatformStatus(name="twitter", configured=settings.is_twitter_configured),
        PlatformStatus(name="youtube", configured=settings.is_youtube_configured),
    ]


@router.post("/{platform_name}/test")
async def test_platform_connection(
    platform_name: str,
    user: User = Depends(get_current_user),
):
    """Test connectivity to a specific platform API."""
    platform_clients = {
        "instagram": ("platforms.instagram", "InstagramClient", settings.is_instagram_configured),
        "facebook": ("platforms.facebook", "FacebookClient", settings.is_facebook_configured),
        "twitter": ("platforms.twitter", "TwitterClient", settings.is_twitter_configured),
        "youtube": ("platforms.youtube", "YouTubeClient", settings.is_youtube_configured),
    }

    if platform_name not in platform_clients:
        return {"status": "error", "message": f"Unknown platform: {platform_name}"}

    module_path, class_name, is_configured = platform_clients[platform_name]

    if not is_configured:
        return {
            "status": "not_configured",
            "message": f"{platform_name} API credentials are not configured in .env",
        }

    try:
        import importlib
        module = importlib.import_module(module_path)
        client_class = getattr(module, class_name)
        client = client_class()
        connected = await client.test_connection()

        return {
            "status": "connected" if connected else "failed",
            "message": f"{platform_name} API {'connected' if connected else 'connection failed'}",
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}
