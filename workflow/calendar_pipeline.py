"""
Zaytri — Calendar Pipeline (End-to-End Orchestration)
Processes calendar entries through the full agent pipeline:
  Parse → Content Creator → Hashtag Generator → Review → Approval →
  Scheduler → Publisher → Engagement → Analytics

This orchestrator reads CalendarEntry records from the DB and drives each
through every agent stage, updating the entry status at each step.
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from uuid import UUID

from celery import shared_task

from agents.content_creator import ContentCreatorAgent
from agents.hashtag_generator import HashtagGeneratorAgent
from agents.review_agent import ReviewAgent
from agents.data_parser_agent import DataParserAgent, DataSourceType

logger = logging.getLogger(__name__)


class CalendarPipeline:
    """
    End-to-end pipeline for calendar-sourced content.

    Flow:
    1. Parse uploaded data via DataParserAgent
    2. Store parsed rows as CalendarEntry records
    3. For each entry, run through agents:
       - Content Creator (topic + context → content)
       - Hashtag Generator (+ merge default hashtags from sheet)
       - Review Agent
       - If approval_required → trigger WhatsApp/manual approval
       - Scheduler Bot → queue for publishing
    4. Track pipeline_stage on each entry

    This can be triggered:
    - Immediately on upload (synchronous)
    - Via Celery task (asynchronous batch)
    """

    def __init__(self):
        self.data_parser = DataParserAgent()
        self.content_creator = ContentCreatorAgent()
        self.hashtag_generator = HashtagGeneratorAgent()
        self.review_agent = ReviewAgent()

    # ═══════════════════════════════════════════════════════════════════
    # Step 1: Parse & Store
    # ═══════════════════════════════════════════════════════════════════

    async def parse_and_store(
        self,
        source_type: str,
        user_id: str,
        name: str,
        data: Any = None,
        url: str = None,
        filename: str = None,
    ) -> Dict[str, Any]:
        """
        Parse uploaded data and store as CalendarUpload + CalendarEntry records.

        Returns: { upload_id, total_rows, parsed_rows, failed_rows, errors }
        """
        from db.database import async_session
        from db.calendar_models import (
            CalendarUpload, CalendarEntry, CalendarSourceType,
            CalendarEntryStatus, PipelineStage,
        )

        # Parse the data
        parse_input = {"source_type": source_type}
        if data is not None:
            parse_input["data"] = data
        if url:
            parse_input["url"] = url

        parse_result = await self.data_parser.run(parse_input)

        rows = parse_result["rows"]
        parse_errors = parse_result.get("parse_errors", [])

        # Store in database
        async with async_session() as session:
            # Create upload record
            upload = CalendarUpload(
                user_id=user_id,
                name=name,
                source_type=CalendarSourceType(source_type),
                source_url=url,
                original_filename=filename,
                total_rows=len(rows) + len(parse_errors),
                parsed_rows=len(rows),
                failed_rows=len(parse_errors),
                parse_errors=parse_errors if parse_errors else None,
            )
            session.add(upload)
            await session.flush()

            # Create entry records
            entries_created = 0
            for row in rows:
                try:
                    # Parse scheduled date
                    sched_date = None
                    date_str = row.get("scheduled_date") or row.get("date")
                    if date_str:
                        try:
                            sched_date = datetime.strptime(date_str, "%Y-%m-%d")
                        except (ValueError, TypeError):
                            pass

                    entry = CalendarEntry(
                        upload_id=upload.id,
                        user_id=user_id,
                        row_number=row.get("_row_number"),
                        date=row.get("date"),
                        scheduled_date=sched_date,
                        brand=row.get("brand"),
                        content_type=row.get("content_type"),
                        topic=row.get("topic", ""),
                        tone=row.get("tone", "professional"),
                        cta=row.get("cta"),
                        link=row.get("link"),
                        platforms=row.get("platforms", []),
                        default_hashtags=row.get("default_hashtags", []),
                        generated_hashtags=row.get("generated_hashtags", []),
                        approval_required=row.get("approval_required", False),
                        model_provider=row.get("model_provider"),
                        model_name=row.get("model_name") or row.get("model"),
                        status=CalendarEntryStatus.PENDING,
                        pipeline_stage=PipelineStage.PARSED,
                        raw_data=row,
                        notes=row.get("notes"),
                    )
                    session.add(entry)
                    entries_created += 1
                except Exception as e:
                    parse_errors.append(f"Row {row.get('_row_number', '?')}: {str(e)}")
                    logger.error(f"Failed to create entry: {e}")

            upload.parsed_rows = entries_created
            upload.is_processed = True
            upload.processed_at = datetime.utcnow()

            await session.commit()
            await session.refresh(upload)

            return {
                "upload_id": str(upload.id),
                "total_rows": upload.total_rows,
                "parsed_rows": entries_created,
                "failed_rows": len(parse_errors),
                "errors": parse_errors,
                "name": name,
            }

    # ═══════════════════════════════════════════════════════════════════
    # Step 2: Process Pipeline (per entry)
    # ═══════════════════════════════════════════════════════════════════

    async def process_entry(self, entry_id: str) -> Dict[str, Any]:
        """
        Process a single CalendarEntry through the full pipeline.

        Stages: Content Creation → Hashtag Generation → Review →
                (Approval if required) → Save as Content → Queue for Scheduling
        """
        from db.database import async_session
        from db.calendar_models import CalendarEntry, CalendarEntryStatus, PipelineStage
        from db.models import Content, ContentStatus, Platform as PlatformEnum
        from sqlalchemy import select

        async with async_session() as session:
            result = await session.execute(
                select(CalendarEntry).where(CalendarEntry.id == entry_id)
            )
            entry = result.scalar_one_or_none()
            if not entry:
                return {"success": False, "error": "Entry not found"}

            content_ids = []
            errors = []

            try:
                # ── Stage 1: Content Creation ───────────────────────────
                entry.pipeline_stage = PipelineStage.CONTENT_CREATION
                entry.status = CalendarEntryStatus.QUEUED
                await session.commit()

                # Build enriched prompt context from calendar data
                enriched_topic = self._build_enriched_topic(entry)

                content_result = await self.content_creator.run({
                    "topic": enriched_topic,
                    "platform": entry.platforms[0] if entry.platforms else "instagram",
                    "tone": entry.tone or "professional",
                })

                # If there's a CTA link from the sheet, use it
                if entry.link and not content_result.get("cta"):
                    content_result["cta"] = f"Check it out: {entry.link}"
                elif entry.cta:
                    content_result["cta"] = entry.cta

                # ── Stage 2: Hashtag Generation ─────────────────────────
                entry.pipeline_stage = PipelineStage.HASHTAG_GENERATION
                await session.commit()

                hashtag_result = await self.hashtag_generator.run({
                    "topic": entry.topic,
                    "platform": entry.platforms[0] if entry.platforms else "instagram",
                })

                # Merge default hashtags from sheet
                if entry.default_hashtags:
                    existing_niche = hashtag_result.get("niche_hashtags", [])
                    merged = list(set(entry.default_hashtags + existing_niche))
                    hashtag_result["niche_hashtags"] = merged

                entry.generated_hashtags = (
                    hashtag_result.get("niche_hashtags", [])
                    + hashtag_result.get("broad_hashtags", [])
                )

                # ── Stage 3: Review ─────────────────────────────────────
                entry.pipeline_stage = PipelineStage.REVIEW
                await session.commit()

                review_input = {
                    **content_result,
                    "niche_hashtags": hashtag_result.get("niche_hashtags", []),
                    "broad_hashtags": hashtag_result.get("broad_hashtags", []),
                }
                review_result = await self.review_agent.run(review_input)

                entry.status = CalendarEntryStatus.REVIEW_PASSED
                entry.pipeline_stage = PipelineStage.REVIEW

                # ── Stage 4: Save as Content (one per platform) ─────────
                for platform in entry.platforms:
                    try:
                        # Map platform string to enum
                        try:
                            platform_enum = PlatformEnum(platform)
                        except ValueError:
                            logger.warning(f"Unknown platform '{platform}', skipping")
                            continue

                        # Determine content status
                        if entry.approval_required:
                            content_status = ContentStatus.REVIEWED
                        elif review_result.get("is_approved", False):
                            content_status = ContentStatus.APPROVED
                        else:
                            content_status = ContentStatus.DRAFT

                        db_content = Content(
                            topic=entry.topic,
                            platform=platform_enum,
                            tone=entry.tone or "professional",
                            caption=content_result.get("caption"),
                            hook=content_result.get("hook"),
                            cta=content_result.get("cta"),
                            post_text=content_result.get("post_text"),
                            niche_hashtags=hashtag_result.get("niche_hashtags"),
                            broad_hashtags=hashtag_result.get("broad_hashtags"),
                            review_score=review_result.get("overall_score"),
                            review_feedback=str(review_result.get("issues", [])),
                            improved_text=review_result.get("improved_text"),
                            status=content_status,
                            created_by=entry.user_id,
                        )
                        session.add(db_content)
                        await session.flush()
                        content_ids.append(str(db_content.id))

                    except Exception as e:
                        errors.append(f"Platform {platform}: {str(e)}")
                        logger.error(f"Failed to create content for platform {platform}: {e}")

                # ── Stage 5: Approval (if required) ─────────────────────
                if entry.approval_required:
                    entry.pipeline_stage = PipelineStage.APPROVAL
                    entry.status = CalendarEntryStatus.APPROVAL_SENT

                    # Try WhatsApp approval if configured
                    try:
                        from config import settings
                        if settings.whatsapp_access_token and content_ids:
                            from api.whatsapp_approval import _send_whatsapp_approval
                            # Send approval for first content
                            # (In production, could send for all)
                            logger.info(
                                f"WhatsApp approval would be sent for entry {entry_id}"
                            )
                    except Exception as e:
                        logger.warning(f"WhatsApp approval skipped: {e}")
                else:
                    entry.pipeline_stage = PipelineStage.SCHEDULING
                    entry.status = CalendarEntryStatus.APPROVED

                # Update entry with content IDs
                entry.content_ids = content_ids
                entry.status = (
                    CalendarEntryStatus.APPROVAL_SENT
                    if entry.approval_required
                    else CalendarEntryStatus.APPROVED
                )
                entry.pipeline_stage = (
                    PipelineStage.APPROVAL
                    if entry.approval_required
                    else PipelineStage.SCHEDULING
                )

                await session.commit()

                return {
                    "success": True,
                    "entry_id": str(entry.id),
                    "content_ids": content_ids,
                    "status": entry.status.value,
                    "pipeline_stage": entry.pipeline_stage.value,
                    "review_score": review_result.get("overall_score"),
                    "errors": errors,
                }

            except Exception as e:
                entry.pipeline_stage = PipelineStage.FAILED
                entry.status = CalendarEntryStatus.FAILED
                entry.pipeline_errors = (entry.pipeline_errors or []) + [str(e)]
                await session.commit()

                logger.error(f"Pipeline failed for entry {entry_id}: {e}", exc_info=True)
                return {
                    "success": False,
                    "entry_id": str(entry.id),
                    "error": str(e),
                    "stage": entry.pipeline_stage.value,
                }

    # ═══════════════════════════════════════════════════════════════════
    # Step 3: Batch Process (all entries from an upload)
    # ═══════════════════════════════════════════════════════════════════

    async def process_upload(self, upload_id: str) -> Dict[str, Any]:
        """Process all pending entries from a calendar upload."""
        from db.database import async_session
        from db.calendar_models import CalendarEntry, CalendarEntryStatus
        from sqlalchemy import select

        async with async_session() as session:
            result = await session.execute(
                select(CalendarEntry).where(
                    CalendarEntry.upload_id == upload_id,
                    CalendarEntry.status == CalendarEntryStatus.PENDING,
                ).order_by(CalendarEntry.row_number)
            )
            entries = result.scalars().all()

        results = []
        success_count = 0
        fail_count = 0

        for entry in entries:
            try:
                r = await self.process_entry(str(entry.id))
                results.append(r)
                if r.get("success"):
                    success_count += 1
                else:
                    fail_count += 1
            except Exception as e:
                fail_count += 1
                results.append({
                    "success": False,
                    "entry_id": str(entry.id),
                    "error": str(e),
                })

        return {
            "upload_id": upload_id,
            "total_entries": len(entries),
            "success": success_count,
            "failed": fail_count,
            "results": results,
        }

    # ═══════════════════════════════════════════════════════════════════
    # Helpers
    # ═══════════════════════════════════════════════════════════════════

    def _build_enriched_topic(self, entry) -> str:
        """
        Build an enriched topic string from calendar entry metadata.
        This gives the Content Creator Agent more context for better content.
        """
        parts = [entry.topic]

        if entry.brand:
            parts.append(f"(Brand: {entry.brand})")

        if entry.content_type:
            parts.append(f"| Content Type: {entry.content_type}")

        if entry.link:
            parts.append(f"| Include link: {entry.link}")

        if entry.notes:
            parts.append(f"| Notes: {entry.notes}")

        return " ".join(parts)


# ═════════════════════════════════════════════════════════════════════════════
# Celery Tasks
# ═════════════════════════════════════════════════════════════════════════════

@shared_task(name="workflow.calendar_pipeline.process_calendar_upload")
def process_calendar_upload_task(upload_id: str):
    """Celery task: process all entries from a calendar upload."""
    import asyncio
    pipeline = CalendarPipeline()
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(pipeline.process_upload(upload_id))
    finally:
        loop.close()


@shared_task(name="workflow.calendar_pipeline.process_calendar_entry")
def process_calendar_entry_task(entry_id: str):
    """Celery task: process a single calendar entry."""
    import asyncio
    pipeline = CalendarPipeline()
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(pipeline.process_entry(entry_id))
    finally:
        loop.close()
