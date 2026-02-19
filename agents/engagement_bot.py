"""
Zaytri — Agent 6: Engagement Bot
Monitors comments after publishing, generates AI replies, and flags sensitive content.
"""

import logging
from datetime import datetime
from typing import Any, Dict, List

from celery import shared_task

from agents.base_agent import BaseAgent
from brain.llm_router import get_llm
from brain.prompts import ENGAGEMENT_REPLY_SYSTEM, ENGAGEMENT_REPLY_PROMPT

logger = logging.getLogger(__name__)


class EngagementBot(BaseAgent):
    """
    Agent 6 — Engagement Bot

    Triggered 2 hours after publishing (configurable in cron_config.py).
    Monitors comments, generates contextual AI replies, and flags sensitive content.
    """

    def __init__(self):
        super().__init__("EngagementBot")

    async def run(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        self.log_start(input_data)

        content_id = input_data.get("content_id")
        platform = input_data.get("platform")
        post_id = input_data.get("post_id")

        if not all([content_id, platform, post_id]):
            raise ValueError("content_id, platform, and post_id are required")

        from db.database import async_session
        from db.models import Content, EngagementLog, Platform as PlatformEnum
        from sqlalchemy import select

        replied_count = 0
        flagged_count = 0
        results = []

        try:
            # Get platform client
            platform_client = self._get_platform_client(platform)
            if not platform_client:
                return {"status": "skipped", "reason": "Platform not configured"}

            # Fetch comments from platform
            comments = await platform_client.get_comments(post_id)

            # Get content topic for context
            async with async_session() as session:
                content_result = await session.execute(
                    select(Content).where(Content.id == content_id)
                )
                content = content_result.scalar_one_or_none()
                topic = content.topic if content else "general"

                for comment in comments:
                    try:
                        # Generate AI reply
                        reply_data = await self._generate_reply(
                            platform=platform,
                            topic=topic,
                            comment_text=comment.get("text", ""),
                            commenter_name=comment.get("author", "User"),
                        )

                        # Log the engagement
                        log = EngagementLog(
                            content_id=content_id,
                            platform=PlatformEnum(platform),
                            comment_id=comment.get("id"),
                            comment_text=comment.get("text"),
                            reply_text=reply_data.get("reply"),
                            is_flagged=reply_data.get("sentiment") in ["spam", "offensive"],
                            flag_reason=reply_data.get("flag_reason"),
                        )

                        # Auto-reply if safe
                        if reply_data.get("is_safe_to_auto_reply", False):
                            try:
                                await platform_client.reply_to_comment(
                                    comment_id=comment.get("id"),
                                    text=reply_data["reply"],
                                )
                                log.is_auto_replied = True
                                replied_count += 1
                            except Exception as e:
                                self.logger.warning(f"Failed to auto-reply: {e}")

                        if log.is_flagged:
                            flagged_count += 1

                        session.add(log)
                        results.append({
                            "comment_id": comment.get("id"),
                            "sentiment": reply_data.get("sentiment"),
                            "auto_replied": log.is_auto_replied,
                            "flagged": log.is_flagged,
                        })

                    except Exception as e:
                        self.logger.error(f"Error processing comment: {e}")

                await session.commit()

        except Exception as e:
            self.log_error(e)
            raise

        output = {
            "total_comments": len(comments) if 'comments' in dir() else 0,
            "replied_count": replied_count,
            "flagged_count": flagged_count,
            "results": results,
        }
        self.log_complete(output)
        return output

    async def _generate_reply(
        self, platform: str, topic: str, comment_text: str, commenter_name: str
    ) -> Dict[str, Any]:
        """Generate an AI reply using the LLM."""
        prompt = ENGAGEMENT_REPLY_PROMPT.format(
            platform=platform,
            topic=topic,
            comment_text=comment_text,
            commenter_name=commenter_name,
        )

        return await get_llm("engagement_bot").generate_json(
            prompt=prompt,
            system_prompt=ENGAGEMENT_REPLY_SYSTEM,
            temperature=0.6,
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
@shared_task(name="agents.engagement_bot.run_engagement_check")
def run_engagement_check(content_id: str, platform: str, post_id: str):
    """Celery task entrypoint for the Engagement Bot."""
    import asyncio
    bot = EngagementBot()
    return asyncio.get_event_loop().run_until_complete(
        bot.run({
            "content_id": content_id,
            "platform": platform,
            "post_id": post_id,
        })
    )
