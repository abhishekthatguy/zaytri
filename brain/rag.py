"""
Zaytri — Multi-Tenant RAG System with Brand Isolation
Provides contextual memory retrieving to prevent LLM hallucinations 
by pulling Brand Memory, Calendar Data, Past Posts, Tone Guidance, and Analytics.
"""

from typing import Optional, Dict, Any, List
from sqlalchemy import select, and_, desc, func
from sqlalchemy.ext.asyncio import AsyncSession
from db.database import async_session
from db.models import Content, ContentStatus, AnalyticsRecord
from db.calendar_models import CalendarEntry, CalendarEntryStatus
from db.settings_models import BrandSettings

class BrandResolverRAG:
    """
    Retrieves and bundles isolated multi-tenant brand context for LLM Prompts.
    Follows: Master Agent/Task Planner -> Brand Resolver -> Content Agent
    """

    def __init__(self, user_id: str):
        self.user_id = user_id

    async def _fetch_brand_settings(self, session: AsyncSession, brand_name: Optional[str]) -> Optional[BrandSettings]:
        """Fetch strict tone and brand memory."""
        stmt = select(BrandSettings).where(BrandSettings.user_id == self.user_id)
        if brand_name:
            stmt = stmt.where(BrandSettings.brand_name == brand_name)
        # Default to the first brand if none specified
        result = await session.execute(stmt)
        return result.scalars().first()

    async def _fetch_past_posts(self, session: AsyncSession, platform: str, limit: int = 3) -> str:
        """Fetch previously approved/published content to maintain style continuity."""
        stmt = (
            select(Content)
            .where(
                and_(
                    Content.created_by == self.user_id,
                    Content.platform == platform,
                    Content.status.in_([ContentStatus.APPROVED, ContentStatus.PUBLISHED, ContentStatus.SCHEDULED])
                )
            )
            .order_by(desc(Content.created_at))
            .limit(limit)
        )
        result = await session.execute(stmt)
        posts = result.scalars().all()
        if not posts:
            return "No past posts available yet."
        
        snippets = []
        for p in posts:
            snippets.append(f"- Topic: {p.topic}\n  Text: {p.post_text[:100]}...")
        return "\n".join(snippets)

    async def _fetch_engagement_analytics(self, session: AsyncSession, platform: str) -> str:
        """Fetch what performed well recently to inform the LLM."""
        stmt = (
            select(AnalyticsRecord)
            .join(Content, Content.id == AnalyticsRecord.content_id)
            .where(
                and_(
                    Content.created_by == self.user_id,
                    AnalyticsRecord.platform == platform
                )
            )
            .order_by(desc(AnalyticsRecord.fetched_at))
            .limit(3)
        )
        result = await session.execute(stmt)
        analytics = result.scalars().all()
        
        if not analytics:
            return "No historical engagement data."
            
        data = []
        for a in analytics:
            data.append(f"Likes: {a.likes}, Comments: {a.comments}, Reach: {a.reach}")
        return " | ".join(data)

    async def _fetch_calendar_context(self, session: AsyncSession, brand: Optional[str], limit: int = 2) -> str:
        """Fetch upcoming scheduled topics for context awareness."""
        from db.models import Platform
        stmt = select(CalendarEntry).where(CalendarEntry.user_id == self.user_id)
        if brand:
            stmt = stmt.where(CalendarEntry.brand == brand)
            
        stmt = stmt.order_by(CalendarEntry.date).limit(limit)
        result = await session.execute(stmt)
        events = result.scalars().all()
        if not events:
            return "No upcoming calendar events."
            
        agenda = []
        for e in events:
            agenda.append(f"- {e.date}: {e.topic} (on {', '.join([p for p in (e.platforms or [])])})")
        return "\n".join(agenda)

    async def build_context(self, topic: str, platform: str, assigned_tone: str, assigned_brand: Optional[str] = None) -> str:
        """
        Assemble the complete multi-layer RAG context block.
        """
        async with async_session() as session:
            # 1. Brand Guidelines
            brand: BrandSettings = await self._fetch_brand_settings(session, assigned_brand)
            tone_guidance = brand.brand_tone if brand and brand.brand_tone else assigned_tone
            guidelines = brand.brand_guidelines if brand and brand.brand_guidelines else "Stay aligned with general platform best practices."
            target_audience = brand.target_audience if brand and brand.target_audience else "General Audience"
            
            # 2. Content Memory (Past Posts)
            past_posts = await self._fetch_past_posts(session, platform)
            
            # 3. Analytics Memory
            analytics = await self._fetch_engagement_analytics(session, platform)
            
            # 4. Marketing Calendar (What's coming up?)
            calendar = await self._fetch_calendar_context(session, assigned_brand if assigned_brand else (brand.brand_name if brand else None))

        rag_block = f"""
=== BRAND & RAG MEMORY CONTEXT ===
{f"Brand/Client: {brand.brand_name}" if brand else "Brand: Default Workspace"}
Target Audience: {target_audience}
Tone Guidance: {tone_guidance}
Brand Rules/Guidelines: {guidelines}

=== RECENT BEST PERFORMING POSTS ===
{past_posts}

=== ENGAGEMENT ANALYTICS (Recent metrics to learn from) ===
{analytics}

=== UPCOMING CALENDAR ===
{calendar}
==================================
"""
        return rag_block
