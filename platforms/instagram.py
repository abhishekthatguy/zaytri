"""
Zaytri — Instagram Graph API Client
"""

import logging
from typing import Any, Dict, List, Optional
import httpx

from platforms.base_platform import BasePlatform

logger = logging.getLogger(__name__)

GRAPH_API_BASE = "https://graph.facebook.com/v19.0"


class InstagramClient(BasePlatform):
    """Instagram Graph API client for business accounts."""

    def __init__(self, access_token: str, business_account_id: str):
        super().__init__("Instagram", access_token)
        self.account_id = business_account_id

    async def publish(self, text: str, media_url: Optional[str] = None) -> str:
        """Publish a post to Instagram."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            if media_url:
                # Step 1: Create media container
                create_resp = await client.post(
                    f"{GRAPH_API_BASE}/{self.account_id}/media",
                    params={
                        "image_url": media_url,
                        "caption": text,
                        "access_token": self.access_token,
                    },
                )
                create_resp.raise_for_status()
                container_id = create_resp.json()["id"]

                # Step 2: Publish the container
                publish_resp = await client.post(
                    f"{GRAPH_API_BASE}/{self.account_id}/media_publish",
                    params={
                        "creation_id": container_id,
                        "access_token": self.access_token,
                    },
                )
                publish_resp.raise_for_status()
                return publish_resp.json()["id"]
            else:
                # Text-only (carousel or story could be added later)
                resp = await client.post(
                    f"{GRAPH_API_BASE}/{self.account_id}/media",
                    params={
                        "caption": text,
                        "access_token": self.access_token,
                    },
                )
                resp.raise_for_status()
                return resp.json().get("id", "")

    async def get_comments(self, post_id: str) -> List[Dict[str, Any]]:
        """Fetch comments on an Instagram post."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                f"{GRAPH_API_BASE}/{post_id}/comments",
                params={
                    "fields": "id,text,username,timestamp",
                    "access_token": self.access_token,
                },
            )
            resp.raise_for_status()
            data = resp.json().get("data", [])

            return [
                {
                    "id": c["id"],
                    "text": c.get("text", ""),
                    "author": c.get("username", "Unknown"),
                    "created_at": c.get("timestamp", ""),
                }
                for c in data
            ]

    async def reply_to_comment(self, comment_id: str, text: str) -> str:
        """Reply to an Instagram comment."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{GRAPH_API_BASE}/{comment_id}/replies",
                params={
                    "message": text,
                    "access_token": self.access_token,
                },
            )
            resp.raise_for_status()
            return resp.json().get("id", "")

    async def get_analytics(self, post_id: str) -> Dict[str, Any]:
        """Fetch Instagram post insights."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Get basic metrics
            resp = await client.get(
                f"{GRAPH_API_BASE}/{post_id}",
                params={
                    "fields": "like_count,comments_count,timestamp",
                    "access_token": self.access_token,
                },
            )
            resp.raise_for_status()
            data = resp.json()

            # Get insights (reach, impressions)
            insights_resp = await client.get(
                f"{GRAPH_API_BASE}/{post_id}/insights",
                params={
                    "metric": "reach,impressions",
                    "access_token": self.access_token,
                },
            )

            reach = 0
            impressions = 0
            if insights_resp.status_code == 200:
                for metric in insights_resp.json().get("data", []):
                    if metric["name"] == "reach":
                        reach = metric["values"][0]["value"]
                    elif metric["name"] == "impressions":
                        impressions = metric["values"][0]["value"]

            likes = data.get("like_count", 0)
            comments = data.get("comments_count", 0)
            total = likes + comments
            engagement_rate = (total / reach * 100) if reach > 0 else 0.0

            return {
                "likes": likes,
                "comments": comments,
                "shares": 0,  # Instagram doesn't expose shares
                "reach": reach,
                "impressions": impressions,
                "engagement_rate": round(engagement_rate, 2),
            }

    async def test_connection(self) -> bool:
        """Test Instagram API connectivity."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{GRAPH_API_BASE}/{self.account_id}",
                    params={
                        "fields": "id,username",
                        "access_token": self.access_token,
                    },
                )
                return resp.status_code == 200
        except Exception:
            return False
