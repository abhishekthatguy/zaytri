"""
Zaytri — OAuth Handlers
Google, Facebook, GitHub, Twitter OAuth flows.
All client IDs/secrets come from .env — configure once, use everywhere.
No 3rd-party auth libraries — we handle the OAuth flow ourselves via httpx.
"""

import httpx
import logging
from typing import Optional, Dict, Any
from urllib.parse import urlencode
from config import settings

logger = logging.getLogger(__name__)


class OAuthUserInfo:
    """Normalized user info from any OAuth provider."""

    def __init__(
        self,
        provider: str,
        provider_user_id: str,
        email: Optional[str],
        name: Optional[str],
        avatar_url: Optional[str] = None,
        access_token: Optional[str] = None,
        refresh_token: Optional[str] = None,
    ):
        self.provider = provider
        self.provider_user_id = provider_user_id
        self.email = email
        self.name = name
        self.avatar_url = avatar_url
        self.access_token = access_token
        self.refresh_token = refresh_token


async def get_google_user(code: str, redirect_uri: str) -> Optional[OAuthUserInfo]:
    """Exchange Google auth code for user info."""
    try:
        async with httpx.AsyncClient() as client:
            # Exchange code for token
            token_resp = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": settings.oauth_google_client_id,
                    "client_secret": settings.oauth_google_client_secret,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
            token_data = token_resp.json()
            access_token = token_data.get("access_token")
            if not access_token:
                logger.error(f"Google OAuth token error: {token_data}")
                return None

            # Get user info
            user_resp = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            user_data = user_resp.json()

            return OAuthUserInfo(
                provider="google",
                provider_user_id=str(user_data["id"]),
                email=user_data.get("email"),
                name=user_data.get("name"),
                avatar_url=user_data.get("picture"),
                access_token=access_token,
                refresh_token=token_data.get("refresh_token"),
            )
    except Exception as e:
        logger.error(f"Google OAuth error: {e}")
        return None


async def get_facebook_user(code: str, redirect_uri: str) -> Optional[OAuthUserInfo]:
    """Exchange Facebook auth code for user info."""
    try:
        async with httpx.AsyncClient() as client:
            token_resp = await client.get(
                "https://graph.facebook.com/v18.0/oauth/access_token",
                params={
                    "client_id": settings.oauth_facebook_app_id,
                    "client_secret": settings.oauth_facebook_app_secret,
                    "code": code,
                    "redirect_uri": redirect_uri,
                },
            )
            token_data = token_resp.json()
            access_token = token_data.get("access_token")
            if not access_token:
                logger.error(f"Facebook OAuth token error: {token_data}")
                return None

            user_resp = await client.get(
                "https://graph.facebook.com/me",
                params={
                    "fields": "id,name,email,picture.type(large)",
                    "access_token": access_token,
                },
            )
            user_data = user_resp.json()

            return OAuthUserInfo(
                provider="facebook",
                provider_user_id=str(user_data["id"]),
                email=user_data.get("email"),
                name=user_data.get("name"),
                avatar_url=user_data.get("picture", {}).get("data", {}).get("url"),
                access_token=access_token,
            )
    except Exception as e:
        logger.error(f"Facebook OAuth error: {e}")
        return None


async def get_github_user(code: str, redirect_uri: str) -> Optional[OAuthUserInfo]:
    """Exchange GitHub auth code for user info."""
    try:
        async with httpx.AsyncClient() as client:
            token_resp = await client.post(
                "https://github.com/login/oauth/access_token",
                data={
                    "client_id": settings.oauth_github_client_id,
                    "client_secret": settings.oauth_github_client_secret,
                    "code": code,
                    "redirect_uri": redirect_uri,
                },
                headers={"Accept": "application/json"},
            )
            token_data = token_resp.json()
            access_token = token_data.get("access_token")
            if not access_token:
                logger.error(f"GitHub OAuth token error: {token_data}")
                return None

            # Get user profile
            user_resp = await client.get(
                "https://api.github.com/user",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            user_data = user_resp.json()

            # Get primary email
            email = user_data.get("email")
            if not email:
                emails_resp = await client.get(
                    "https://api.github.com/user/emails",
                    headers={"Authorization": f"Bearer {access_token}"},
                )
                emails = emails_resp.json()
                for e in emails:
                    if e.get("primary") and e.get("verified"):
                        email = e["email"]
                        break

            return OAuthUserInfo(
                provider="github",
                provider_user_id=str(user_data["id"]),
                email=email,
                name=user_data.get("name") or user_data.get("login"),
                avatar_url=user_data.get("avatar_url"),
                access_token=access_token,
            )
    except Exception as e:
        logger.error(f"GitHub OAuth error: {e}")
        return None


async def get_twitter_user(code: str, redirect_uri: str) -> Optional[OAuthUserInfo]:
    """Exchange Twitter (X) OAuth 2.0 code for user info."""
    try:
        async with httpx.AsyncClient() as client:
            # Twitter uses PKCE, basic auth for token exchange
            import base64
            credentials = base64.b64encode(
                f"{settings.oauth_twitter_client_id}:{settings.oauth_twitter_client_secret}".encode()
            ).decode()

            token_resp = await client.post(
                "https://api.twitter.com/2/oauth2/token",
                data={
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri,
                    "code_verifier": "challenge",  # PKCE verifier
                },
                headers={
                    "Authorization": f"Basic {credentials}",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            )
            token_data = token_resp.json()
            access_token = token_data.get("access_token")
            if not access_token:
                logger.error(f"Twitter OAuth token error: {token_data}")
                return None

            user_resp = await client.get(
                "https://api.twitter.com/2/users/me",
                params={"user.fields": "id,name,username,profile_image_url"},
                headers={"Authorization": f"Bearer {access_token}"},
            )
            user_data = user_resp.json().get("data", {})

            return OAuthUserInfo(
                provider="twitter",
                provider_user_id=str(user_data.get("id", "")),
                email=None,  # Twitter doesn't give email in basic scope
                name=user_data.get("name"),
                avatar_url=user_data.get("profile_image_url"),
                access_token=access_token,
            )
    except Exception as e:
        logger.error(f"Twitter OAuth error: {e}")
        return None


# ─── OAuth URL Generators ───────────────────────────────────────────────────

def get_oauth_login_url(provider: str, redirect_uri: str) -> Optional[str]:
    """Generate the OAuth authorization URL for a provider."""
    urls = {
        "google": (
            "https://accounts.google.com/o/oauth2/v2/auth?"
            + urlencode({
                "client_id": settings.oauth_google_client_id,
                "redirect_uri": redirect_uri,
                "response_type": "code",
                "scope": "openid email profile",
                "access_type": "offline",
                "prompt": "consent",
                "state": provider,
            })
        ),
        "facebook": (
            "https://www.facebook.com/v18.0/dialog/oauth?"
            + urlencode({
                "client_id": settings.oauth_facebook_app_id,
                "redirect_uri": redirect_uri,
                "scope": "email,public_profile",
                "state": provider,
            })
        ),
        "github": (
            "https://github.com/login/oauth/authorize?"
            + urlencode({
                "client_id": settings.oauth_github_client_id,
                "redirect_uri": redirect_uri,
                "scope": "read:user user:email",
                "state": provider,
            })
        ),
        "twitter": (
            "https://twitter.com/i/oauth2/authorize?"
            + urlencode({
                "client_id": settings.oauth_twitter_client_id,
                "redirect_uri": redirect_uri,
                "response_type": "code",
                "scope": "tweet.read users.read",
                "state": provider,
                "code_challenge": "challenge",
                "code_challenge_method": "plain",
            })
        ),
    }
    return urls.get(provider)


def get_configured_providers() -> Dict[str, bool]:
    """Return which OAuth providers are configured."""
    return {
        "google": bool(settings.oauth_google_client_id and settings.oauth_google_client_secret),
        "facebook": bool(settings.oauth_facebook_app_id and settings.oauth_facebook_app_secret),
        "github": bool(settings.oauth_github_client_id and settings.oauth_github_client_secret),
        "twitter": bool(settings.oauth_twitter_client_id and settings.oauth_twitter_client_secret),
    }


# ─── Provider Dispatcher ────────────────────────────────────────────────────

OAUTH_HANDLERS = {
    "google": get_google_user,
    "facebook": get_facebook_user,
    "github": get_github_user,
    "twitter": get_twitter_user,
}


async def handle_oauth_callback(
    provider: str, code: str, redirect_uri: str
) -> Optional[OAuthUserInfo]:
    """Route OAuth callback to the correct handler."""
    handler = OAUTH_HANDLERS.get(provider)
    if not handler:
        return None
    return await handler(code, redirect_uri)
