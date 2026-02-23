"""
Zaytri — Master Agent
Conversational AI controller that lets non-technical users manage the entire
system through natural-language chat (text or voice) in any language.

The Master Agent classifies user intent via LLM, executes the matching system
action through the ActionExecutor, and responds conversationally.

Identity:  Zaytri — Built by Abhishek Singh (Avii)
Fallback:  Primary LLM → Secondary LLM → Default offline response
Memory:    Tracks per-user interaction patterns for personalization
"""

import json
import logging
import re
from collections import Counter, defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional

from brain.llm_router import get_llm

logger = logging.getLogger(__name__)

from sqlalchemy.ext.asyncio import AsyncSession

# ═════════════════════════════════════════════════════════════════════════════
# Identity & Knowledge Base
# ═════════════════════════════════════════════════════════════════════════════

def _current_date() -> str:
    """Human-readable current date."""
    return datetime.now().strftime("%d %B %Y, %I:%M %p")


DEFAULT_INTRO_MESSAGE = (
    "I am **Zaytri**, an AI automation system built by **Abhishek Singh (Avii)**.\n\n"
    f"As of {_current_date()}, I am actively running with multi-agent orchestration "
    "capabilities and learning day by day.\n\n"
    "I can:\n"
    "• Generate and schedule social media content\n"
    "• Automate workflows across platforms\n"
    "• Analyze engagement patterns\n"
    "• Respond to comments automatically\n"
    "• Integrate with Instagram, Facebook, Twitter, YouTube\n"
    "• Coordinate multiple AI models including Ollama, ChatGPT, and Gemini\n\n"
    "Tell me what you'd like to automate or improve today. 🚀"
)

# Patterns that trigger a self-introduction
IDENTITY_PATTERNS = [
    r"\bwho\s+are\s+you\b",
    r"\bintroduce\s+yourself\b",
    r"\bwhat\s+can\s+you\s+do\b",
    r"\bwho\s+(built|created|made)\s+you\b",
    r"\btell\s+me\s+about\s+yourself\b",
    r"\bwhat\s+are\s+you\b",
    r"\bwhat\s+is\s+zaytri\b",
    r"\btum\s+kaun\s+ho\b",           # Hindi: Who are you?
    r"\btum\s+kya\s+kar\s+sakte\s+ho\b",  # Hindi: What can you do?
    r"\bapna\s+introduction\s+do\b",  # Hindi: Introduce yourself
]

# ═════════════════════════════════════════════════════════════════════════════
# User Memory & Pattern Tracking
# ═════════════════════════════════════════════════════════════════════════════


class UserMemory:
    """
    In-memory tracker for per-user interaction patterns.
    Stores intent frequency, preferred language, and interaction history
    to personalize responses over time.

    NOTE: This is a lightweight in-process cache. For persistence across
    restarts, the ChatMessage table serves as the durable store and can
    be loaded on demand.
    """

    def __init__(self):
        # user_id → { intent_counts, topics, last_language, message_count, ... }
        self._store: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
            "intent_counts": Counter(),
            "topics": [],
            "last_language": "en",
            "message_count": 0,
            "first_seen": None,
            "last_seen": None,
            "preferred_platform": None,
            "preferred_tone": None,
        })

    def record_interaction(
        self,
        user_id: str,
        intent: str,
        message: str,
        params: Optional[dict] = None,
    ):
        """Record an interaction for pattern tracking."""
        mem = self._store[user_id]
        now = datetime.utcnow()

        mem["intent_counts"][intent] += 1
        mem["message_count"] += 1
        mem["last_seen"] = now

        if mem["first_seen"] is None:
            mem["first_seen"] = now

        # Track topics from workflows
        if params and "topic" in params:
            mem["topics"].append(params["topic"])
            # Keep last 50 topics
            mem["topics"] = mem["topics"][-50:]

        # Track platform/tone preferences
        if params:
            if "platform" in params:
                mem["preferred_platform"] = params["platform"]
            if "tone" in params:
                mem["preferred_tone"] = params["tone"]

    def get_context(self, user_id: str) -> str:
        """Get a brief context string about the user for the LLM."""
        mem = self._store[user_id]
        if mem["message_count"] == 0:
            return ""

        parts = [f"User has sent {mem['message_count']} messages."]

        # Top intents
        top = mem["intent_counts"].most_common(3)
        if top:
            intent_str = ", ".join(f"{k}({v})" for k, v in top)
            parts.append(f"Frequent intents: {intent_str}.")

        # Recent topics
        if mem["topics"]:
            recent = mem["topics"][-3:]
            parts.append(f"Recent topics: {', '.join(recent)}.")

        # Preferences
        if mem["preferred_platform"]:
            parts.append(f"Preferred platform: {mem['preferred_platform']}.")
        if mem["preferred_tone"]:
            parts.append(f"Preferred tone: {mem['preferred_tone']}.")

        return " ".join(parts)

    def get_stats(self, user_id: str) -> dict:
        """Return raw stats for a user (used by status/debug)."""
        mem = self._store[user_id]
        return {
            "message_count": mem["message_count"],
            "top_intents": dict(mem["intent_counts"].most_common(5)),
            "recent_topics": mem["topics"][-5:],
            "preferred_platform": mem["preferred_platform"],
            "preferred_tone": mem["preferred_tone"],
            "first_seen": mem["first_seen"].isoformat() if mem["first_seen"] else None,
            "last_seen": mem["last_seen"].isoformat() if mem["last_seen"] else None,
        }


# Singleton
user_memory = UserMemory()


# ═════════════════════════════════════════════════════════════════════════════
# System Prompt
# ═════════════════════════════════════════════════════════════════════════════

MASTER_SYSTEM_PROMPT = f"""You are Zaytri — an AI automation assistant built by Abhishek Singh (Avii).
You are NOT a human. You are NOT OpenAI. You are Zaytri, built by Avii.

IDENTITY:
- Name: Zaytri
- Creator: Abhishek Singh (Avii), an AI enthusiast and automation architect
- Purpose: Help users automate tasks, manage workflows, generate content, analyze data, and orchestrate AI agents
- Current Date: {{{{current_date}}}}

PERSONALITY:
- Confident but helpful
- Intelligent and structured
- Clear and concise
- Slightly futuristic tone
- Professional but friendly
- Never claim to be a human or OpenAI

You control a multi-agent social media automation system and help non-technical users
manage it through natural language.

CRITICAL RULES:
1. ALWAYS respond in the SAME LANGUAGE the user writes in.
2. ALWAYS output valid JSON matching the schema below — nothing else.
3. Be friendly, concise, and helpful. Explain what you did clearly.
4. For destructive actions (delete, remove keys), include a confirmation warning.
5. If you're unsure what the user wants, set intent to "general_chat" and ask.
6. If the user asks "who are you", "who built you", "introduce yourself", or "what can you do":
   - set intent to "introduce", mention your name (Zaytri) and creator (Abhishek Singh / Avii).
   - IMPORTANT: Do NOT give the same response every time! Be creative and vary your wording.
   - Sometimes be brief, sometimes detailed. Highlight different capabilities each time.
   - You may include the current date, a fun fact, or a personalized greeting.
   - Never copy a previous response verbatim — keep it fresh and conversational.
7. NEVER expose raw system errors. Always respond with a helpful message.

AVAILABLE INTENTS (pick exactly one):

| Intent | Required Params | Description |
|---|---|---|
| introduce | | Self-introduction with identity, creator credit, capabilities |
| assign_llm_key | provider, api_key | Save API key for a provider (openai/gemini/anthropic/groq) |
| delete_llm_key | provider | Remove a provider's API key |
| test_provider | provider | Test LLM provider connectivity |
| assign_agent_model | agent_id, provider, model | Assign specific LLM to an agent |
| reset_agent_model | agent_id | Reset agent to default Ollama |
| switch_all_agents | provider, model | Switch ALL agents to one provider/model |
| run_workflow | topic, platform, tone | Create content via pipeline |
| update_cron | (any cron fields) | Change cron schedule settings |
| get_system_status | | Show system health & stats |
| list_content | (optional: status, platform, limit) | List created content |
| approve_content | content_id | Approve a piece of content |
| delete_content | content_id | Delete content |
| list_providers | | Show configured LLM providers |
| list_agents | | Show agent model configurations |
| get_settings | | Show current cron/platform settings |
| upload_calendar | source_type, url_or_name | Upload/connect a content calendar (CSV file, Google Sheet URL) |
| list_calendar | (optional: status, brand) | List calendar entries |
| process_calendar | upload_id or entry_id | Process calendar entries through the pipeline |
| help | | Show what you can do |
| general_chat | | Freeform conversation / clarification |

KNOWN AGENTS: content_creator, hashtag_generator, review_agent, engagement_bot, analytics_agent, data_parser, scheduler_bot, publisher_bot
KNOWN PROVIDERS: ollama (free/local), openai, gemini, anthropic, groq
PLATFORMS: instagram, facebook, twitter, youtube
TONES: professional, casual, educational, witty, formal

OUTPUT JSON SCHEMA (strict):
{{{{
  "intent": "<intent_name>",
  "params": {{ <key-value params for the intent, empty {{}} if none> }},
  "response": "<natural language response to the user in THEIR language>"
}}}}

IMPORTANT: For "introduce" intent, NEVER repeat the same response. Vary the structure, tone, and which capabilities you mention. Be creative!

EXAMPLES (show variety — DO NOT copy these word-for-word, create your own each time):
User: "Who are you?"
{{"intent":"introduce","params":{{}},"response":"Hey! 👋 I'm Zaytri — your AI-powered automation sidekick, crafted by Abhishek Singh (Avii). Think of me as your digital team that never sleeps. I handle content creation, social media scheduling, engagement tracking, and multi-model AI coordination. What would you like to tackle today?"}}

User: "Set my OpenAI key to sk-abc123"
{{"intent":"assign_llm_key","params":{{"provider":"openai","api_key":"sk-abc123"}},"response":"I'll save your OpenAI API key now. 🔑"}}

User: "Create a post about AI trends for Instagram"
{{"intent":"run_workflow","params":{{"topic":"AI trends","platform":"instagram","tone":"professional"}},"response":"Creating an Instagram post about AI trends! 🚀 Running the content pipeline now..."}}

User: "मुझे बताओ कि तुम क्या कर सकते हो"
{{"intent":"help","params":{{}},"response":"मैं Zaytri हूँ, Abhishek Singh (Avii) द्वारा बनाया गया AI ऑटोमेशन सिस्टम!\\n\\nमैं आपकी मदद कर सकता हूँ:\\n- सोशल मीडिया पोस्ट बनाना\\n- AI मॉडल कॉन्फ़िगर करना\\n- API keys सेट करना\\n- शेड्यूल बदलना\\n- कंटेंट देखना और मैनेज करना\\nबस मुझसे बात करें! 🤖"}}

{{{{user_memory_context}}}}
"""


# ═════════════════════════════════════════════════════════════════════════════
# Action Executor
# ═════════════════════════════════════════════════════════════════════════════


class ActionExecutor:
    """Executes classified intents by calling the appropriate system APIs."""

    def __init__(self, user_id: str, session: Optional[AsyncSession] = None):
        self.user_id = user_id
        self.session = session

    async def execute(self, intent: str, params: dict) -> dict:
        """Route intent to the correct handler."""
        handler = getattr(self, f"_handle_{intent}", None)
        if not handler:
            return {"success": False, "message": f"Unknown intent: {intent}"}
        try:
            return await handler(params)
        except Exception as e:
            logger.error(f"Action execution failed: {intent} — {e}", exc_info=True)
            return {"success": False, "message": str(e)}

    # ── Self-Introduction ──────────────────────────────────────────────

    async def _handle_introduce(self, params: dict) -> dict:
        """Return the default introduction — always succeeds."""
        return {
            "success": True,
            "message": DEFAULT_INTRO_MESSAGE,
        }

    # ── LLM Key Management ─────────────────────────────────────────────

    async def _handle_assign_llm_key(self, params: dict) -> dict:
        provider = params.get("provider", "").lower()
        api_key = params.get("api_key", "")
        if not provider or not api_key:
            return {"success": False, "message": "Provider and API key are required"}

        from db.database import async_session
        from db.settings_models import LLMProviderConfig
        from sqlalchemy import select
        from utils.crypto import encrypt_value
        from brain.llm_router import llm_router
        from datetime import datetime

        # Use shared session if available, else create new one
        if self.session:
            session = self.session
            result = await session.execute(
                select(LLMProviderConfig).where(LLMProviderConfig.provider == provider)
            )
            cfg = result.scalar_one_or_none()
            
            encrypted = encrypt_value(api_key)
            if cfg:
                cfg.api_key_encrypted = encrypted
                cfg.test_status = "untested"
                cfg.updated_at = datetime.utcnow()
            else:
                new_cfg = LLMProviderConfig(
                    provider=provider,
                    api_key_encrypted=encrypted,
                    test_status="untested",
                )
                session.add(new_cfg)
            await session.commit()
        else:
            async with async_session() as session:
                result = await session.execute(
                    select(LLMProviderConfig).where(LLMProviderConfig.provider == provider)
                )
                cfg = result.scalar_one_or_none()
                
                encrypted = encrypt_value(api_key)
                if cfg:
                    cfg.api_key_encrypted = encrypted
                    cfg.test_status = "untested"
                    cfg.updated_at = datetime.utcnow()
                else:
                    new_cfg = LLMProviderConfig(
                        provider=provider,
                        api_key_encrypted=encrypted,
                        test_status="untested",
                    )
                    session.add(new_cfg)
                await session.commit()

        # Clear router cache
        if hasattr(llm_router, "clear_cache"):
            llm_router.clear_cache()

        return {"success": True, "message": f"API Key for {provider} saved 🔑"}

    async def _handle_delete_llm_key(self, params: dict) -> dict:
        provider = params.get("provider", "").lower()
        from db.database import async_session
        from db.settings_models import LLMProviderConfig
        from sqlalchemy import select
        from brain.llm_router import llm_router

        async with async_session() as session:
            result = await session.execute(
                select(LLMProviderConfig).where(LLMProviderConfig.provider == provider)
            )
            cfg = result.scalar_one_or_none()
            if cfg:
                await session.delete(cfg)
                await session.commit()

        llm_router.invalidate_cache()
        return {"success": True, "message": f"{provider} API key removed"}

    async def _handle_test_provider(self, params: dict) -> dict:
        provider = params.get("provider", "").lower()
        from brain.llm_router import create_provider, PROVIDER_MODELS

        if provider not in PROVIDER_MODELS:
            return {"success": False, "message": f"Unknown provider: {provider}"}

        try:
            if provider == "ollama":
                from config import settings
                p = create_provider("ollama", settings.ollama_model)
            else:
                from db.database import async_session
                from db.settings_models import LLMProviderConfig
                from sqlalchemy import select
                from utils.crypto import decrypt_value

                async with async_session() as session:
                    result = await session.execute(
                        select(LLMProviderConfig).where(LLMProviderConfig.provider == provider)
                    )
                    cfg = result.scalar_one_or_none()
                    if not cfg or not cfg.api_key_encrypted:
                        return {"success": False, "message": f"No API key for {provider}"}
                    api_key = decrypt_value(cfg.api_key_encrypted)
                    p = create_provider(provider, PROVIDER_MODELS[provider][0], api_key=api_key)

            healthy = await p.health_check()
            return {"success": healthy, "message": f"{provider} {'connected' if healthy else 'unreachable'}"}
        except Exception as e:
            return {"success": False, "message": str(e)}

    # ── Agent Model Assignment ─────────────────────────────────────────

    async def _handle_assign_agent_model(self, params: dict) -> dict:
        agent_id = params.get("agent_id", "")
        provider = params.get("provider", "")
        model = params.get("model", "")

        from db.database import async_session
        from db.settings_models import AgentModelConfig
        from sqlalchemy import select
        from brain.llm_router import llm_router

        async with async_session() as session:
            result = await session.execute(
                select(AgentModelConfig).where(AgentModelConfig.agent_id == agent_id)
            )
            cfg = result.scalar_one_or_none()
            if cfg:
                cfg.provider = provider
                cfg.model = model
                cfg.is_custom = True
                cfg.updated_at = datetime.utcnow()
            else:
                cfg = AgentModelConfig(
                    agent_id=agent_id, provider=provider, model=model, is_custom=True
                )
                session.add(cfg)
            await session.commit()

        llm_router.invalidate_cache(agent_id)
        return {"success": True, "message": f"{agent_id} → {provider}/{model}"}

    async def _handle_reset_agent_model(self, params: dict) -> dict:
        agent_id = params.get("agent_id", "")
        from db.database import async_session
        from db.settings_models import AgentModelConfig
        from sqlalchemy import select
        from brain.llm_router import llm_router

        async with async_session() as session:
            result = await session.execute(
                select(AgentModelConfig).where(AgentModelConfig.agent_id == agent_id)
            )
            cfg = result.scalar_one_or_none()
            if cfg:
                cfg.is_custom = False
                cfg.provider = "ollama"
                from config import settings
                cfg.model = settings.ollama_model
                await session.commit()

        llm_router.invalidate_cache(agent_id)
        return {"success": True, "message": f"{agent_id} reset to Ollama default"}

    async def _handle_switch_all_agents(self, params: dict) -> dict:
        provider = params.get("provider", "")
        model = params.get("model", "")
        from brain.llm_router import AGENT_IDS

        results = []
        for aid in AGENT_IDS:
            r = await self._handle_assign_agent_model({
                "agent_id": aid, "provider": provider, "model": model
            })
            results.append(f"{aid}: {'✅' if r['success'] else '❌'}")

        return {"success": True, "message": f"Switched all agents to {provider}/{model}"}

    # ── Workflow / Content Pipeline ────────────────────────────────────

    async def _handle_run_workflow(self, params: dict) -> dict:
        topic = params.get("topic", "")
        platform = params.get("platform", "instagram").lower()
        tone = params.get("tone", "professional").lower()
        brand = params.get("brand")

        if not topic:
            return {"success": False, "message": "Topic is required"}

        from workflow.pipeline import ContentPipeline
        pipeline = ContentPipeline()
        result = await pipeline.run(
            topic=topic, platform=platform, tone=tone, user_id=self.user_id, brand=brand
        )
        return {
            "success": True,
            "message": f"Content created! Status: {result.get('status', 'draft')}",
            "data": {
                "content_id": result.get("content_id"),
                "status": result.get("status"),
                "caption": result.get("content", {}).get("caption", ""),
                "score": result.get("review", {}).get("overall_score"),
            },
        }

    # ── Cron Settings ──────────────────────────────────────────────────

    async def _handle_update_cron(self, params: dict) -> dict:
        from db.database import async_session
        from db.settings_models import UserSettings
        from sqlalchemy import select

        field_map = {
            "scheduler_hour": int, "scheduler_minute": int,
            "engagement_delay_hours": int,
            "analytics_day_of_week": int, "analytics_hour": int, "analytics_minute": int,
            "timezone": str,
        }

        async with async_session() as session:
            result = await session.execute(select(UserSettings).limit(1))
            settings_row = result.scalar_one_or_none()
            if not settings_row:
                settings_row = UserSettings()
                session.add(settings_row)

            updated = []
            for key, cast in field_map.items():
                if key in params:
                    setattr(settings_row, key, cast(params[key]))
                    updated.append(key)

            settings_row.updated_at = datetime.utcnow()
            await session.commit()

        return {"success": True, "message": f"Updated: {', '.join(updated)}"}

    # ── System Status ──────────────────────────────────────────────────

    async def _handle_get_system_status(self, params: dict) -> dict:
        from brain.llm_router import llm_router, AGENT_IDS, PROVIDER_MODELS

        # Check Ollama
        try:
            ollama_ok = await llm_router.get_default_provider().health_check()
        except Exception:
            ollama_ok = False

        # Count content
        content_count = 0
        try:
            from db.database import async_session
            from db.models import Content
            from sqlalchemy import select, func

            async with async_session() as session:
                result = await session.execute(select(func.count(Content.id)))
                content_count = result.scalar() or 0
        except Exception:
            pass

        return {
            "success": True,
            "message": "System status retrieved",
            "data": {
                "ollama": "connected" if ollama_ok else "disconnected",
                "agents": AGENT_IDS,
                "providers": list(PROVIDER_MODELS.keys()),
                "total_content": content_count,
            },
        }

    # ── Content Management ─────────────────────────────────────────────

    async def _handle_list_content(self, params: dict) -> dict:
        from db.database import async_session
        from db.models import Content
        from sqlalchemy import select

        limit = int(params.get("limit", 5))

        async with async_session() as session:
            query = select(Content).order_by(Content.created_at.desc()).limit(limit)

            status_filter = params.get("status")
            if status_filter:
                from db.models import ContentStatus
                try:
                    query = query.where(Content.status == ContentStatus(status_filter))
                except Exception:
                    pass

            result = await session.execute(query)
            items = result.scalars().all()

            content_list = [
                {
                    "id": str(c.id),
                    "topic": c.topic,
                    "platform": c.platform.value if c.platform else "",
                    "status": c.status.value if c.status else "",
                    "score": c.review_score,
                    "created": c.created_at.isoformat() if c.created_at else "",
                }
                for c in items
            ]

        return {"success": True, "message": f"Found {len(content_list)} content items", "data": content_list}

    async def _handle_approve_content(self, params: dict) -> dict:
        content_id = params.get("content_id", "")
        from db.database import async_session
        from db.models import Content, ContentStatus
        from sqlalchemy import select

        async with async_session() as session:
            result = await session.execute(
                select(Content).where(Content.id == content_id)
            )
            content = result.scalar_one_or_none()
            if not content:
                return {"success": False, "message": "Content not found"}
            content.status = ContentStatus.APPROVED
            await session.commit()

        return {"success": True, "message": f"Content {content_id[:8]}… approved ✅"}

    async def _handle_delete_content(self, params: dict) -> dict:
        content_id = params.get("content_id", "")
        from db.database import async_session
        from db.models import Content
        from sqlalchemy import select

        async with async_session() as session:
            result = await session.execute(
                select(Content).where(Content.id == content_id)
            )
            content = result.scalar_one_or_none()
            if not content:
                return {"success": False, "message": "Content not found"}
            await session.delete(content)
            await session.commit()

        return {"success": True, "message": f"Content {content_id[:8]}… deleted 🗑️"}

    # ── Info / Read-only ───────────────────────────────────────────────

    async def _handle_list_providers(self, params: dict) -> dict:
        from db.database import async_session
        from db.settings_models import LLMProviderConfig
        from sqlalchemy import select
        from brain.llm_router import PROVIDER_MODELS

        async with async_session() as session:
            result = await session.execute(select(LLMProviderConfig))
            configs = {c.provider: c for c in result.scalars().all()}

        providers = []
        for prov, models in PROVIDER_MODELS.items():
            cfg = configs.get(prov)
            providers.append({
                "provider": prov,
                "configured": prov == "ollama" or (cfg is not None and cfg.api_key_encrypted is not None),
                "status": cfg.test_status if cfg else ("ok" if prov == "ollama" else None),
                "models_count": len(models),
            })

        return {"success": True, "message": "Provider list", "data": providers}

    async def _handle_list_agents(self, params: dict) -> dict:
        from db.database import async_session
        from db.settings_models import AgentModelConfig
        from sqlalchemy import select
        from brain.llm_router import AGENT_IDS
        from config import settings

        async with async_session() as session:
            result = await session.execute(select(AgentModelConfig))
            configs = {c.agent_id: c for c in result.scalars().all()}

        agents = []
        for aid in AGENT_IDS:
            cfg = configs.get(aid)
            agents.append({
                "agent_id": aid,
                "provider": cfg.provider if cfg and cfg.is_custom else "ollama",
                "model": cfg.model if cfg and cfg.is_custom else settings.ollama_model,
                "is_custom": cfg.is_custom if cfg else False,
            })

        return {"success": True, "message": "Agent configurations", "data": agents}

    async def _handle_get_settings(self, params: dict) -> dict:
        from db.database import async_session
        from db.settings_models import UserSettings
        from sqlalchemy import select

        async with async_session() as session:
            result = await session.execute(select(UserSettings).limit(1))
            s = result.scalar_one_or_none()

        if not s:
            return {"success": True, "message": "No custom settings — using defaults", "data": {}}

        return {
            "success": True,
            "message": "Current settings",
            "data": {
                "scheduler": f"{s.scheduler_hour:02d}:{s.scheduler_minute:02d}",
                "engagement_delay_hours": s.engagement_delay_hours,
                "analytics": f"Day {s.analytics_day_of_week} at {s.analytics_hour:02d}:{s.analytics_minute:02d}",
                "timezone": s.timezone,
            },
        }

    async def _handle_help(self, params: dict) -> dict:
        return {
            "success": True,
            "message": "Help generated by the LLM response",
        }

    async def _handle_general_chat(self, params: dict) -> dict:
        return {
            "success": True,
            "message": "General chat — response provided by LLM",
        }

    # ── Calendar Management ─────────────────────────────────────────────────

    async def _handle_upload_calendar(self, params: dict) -> dict:
        """Handle calendar upload via Google Sheet URL."""
        url = params.get("url") or params.get("url_or_name", "")
        source_type = params.get("source_type", "google_sheet")
        name = params.get("name", "Calendar Import")

        if not url:
            return {"success": False, "message": "Please provide a Google Sheet URL or file"}

        try:
            from workflow.calendar_pipeline import CalendarPipeline
            pipeline = CalendarPipeline()

            result = await pipeline.parse_and_store(
                source_type=source_type,
                user_id=self.user_id,
                name=name,
                url=url,
            )

            return {
                "success": True,
                "message": f"Parsed {result['parsed_rows']} calendar entries",
                "data": result,
            }
        except Exception as e:
            return {"success": False, "message": f"Calendar import failed: {str(e)}"}

    async def _handle_list_calendar(self, params: dict) -> dict:
        """List calendar entries with optional filters."""
        from db.database import async_session
        from db.calendar_models import CalendarEntry, CalendarEntryStatus
        from sqlalchemy import select

        limit = int(params.get("limit", 10))

        async with async_session() as session:
            query = select(CalendarEntry).order_by(CalendarEntry.row_number).limit(limit)

            status_filter = params.get("status")
            if status_filter:
                try:
                    query = query.where(
                        CalendarEntry.status == CalendarEntryStatus(status_filter)
                    )
                except ValueError:
                    pass

            brand_filter = params.get("brand")
            if brand_filter:
                query = query.where(CalendarEntry.brand == brand_filter)

            result = await session.execute(query)
            entries = result.scalars().all()

            entry_list = [
                {
                    "id": str(e.id),
                    "brand": e.brand,
                    "topic": e.topic,
                    "platforms": e.platforms,
                    "status": e.status.value if e.status else "pending",
                    "approval": e.approval_required,
                    "date": e.date,
                }
                for e in entries
            ]

        return {
            "success": True,
            "message": f"Found {len(entry_list)} calendar entries",
            "data": entry_list,
        }

    async def _handle_process_calendar(self, params: dict) -> dict:
        """Process calendar entries through the pipeline."""
        upload_id = params.get("upload_id")
        entry_id = params.get("entry_id")

        try:
            from workflow.calendar_pipeline import CalendarPipeline
            pipeline = CalendarPipeline()

            if entry_id:
                result = await pipeline.process_entry(entry_id)
                msg = "Entry processed" if result.get("success") else f"Failed: {result.get('error')}"
            elif upload_id:
                result = await pipeline.process_upload(upload_id)
                msg = f"Processed {result.get('success', 0)}/{result.get('total_entries', 0)} entries"
            else:
                return {"success": False, "message": "Provide upload_id or entry_id"}

            return {
                "success": result.get("success", True),
                "message": msg,
                "data": result,
            }
        except Exception as e:
            return {"success": False, "message": f"Processing failed: {str(e)}"}


# ═════════════════════════════════════════════════════════════════════════════
# Master Agent — with Fallback + Memory
# ═════════════════════════════════════════════════════════════════════════════


class MasterAgent:
    """
    Conversational AI controller for the Zaytri system.

    Features:
    - Identity-aware: knows it's Zaytri built by Abhishek Singh (Avii)
    - Multi-layer fallback: Primary LLM → Secondary LLM → Offline default
    - User memory: tracks interaction patterns per user for personalization
    - Never exposes raw errors to users
    """

    # Provider priority for fallback (first = primary, rest = fallback chain)
    FALLBACK_PROVIDERS = ["ollama", "openai", "gemini", "anthropic", "groq"]

    def __init__(self):
        self.logger = logging.getLogger("zaytri.master_agent")

    # ── Quick identity check (no LLM needed) ──────────────────────────

    def _is_identity_question(self, message: str) -> bool:
        """Check if the message is asking about Zaytri's identity."""
        lower = message.lower().strip()
        return any(re.search(p, lower) for p in IDENTITY_PATTERNS)

    def _build_intro_response(self) -> Dict[str, Any]:
        """Build the default introduction response (no LLM call required)."""
        return {
            "intent": "introduce",
            "response": DEFAULT_INTRO_MESSAGE,
            "action_success": True,
            "action_data": None,
        }

    # ── LLM call with fallback chain ──────────────────────────────────

    async def _call_llm_with_fallback(self, prompt: str, system_prompt: str) -> str:
        """
        Try the configured master_agent LLM first, then fall through the
        provider chain. If everything fails, return None to signal offline mode.

        Optimizations:
        - max_tokens=768 (Master Agent JSON responses are small)
        - 30s timeout per provider to fail fast
        """
        import asyncio

        errors = []
        PER_PROVIDER_TIMEOUT = 30.0  # seconds — fail fast, try next provider

        # 1) Try primary configured LLM
        try:
            llm = get_llm("master_agent")
            result = await asyncio.wait_for(
                llm.generate(
                    prompt=prompt,
                    system_prompt=system_prompt,
                    temperature=0.3,
                    max_tokens=768,
                    json_mode=True,
                ),
                timeout=PER_PROVIDER_TIMEOUT,
            )
            return result
        except asyncio.TimeoutError:
            errors.append("primary: timeout")
            self.logger.warning("Primary LLM timed out after 30s")
        except Exception as e:
            errors.append(f"primary: {e}")
            self.logger.warning(f"Primary LLM failed: {e}")

        # 2) Try each fallback provider
        from brain.llm_router import create_provider, PROVIDER_MODELS

        for provider_name in self.FALLBACK_PROVIDERS:
            try:
                if provider_name == "ollama":
                    from config import settings as app_settings
                    p = create_provider("ollama", app_settings.ollama_model)
                else:
                    # Check if we have an API key for this provider
                    from db.database import async_session
                    from db.settings_models import LLMProviderConfig
                    from sqlalchemy import select
                    from utils.crypto import decrypt_value

                    async with async_session() as session:
                        result = await session.execute(
                            select(LLMProviderConfig).where(
                                LLMProviderConfig.provider == provider_name
                            )
                        )
                        cfg = result.scalar_one_or_none()
                        if not cfg or not cfg.api_key_encrypted:
                            continue
                        api_key = decrypt_value(cfg.api_key_encrypted)
                        p = create_provider(
                            provider_name, PROVIDER_MODELS[provider_name][0], api_key=api_key
                        )

                result = await asyncio.wait_for(
                    p.generate(
                        prompt=prompt,
                        system_prompt=system_prompt,
                        temperature=0.3,
                        max_tokens=768,
                        json_mode=True,
                    ),
                    timeout=PER_PROVIDER_TIMEOUT,
                )
                self.logger.info(f"Fallback succeeded via {provider_name}")
                return result
            except asyncio.TimeoutError:
                errors.append(f"{provider_name}: timeout")
                self.logger.warning(f"Fallback {provider_name} timed out after 30s")
                continue
            except Exception as e:
                errors.append(f"{provider_name}: {e}")
                self.logger.warning(f"Fallback {provider_name} failed: {e}")
                continue

        # 3) All providers exhausted
        self.logger.error(f"All LLM providers failed: {errors}")
        return None

    # ── Main chat method ──────────────────────────────────────────────

    # Intents that are allowed for unauthenticated (guest) users
    GUEST_ALLOWED_INTENTS = {"general_chat", "introduce", "help"}

    async def chat(
        self,
        message: str,
        user_id: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        is_authenticated: bool = True,
    ) -> Dict[str, Any]:
        """
        Process a user message through the Master Agent.

        Flow:
        1. Quick check: is this an identity question? → respond offline
        2. Build context from memory + history
        3. Call LLM with fallback chain
        4. If total LLM failure → respond with default intro
        5. Check auth gate: if guest + action intent → ask to login
        6. Execute the action via ActionExecutor
        7. Record interaction in user memory
        8. Return the natural-language response + execution result
        """
        self.logger.info(f"Master Agent received: {message[:100]}...")

        # NOTE: Identity questions (who are you, introduce yourself, etc.)
        # are no longer fast-pathed. They go through the LLM so responses
        # are natural and varied each time, while the system prompt ensures
        # core facts (Zaytri, built by Abhishek Singh/Avii) stay constant.

        # ── Step 2: Build context ────────────────────────────────────
        context = ""
        if conversation_history:
            recent = conversation_history[-6:]  # Last 3 exchanges
            for msg in recent:
                role = "User" if msg["role"] == "user" else "Assistant"
                context += f"{role}: {msg['content']}\n"

        # Get user memory context for personalization
        memory_ctx = user_memory.get_context(user_id)
        memory_section = f"\nUSER CONTEXT: {memory_ctx}" if memory_ctx else ""

        # Inject current date + user memory into system prompt
        system_prompt = MASTER_SYSTEM_PROMPT.replace(
            "{{current_date}}", _current_date()
        ).replace(
            "{{user_memory_context}}", memory_section
        )

        # Add creativity hint for identity questions
        creativity_hint = ""
        if self._is_identity_question(message):
            import random
            styles = [
                "Be brief and punchy — 2-3 sentences max.",
                "Be warm and welcoming — like greeting an old friend.",
                "Be confident and futuristic — emphasize AI capabilities.",
                "Be playful and fun — use emojis and casual tone.",
                "Be professional and structured — use bullet points for capabilities.",
                "Be mysterious and intriguing — tease what you can do without listing everything.",
                "Focus on content creation and social media features.",
                "Focus on multi-model AI orchestration and analytics.",
                "Lead with your creator's vision and your learning abilities.",
                "Start with the current date and what you've been up to.",
            ]
            style = random.choice(styles)
            creativity_hint = f"\nSTYLE INSTRUCTION: {style} Do NOT repeat any previous introduction verbatim.\n"

        full_prompt = f"""CONVERSATION HISTORY:
{context if context else '(new conversation)'}

CURRENT USER MESSAGE:
{message}
{creativity_hint}
Analyze the user's message. Determine the intent and extract parameters.
Respond ONLY with valid JSON matching the schema from your instructions."""

        # ── Step 3: Call LLM with fallback ───────────────────────────
        raw = await self._call_llm_with_fallback(full_prompt, system_prompt)

        if raw is None:
            # ── Step 4: Total failure → use intro for identity, error for rest
            self.logger.warning("All LLMs failed — returning offline response")
            user_memory.record_interaction(user_id, "general_chat", message)

            # Identity questions can still be answered offline
            if self._is_identity_question(message):
                return self._build_intro_response()

            return {
                "intent": "general_chat",
                "response": (
                    "⚠️ I'm having trouble connecting to my AI brain right now. "
                    "All language model providers are currently unreachable.\n\n"
                    "**Quick fixes:**\n"
                    "• Make sure **Ollama** is running: `ollama serve`\n"
                    "• Verify the model is installed: `ollama list`\n"
                    "• Or add a cloud API key (OpenAI/Gemini/etc.) in Settings\n\n"
                    "I'll keep trying — please send your message again in a moment! 🔄"
                ),
                "action_success": False,
                "action_data": None,
            }

        # Parse the LLM response
        parsed = self._parse_response(raw)

        intent = parsed.get("intent", "general_chat")
        params = parsed.get("params", {})
        llm_response = parsed.get("response", "Done!")

        self.logger.info(f"Classified intent: {intent}, params: {list(params.keys())}")

        # ── Step 5: Auth gate for guest users ────────────────────────
        if not is_authenticated and intent not in self.GUEST_ALLOWED_INTENTS:
            self.logger.info(f"Guest user attempted action intent '{intent}' — asking to login")
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

        # ── Step 6: Execute the action ───────────────────────────────
        executor = ActionExecutor(user_id=user_id)
        action_result = await executor.execute(intent, params)

        # For intents that provide data, enrich the response
        if action_result.get("data") and intent not in ("help", "general_chat", "introduce"):
            enriched = llm_response
            data = action_result["data"]

            if isinstance(data, list) and len(data) > 0:
                items_text = "\n".join(
                    f"  • {json.dumps(item, default=str)}" for item in data[:10]
                )
                enriched += f"\n\n{items_text}"
            elif isinstance(data, dict):
                items_text = "\n".join(
                    f"  • **{k}**: {v}" for k, v in data.items()
                )
                enriched += f"\n\n{items_text}"

            llm_response = enriched

        # ── Step 7: Record in memory ─────────────────────────────────
        user_memory.record_interaction(user_id, intent, message, params)

        return {
            "intent": intent,
            "response": llm_response,
            "action_success": action_result.get("success", True),
            "action_data": action_result.get("data"),
        }

    def _parse_response(self, raw: str) -> dict:
        """Parse LLM response JSON, with fallback extraction."""
        # Try direct parse
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            pass

        # Try extracting from code block
        match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass

        # Try finding JSON object in the text
        match = re.search(r"\{[^{}]*\"intent\"[^{}]*\}", raw, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass

        # Fallback: treat as general chat
        return {
            "intent": "general_chat",
            "params": {},
            "response": raw.strip(),
        }
