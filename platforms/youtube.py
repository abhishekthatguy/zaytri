"""
Zaytri — YouTube Data API Client
"""

import logging
from typing import Any, Dict, List, Optional
import httpx

from platforms.base_platform import BasePlatform

logger = logging.getLogger(__name__)

YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3"


class YouTubeClient(BasePlatform):
    """YouTube Data API v3 client using OAuth 2.0 access token."""

    def __init__(self, access_token: str):
        super().__init__("YouTube", access_token)

    def _get_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }

    async def publish(self, text: str, media_url: Optional[str] = None) -> str:
        """
        Publish to YouTube.
        Note: Full video upload requires multipart upload via resumable sessions.
        This handles community post / text updates.
        """
        logger.warning(
            "YouTube publish: Full video upload requires resumable upload flow. "
            "Use this for description/community post updates."
        )
        return "youtube-pending"

    async def get_comments(self, post_id: str) -> List[Dict[str, Any]]:
        """Fetch comments on a YouTube video."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                f"{YOUTUBE_API_BASE}/commentThreads",
                headers=self._get_headers(),
                params={
                    "part": "snippet",
                    "videoId": post_id,
                    "maxResults": 100,
                    "order": "time",
                },
            )
            resp.raise_for_status()
            items = resp.json().get("items", [])

            return [
                {
                    "id": item["id"],
                    "text": item["snippet"]["topLevelComment"]["snippet"].get(
                        "textDisplay", ""
                    ),
                    "author": item["snippet"]["topLevelComment"]["snippet"].get(
                        "authorDisplayName", "Unknown"
                    ),
                    "created_at": item["snippet"]["topLevelComment"]["snippet"].get(
                        "publishedAt", ""
                    ),
                }
                for item in items
            ]

    async def reply_to_comment(self, comment_id: str, text: str) -> str:
        """Reply to a YouTube comment."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{YOUTUBE_API_BASE}/comments",
                params={"part": "snippet"},
                headers=self._get_headers(),
                json={
                    "snippet": {
                        "parentId": comment_id,
                        "textOriginal": text,
                    }
                },
            )
            resp.raise_for_status()
            return resp.json().get("id", "")

    async def get_analytics(self, post_id: str) -> Dict[str, Any]:
        """Fetch YouTube video statistics."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                f"{YOUTUBE_API_BASE}/videos",
                headers=self._get_headers(),
                params={
                    "part": "statistics",
                    "id": post_id,
                },
            )
            resp.raise_for_status()
            items = resp.json().get("items", [])

            if not items:
                return {
                    "likes": 0, "comments": 0, "shares": 0,
                    "reach": 0, "impressions": 0, "engagement_rate": 0.0,
                }

            stats = items[0].get("statistics", {})
            views = int(stats.get("viewCount", 0))
            likes = int(stats.get("likeCount", 0))
            comments = int(stats.get("commentCount", 0))
            favorites = int(stats.get("favoriteCount", 0))

            total = likes + comments + favorites
            engagement_rate = (total / views * 100) if views > 0 else 0.0

            return {
                "likes": likes,
                "comments": comments,
                "shares": 0,  # YouTube doesn't expose share count
                "reach": views,
                "impressions": views,
                "engagement_rate": round(engagement_rate, 2),
            }

    async def test_connection(self) -> bool:
        """Test YouTube API connectivity."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{YOUTUBE_API_BASE}/channels",
                    headers=self._get_headers(),
                    params={
                        "part": "id",
                        "mine": "true",
                    },
                )
                return resp.status_code == 200
        except Exception:
            return False
