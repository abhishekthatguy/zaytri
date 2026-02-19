"""
Zaytri — Agent 7: Analytics Agent
Fetches engagement metrics from platforms and generates weekly summary reports.
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List

from celery import shared_task

from agents.base_agent import BaseAgent
from brain.llm_router import get_llm
from brain.prompts import ANALYTICS_SUMMARY_SYSTEM, ANALYTICS_SUMMARY_PROMPT

logger = logging.getLogger(__name__)


class AnalyticsAgent(BaseAgent):
    """
    Agent 7 — Analytics Agent

    Triggered weekly by Celery Beat.
    Fetches likes, comments, reach from platform APIs.
    Stores records in DB and generates a summary report.
    """

    def __init__(self):
        super().__init__("AnalyticsAgent")

    async def run(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        self.log_start(input_data)

        from sqlalchemy import select
        from db.database import async_session
        from db.models import (
            Content, Schedule, AnalyticsRecord,
            ContentStatus, Platform as PlatformEnum,
        )

        analytics_records = []
        errors = []

        try:
            async with async_session() as session:
                # Get all published content from the last 7 days
                week_ago = datetime.utcnow() - timedelta(days=7)
                result = await session.execute(
                    select(Schedule).where(
                        Schedule.is_published == True,
                        Schedule.published_at >= week_ago,
                    )
                )
                published_schedules = result.scalars().all()

                for schedule in published_schedules:
                    if not schedule.platform_post_id:
                        continue

                    try:
                        platform_client = self._get_platform_client(
                            schedule.platform.value
                        )
                        if not platform_client:
                            continue

                        # Fetch analytics from platform
                        metrics = await platform_client.get_analytics(
                            schedule.platform_post_id
                        )

                        # Save to DB
                        record = AnalyticsRecord(
                            content_id=schedule.content_id,
                            platform=schedule.platform,
                            likes=metrics.get("likes", 0),
                            comments=metrics.get("comments", 0),
                            shares=metrics.get("shares", 0),
                            reach=metrics.get("reach", 0),
                            impressions=metrics.get("impressions", 0),
                            engagement_rate=metrics.get("engagement_rate", 0.0),
                        )
                        session.add(record)
                        analytics_records.append({
                            "content_id": str(schedule.content_id),
                            "platform": schedule.platform.value,
                            "metrics": metrics,
                        })

                    except Exception as e:
                        errors.append({
                            "content_id": str(schedule.content_id),
                            "error": str(e),
                        })
                        self.logger.error(
                            f"Failed to fetch analytics for {schedule.content_id}: {e}"
                        )

                await session.commit()

                # Generate AI summary report
                summary = ""
                if analytics_records:
                    summary = await self._generate_summary(analytics_records)

        except Exception as e:
            self.log_error(e)
            raise

        output = {
            "records_fetched": len(analytics_records),
            "errors": errors,
            "summary": summary,
            "timestamp": datetime.utcnow().isoformat(),
        }
        self.log_complete(output)
        return output

    async def _generate_summary(self, analytics_data: List[Dict]) -> str:
        """Generate an AI-powered analytics summary."""
        import json
        data_str = json.dumps(analytics_data, indent=2, default=str)

        prompt = ANALYTICS_SUMMARY_PROMPT.format(analytics_data=data_str)

        return await get_llm("analytics_agent").generate(
            prompt=prompt,
            system_prompt=ANALYTICS_SUMMARY_SYSTEM,
            temperature=0.5,
        )

    def _get_platform_client(self, platform: str):
        """Get the platform API client."""
        from config import settings

        if platform == "instagram" and settings.is_instagram_configured:
            from platforms.instagram import InstagramClient
            return InstagramClient()
        elif platform == "facebook" and settings.is_facebook_configured:
            from platforms.facebook import FacebookClient
            return FacebookClient()
        elif platform == "twitter" and settings.is_twitter_configured:
            from platforms.twitter import TwitterClient
            return TwitterClient()
        elif platform == "youtube" and settings.is_youtube_configured:
            from platforms.youtube import YouTubeClient
            return YouTubeClient()
        return None


# ─── Celery Task ─────────────────────────────────────────────────────────────
@shared_task(name="agents.analytics_agent.run_analytics")
def run_analytics():
    """Celery task entrypoint for the Analytics Agent."""
    import asyncio
    bot = AnalyticsAgent()
    return asyncio.get_event_loop().run_until_complete(bot.run({}))
