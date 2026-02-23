"""
Zaytri — Cleanup Agent
Periodically removes soft-deleted content older than 7 days.
"""

import logging
from datetime import datetime, timedelta
from sqlalchemy import delete
from db.database import async_session
from db.models import Content, ContentStatus
from celery_app import celery_app

logger = logging.getLogger(__name__)

@celery_app.task(name="agents.cleanup_agent.cleanup_deleted_content")
async def cleanup_deleted_content():
    """Permanent delete of content in trash for > 7 days."""
    cutoff = datetime.utcnow() - timedelta(days=7)
    
    async with async_session() as session:
        try:
            # SQLAlchemy delete statement for older deleted content
            stmt = delete(Content).where(
                Content.status == ContentStatus.DELETED,
                Content.deleted_at <= cutoff
            )
            result = await session.execute(stmt)
            await session.commit()
            
            deleted_count = result.rowcount
            if deleted_count > 0:
                logger.info(f"Cleanup Agent: Permanently removed {deleted_count} items from trash.")
            
            return {"success": True, "deleted_count": deleted_count}
        except Exception as e:
            await session.rollback()
            logger.error(f"Cleanup Agent failed: {e}")
            return {"success": False, "error": str(e)}
