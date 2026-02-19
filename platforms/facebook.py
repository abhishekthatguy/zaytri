"""
Zaytri — Facebook Graph API Client
"""

import logging
from typing import Any, Dict, List, Optional
import httpx

from platforms.base_platform import BasePlatform

logger = logging.getLogger(__name__)

GRAPH_API_BASE = "https://graph.facebook.com/v19.0"


class FacebookClient(BasePlatform):
    """Facebook Graph API client for page management."""

    def __init__(self, access_token: str, page_id: str):
        super().__init__("Facebook", access_token)
        self.page_id = page_id

    async def publish(self, text: str, media_url: Optional[str] = None) -> str:
        """Publish a post to a Facebook page."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            params = {
                "message": text,
                "access_token": self.access_token,
            }
            if media_url:
                params["link"] = media_url

            resp = await client.post(
                f"{GRAPH_API_BASE}/{self.page_id}/feed",
                params=params,
            )
            resp.raise_for_status()
            return resp.json()["id"]

    async def get_comments(self, post_id: str) -> List[Dict[str, Any]]:
        """Fetch comments on a Facebook post."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                f"{GRAPH_API_BASE}/{post_id}/comments",
                params={
                    "fields": "id,message,from,created_time",
                    "access_token": self.access_token,
                },
            )
            resp.raise_for_status()
            data = resp.json().get("data", [])

            return [
                {
                    "id": c["id"],
                    "text": c.get("message", ""),
                    "author": c.get("from", {}).get("name", "Unknown"),
                    "created_at": c.get("created_time", ""),
                }
                for c in data
            ]

    async def reply_to_comment(self, comment_id: str, text: str) -> str:
        """Reply to a Facebook comment."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{GRAPH_API_BASE}/{comment_id}/comments",
                params={
                    "message": text,
                    "access_token": self.access_token,
                },
            )
            resp.raise_for_status()
            return resp.json().get("id", "")

    async def get_analytics(self, post_id: str) -> Dict[str, Any]:
        """Fetch Facebook post insights."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Basic metrics
            resp = await client.get(
                f"{GRAPH_API_BASE}/{post_id}",
                params={
                    "fields": "likes.summary(true),comments.summary(true),shares",
                    "access_token": self.access_token,
                },
            )
            resp.raise_for_status()
            data = resp.json()

            likes = data.get("likes", {}).get("summary", {}).get("total_count", 0)
            comments = data.get("comments", {}).get("summary", {}).get("total_count", 0)
            shares = data.get("shares", {}).get("count", 0)

            # Post insights
            insights_resp = await client.get(
                f"{GRAPH_API_BASE}/{post_id}/insights",
                params={
                    "metric": "post_impressions,post_impressions_unique",
                    "access_token": self.access_token,
                },
            )

            reach = 0
            impressions = 0
            if insights_resp.status_code == 200:
                for metric in insights_resp.json().get("data", []):
                    if metric["name"] == "post_impressions_unique":
                        reach = metric["values"][0]["value"]
                    elif metric["name"] == "post_impressions":
                        impressions = metric["values"][0]["value"]

            total = likes + comments + shares
            engagement_rate = (total / reach * 100) if reach > 0 else 0.0

            return {
                "likes": likes,
                "comments": comments,
                "shares": shares,
                "reach": reach,
                "impressions": impressions,
                "engagement_rate": round(engagement_rate, 2),
            }

    async def test_connection(self) -> bool:
        """Test Facebook API connectivity."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{GRAPH_API_BASE}/{self.page_id}",
                    params={
                        "fields": "id,name",
                        "access_token": self.access_token,
                    },
                )
                return resp.status_code == 200
        except Exception:
            return False
