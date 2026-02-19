"""
Zaytri — Content API Routes
CRUD operations for generated content.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from auth.models import User
from db.database import get_db
from db.models import Content, ContentStatus, Schedule, Platform as PlatformEnum

router = APIRouter(prefix="/content", tags=["Content"])


# ─── Dashboard Stats ─────────────────────────────────────────────────────────

@router.get("/stats")
async def get_content_stats(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Aggregate content counts by status for the dashboard."""
    from sqlalchemy import func

    # Total count
    total_result = await db.execute(select(func.count()).select_from(Content))
    total = total_result.scalar() or 0

    # Count per status
    status_counts = {}
    for s in ContentStatus:
        result = await db.execute(
            select(func.count()).select_from(Content).where(Content.status == s)
        )
        status_counts[s.value] = result.scalar() or 0

    # Average review score
    avg_result = await db.execute(
        select(func.avg(Content.review_score)).where(Content.review_score.isnot(None))
    )
    avg_score = avg_result.scalar()
    avg_score = round(float(avg_score), 1) if avg_score else 0.0

    # Recent published (last 7 days)
    from datetime import timedelta
    week_ago = datetime.utcnow() - timedelta(days=7)
    recent_result = await db.execute(
        select(func.count()).select_from(Schedule).where(
            Schedule.is_published == True,
            Schedule.published_at >= week_ago,
        )
    )
    recent_published = recent_result.scalar() or 0

    return {
        "total": total,
        "by_status": status_counts,
        "avg_review_score": avg_score,
        "recent_published_7d": recent_published,
    }


# ─── Request / Response Schemas ──────────────────────────────────────────────

class ContentResponse(BaseModel):
    id: UUID
    topic: str
    platform: str
    tone: str
    caption: Optional[str] = None
    hook: Optional[str] = None
    cta: Optional[str] = None
    post_text: Optional[str] = None
    niche_hashtags: Optional[list] = None
    broad_hashtags: Optional[list] = None
    review_score: Optional[float] = None
    review_feedback: Optional[str] = None
    improved_text: Optional[str] = None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ContentListResponse(BaseModel):
    total: int
    items: List[ContentResponse]


class UpdateContentRequest(BaseModel):
    caption: Optional[str] = None
    hook: Optional[str] = None
    cta: Optional[str] = None
    post_text: Optional[str] = None
    improved_text: Optional[str] = None
    topic: Optional[str] = None
    tone: Optional[str] = None


# ─── Routes ──────────────────────────────────────────────────────────────────

@router.get("", response_model=ContentListResponse)
async def list_content(
    status_filter: Optional[str] = Query(None, alias="status"),
    platform: Optional[str] = None,
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all generated content with optional filters."""
    query = select(Content).order_by(desc(Content.created_at))

    if status_filter:
        query = query.where(Content.status == ContentStatus(status_filter))
    if platform:
        query = query.where(Content.platform == platform)

    # Count total
    from sqlalchemy import func
    count_query = select(func.count()).select_from(Content)
    if status_filter:
        count_query = count_query.where(Content.status == ContentStatus(status_filter))
    if platform:
        count_query = count_query.where(Content.platform == platform)

    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Fetch page
    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    items = result.scalars().all()

    return ContentListResponse(
        total=total,
        items=[ContentResponse.model_validate(item) for item in items],
    )


@router.get("/{content_id}", response_model=ContentResponse)
async def get_content(
    content_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get a single content item by ID."""
    result = await db.execute(select(Content).where(Content.id == content_id))
    content = result.scalar_one_or_none()

    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    return ContentResponse.model_validate(content)


@router.patch("/{content_id}/approve", response_model=ContentResponse)
async def approve_content(
    content_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Approve content for publishing."""
    result = await db.execute(select(Content).where(Content.id == content_id))
    content = result.scalar_one_or_none()

    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    content.status = ContentStatus.APPROVED
    content.updated_at = datetime.utcnow()
    await db.flush()
    await db.refresh(content)

    return ContentResponse.model_validate(content)


@router.patch("/{content_id}/reject")
async def reject_content(
    content_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Reject content (set back to draft)."""
    result = await db.execute(select(Content).where(Content.id == content_id))
    content = result.scalar_one_or_none()

    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    content.status = ContentStatus.DRAFT
    content.updated_at = datetime.utcnow()
    await db.flush()

    return {"status": "success", "message": "Content rejected and set to draft"}


@router.patch("/{content_id}/edit", response_model=ContentResponse)
async def edit_content(
    content_id: UUID,
    update: UpdateContentRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Edit a draft content item."""
    result = await db.execute(select(Content).where(Content.id == content_id))
    content = result.scalar_one_or_none()

    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    if content.status not in (ContentStatus.DRAFT, ContentStatus.REVIEWED):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot edit content with status '{content.status.value}'. Only draft/reviewed content can be edited.",
        )

    # Apply updates
    for field, value in update.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(content, field, value)

    content.updated_at = datetime.utcnow()
    await db.flush()
    await db.refresh(content)

    return ContentResponse.model_validate(content)


@router.post("/{content_id}/publish-now")
async def publish_now(
    content_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Immediately publish approved content to its platform."""
    result = await db.execute(select(Content).where(Content.id == content_id))
    content = result.scalar_one_or_none()

    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    if content.status != ContentStatus.APPROVED:
        raise HTTPException(
            status_code=400,
            detail=f"Content must be approved before publishing. Current status: {content.status.value}",
        )

    # Build full text
    post_text = content.improved_text or content.post_text or content.caption or ""
    hashtags = ""
    if content.niche_hashtags:
        hashtags += " ".join(content.niche_hashtags)
    if content.broad_hashtags:
        hashtags += " " + " ".join(content.broad_hashtags)
    full_text = f"{post_text}\n\n{hashtags}".strip()

    platform_name = content.platform.value if hasattr(content.platform, 'value') else content.platform

    # Get platform client with credentials from SocialConnection model
    from utils.credential_loader import get_platform_client

    platform_client = await get_platform_client(
        platform=platform_name,
        user_id=user.id,
        connection_id=getattr(content, 'social_connection_id', None),
    )

    if not platform_client:
        raise HTTPException(
            status_code=400,
            detail=f"No credentials configured for {platform_name}. Connect an account in Settings → Social Media.",
        )

    try:
        post_id = await platform_client.publish(text=full_text)

        # Create schedule record
        schedule = Schedule(
            content_id=content.id,
            platform=PlatformEnum(platform_name),
            scheduled_at=datetime.utcnow(),
            published_at=datetime.utcnow(),
            is_published=True,
            platform_post_id=post_id,
        )
        db.add(schedule)

        # Update content status
        content.status = ContentStatus.PUBLISHED
        content.updated_at = datetime.utcnow()
        await db.flush()

        return {
            "status": "success",
            "message": f"Published to {platform_name} successfully!",
            "post_id": post_id,
        }

    except Exception as e:
        # Must use a separate session to commit FAILED status,
        # because raising HTTPException will cause get_db() to rollback the main session
        from db.database import async_session as session_factory
        async with session_factory() as fail_session:
            from sqlalchemy import update
            await fail_session.execute(
                update(Content)
                .where(Content.id == content_id)
                .values(status=ContentStatus.FAILED, updated_at=datetime.utcnow())
            )
            await fail_session.commit()

        raise HTTPException(
            status_code=500,
            detail=f"Failed to publish to {platform_name}: {str(e)}",
        )


@router.delete("/{content_id}")
async def delete_content(
    content_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a content item."""
    result = await db.execute(select(Content).where(Content.id == content_id))
    content = result.scalar_one_or_none()

    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    await db.delete(content)
    return {"status": "success", "message": "Content deleted"}

