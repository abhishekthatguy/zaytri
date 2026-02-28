"""
Zaytri — Agent 4: Scheduler Bot
Fetches approved content from DB and queues it for publishing.
Runs as a Celery periodic task (cron).
"""

import logging
from datetime import datetime
from typing import Any, Dict

from celery import shared_task
from .base_agent import BaseAgent

logger = logging.getLogger(__name__)


class SchedulerBot(BaseAgent):
    """
    Agent 4 — Scheduler Bot

    Triggered by Celery Beat cron (e.g., 9 AM daily).
    Fetches approved content from the database and pushes to publish queue.
    """

    def __init__(self):
        super().__init__("SchedulerBot")

    async def run(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        self.log_start(input_data)

        from sqlalchemy import select
        from db.database import async_session
        from db.models import Content, ContentStatus, Schedule

        scheduled_count = 0
        errors = []

        try:
            async with async_session() as session:
                # Fetch all approved content that hasn't been scheduled yet
                result = await session.execute(
                    select(Content).where(Content.status == ContentStatus.APPROVED)
                )
                approved_contents = result.scalars().all()

                for content in approved_contents:
                    try:
                        # Create a schedule entry
                        schedule = Schedule(
                            content_id=content.id,
                            platform=content.platform,
                            scheduled_at=datetime.utcnow(),
                        )
                        session.add(schedule)

                        # Update content status
                        content.status = ContentStatus.SCHEDULED
                        scheduled_count += 1

                        self.logger.info(
                            f"Scheduled content {content.id} for {content.platform.value}"
                        )
                    except Exception as e:
                        errors.append(f"Content {content.id}: {str(e)}")
                        self.logger.error(f"Failed to schedule content {content.id}: {e}")

                await session.commit()

        except Exception as e:
            self.log_error(e)
            raise

        output = {
            "scheduled_count": scheduled_count,
            "errors": errors,
            "timestamp": datetime.utcnow().isoformat(),
        }

        self.log_complete(output)
        return output


# ─── Celery Task ─────────────────────────────────────────────────────────────
@shared_task(name="agents.scheduler_bot.run_scheduler")
def run_scheduler():
    """Celery task entrypoint for the Scheduler Bot."""
    import asyncio
    bot = SchedulerBot()
    return asyncio.get_event_loop().run_until_complete(bot.run({}))
