"""
Zaytri — Content Pipeline (Workflow Orchestration)
Chains Agent 1 → Agent 2 → Agent 3 and saves results to database.
"""

import logging
from typing import Any, Dict, Optional
from uuid import UUID

from celery import shared_task

from agents.content_creator import ContentCreatorAgent
from agents.hashtag_generator import HashtagGeneratorAgent
from agents.review_agent import ReviewAgent

logger = logging.getLogger(__name__)


class ContentPipeline:
    """
    Main workflow pipeline:
    1. Content Creator Agent → generates post content
    2. Hashtag Generator Agent → generates hashtags
    3. Review Agent → reviews and scores the content
    4. Save to database with appropriate status
    """

    def __init__(self):
        self.content_creator = ContentCreatorAgent()
        self.hashtag_generator = HashtagGeneratorAgent()
        self.review_agent = ReviewAgent()

    async def run(
        self,
        topic: str,
        platform: str,
        tone: str = "professional",
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Execute the full content creation pipeline.

        Args:
            topic: Content topic
            platform: Target social media platform
            tone: Content tone (e.g., professional, casual, educational)
            user_id: ID of the user who triggered the workflow

        Returns:
            Complete pipeline results with content, hashtags, and review
        """
        logger.info(f"Starting pipeline: topic='{topic}', platform='{platform}', tone='{tone}'")

        # ── Step 1: Generate Content ────────────────────────────────────
        logger.info("Step 1/3: Running Content Creator Agent...")
        content_result = await self.content_creator.run({
            "topic": topic,
            "platform": platform,
            "tone": tone,
        })

        # ── Step 2: Generate Hashtags ───────────────────────────────────
        logger.info("Step 2/3: Running Hashtag Generator Agent...")
        hashtag_result = await self.hashtag_generator.run({
            "topic": topic,
            "platform": platform,
        })

        # ── Step 3: Review Content ──────────────────────────────────────
        logger.info("Step 3/3: Running Review Agent...")
        review_input = {
            **content_result,
            "niche_hashtags": hashtag_result["niche_hashtags"],
            "broad_hashtags": hashtag_result["broad_hashtags"],
        }
        review_result = await self.review_agent.run(review_input)

        # ── Save to Database ────────────────────────────────────────────
        content_id = await self._save_to_db(
            topic=topic,
            platform=platform,
            tone=tone,
            content=content_result,
            hashtags=hashtag_result,
            review=review_result,
            user_id=user_id,
        )

        logger.info(f"Pipeline complete. Content ID: {content_id}")

        return {
            "content_id": str(content_id),
            "content": content_result,
            "hashtags": hashtag_result,
            "review": review_result,
            "status": "reviewed" if review_result.get("is_approved") else "draft",
        }

    async def _save_to_db(
        self,
        topic: str,
        platform: str,
        tone: str,
        content: Dict,
        hashtags: Dict,
        review: Dict,
        user_id: Optional[str],
    ) -> str:
        """Save pipeline results to the database."""
        from db.database import async_session
        from db.models import Content, ContentStatus, Platform as PlatformEnum

        async with async_session() as session:
            # Determine status based on review
            status = (
                ContentStatus.REVIEWED
                if review.get("is_approved")
                else ContentStatus.DRAFT
            )

            db_content = Content(
                topic=topic,
                platform=PlatformEnum(platform),
                tone=tone,
                caption=content.get("caption"),
                hook=content.get("hook"),
                cta=content.get("cta"),
                post_text=content.get("post_text"),
                niche_hashtags=hashtags.get("niche_hashtags"),
                broad_hashtags=hashtags.get("broad_hashtags"),
                review_score=review.get("overall_score"),
                review_feedback=str(review.get("issues", [])),
                improved_text=review.get("improved_text"),
                status=status,
                created_by=user_id if user_id else None,
            )

            session.add(db_content)
            await session.commit()
            await session.refresh(db_content)
            return str(db_content.id)


# ─── Celery Task Wrapper ────────────────────────────────────────────────────
@shared_task(name="workflow.pipeline.run_content_pipeline")
def run_content_pipeline(topic: str, platform: str, tone: str, user_id: str = None):
    """Celery task entrypoint for the content pipeline."""
    import asyncio
    pipeline = ContentPipeline()
    return asyncio.get_event_loop().run_until_complete(
        pipeline.run(topic=topic, platform=platform, tone=tone, user_id=user_id)
    )
