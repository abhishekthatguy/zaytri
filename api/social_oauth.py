"""
Zaytri — Social Platform OAuth Handlers
Separate from login OAuth — this handles connecting social media platforms
for publishing with platform-specific scopes (manage_pages, publish_video, etc.).
"""

import httpx
import logging
from typing import Optional, Dict, Any
from dataclasses import dataclass, field
from config import settings
from urllib.parse import urlencode

logger = logging.getLogger(__name__)


# ─── Normalized Social Account Info ─────────────────────────────────────────

@dataclass
class SocialAccountInfo:
    """Normalized info returned after a social platform OAuth flow."""
    platform: str
    platform_account_id: str
    username: str
    avatar_url: Optional[str] = None
    account_type: str = "personal"  # personal, page, business, channel
    access_token: str = ""
    refresh_token: Optional[str] = None
    token_expires_in: Optional[int] = None  # seconds
    scopes: str = ""
    extra: Dict[str, Any] = field(default_factory=dict)


# ─── Platform OAuth Configs ─────────────────────────────────────────────────

SOCIAL_OAUTH_CONFIGS: Dict[str, Dict[str, Any]] = {
    "instagram": {
        "display_name": "Instagram",
        "icon": "📸",
        "requires": ["oauth_facebook_app_id", "oauth_facebook_app_secret"],
        "note": "Connects via Facebook/Meta Graph API OAuth",
    },
    "facebook": {
        "display_name": "Facebook",
        "icon": "👤",
        "requires": ["oauth_facebook_app_id", "oauth_facebook_app_secret"],
        "note": "Connects via Facebook OAuth — manages Pages",
    },
    "twitter": {
        "display_name": "X (Twitter)",
        "icon": "𝕏",
        "requires": ["oauth_twitter_client_id", "oauth_twitter_client_secret"],
        "note": "Connects via Twitter/X OAuth 2.0",
    },
    "youtube": {
        "display_name": "YouTube",
        "icon": "▶️",
        "requires": ["oauth_google_client_id", "oauth_google_client_secret"],
        "note": "Connects via Google OAuth with YouTube scopes",
    },
    "linkedin": {
        "display_name": "LinkedIn",
        "icon": "💼",
        "requires": ["oauth_linkedin_client_id", "oauth_linkedin_client_secret"],
        "note": "Connects via LinkedIn OAuth 2.0",
    },
    "reddit": {
        "display_name": "Reddit",
        "icon": "🤖",
        "requires": ["oauth_reddit_client_id", "oauth_reddit_client_secret"],
        "note": "Connects via Reddit OAuth 2.0",
    },
    "medium": {
        "display_name": "Medium",
        "icon": "✍️",
        "requires": ["oauth_medium_client_id", "oauth_medium_client_secret"],
        "note": "Connects via Medium OAuth — publish stories",
    },
    "blogger": {
        "display_name": "Blogger",
        "icon": "📝",
        "requires": ["oauth_google_client_id", "oauth_google_client_secret"],
        "note": "Connects via Google OAuth with Blogger scopes",
    },
    "gmail": {
        "display_name": "Gmail",
        "icon": "📧",
        "requires": ["oauth_google_client_id", "oauth_google_client_secret"],
        "note": "Connects via Google OAuth with Gmail scopes",
    },
}


def is_platform_oauth_configured(platform: str) -> bool:
    """Check if the required OAuth credentials for a platform are set."""
    config = SOCIAL_OAUTH_CONFIGS.get(platform)
    if not config:
        return False
    for attr_name in config["requires"]:
        if not getattr(settings, attr_name, ""):
            return False
    return True


def get_configured_social_platforms() -> Dict[str, Dict[str, Any]]:
    """
    Return all platforms — always marked as configured so users see
    a 'Connect' button for every platform.  Actual credential
    validation happens at connect-time in get_social_connect_url().
    """
    result = {}
    for platform, config in SOCIAL_OAUTH_CONFIGS.items():
        result[platform] = {
            "display_name": config["display_name"],
            "icon": config["icon"],
            "configured": True,  # always show Connect button
            "has_credentials": is_platform_oauth_configured(platform),
            "note": config.get("note", ""),
        }
    return result


# ─── OAuth URL Generators (Social Connect — NOT login) ──────────────────────

def get_missing_credentials(platform: str) -> list[str]:
    """Return list of missing credential names for a platform."""
    config = SOCIAL_OAUTH_CONFIGS.get(platform)
    if not config:
        return []
    missing = []
    for attr_name in config["requires"]:
        if not getattr(settings, attr_name, ""):
            missing.append(attr_name.upper())
    return missing


def get_social_connect_url(platform: str, redirect_uri: str, state: str = "") -> Optional[str]:
    """
    Generate the OAuth authorization URL for connecting a social platform.
    Uses platform-specific scopes for publishing/managing content.
    """
    if not is_platform_oauth_configured(platform):
        return None

    generators = {
        "instagram": _instagram_connect_url,
        "facebook": _facebook_connect_url,
        "twitter": _twitter_connect_url,
        "youtube": _youtube_connect_url,
        "linkedin": _linkedin_connect_url,
        "reddit": _reddit_connect_url,
        "medium": _medium_connect_url,
        "blogger": _blogger_connect_url,
        "gmail": _gmail_connect_url,
    }

    generator = generators.get(platform)
    if not generator:
        return None
    return generator(redirect_uri, state)


def _instagram_connect_url(redirect_uri: str, state: str) -> str:
    """Instagram uses Facebook/Meta Graph API with instagram_basic + pages scopes."""
    params = urlencode({
        "client_id": settings.oauth_facebook_app_id,
        "redirect_uri": redirect_uri,
        "scope": "instagram_basic,instagram_content_publish,instagram_manage_comments,instagram_manage_insights,pages_show_list,pages_read_engagement",
        "response_type": "code",
        "state": state or "instagram",
    })
    return f"https://www.facebook.com/v18.0/dialog/oauth?{params}"


def _facebook_connect_url(redirect_uri: str, state: str) -> str:
    """Facebook Pages — manage posts, comments, insights."""
    params = urlencode({
        "client_id": settings.oauth_facebook_app_id,
        "redirect_uri": redirect_uri,
        "scope": "pages_manage_posts,pages_read_engagement,pages_show_list,pages_manage_metadata,public_profile",
        "response_type": "code",
        "state": state or "facebook",
    })
    return f"https://www.facebook.com/v18.0/dialog/oauth?{params}"


def _twitter_connect_url(redirect_uri: str, state: str) -> str:
    """Twitter/X — tweet read/write."""
    params = urlencode({
        "client_id": settings.oauth_twitter_client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "tweet.read tweet.write users.read offline.access",
        "state": state or "twitter",
        "code_challenge": "challenge",
        "code_challenge_method": "plain",
    })
    return f"https://twitter.com/i/oauth2/authorize?{params}"


def _youtube_connect_url(redirect_uri: str, state: str) -> str:
    """YouTube — upload videos, manage channels."""
    params = urlencode({
        "client_id": settings.oauth_google_client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly",
        "access_type": "offline",
        "prompt": "consent",
        "state": state or "youtube",
    })
    return f"https://accounts.google.com/o/oauth2/v2/auth?{params}"


def _linkedin_connect_url(redirect_uri: str, state: str) -> str:
    """LinkedIn — share posts, company pages."""
    params = urlencode({
        "client_id": getattr(settings, "oauth_linkedin_client_id", ""),
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid profile w_member_social",
        "state": state or "linkedin",
    })
    return f"https://www.linkedin.com/oauth/v2/authorization?{params}"


def _reddit_connect_url(redirect_uri: str, state: str) -> str:
    """Reddit — submit posts, manage comments."""
    params = urlencode({
        "client_id": getattr(settings, "oauth_reddit_client_id", ""),
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "submit read identity",
        "state": state or "reddit",
        "duration": "permanent",
    })
    return f"https://www.reddit.com/api/v1/authorize?{params}"


def _medium_connect_url(redirect_uri: str, state: str) -> str:
    """Medium — publish stories."""
    params = urlencode({
        "client_id": getattr(settings, "oauth_medium_client_id", ""),
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "basicProfile,publishPost",
        "state": state or "medium",
    })
    return f"https://medium.com/m/oauth/authorize?{params}"


def _blogger_connect_url(redirect_uri: str, state: str) -> str:
    """Blogger — uses Google OAuth with Blogger scopes."""
    params = urlencode({
        "client_id": settings.oauth_google_client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "https://www.googleapis.com/auth/blogger",
        "access_type": "offline",
        "prompt": "consent",
        "state": state or "blogger",
    })
    return f"https://accounts.google.com/o/oauth2/v2/auth?{params}"


def _gmail_connect_url(redirect_uri: str, state: str) -> str:
    """Gmail — send emails (e.g. newsletter distribution)."""
    params = urlencode({
        "client_id": settings.oauth_google_client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "https://www.googleapis.com/auth/gmail.send",
        "access_type": "offline",
        "prompt": "consent",
        "state": state or "gmail",
    })
    return f"https://accounts.google.com/o/oauth2/v2/auth?{params}"


# ─── OAuth Callback Handlers (exchange code for token + user info) ──────────

async def handle_social_callback(
    platform: str, code: str, redirect_uri: str
) -> Optional[SocialAccountInfo]:
    """Exchange OAuth code for tokens and fetch account info."""
    handlers = {
        "instagram": _handle_instagram_callback,
        "facebook": _handle_facebook_callback,
        "twitter": _handle_twitter_callback,
        "youtube": _handle_youtube_callback,
        "linkedin": _handle_linkedin_callback,
        "reddit": _handle_reddit_callback,
        "medium": _handle_medium_callback,
        "blogger": _handle_blogger_callback,
        "gmail": _handle_gmail_callback,
    }
    handler = handlers.get(platform)
    if not handler:
        logger.error(f"No social callback handler for platform: {platform}")
        return None
    return await handler(code, redirect_uri)


async def _handle_instagram_callback(code: str, redirect_uri: str) -> Optional[SocialAccountInfo]:
    """Instagram: exchange code via Facebook Graph, then get IG business accounts."""
    try:
        async with httpx.AsyncClient() as client:
            # Exchange code for user token
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
                logger.error(f"Instagram OAuth token error: {token_data}")
                return None

            # Get user's pages with connected Instagram accounts
            pages_resp = await client.get(
                "https://graph.facebook.com/v18.0/me/accounts",
                params={
                    "fields": "id,name,access_token,instagram_business_account{id,username,profile_picture_url}",
                    "access_token": access_token,
                },
            )
            pages_data = pages_resp.json().get("data", [])

            # Find first page with an Instagram business account
            for page in pages_data:
                ig_account = page.get("instagram_business_account")
                if ig_account:
                    page_token = page.get("access_token", access_token)
                    return SocialAccountInfo(
                        platform="instagram",
                        platform_account_id=ig_account["id"],
                        username=ig_account.get("username", ""),
                        avatar_url=ig_account.get("profile_picture_url"),
                        account_type="business",
                        access_token=page_token,
                        scopes="instagram_basic,instagram_content_publish,instagram_manage_comments",
                        extra={"page_id": page["id"], "page_name": page.get("name")},
                    )

            # No IG business account found — return user info instead
            user_resp = await client.get(
                "https://graph.facebook.com/v18.0/me",
                params={"fields": "id,name", "access_token": access_token},
            )
            user_data = user_resp.json()
            return SocialAccountInfo(
                platform="instagram",
                platform_account_id=user_data.get("id", ""),
                username=user_data.get("name", "user"),
                account_type="personal",
                access_token=access_token,
                scopes="instagram_basic",
            )
    except Exception as e:
        logger.error(f"Instagram social OAuth error: {e}")
        return None


async def _handle_facebook_callback(code: str, redirect_uri: str) -> Optional[SocialAccountInfo]:
    """Facebook: exchange code, get page tokens for publishing."""
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

            # Get user's pages
            pages_resp = await client.get(
                "https://graph.facebook.com/v18.0/me/accounts",
                params={
                    "fields": "id,name,access_token,picture{url}",
                    "access_token": access_token,
                },
            )
            pages_data = pages_resp.json().get("data", [])

            if pages_data:
                page = pages_data[0]
                return SocialAccountInfo(
                    platform="facebook",
                    platform_account_id=page["id"],
                    username=page.get("name", ""),
                    avatar_url=page.get("picture", {}).get("data", {}).get("url"),
                    account_type="page",
                    access_token=page.get("access_token", access_token),
                    scopes="pages_manage_posts,pages_read_engagement",
                    extra={"all_pages": [{"id": p["id"], "name": p.get("name")} for p in pages_data]},
                )

            # No pages — use personal profile
            user_resp = await client.get(
                "https://graph.facebook.com/v18.0/me",
                params={"fields": "id,name,picture.type(large)", "access_token": access_token},
            )
            user_data = user_resp.json()
            return SocialAccountInfo(
                platform="facebook",
                platform_account_id=user_data["id"],
                username=user_data.get("name", ""),
                avatar_url=user_data.get("picture", {}).get("data", {}).get("url"),
                account_type="personal",
                access_token=access_token,
                scopes="public_profile",
            )
    except Exception as e:
        logger.error(f"Facebook social OAuth error: {e}")
        return None


async def _handle_twitter_callback(code: str, redirect_uri: str) -> Optional[SocialAccountInfo]:
    """Twitter/X: exchange code for token, get user profile."""
    try:
        import base64
        async with httpx.AsyncClient() as client:
            credentials = base64.b64encode(
                f"{settings.oauth_twitter_client_id}:{settings.oauth_twitter_client_secret}".encode()
            ).decode()

            token_resp = await client.post(
                "https://api.twitter.com/2/oauth2/token",
                data={
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri,
                    "code_verifier": "challenge",
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

            return SocialAccountInfo(
                platform="twitter",
                platform_account_id=str(user_data.get("id", "")),
                username=f"@{user_data.get('username', '')}",
                avatar_url=user_data.get("profile_image_url"),
                account_type="personal",
                access_token=access_token,
                refresh_token=token_data.get("refresh_token"),
                token_expires_in=token_data.get("expires_in"),
                scopes="tweet.read tweet.write users.read",
            )
    except Exception as e:
        logger.error(f"Twitter social OAuth error: {e}")
        return None


async def _handle_youtube_callback(code: str, redirect_uri: str) -> Optional[SocialAccountInfo]:
    """YouTube: Google OAuth with YouTube scopes."""
    try:
        async with httpx.AsyncClient() as client:
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
                logger.error(f"YouTube OAuth token error: {token_data}")
                return None

            # Get channel info
            channel_resp = await client.get(
                "https://www.googleapis.com/youtube/v3/channels",
                params={"part": "snippet", "mine": "true"},
                headers={"Authorization": f"Bearer {access_token}"},
            )
            channels = channel_resp.json().get("items", [])

            if channels:
                ch = channels[0]
                snippet = ch.get("snippet", {})
                return SocialAccountInfo(
                    platform="youtube",
                    platform_account_id=ch["id"],
                    username=snippet.get("title", ""),
                    avatar_url=snippet.get("thumbnails", {}).get("default", {}).get("url"),
                    account_type="channel",
                    access_token=access_token,
                    refresh_token=token_data.get("refresh_token"),
                    token_expires_in=token_data.get("expires_in"),
                    scopes="youtube.upload,youtube.readonly",
                )

            return None
    except Exception as e:
        logger.error(f"YouTube social OAuth error: {e}")
        return None


async def _handle_linkedin_callback(code: str, redirect_uri: str) -> Optional[SocialAccountInfo]:
    """LinkedIn: exchange code for token, get profile."""
    try:
        async with httpx.AsyncClient() as client:
            token_resp = await client.post(
                "https://www.linkedin.com/oauth/v2/accessToken",
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": redirect_uri,
                    "client_id": getattr(settings, "oauth_linkedin_client_id", ""),
                    "client_secret": getattr(settings, "oauth_linkedin_client_secret", ""),
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            token_data = token_resp.json()
            access_token = token_data.get("access_token")
            if not access_token:
                logger.error(f"LinkedIn OAuth token error: {token_data}")
                return None

            user_resp = await client.get(
                "https://api.linkedin.com/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            user_data = user_resp.json()

            return SocialAccountInfo(
                platform="linkedin",
                platform_account_id=user_data.get("sub", ""),
                username=user_data.get("name", ""),
                avatar_url=user_data.get("picture"),
                account_type="personal",
                access_token=access_token,
                token_expires_in=token_data.get("expires_in"),
                scopes="openid,profile,w_member_social",
            )
    except Exception as e:
        logger.error(f"LinkedIn social OAuth error: {e}")
        return None


async def _handle_reddit_callback(code: str, redirect_uri: str) -> Optional[SocialAccountInfo]:
    """Reddit: exchange code for token, get user identity."""
    try:
        import base64
        async with httpx.AsyncClient() as client:
            client_id = getattr(settings, "oauth_reddit_client_id", "")
            client_secret = getattr(settings, "oauth_reddit_client_secret", "")
            credentials = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()

            token_resp = await client.post(
                "https://www.reddit.com/api/v1/access_token",
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": redirect_uri,
                },
                headers={
                    "Authorization": f"Basic {credentials}",
                    "Content-Type": "application/x-www-form-urlencoded",
                    "User-Agent": "Zaytri/1.0",
                },
            )
            token_data = token_resp.json()
            access_token = token_data.get("access_token")
            if not access_token:
                logger.error(f"Reddit OAuth token error: {token_data}")
                return None

            user_resp = await client.get(
                "https://oauth.reddit.com/api/v1/me",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "User-Agent": "Zaytri/1.0",
                },
            )
            user_data = user_resp.json()

            return SocialAccountInfo(
                platform="reddit",
                platform_account_id=user_data.get("id", ""),
                username=f"u/{user_data.get('name', '')}",
                avatar_url=user_data.get("icon_img", "").split("?")[0] if user_data.get("icon_img") else None,
                account_type="personal",
                access_token=access_token,
                refresh_token=token_data.get("refresh_token"),
                token_expires_in=token_data.get("expires_in"),
                scopes="submit,read,identity",
            )
    except Exception as e:
        logger.error(f"Reddit social OAuth error: {e}")
        return None


async def _handle_medium_callback(code: str, redirect_uri: str) -> Optional[SocialAccountInfo]:
    """Medium: exchange code for token, get user profile."""
    try:
        async with httpx.AsyncClient() as client:
            token_resp = await client.post(
                "https://api.medium.com/v1/tokens",
                data={
                    "code": code,
                    "client_id": getattr(settings, "oauth_medium_client_id", ""),
                    "client_secret": getattr(settings, "oauth_medium_client_secret", ""),
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            token_data = token_resp.json()
            access_token = token_data.get("access_token")
            if not access_token:
                logger.error(f"Medium OAuth token error: {token_data}")
                return None

            user_resp = await client.get(
                "https://api.medium.com/v1/me",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            user_data = user_resp.json().get("data", {})

            return SocialAccountInfo(
                platform="medium",
                platform_account_id=user_data.get("id", ""),
                username=f"@{user_data.get('username', '')}",
                avatar_url=user_data.get("imageUrl"),
                account_type="personal",
                access_token=access_token,
                scopes="basicProfile,publishPost",
            )
    except Exception as e:
        logger.error(f"Medium social OAuth error: {e}")
        return None


async def _handle_blogger_callback(code: str, redirect_uri: str) -> Optional[SocialAccountInfo]:
    """Blogger: Google OAuth with Blogger scope, get blog info."""
    try:
        async with httpx.AsyncClient() as client:
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
                logger.error(f"Blogger OAuth token error: {token_data}")
                return None

            # Get user's blogs
            blogs_resp = await client.get(
                "https://www.googleapis.com/blogger/v3/users/self/blogs",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            blogs = blogs_resp.json().get("items", [])

            if blogs:
                blog = blogs[0]
                return SocialAccountInfo(
                    platform="blogger",
                    platform_account_id=blog["id"],
                    username=blog.get("name", "My Blog"),
                    account_type="blog",
                    access_token=access_token,
                    refresh_token=token_data.get("refresh_token"),
                    token_expires_in=token_data.get("expires_in"),
                    scopes="blogger",
                    extra={"blog_url": blog.get("url"), "all_blogs": [{"id": b["id"], "name": b.get("name")} for b in blogs]},
                )
            return None
    except Exception as e:
        logger.error(f"Blogger social OAuth error: {e}")
        return None


async def _handle_gmail_callback(code: str, redirect_uri: str) -> Optional[SocialAccountInfo]:
    """Gmail: Google OAuth with gmail.send scope."""
    try:
        async with httpx.AsyncClient() as client:
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
                logger.error(f"Gmail OAuth token error: {token_data}")
                return None

            # Get user's email profile
            profile_resp = await client.get(
                "https://gmail.googleapis.com/gmail/v1/users/me/profile",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            profile_data = profile_resp.json()

            return SocialAccountInfo(
                platform="gmail",
                platform_account_id=profile_data.get("emailAddress", ""),
                username=profile_data.get("emailAddress", ""),
                account_type="email",
                access_token=access_token,
                refresh_token=token_data.get("refresh_token"),
                token_expires_in=token_data.get("expires_in"),
                scopes="gmail.send",
            )
    except Exception as e:
        logger.error(f"Gmail social OAuth error: {e}")
        return None
