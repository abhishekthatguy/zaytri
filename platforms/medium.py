"""
Zaytri — Medium API Client
Uses Medium's API with OAuth access tokens.
"""

import logging
from typing import Any, Dict, List, Optional
import httpx

from platforms.base_platform import BasePlatform

logger = logging.getLogger(__name__)

MEDIUM_API_BASE = "https://api.medium.com/v1"


class MediumClient(BasePlatform):
    """Medium API client for publishing stories."""

    def __init__(self, access_token: str, author_id: str = ""):
        """
        Args:
            access_token: Medium API integration token or OAuth token.
            author_id: Medium user ID. Resolved via /me if not provided.
        """
        super().__init__("Medium", access_token)
        self.author_id = author_id

    def _get_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    async def _ensure_author_id(self) -> str:
        """Lazily resolve the author ID from the /me endpoint."""
        if self.author_id:
            return self.author_id

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{MEDIUM_API_BASE}/me",
                headers=self._get_headers(),
            )
            resp.raise_for_status()
            self.author_id = resp.json().get("data", {}).get("id", "")
            return self.author_id

    async def publish(self, text: str, media_url: Optional[str] = None) -> str:
        """
        Publish a story to Medium.

        The `text` is treated as the story body (HTML or Markdown).
        First line is used as the title.
        """
        author_id = await self._ensure_author_id()

        # Extract title from first line, rest is content
        lines = text.strip().split("\n", 1)
        title = lines[0][:100] if lines else "Untitled"
        content = lines[1].strip() if len(lines) > 1 else text

        # Append media as image if provided
        if media_url:
            content += f'\n\n<img src="{media_url}" alt="Post image" />'

        payload = {
            "title": title,
            "contentFormat": "html",
            "content": content,
            "publishStatus": "public",
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{MEDIUM_API_BASE}/users/{author_id}/posts",
                headers=self._get_headers(),
                json=payload,
            )
            resp.raise_for_status()
            return resp.json().get("data", {}).get("id", "")

    async def get_comments(self, post_id: str) -> List[Dict[str, Any]]:
        """
        Fetch comments on a Medium story.
        Note: Medium's API has limited comment support.
        """
        # Medium's official API doesn't expose comments
        logger.info("Medium API does not support fetching comments directly.")
        return []

    async def reply_to_comment(self, comment_id: str, text: str) -> str:
        """
        Reply to a Medium comment.
        Note: Medium's API doesn't support programmatic replies.
        """
        logger.info("Medium API does not support replying to comments programmatically.")
        return ""

    async def get_analytics(self, post_id: str) -> Dict[str, Any]:
        """
        Fetch Medium story statistics.
        Note: Medium's API has limited analytics — stats are mainly visible in the dashboard.
        """
        # Medium's official API doesn't expose analytics
        return {
            "likes": 0,
            "comments": 0,
            "shares": 0,
            "reach": 0,
            "impressions": 0,
            "engagement_rate": 0.0,
        }

    async def test_connection(self) -> bool:
        """Test Medium API connectivity."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{MEDIUM_API_BASE}/me",
                    headers=self._get_headers(),
                )
                return resp.status_code == 200
        except Exception:
            return False
