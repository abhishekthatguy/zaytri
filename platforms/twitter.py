"""
Zaytri — Twitter/X API Client
"""

import logging
from typing import Any, Dict, List, Optional
import httpx

from platforms.base_platform import BasePlatform

logger = logging.getLogger(__name__)

TWITTER_API_BASE = "https://api.twitter.com/2"


class TwitterClient(BasePlatform):
    """Twitter/X API v2 client using OAuth 2.0 user tokens."""

    def __init__(self, access_token: str):
        super().__init__("Twitter", access_token)

    def _get_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }

    async def publish(self, text: str, media_url: Optional[str] = None) -> str:
        """Post a tweet."""
        # Truncate to 280 chars for Twitter
        if len(text) > 280:
            text = text[:277] + "..."

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{TWITTER_API_BASE}/tweets",
                headers=self._get_headers(),
                json={"text": text},
            )
            resp.raise_for_status()
            return resp.json()["data"]["id"]

    async def get_comments(self, post_id: str) -> List[Dict[str, Any]]:
        """Fetch replies/mentions for a tweet using search."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Search for replies to the tweet
            resp = await client.get(
                f"{TWITTER_API_BASE}/tweets/search/recent",
                headers=self._get_headers(),
                params={
                    "query": f"conversation_id:{post_id}",
                    "tweet.fields": "author_id,created_at,text",
                    "max_results": 100,
                },
            )
            resp.raise_for_status()
            data = resp.json().get("data", [])

            return [
                {
                    "id": t["id"],
                    "text": t.get("text", ""),
                    "author": t.get("author_id", "Unknown"),
                    "created_at": t.get("created_at", ""),
                }
                for t in data
            ]

    async def reply_to_comment(self, comment_id: str, text: str) -> str:
        """Reply to a tweet."""
        if len(text) > 280:
            text = text[:277] + "..."

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{TWITTER_API_BASE}/tweets",
                headers=self._get_headers(),
                json={
                    "text": text,
                    "reply": {"in_reply_to_tweet_id": comment_id},
                },
            )
            resp.raise_for_status()
            return resp.json()["data"]["id"]

    async def get_analytics(self, post_id: str) -> Dict[str, Any]:
        """Fetch tweet metrics."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                f"{TWITTER_API_BASE}/tweets/{post_id}",
                headers=self._get_headers(),
                params={
                    "tweet.fields": "public_metrics,non_public_metrics,organic_metrics",
                },
            )
            resp.raise_for_status()
            metrics = resp.json().get("data", {}).get("public_metrics", {})

            likes = metrics.get("like_count", 0)
            comments = metrics.get("reply_count", 0)
            shares = metrics.get("retweet_count", 0) + metrics.get("quote_count", 0)
            impressions = metrics.get("impression_count", 0)

            total = likes + comments + shares
            engagement_rate = (total / impressions * 100) if impressions > 0 else 0.0

            return {
                "likes": likes,
                "comments": comments,
                "shares": shares,
                "reach": impressions,  # Twitter uses impressions as reach proxy
                "impressions": impressions,
                "engagement_rate": round(engagement_rate, 2),
            }

    async def test_connection(self) -> bool:
        """Test Twitter API connectivity."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{TWITTER_API_BASE}/users/me",
                    headers=self._get_headers(),
                )
                return resp.status_code == 200
        except Exception:
            return False
