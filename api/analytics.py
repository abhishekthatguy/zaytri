"""
Zaytri — Analytics API Routes
"""

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta

from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from auth.models import User
from db.database import get_db
from db.models import AnalyticsRecord, Content

router = APIRouter(prefix="/analytics", tags=["Analytics"])


class AnalyticsResponse(BaseModel):
    content_id: str
    platform: str
    likes: int
    comments: int
    shares: int
    reach: int
    impressions: int
    engagement_rate: float
    fetched_at: datetime

    model_config = {"from_attributes": True}


class AnalyticsSummary(BaseModel):
    total_likes: int
    total_comments: int
    total_shares: int
    total_reach: int
    avg_engagement_rate: float
    records: List[AnalyticsResponse]


@router.get("/report", response_model=AnalyticsSummary)
async def get_analytics_report(
    days: int = Query(default=7, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get an analytics summary report for the specified time period."""
    since = datetime.utcnow() - timedelta(days=days)

    result = await db.execute(
        select(AnalyticsRecord)
        .join(Content, AnalyticsRecord.content_id == Content.id)
        .where(
            Content.created_by == user.id,
            AnalyticsRecord.fetched_at >= since
        )
        .order_by(desc(AnalyticsRecord.fetched_at))
    )
    records = result.scalars().all()

    total_likes = sum(r.likes for r in records)
    total_comments = sum(r.comments for r in records)
    total_shares = sum(r.shares for r in records)
    total_reach = sum(r.reach for r in records)
    avg_engagement = (
        sum(r.engagement_rate for r in records) / len(records)
        if records
        else 0.0
    )

    return AnalyticsSummary(
        total_likes=total_likes,
        total_comments=total_comments,
        total_shares=total_shares,
        total_reach=total_reach,
        avg_engagement_rate=round(avg_engagement, 2),
        records=[AnalyticsResponse.model_validate(r) for r in records],
    )


@router.get("/platform/{platform}", response_model=AnalyticsSummary)
async def get_platform_analytics(
    platform: str,
    days: int = Query(default=7, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get analytics for a specific platform."""
    since = datetime.utcnow() - timedelta(days=days)

    result = await db.execute(
        select(AnalyticsRecord)
        .join(Content, AnalyticsRecord.content_id == Content.id)
        .where(
            Content.created_by == user.id,
            AnalyticsRecord.platform == platform,
            AnalyticsRecord.fetched_at >= since,
        )
        .order_by(desc(AnalyticsRecord.fetched_at))
    )
    records = result.scalars().all()

    total_likes = sum(r.likes for r in records)
    total_comments = sum(r.comments for r in records)
    total_shares = sum(r.shares for r in records)
    total_reach = sum(r.reach for r in records)
    avg_engagement = (
        sum(r.engagement_rate for r in records) / len(records)
        if records
        else 0.0
    )

    return AnalyticsSummary(
        total_likes=total_likes,
        total_comments=total_comments,
        total_shares=total_shares,
        total_reach=total_reach,
        avg_engagement_rate=round(avg_engagement, 2),
        records=[AnalyticsResponse.model_validate(r) for r in records],
    )
