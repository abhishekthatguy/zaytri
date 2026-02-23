"""
Zaytri — Master Orchestrator
Thin coordinator (~150 lines) replacing the 1121-line monolith.
Delegates to: IntentClassifier → BrandResolver → TaskPlanner → ExecutionController.
"""

import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from brain.providers import BaseLLMProvider
from infra.logging import get_logger, set_request_id, set_task_context
from orchestration.intent_classifier import (
    classify_intent,
    is_identity_question,
    IntentResult,
)
from orchestration.user_memory import UserMemory

logger = get_logger("orchestration.master")

# Module-level user memory (survives across requests, lost on restart)
user_memory = UserMemory()

# Default intro for total LLM failure
DEFAULT_INTRO_MESSAGE = (
    "I am **Zaytri**, an AI automation system built by **Abhishek Singh (Avii)**.\n\n"
    "I can:\n"
    "• Generate and schedule social media content\n"
    "• Automate workflows across platforms\n"
    "• Analyze engagement patterns\n"
    "• Coordinate multiple AI models\n\n"
    "Tell me what you'd like to automate today. 🚀"
)

GUEST_ALLOWED_INTENTS = {"general_chat", "introduce", "help"}


class MasterOrchestrator:
    """
    V3 Master Agent — thin orchestrator.
    
    Flow:
    1. classify_intent() → IntentResult
    2. BrandResolver.resolve() → brand context
    3. TaskPlanner.plan() → TaskExecution record (or None for lightweight)
    4. ExecutionController.execute() → result
    5. Return response
    """

    def __init__(self, llm: BaseLLMProvider):
        """
        Args:
            llm: Injected LLM provider for intent classification
        """
        self.llm = llm

    async def chat(
        self,
        message: str,
        user_id: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        is_authenticated: bool = True,
    ) -> Dict[str, Any]:
        """
        Process a chat message through the orchestration pipeline.
        """
        logger.info(f"Received: {message[:80]}...")

        # ── 1. Classify intent via LLM ───────────────────────────────
        memory_ctx = user_memory.get_context(user_id)

        try:
            intent_result = await classify_intent(
                message=message,
                llm=self.llm,
                user_context=memory_ctx,
                conversation_history=conversation_history,
            )
        except Exception:
            # Total LLM failure
            logger.warning("All LLMs failed — returning offline response")
            user_memory.record_interaction(user_id, "general_chat", message)

            if is_identity_question(message):
                return {
                    "intent": "introduce",
                    "response": DEFAULT_INTRO_MESSAGE,
                    "action_success": True,
                    "action_data": None,
                }

            return {
                "intent": "general_chat",
                "response": (
                    "⚠️ I'm having trouble connecting to my AI brain right now. "
                    "All language model providers are currently unreachable.\n\n"
                    "**Quick fixes:**\n"
                    "• Make sure **Ollama** is running: `ollama serve`\n"
                    "• Or add a cloud API key in Settings\n\n"
                    "Please try again in a moment! 🔄"
                ),
                "action_success": False,
                "action_data": None,
            }

        intent = intent_result["intent"]
        params = intent_result["params"]
        llm_response = intent_result["response"]

        logger.info(f"Classified: intent={intent}, params={list(params.keys())}")

        # ── 2. Auth gate ─────────────────────────────────────────────
        if not is_authenticated and intent not in GUEST_ALLOWED_INTENTS:
            user_memory.record_interaction(user_id, intent, message, params)
            return {
                "intent": intent,
                "response": (
                    "🔒 To perform this action, you need to be logged in.\n\n"
                    "Please **sign in** or **create an account** first, "
                    "and then I can help you with that!\n\n"
                    "You can still chat with me freely without logging in. 😊"
                ),
                "action_success": False,
                "action_data": {"requires_login": True},
            }

        # ── 3. Execute via orchestration pipeline ────────────────────
        from db.database import async_session
        from orchestration.brand_resolver import BrandResolver
        from orchestration.task_planner import TaskPlanner, LIGHTWEIGHT_INTENTS
        from orchestration.execution_controller import ExecutionController

        async with async_session() as session:
            # Resolve brand
            resolver = BrandResolver(session)
            brand = await resolver.resolve(user_id, params.get("brand"))

            if brand:
                set_task_context(brand_id=str(brand.id))

            # Plan task
            planner = TaskPlanner(session)
            task = await planner.plan(
                user_id=user_id,
                intent=intent,
                params=params,
                brand=brand,
            )

            # Execute
            controller = ExecutionController(session, user_id)

            # Build action handlers from the legacy ActionExecutor
            from agents.master_agent import ActionExecutor
            executor = ActionExecutor(user_id=user_id, session=session)
            action_handlers = {
                name.replace("_handle_", ""): getattr(executor, name)
                for name in dir(executor)
                if name.startswith("_handle_")
            }

            if task:
                action_result = await controller.execute(task, action_handlers)
            else:
                action_result = await controller.execute_lightweight(
                    intent, params, action_handlers
                )

            await session.commit()

        # ── 4. Enrich response with action data ─────────────────────
        if action_result.get("data") and intent not in ("help", "general_chat", "introduce"):
            data = action_result["data"]
            if isinstance(data, list) and len(data) > 0:
                items_text = "\n".join(
                    f"  • {json.dumps(item, default=str)}" for item in data[:10]
                )
                llm_response += f"\n\n{items_text}"
            elif isinstance(data, dict):
                items_text = "\n".join(
                    f"  • **{k}**: {v}" for k, v in data.items()
                )
                llm_response += f"\n\n{items_text}"

        # ── 5. Record interaction ────────────────────────────────────
        user_memory.record_interaction(user_id, intent, message, params)

        return {
            "intent": intent,
            "response": llm_response,
            "action_success": action_result.get("success", True),
            "action_data": action_result.get("data"),
        }
