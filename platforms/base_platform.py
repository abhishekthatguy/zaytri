"""
Zaytri — Base Platform Client (Abstract)
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional


class BasePlatform(ABC):
    """Abstract base class for all social media platform clients."""

    def __init__(self, name: str, access_token: str):
        self.name = name
        self.access_token = access_token

    @abstractmethod
    async def publish(self, text: str, media_url: Optional[str] = None) -> str:
        """
        Publish content to the platform.

        Args:
            text: Post text/caption
            media_url: Optional media URL to attach

        Returns:
            Platform-specific post ID
        """
        pass

    @abstractmethod
    async def get_comments(self, post_id: str) -> List[Dict[str, Any]]:
        """
        Fetch comments on a post.

        Returns:
            List of {"id": str, "text": str, "author": str, "created_at": str}
        """
        pass

    @abstractmethod
    async def reply_to_comment(self, comment_id: str, text: str) -> str:
        """
        Reply to a comment.

        Returns:
            Reply ID
        """
        pass

    @abstractmethod
    async def get_analytics(self, post_id: str) -> Dict[str, Any]:
        """
        Fetch engagement metrics for a post.

        Returns:
            {"likes": int, "comments": int, "shares": int, "reach": int,
             "impressions": int, "engagement_rate": float}
        """
        pass

    @abstractmethod
    async def test_connection(self) -> bool:
        """Test API connectivity."""
        pass
