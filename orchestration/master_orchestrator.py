"""
Zaytri — Master Orchestrator
Thin coordinator replacing the 1121-line monolith.
Delegates to: IntentClassifier → BrandResolver → RAGEngine → TaskPlanner → ExecutionController.
Multi-layer RAG context injection with hallucination guards.

Architecture (per system design):
  User Query → Embedding Model (OpenAI 1536D) → pgvector Search (per brand) →
  Retrieved Context → Chat Model (Switchable) → Answer
"""

import json
import logging
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

# Register all models for SQLAlchemy relationships
import auth.models  # noqa: F401
import db.models     # noqa: F401
import db.settings_models  # noqa: F401
import db.social_connections  # noqa: F401
import db.whatsapp_approval   # noqa: F401
import db.calendar_models     # noqa: F401
import db.task_models          # noqa: F401

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
    
    Flow (per architecture diagram):
    1. Resolve ALL brands for user (multi-tenant)
    2. For each brand: pgvector similarity search (1536D OpenAI embeddings)
    3. Build RAG context block from retrieved chunks
    4. classify_intent() with RAG context injected
    5. BrandResolver.resolve() → brand context
    6. TaskPlanner.plan() → TaskExecution record (or None for lightweight)
    7. ExecutionController.execute() → result
    8. Return response via switchable Chat Model
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

        # ── 1. Build user memory context ─────────────────────────────
        memory_ctx = user_memory.get_context(user_id)

        # ── 2. Multi-Brand RAG Context Injection ─────────────────────
        # Per architecture: Query → Embedding (1536D) → pgvector Search
        # → per-brand tenant isolation → Retrieved Context → Chat Model
        rag_context_block = ""
        rag_debug_info = {}
        
        if _context_controls.get("brand_memory", True) and is_authenticated:
            try:
                from db.database import async_session
                from orchestration.brand_resolver import BrandResolver
                from brain.rag_engine import get_rag_engine
                
                rag_engine = get_rag_engine()
                
                async with async_session() as rag_session:
                    resolver = BrandResolver(rag_session)
                    brands = await resolver.list_brands(user_id)
                    
                    if brands:
                        all_brand_contexts = []
                        all_rag_results = []
                        
                        for brand in brands:
                            brand_id = str(brand.id)
                            
                            try:
                                rag_result = await rag_engine.build_rag_context(
                                    brand_id=brand_id,
                                    query=message,
                                    force_rag=False,  # Don't block per-brand; check overall later
                                    session=rag_session,
                                )
                                all_rag_results.append(rag_result)
                                
                                # Build brand info line
                                brand_info = f"Brand: {brand.brand_name}"
                                if brand.target_audience:
                                    brand_info += f" | Audience: {brand.target_audience}"
                                if brand.brand_tone:
                                    brand_info += f" | Tone: {brand.brand_tone}"
                                
                                # Add RAG-retrieved context for this brand
                                if rag_result.context_block:
                                    all_brand_contexts.append(
                                        f"── {brand.brand_name} ──\n"
                                        f"{brand_info}\n"
                                        f"Retrieved Knowledge:\n{rag_result.context_block}"
                                    )
                                else:
                                    all_brand_contexts.append(
                                        f"── {brand.brand_name} ──\n"
                                        f"{brand_info}\n"
                                        f"(No matching knowledge found for this query)"
                                    )
                            except Exception as e:
                                logger.warning(f"RAG retrieval failed for brand {brand.brand_name}: {e}")
                                all_brand_contexts.append(
                                    f"── {brand.brand_name} ──\n"
                                    f"(RAG retrieval error)"
                                )
                        
                        # Aggregate RAG debug info
                        total_chunks = sum(len(r.retrieved_chunks) for r in all_rag_results)
                        any_sufficient = any(r.is_sufficient for r in all_rag_results)
                        total_retrieval_ms = sum(r.retrieval_time_ms for r in all_rag_results)
                        
                        rag_debug_info = {
                            "brands_queried": len(brands),
                            "total_retrieved_chunks": total_chunks,
                            "any_sufficient": any_sufficient,
                            "total_retrieval_time_ms": round(total_retrieval_ms, 1),
                            "per_brand": [
                                {
                                    "brand": r.brand_name,
                                    "namespace": r.namespace,
                                    "retrieved_docs": len(r.retrieved_chunks),
                                    "similarity_scores": r.similarity_scores,
                                    "is_sufficient": r.is_sufficient,
                                    "search_method": r.search_method,
                                    "retrieval_time_ms": round(r.retrieval_time_ms, 1),
                                }
                                for r in all_rag_results
                            ],
                        }
                        
                        # Build combined context block
                        if all_brand_contexts:
                            combined_context = "\n\n".join(all_brand_contexts)
                            rag_context_block = (
                                "\n\n=== BRAND KNOWLEDGE CONTEXT (RAG — pgvector Search) ===\n"
                                "Use the following brand-specific context to answer questions.\n"
                                "Each brand's knowledge is isolated for multi-tenant accuracy.\n"
                                "If the combined context is insufficient for specific details, say you don't know.\n\n"
                                f"{combined_context}\n"
                                "=== END CONTEXT ===\n"
                            )
                            memory_ctx += rag_context_block
                        
                        # Force-RAG: block LLM if no brand has sufficient context
                        if force_rag and not any_sufficient:
                            logger.warning("Force-RAG mode: no sufficient context across all brands, blocking LLM")
                            return {
                                "intent": "general_chat",
                                "response": (
                                    "I do not have sufficient brand knowledge to answer this. "
                                    "No relevant brand knowledge found across any of your brands."
                                ),
                                "action_success": False,
                                "action_data": {"rag_blocked": True, **rag_debug_info},
                            }
                        
                        logger.info(
                            f"RAG injected: {total_chunks} total chunks across {len(brands)} brands, "
                            f"sufficient={any_sufficient}, "
                            f"retrieval={total_retrieval_ms:.1f}ms"
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

        # ── 3. Auth gate ─────────────────────────────────────────────
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

        # ── 4. Execute via orchestration pipeline ────────────────────
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

        # ── 5. Enrich response with action data ─────────────────────
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

        # ── 6. Record interaction & performance logging ────────────────
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
