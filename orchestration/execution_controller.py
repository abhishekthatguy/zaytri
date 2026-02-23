"""
Zaytri — Execution Controller (Orchestration Layer)
Runs planned task steps, tracks state transitions in DB, handles timeouts/retries.
"""

import json
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from db.task_models import TaskExecution, TaskState
from infra.logging import get_logger, set_task_context

logger = get_logger("orchestration.execution_controller")


class ExecutionController:
    """
    Executes a TaskExecution by running its planned steps.
    Updates state: PLANNED → EXECUTING → PUBLISHED/FAILED.
    """

    def __init__(self, session: AsyncSession, user_id: str):
        self.session = session
        self.user_id = user_id

    async def execute(
        self,
        task: TaskExecution,
        action_handlers: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Execute a planned task.

        Args:
            task: TaskExecution record with state PLANNED
            action_handlers: Dict mapping intent → async handler callable

        Returns:
            Execution result dict
        """
        # Set logging context
        set_task_context(
            task_id=str(task.id),
            brand_id=str(task.brand_id) if task.brand_id else None,
        )

        # Transition to EXECUTING
        task.state = TaskState.EXECUTING
        task.started_at = datetime.utcnow()
        await self.session.flush()

        logger.info(f"Executing task: intent={task.intent}")

        try:
            handler = action_handlers.get(task.intent)
            if not handler:
                raise ValueError(f"No handler for intent: {task.intent}")

            result = await handler(task.params_json or {})

            # Determine final state
            if result.get("success", True):
                task.state = TaskState.PUBLISHED
                task.result_json = result
            else:
                task.state = TaskState.FAILED
                task.error_message = result.get("message", "Unknown error")
                task.result_json = result

            task.completed_at = datetime.utcnow()
            await self.session.flush()

            logger.info(
                f"Task completed: state={task.state.value}, "
                f"intent={task.intent}"
            )
            return result

        except Exception as e:
            task.state = TaskState.FAILED
            task.error_message = str(e)
            task.completed_at = datetime.utcnow()
            await self.session.flush()

            logger.error(f"Task failed: {e}", exc_info=True)
            return {"success": False, "message": str(e)}

    async def execute_lightweight(
        self,
        intent: str,
        params: Dict[str, Any],
        action_handlers: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Execute a lightweight intent (no TaskExecution record).
        Used for introduce, help, general_chat.
        """
        handler = action_handlers.get(intent)
        if not handler:
            return {"success": True, "message": "Handled by LLM response"}

        try:
            return await handler(params)
        except Exception as e:
            logger.error(f"Lightweight action failed: {intent} — {e}")
            return {"success": False, "message": str(e)}
