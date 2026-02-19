"""
Zaytri — Calendar API Routes
Upload, parse, process, and manage content calendar entries.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, status
from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime

from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from auth.models import User
from db.database import get_db

router = APIRouter(prefix="/calendar", tags=["Calendar"])
logger = logging.getLogger(__name__)


# ─── Request / Response Schemas ──────────────────────────────────────────────

class CalendarUploadResponse(BaseModel):
    id: str
    name: str
    source_type: str
    total_rows: int
    parsed_rows: int
    failed_rows: int
    parse_errors: Optional[list] = None
    is_processed: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class CalendarEntryResponse(BaseModel):
    id: str
    upload_id: str
    row_number: Optional[int] = None
    date: Optional[str] = None
    brand: Optional[str] = None
    content_type: Optional[str] = None
    topic: str
    tone: Optional[str] = None
    platforms: list
    default_hashtags: Optional[list] = None
    generated_hashtags: Optional[list] = None
    approval_required: bool
    status: str
    pipeline_stage: str
    content_ids: Optional[list] = None
    pipeline_errors: Optional[list] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class CalendarStatsResponse(BaseModel):
    total_uploads: int
    total_entries: int
    by_status: dict
    by_brand: dict
    by_platform: dict


class ProcessResponse(BaseModel):
    status: str
    message: str
    data: Optional[dict] = None


class GoogleSheetRequest(BaseModel):
    url: str
    name: Optional[str] = "Google Sheet Import"


# ─── Upload Routes ───────────────────────────────────────────────────────────

@router.post("/upload/csv", response_model=ProcessResponse)
async def upload_csv(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    user: User = Depends(get_current_user),
):
    """Upload a CSV file and parse it into calendar entries."""
    if not file.filename.endswith((".csv", ".tsv")):
        raise HTTPException(
            status_code=400,
            detail="Only CSV and TSV files are supported",
        )

    content = await file.read()
    upload_name = name or file.filename or "CSV Upload"

    try:
        from workflow.calendar_pipeline import CalendarPipeline
        pipeline = CalendarPipeline()

        result = await pipeline.parse_and_store(
            source_type="csv_file",
            user_id=str(user.id),
            name=upload_name,
            data=content,
            filename=file.filename,
        )

        return ProcessResponse(
            status="success",
            message=f"Parsed {result['parsed_rows']} entries from {upload_name}",
            data=result,
        )

    except Exception as e:
        logger.error(f"CSV upload failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.post("/upload/google-sheet", response_model=ProcessResponse)
async def upload_google_sheet(
    request: GoogleSheetRequest,
    user: User = Depends(get_current_user),
):
    """Fetch and parse a public Google Sheet into calendar entries."""
    try:
        from workflow.calendar_pipeline import CalendarPipeline
        pipeline = CalendarPipeline()

        result = await pipeline.parse_and_store(
            source_type="google_sheet",
            user_id=str(user.id),
            name=request.name,
            url=request.url,
        )

        return ProcessResponse(
            status="success",
            message=f"Parsed {result['parsed_rows']} entries from Google Sheet",
            data=result,
        )

    except Exception as e:
        logger.error(f"Google Sheet import failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


@router.post("/upload/json", response_model=ProcessResponse)
async def upload_json(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    user: User = Depends(get_current_user),
):
    """Upload a JSON/JSONL file and parse it into calendar entries."""
    content = await file.read()
    upload_name = name or file.filename or "JSON Upload"

    try:
        from workflow.calendar_pipeline import CalendarPipeline
        pipeline = CalendarPipeline()

        result = await pipeline.parse_and_store(
            source_type="json_file",
            user_id=str(user.id),
            name=upload_name,
            data=content,
            filename=file.filename,
        )

        return ProcessResponse(
            status="success",
            message=f"Parsed {result['parsed_rows']} entries from JSON",
            data=result,
        )

    except Exception as e:
        logger.error(f"JSON upload failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


# ─── Upload Management ──────────────────────────────────────────────────────

@router.get("/uploads")
async def list_uploads(
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all calendar uploads for the current user."""
    from db.calendar_models import CalendarUpload

    count_result = await db.execute(
        select(func.count()).select_from(CalendarUpload)
        .where(CalendarUpload.user_id == user.id)
    )
    total = count_result.scalar() or 0

    result = await db.execute(
        select(CalendarUpload)
        .where(CalendarUpload.user_id == user.id)
        .order_by(desc(CalendarUpload.created_at))
        .offset(offset)
        .limit(limit)
    )
    uploads = result.scalars().all()

    return {
        "total": total,
        "items": [
            {
                "id": str(u.id),
                "name": u.name,
                "source_type": u.source_type.value,
                "total_rows": u.total_rows,
                "parsed_rows": u.parsed_rows,
                "failed_rows": u.failed_rows,
                "is_processed": u.is_processed,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in uploads
        ],
    }


@router.delete("/uploads/{upload_id}")
async def delete_upload(
    upload_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a calendar upload and all its entries."""
    from db.calendar_models import CalendarUpload

    result = await db.execute(
        select(CalendarUpload).where(
            CalendarUpload.id == upload_id,
            CalendarUpload.user_id == user.id,
        )
    )
    upload = result.scalar_one_or_none()

    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")

    await db.delete(upload)
    return {"status": "success", "message": "Upload and all entries deleted"}


# ─── Entry Management ───────────────────────────────────────────────────────

@router.get("/entries")
async def list_entries(
    upload_id: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    brand: Optional[str] = None,
    platform: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List calendar entries with filters."""
    from db.calendar_models import CalendarEntry, CalendarEntryStatus

    query = (
        select(CalendarEntry)
        .where(CalendarEntry.user_id == user.id)
        .order_by(CalendarEntry.row_number)
    )

    if upload_id:
        query = query.where(CalendarEntry.upload_id == upload_id)
    if status_filter:
        try:
            query = query.where(
                CalendarEntry.status == CalendarEntryStatus(status_filter)
            )
        except ValueError:
            pass
    if brand:
        query = query.where(CalendarEntry.brand == brand)

    # Count total
    count_query = select(func.count()).select_from(CalendarEntry).where(
        CalendarEntry.user_id == user.id
    )
    if upload_id:
        count_query = count_query.where(CalendarEntry.upload_id == upload_id)
    if status_filter:
        try:
            count_query = count_query.where(
                CalendarEntry.status == CalendarEntryStatus(status_filter)
            )
        except ValueError:
            pass

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    result = await db.execute(query.offset(offset).limit(limit))
    entries = result.scalars().all()

    items = []
    for e in entries:
        items.append({
            "id": str(e.id),
            "upload_id": str(e.upload_id),
            "row_number": e.row_number,
            "date": e.date,
            "brand": e.brand,
            "content_type": e.content_type,
            "topic": e.topic,
            "tone": e.tone,
            "platforms": e.platforms or [],
            "default_hashtags": e.default_hashtags or [],
            "generated_hashtags": e.generated_hashtags or [],
            "approval_required": e.approval_required,
            "status": e.status.value if e.status else "pending",
            "pipeline_stage": e.pipeline_stage.value if e.pipeline_stage else "parsed",
            "content_ids": e.content_ids or [],
            "pipeline_errors": e.pipeline_errors,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        })

    return {"total": total, "items": items}


@router.get("/entries/{entry_id}")
async def get_entry(
    entry_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get a single calendar entry."""
    from db.calendar_models import CalendarEntry

    result = await db.execute(
        select(CalendarEntry).where(
            CalendarEntry.id == entry_id,
            CalendarEntry.user_id == user.id,
        )
    )
    entry = result.scalar_one_or_none()

    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    return {
        "id": str(entry.id),
        "upload_id": str(entry.upload_id),
        "row_number": entry.row_number,
        "date": entry.date,
        "brand": entry.brand,
        "content_type": entry.content_type,
        "topic": entry.topic,
        "tone": entry.tone,
        "cta": entry.cta,
        "link": entry.link,
        "platforms": entry.platforms or [],
        "default_hashtags": entry.default_hashtags or [],
        "generated_hashtags": entry.generated_hashtags or [],
        "approval_required": entry.approval_required,
        "status": entry.status.value if entry.status else "pending",
        "pipeline_stage": entry.pipeline_stage.value if entry.pipeline_stage else "parsed",
        "content_ids": entry.content_ids or [],
        "pipeline_errors": entry.pipeline_errors,
        "raw_data": entry.raw_data,
        "notes": entry.notes,
        "created_at": entry.created_at.isoformat() if entry.created_at else None,
    }


# ─── Pipeline Processing ────────────────────────────────────────────────────

@router.post("/process/upload/{upload_id}", response_model=ProcessResponse)
async def process_upload(
    upload_id: UUID,
    user: User = Depends(get_current_user),
):
    """
    Process all pending entries from a calendar upload through the full pipeline.
    This runs Content Creator → Hashtag → Review → Approval → Schedule.
    """
    try:
        from workflow.calendar_pipeline import CalendarPipeline
        pipeline = CalendarPipeline()
        result = await pipeline.process_upload(str(upload_id))

        return ProcessResponse(
            status="success",
            message=f"Processed {result['success']}/{result['total_entries']} entries",
            data=result,
        )

    except Exception as e:
        logger.error(f"Upload processing failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")


@router.post("/process/upload/{upload_id}/async", response_model=ProcessResponse)
async def process_upload_async(
    upload_id: UUID,
    user: User = Depends(get_current_user),
):
    """Process all pending entries asynchronously via Celery."""
    try:
        from celery_app import celery_app
        task = celery_app.send_task(
            "workflow.calendar_pipeline.process_calendar_upload",
            args=[str(upload_id)],
        )

        return ProcessResponse(
            status="queued",
            message="Calendar processing queued",
            data={"task_id": task.id, "upload_id": str(upload_id)},
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to queue processing: {str(e)}",
        )


@router.post("/process/entry/{entry_id}", response_model=ProcessResponse)
async def process_entry(
    entry_id: UUID,
    user: User = Depends(get_current_user),
):
    """Process a single calendar entry through the pipeline."""
    try:
        from workflow.calendar_pipeline import CalendarPipeline
        pipeline = CalendarPipeline()
        result = await pipeline.process_entry(str(entry_id))

        return ProcessResponse(
            status="success" if result.get("success") else "failed",
            message="Entry processed" if result.get("success") else f"Failed: {result.get('error')}",
            data=result,
        )

    except Exception as e:
        logger.error(f"Entry processing failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")


# ─── Statistics ──────────────────────────────────────────────────────────────

@router.get("/stats", response_model=CalendarStatsResponse)
async def get_calendar_stats(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get calendar statistics for the dashboard."""
    from db.calendar_models import CalendarUpload, CalendarEntry, CalendarEntryStatus

    # Total uploads
    upload_count = await db.execute(
        select(func.count()).select_from(CalendarUpload)
        .where(CalendarUpload.user_id == user.id)
    )
    total_uploads = upload_count.scalar() or 0

    # Total entries
    entry_count = await db.execute(
        select(func.count()).select_from(CalendarEntry)
        .where(CalendarEntry.user_id == user.id)
    )
    total_entries = entry_count.scalar() or 0

    # By status
    by_status = {}
    for s in CalendarEntryStatus:
        result = await db.execute(
            select(func.count()).select_from(CalendarEntry)
            .where(CalendarEntry.user_id == user.id, CalendarEntry.status == s)
        )
        count = result.scalar() or 0
        if count > 0:
            by_status[s.value] = count

    # By brand
    brand_result = await db.execute(
        select(CalendarEntry.brand, func.count())
        .where(CalendarEntry.user_id == user.id)
        .group_by(CalendarEntry.brand)
    )
    by_brand = {row[0] or "Unknown": row[1] for row in brand_result.fetchall()}

    # By platform (flatten the JSON array)
    # Note: This is a simplified approach; platform counts may overlap
    all_entries = await db.execute(
        select(CalendarEntry.platforms)
        .where(CalendarEntry.user_id == user.id)
    )
    platform_counts = {}
    for (platforms,) in all_entries.fetchall():
        if platforms:
            for p in platforms:
                platform_counts[p] = platform_counts.get(p, 0) + 1

    return CalendarStatsResponse(
        total_uploads=total_uploads,
        total_entries=total_entries,
        by_status=by_status,
        by_brand=by_brand,
        by_platform=platform_counts,
    )
