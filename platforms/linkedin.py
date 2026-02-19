"""
Zaytri — LinkedIn API Client
Uses OAuth 2.0 access token for LinkedIn's Community Management API.
"""

import logging
from typing import Any, Dict, List, Optional
import httpx

from platforms.base_platform import BasePlatform

logger = logging.getLogger(__name__)

LINKEDIN_API_BASE = "https://api.linkedin.com/v2"
LINKEDIN_REST_BASE = "https://api.linkedin.com/rest"


class LinkedInClient(BasePlatform):
    """LinkedIn API client for personal profiles and company pages."""

    def __init__(self, access_token: str, person_urn: str = ""):
        """
        Args:
            access_token: OAuth 2.0 access token.
            person_urn: LinkedIn person URN (e.g. 'urn:li:person:abc123').
                        Retrieved via /userinfo or /me endpoint if not provided.
        """
        super().__init__("LinkedIn", access_token)
        self.person_urn = person_urn

    def _get_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
            "LinkedIn-Version": "202401",
        }

    async def _ensure_person_urn(self) -> str:
        """Lazily resolve the person URN from the /userinfo endpoint."""
        if self.person_urn:
            return self.person_urn

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{LINKEDIN_API_BASE}/userinfo",
                headers={"Authorization": f"Bearer {self.access_token}"},
            )
            resp.raise_for_status()
            sub = resp.json().get("sub", "")
            self.person_urn = f"urn:li:person:{sub}"
            return self.person_urn

    async def publish(self, text: str, media_url: Optional[str] = None) -> str:
        """Create a LinkedIn share/post."""
        author = await self._ensure_person_urn()

        payload: Dict[str, Any] = {
            "author": author,
            "lifecycleState": "PUBLISHED",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": {
                    "shareCommentary": {"text": text},
                    "shareMediaCategory": "NONE",
                }
            },
            "visibility": {
                "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
            },
        }

        if media_url:
            payload["specificContent"]["com.linkedin.ugc.ShareContent"]["shareMediaCategory"] = "ARTICLE"
            payload["specificContent"]["com.linkedin.ugc.ShareContent"]["media"] = [
                {
                    "status": "READY",
                    "originalUrl": media_url,
                }
            ]

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{LINKEDIN_API_BASE}/ugcPosts",
                headers=self._get_headers(),
                json=payload,
            )
            resp.raise_for_status()
            return resp.json().get("id", "")

    async def get_comments(self, post_id: str) -> List[Dict[str, Any]]:
        """Fetch comments on a LinkedIn post."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                f"{LINKEDIN_API_BASE}/socialActions/{post_id}/comments",
                headers=self._get_headers(),
            )
            if resp.status_code != 200:
                return []

            data = resp.json().get("elements", [])
            return [
                {
                    "id": c.get("$URN", c.get("id", "")),
                    "text": c.get("message", {}).get("text", ""),
                    "author": c.get("actor", "Unknown"),
                    "created_at": str(c.get("created", {}).get("time", "")),
                }
                for c in data
            ]

    async def reply_to_comment(self, comment_id: str, text: str) -> str:
        """Reply to a LinkedIn comment."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{LINKEDIN_API_BASE}/socialActions/{comment_id}/comments",
                headers=self._get_headers(),
                json={
                    "actor": await self._ensure_person_urn(),
                    "message": {"text": text},
                },
            )
            resp.raise_for_status()
            return resp.json().get("$URN", resp.json().get("id", ""))

    async def get_analytics(self, post_id: str) -> Dict[str, Any]:
        """Fetch LinkedIn post social actions (likes, comments)."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                f"{LINKEDIN_API_BASE}/socialActions/{post_id}",
                headers=self._get_headers(),
            )
            if resp.status_code != 200:
                return {
                    "likes": 0, "comments": 0, "shares": 0,
                    "reach": 0, "impressions": 0, "engagement_rate": 0.0,
                }

            data = resp.json()
            likes = data.get("likesSummary", {}).get("totalLikes", 0)
            comments = data.get("commentsSummary", {}).get("totalFirstLevelComments", 0)

            return {
                "likes": likes,
                "comments": comments,
                "shares": 0,
                "reach": 0,  # LinkedIn doesn't expose reach via this endpoint
                "impressions": 0,
                "engagement_rate": 0.0,
            }

    async def test_connection(self) -> bool:
        """Test LinkedIn API connectivity."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{LINKEDIN_API_BASE}/userinfo",
                    headers={"Authorization": f"Bearer {self.access_token}"},
                )
                return resp.status_code == 200
        except Exception:
            return False
