"""
Zaytri — Reddit API Client
Uses OAuth 2.0 access token for Reddit's API.
"""

import logging
from typing import Any, Dict, List, Optional
import httpx

from platforms.base_platform import BasePlatform

logger = logging.getLogger(__name__)

REDDIT_API_BASE = "https://oauth.reddit.com"


class RedditClient(BasePlatform):
    """Reddit API client for posting and engagement."""

    def __init__(self, access_token: str, subreddit: str = ""):
        """
        Args:
            access_token: OAuth 2.0 access token.
            subreddit: Target subreddit name (without r/ prefix).
        """
        super().__init__("Reddit", access_token)
        self.subreddit = subreddit

    def _get_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.access_token}",
            "User-Agent": "Zaytri/1.0",
            "Content-Type": "application/x-www-form-urlencoded",
        }

    async def publish(self, text: str, media_url: Optional[str] = None) -> str:
        """Submit a post to a subreddit."""
        if not self.subreddit:
            logger.warning("Reddit publish: no subreddit specified, using u/me")

        data = {
            "sr": self.subreddit or "u_me",
            "kind": "link" if media_url else "self",
            "title": text[:300] if text else "Post",
            "resubmit": "true",
        }

        if media_url:
            data["url"] = media_url
        else:
            data["text"] = text

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{REDDIT_API_BASE}/api/submit",
                headers=self._get_headers(),
                data=data,
            )
            resp.raise_for_status()
            result = resp.json()

            # Reddit returns nested JSON structure
            if "json" in result and "data" in result["json"]:
                return result["json"]["data"].get("id", result["json"]["data"].get("name", ""))
            return result.get("id", "")

    async def get_comments(self, post_id: str) -> List[Dict[str, Any]]:
        """Fetch comments on a Reddit post."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                f"{REDDIT_API_BASE}/comments/{post_id}",
                headers={
                    "Authorization": f"Bearer {self.access_token}",
                    "User-Agent": "Zaytri/1.0",
                },
                params={"limit": 100, "sort": "new"},
            )
            if resp.status_code != 200:
                return []

            # Reddit returns [post, comments] listing structure
            data = resp.json()
            if len(data) < 2:
                return []

            children = data[1].get("data", {}).get("children", [])
            return [
                {
                    "id": c["data"].get("id", ""),
                    "text": c["data"].get("body", ""),
                    "author": c["data"].get("author", "Unknown"),
                    "created_at": str(c["data"].get("created_utc", "")),
                }
                for c in children
                if c.get("kind") == "t1"  # t1 = comment
            ]

    async def reply_to_comment(self, comment_id: str, text: str) -> str:
        """Reply to a Reddit comment."""
        # Reddit uses fullnames like t1_abc123
        thing_id = comment_id if comment_id.startswith("t1_") else f"t1_{comment_id}"

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{REDDIT_API_BASE}/api/comment",
                headers=self._get_headers(),
                data={
                    "thing_id": thing_id,
                    "text": text,
                },
            )
            resp.raise_for_status()
            result = resp.json()

            # Extract comment ID from response
            things = result.get("json", {}).get("data", {}).get("things", [])
            if things:
                return things[0].get("data", {}).get("id", "")
            return ""

    async def get_analytics(self, post_id: str) -> Dict[str, Any]:
        """Fetch Reddit post metrics."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                f"{REDDIT_API_BASE}/api/info",
                headers={
                    "Authorization": f"Bearer {self.access_token}",
                    "User-Agent": "Zaytri/1.0",
                },
                params={"id": f"t3_{post_id}"},
            )
            if resp.status_code != 200:
                return {
                    "likes": 0, "comments": 0, "shares": 0,
                    "reach": 0, "impressions": 0, "engagement_rate": 0.0,
                }

            children = resp.json().get("data", {}).get("children", [])
            if not children:
                return {
                    "likes": 0, "comments": 0, "shares": 0,
                    "reach": 0, "impressions": 0, "engagement_rate": 0.0,
                }

            post = children[0].get("data", {})
            score = post.get("score", 0)
            num_comments = post.get("num_comments", 0)
            upvote_ratio = post.get("upvote_ratio", 0.5)

            return {
                "likes": score,
                "comments": num_comments,
                "shares": post.get("num_crossposts", 0),
                "reach": 0,  # Reddit doesn't expose view count via API
                "impressions": 0,
                "engagement_rate": round(upvote_ratio * 100, 2),
            }

    async def test_connection(self) -> bool:
        """Test Reddit API connectivity."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{REDDIT_API_BASE}/api/v1/me",
                    headers={
                        "Authorization": f"Bearer {self.access_token}",
                        "User-Agent": "Zaytri/1.0",
                    },
                )
                return resp.status_code == 200
        except Exception:
            return False
