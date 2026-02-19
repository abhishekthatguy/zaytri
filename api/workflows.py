"""
Zaytri — Workflow API Routes
Trigger and monitor content creation pipelines.
"""

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional

from auth.dependencies import get_current_user
from auth.models import User
from workflow.pipeline import ContentPipeline

router = APIRouter(prefix="/workflow", tags=["Workflows"])


class WorkflowRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=500, description="Content topic")
    platform: str = Field(..., description="Target platform: instagram, facebook, twitter, youtube")
    tone: str = Field(default="professional", description="Content tone")


class WorkflowResponse(BaseModel):
    status: str
    message: str
    data: Optional[dict] = None


@router.post("/run", response_model=WorkflowResponse)
async def run_workflow(
    request: WorkflowRequest,
    user: User = Depends(get_current_user),
):
    """
    Trigger the full content creation pipeline.
    Chains: Content Creator → Hashtag Generator → Review Agent → Save to DB.
    """
    # Validate platform
    valid_platforms = ["instagram", "facebook", "twitter", "youtube"]
    if request.platform.lower() not in valid_platforms:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid platform. Must be one of: {valid_platforms}",
        )

    try:
        pipeline = ContentPipeline()
        result = await pipeline.run(
            topic=request.topic,
            platform=request.platform.lower(),
            tone=request.tone,
            user_id=str(user.id),
        )

        return WorkflowResponse(
            status="success",
            message="Content pipeline completed successfully",
            data=result,
        )

    except ConnectionError as e:
        # Save failed content to DB so it shows in the Failed tab
        try:
            from db.database import async_session
            from db.models import Content, ContentStatus, Platform as PlatformEnum
            async with async_session() as session:
                db_content = Content(
                    topic=request.topic,
                    platform=PlatformEnum(request.platform.lower()),
                    tone=request.tone,
                    status=ContentStatus.FAILED,
                    review_feedback=f"Pipeline failed: {str(e)}",
                    created_by=user.id,
                )
                session.add(db_content)
                await session.commit()
        except Exception:
            pass  # Don't mask the original error

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"LLM service unavailable. Failed after 3 attempts. Please check that Ollama is running.",
        )
    except Exception as e:
        # Save failed content to DB so it shows in the Failed tab
        try:
            from db.database import async_session
            from db.models import Content, ContentStatus, Platform as PlatformEnum
            async with async_session() as session:
                db_content = Content(
                    topic=request.topic,
                    platform=PlatformEnum(request.platform.lower()),
                    tone=request.tone,
                    status=ContentStatus.FAILED,
                    review_feedback=f"Pipeline failed: {str(e)}",
                    created_by=user.id,
                )
                session.add(db_content)
                await session.commit()
        except Exception:
            pass

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Pipeline failed: {str(e)}",
        )


@router.post("/run-async", response_model=WorkflowResponse)
async def run_workflow_async(
    request: WorkflowRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
):
    """
    Trigger the content pipeline asynchronously via Celery.
    Returns immediately with a task ID for status polling.
    """
    try:
        from celery_app import celery_app

        task = celery_app.send_task(
            "workflow.pipeline.run_content_pipeline",
            args=[request.topic, request.platform.lower(), request.tone, str(user.id)],
        )

        return WorkflowResponse(
            status="queued",
            message="Content pipeline queued for execution",
            data={"task_id": task.id},
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to queue pipeline: {str(e)}",
        )


@router.get("/status/{task_id}", response_model=WorkflowResponse)
async def get_workflow_status(
    task_id: str,
    user: User = Depends(get_current_user),
):
    """Check the status of an async pipeline task."""
    try:
        from celery_app import celery_app

        result = celery_app.AsyncResult(task_id)

        if result.ready():
            return WorkflowResponse(
                status="completed",
                message="Pipeline task completed",
                data={"result": result.result, "task_id": task_id},
            )
        elif result.failed():
            return WorkflowResponse(
                status="failed",
                message=f"Pipeline task failed: {str(result.info)}",
                data={"task_id": task_id},
            )
        else:
            return WorkflowResponse(
                status="running",
                message="Pipeline task is still running",
                data={"task_id": task_id, "state": result.state},
            )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check task status: {str(e)}",
        )
