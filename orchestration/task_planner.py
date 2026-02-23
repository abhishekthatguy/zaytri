"""
Zaytri — Task Planner (Orchestration Layer)
Converts classified intent → TaskExecution DB record with execution plan.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from db.task_models import TaskExecution, TaskState
from db.settings_models import BrandSettings
from infra.logging import get_logger

logger = get_logger("orchestration.task_planner")


# Maps intents to agent step sequences
INTENT_PLANS: Dict[str, List[str]] = {
    "run_workflow": ["content_agent", "hashtag_agent", "review_agent", "save_to_db"],
    "process_calendar": ["calendar_pipeline"],
    "upload_calendar": ["calendar_pipeline"],
    # Single-step intents (domain service calls, no agent chain)
    "assign_llm_key": ["llm_settings_service"],
    "delete_llm_key": ["llm_settings_service"],
    "test_provider": ["llm_settings_service"],
    "assign_agent_model": ["llm_settings_service"],
    "reset_agent_model": ["llm_settings_service"],
    "switch_all_agents": ["llm_settings_service"],
    "update_cron": ["settings_service"],
    "get_system_status": ["system_service"],
    "list_content": ["content_service"],
    "approve_content": ["content_service"],
    "delete_content": ["content_service"],
    "list_providers": ["llm_settings_service"],
    "list_agents": ["llm_settings_service"],
    "get_settings": ["settings_service"],
    "list_calendar": ["calendar_service"],
    "create_image": ["image_generator"],
}

# Intents that don't need a TaskExecution record
LIGHTWEIGHT_INTENTS = {
    "introduce", "help", "general_chat",
}


class TaskPlanner:
    """
    Creates TaskExecution records and determines the execution plan
    for a classified intent.
    """

    def __init__(self, session: AsyncSession):
        self.session = session

    async def plan(
        self,
        user_id: str,
        intent: str,
        params: Dict[str, Any],
        brand: Optional[BrandSettings] = None,
        idempotency_key: Optional[str] = None,
    ) -> Optional[TaskExecution]:
        """
        Create a TaskExecution record with state PLANNED.

        For lightweight intents (introduce, help, general_chat),
        returns None — no DB tracking needed.

        Args:
            user_id: User UUID
            intent: Classified intent string
            params: Intent parameters
            brand: Resolved brand (for isolation)
            idempotency_key: Optional key for Celery dedup

        Returns:
            TaskExecution instance or None for lightweight intents
        """
        if intent in LIGHTWEIGHT_INTENTS:
            logger.info(f"Lightweight intent '{intent}' — no task record needed")
            return None

        plan_steps = INTENT_PLANS.get(intent, ["unknown"])

        task = TaskExecution(
            user_id=user_id,
            brand_id=brand.id if brand else None,
            intent=intent,
            params_json=params,
            plan_json={"steps": plan_steps},
            state=TaskState.PLANNED,
            planned_at=datetime.utcnow(),
            idempotency_key=idempotency_key,
        )

        self.session.add(task)
        await self.session.flush()  # Get the ID without committing

        logger.info(
            f"Task planned: id={str(task.id)[:8]}, intent={intent}, "
            f"steps={plan_steps}, brand={brand.brand_name if brand else 'none'}"
        )
        return task
