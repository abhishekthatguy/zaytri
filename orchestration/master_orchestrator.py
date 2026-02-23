"""
Zaytri — Master Orchestrator
Thin coordinator replacing the 1121-line monolith.
Delegates to: IntentClassifier → BrandResolver → RAGEngine → TaskPlanner → ExecutionController.
Multi-layer RAG context injection with hallucination guards.
"""

import json
import logging
import time
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
        llm_override: Optional[BaseLLMProvider] = None,
        context_controls: Optional[Dict[str, Any]] = None,
        force_rag: bool = False,
        deterministic: bool = False,
    ) -> Dict[str, Any]:
        """
        Process a chat message through the orchestration pipeline.
        """
        pipeline_start = time.perf_counter()
        logger.info(f"Received: {message[:80]}...")
        
        # Use provided LLM override or fallback to default
        _llm = llm_override or self.llm
        _context_controls = context_controls or {}
        
        # Deterministic mode: force temperature=0 for reproducible output
        _temperature_override = 0.0 if deterministic else None

        # ── 1. Classify intent via LLM ───────────────────────────────
        memory_ctx = user_memory.get_context(user_id)
        
        # --- Multi-RAG specific context injection ---
        if _context_controls.get("brand_memory", True) and is_authenticated:
            try:
                from db.database import async_session
                from orchestration.brand_resolver import BrandResolver
                async with async_session() as session:
                    resolver = BrandResolver(session)
                    brands = await resolver.list_brands(user_id)
                    if brands:
                        brand_details = []
                        for b in brands:
                            info = f"Brand: {b.brand_name}"
                            if b.niche: info += f" | Niche: {b.niche}"
                            if b.target_audience: info += f" | Audience: {b.target_audience}"
                            brand_details.append(info)
                        
                        memory_ctx += "\n\nKNOWLEDGE BASE (Brand Memory):\n" + "\n".join(brand_details)
            except Exception as e:
                logger.warning(f"Failed to load brand memory for RAG: {e}")
        # --------------------------------------------
        
        # ── Multi-Layer RAG Context Injection ────────────────────────────
        rag_context_block = ""
        rag_debug_info = {}
        try:
            from brain.rag_engine import get_rag_engine
            rag_engine = get_rag_engine()
            
            # Resolve brand for RAG
            async with async_session() as rag_session:
                from orchestration.brand_resolver import BrandResolver as _BR
                _resolver = _BR(rag_session)
                _brand = await _resolver.resolve(user_id, None)
                
                if _brand and is_authenticated:
                    rag_start = time.perf_counter()
                    rag_result = await rag_engine.build_rag_context(
                        brand_id=str(_brand.id),
                        query=message,
                        force_rag=force_rag,
                        session=rag_session,
                    )
                    rag_end = time.perf_counter()
                    
                    rag_debug_info = {
                        "brand": rag_result.brand_name,
                        "namespace": rag_result.namespace,
                        "retrieved_docs": len(rag_result.retrieved_chunks),
                        "similarity_scores": rag_result.similarity_scores,
                        "is_sufficient": rag_result.is_sufficient,
                        "retrieval_time_ms": round(rag_result.retrieval_time_ms, 1),
                    }
                    
                    if rag_result.context_block:
                        rag_context_block = (
                            "\n\n=== BRAND KNOWLEDGE CONTEXT (RAG) ===\n"
                            "Use ONLY the following context to answer brand-specific questions.\n"
                            "If context is insufficient, say you don't know.\n\n"
                            f"CONTEXT:\n{rag_result.context_block}\n"
                            "=== END CONTEXT ===\n"
                        )
                        memory_ctx += rag_context_block
                    
                    # Force-RAG: block LLM if no relevant context
                    if force_rag and not rag_result.is_sufficient:
                        logger.warning("Force-RAG mode: no sufficient context, blocking LLM")
                        return {
                            "intent": "general_chat",
                            "response": (
                                "I do not have sufficient brand knowledge to answer this. "
                                "No relevant brand knowledge found."
                            ),
                            "action_success": False,
                            "action_data": {"rag_blocked": True, **rag_debug_info},
                        }
                    
                    logger.info(
                        f"RAG injected: {len(rag_result.retrieved_chunks)} chunks, "
                        f"sufficient={rag_result.is_sufficient}, "
                        f"retrieval={rag_result.retrieval_time_ms:.1f}ms"
                    )
        except Exception as e:
            logger.warning(f"RAG context injection failed (non-fatal): {e}")
        # ────────────────────────────────────────────────────────────────
        
        try:
            # Build classification kwargs
            classify_kwargs = dict(
                message=message,
                llm=_llm,
                user_context=memory_ctx,
                conversation_history=conversation_history,
            )
            
            if _temperature_override is not None:
                classify_kwargs["temperature"] = _temperature_override
            
            # TODO: REMOVE BEFORE PRODUCTION — Debug print of final prompt
            print("FINAL PROMPT SENT TO LLM:")
            print(f"User Context (with RAG):\n{memory_ctx}")
            print(f"Message: {message}")
            if rag_debug_info:
                print(f"RAG Debug: {json.dumps(rag_debug_info, indent=2)}")
            
            llm_start = time.perf_counter()
            intent_result = await classify_intent(**classify_kwargs)
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

        # ── 5. Record interaction & performance logging ────────────────
        user_memory.record_interaction(user_id, intent, message, params)
        
        pipeline_end = time.perf_counter()
        total_pipeline_ms = (pipeline_end - pipeline_start) * 1000
        
        logger.info(
            f"Pipeline complete: intent={intent}, "
            f"total={total_pipeline_ms:.0f}ms"
        )

        response_data = {
            "intent": intent,
            "response": llm_response,
            "action_success": action_result.get("success", True),
            "action_data": action_result.get("data"),
        }
        
        # Attach RAG debug info if available
        if rag_debug_info:
            response_data["rag_debug"] = rag_debug_info
        
        # Attach performance info
        response_data["performance"] = {
            "total_pipeline_ms": round(total_pipeline_ms, 1),
        }
        
        return response_data
