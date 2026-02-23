"""
Zaytri — Content Service (Domain Layer)
Content CRUD operations + status transitions.
Extracted from ActionExecutor._handle_list_content/approve/delete.
"""

from typing import Any, Dict, List, Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Content, ContentStatus
from infra.logging import get_logger

logger = get_logger("domain.content_service")


class ContentService:
    """Content management operations."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_content(
        self,
        limit: int = 5,
        status_filter: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """List content with optional filters."""
        query = select(Content).order_by(Content.created_at.desc()).limit(limit)

        if status_filter:
            try:
                query = query.where(Content.status == ContentStatus(status_filter))
            except Exception:
                pass

        if user_id:
            query = query.where(Content.created_by == user_id)

        result = await self.session.execute(query)
        items = result.scalars().all()

        return [
            {
                "id": str(c.id),
                "topic": c.topic,
                "platform": c.platform.value if c.platform else "",
                "status": c.status.value if c.status else "",
                "score": c.review_score,
                "created": c.created_at.isoformat() if c.created_at else "",
            }
            for c in items
        ]

    async def approve_content(self, content_id: str) -> Dict[str, Any]:
        """Approve a content item."""
        result = await self.session.execute(
            select(Content).where(Content.id == content_id)
        )
        content = result.scalar_one_or_none()
        if not content:
            return {"success": False, "message": "Content not found"}

        content.status = ContentStatus.APPROVED
        return {"success": True, "message": f"Content {content_id[:8]}… approved ✅"}

    async def delete_content(self, content_id: str) -> Dict[str, Any]:
        """Delete a content item."""
        result = await self.session.execute(
            select(Content).where(Content.id == content_id)
        )
        content = result.scalar_one_or_none()
        if not content:
            return {"success": False, "message": "Content not found"}

        await self.session.delete(content)
        return {"success": True, "message": f"Content {content_id[:8]}… deleted 🗑️"}

    async def count_content(self) -> int:
        """Count total content items."""
        result = await self.session.execute(select(func.count(Content.id)))
        return result.scalar() or 0
