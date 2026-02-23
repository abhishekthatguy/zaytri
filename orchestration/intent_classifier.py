"""
Zaytri — Intent Classifier (Orchestration Layer)
Pure async function: takes user message + history, returns classified intent.
Extracted from master_agent.py lines 168-260 (system prompt + LLM call).
"""

import json
import re
import logging
from typing import Any, Dict, List, Optional, TypedDict

from brain.providers import BaseLLMProvider
from infra.logging import get_logger

logger = get_logger("orchestration.intent_classifier")


class IntentResult(TypedDict):
    intent: str
    params: Dict[str, Any]
    response: str


# Patterns that trigger a self-introduction (no LLM needed)
IDENTITY_PATTERNS = [
    r"\bwho\s+are\s+you\b",
    r"\bintroduce\s+yourself\b",
    r"\bwhat\s+can\s+you\s+do\b",
    r"\bwho\s+(built|created|made)\s+you\b",
    r"\btell\s+me\s+about\s+yourself\b",
    r"\bwhat\s+are\s+you\b",
    r"\bwhat\s+is\s+zaytri\b",
    r"\btum\s+kaun\s+ho\b",
    r"\btum\s+kya\s+kar\s+sakte\s+ho\b",
    r"\bapna\s+introduction\s+do\b",
]


def is_identity_question(message: str) -> bool:
    """Check if the message is asking about Zaytri's identity."""
    lower = message.lower().strip()
    return any(re.search(p, lower) for p in IDENTITY_PATTERNS)


def _build_system_prompt(current_date: str, user_memory_context: str) -> str:
    """Build the intent classification system prompt."""
    return f"""You are Zaytri — an AI automation assistant built by Abhishek Singh (Avii).
You are NOT a human. You are NOT OpenAI. You are Zaytri, built by Avii.

IDENTITY:
- Name: Zaytri
- Creator: Abhishek Singh (Avii), an AI enthusiast and automation architect
- Purpose: Help users automate tasks, manage workflows, generate content, analyze data, and orchestrate AI agents
- Current Date: {current_date}

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
| upload_calendar | source_type, url_or_name | Upload/connect a content calendar |
| list_calendar | (optional: status, brand) | List calendar entries |
| process_calendar | upload_id or entry_id | Process calendar entries |
| help | | Show what you can do |
| general_chat | | Freeform conversation / clarification |

KNOWN AGENTS: content_creator, hashtag_generator, review_agent, engagement_bot, analytics_agent, data_parser, scheduler_bot, publisher_bot
KNOWN PROVIDERS: ollama (free/local), openai, gemini, anthropic, groq, openrouter
PLATFORMS: instagram, facebook, twitter, youtube
TONES: professional, casual, educational, witty, formal

OUTPUT JSON SCHEMA (strict):
{{
  "intent": "<intent_name>",
  "params": {{ <key-value params for the intent, empty {{}} if none> }},
  "response": "<natural language response to the user in THEIR language>"
}}

IMPORTANT: For "introduce" intent, NEVER repeat the same response. Vary the structure, tone, and which capabilities you mention. Be creative!

{user_memory_context}"""


def _build_user_prompt(
    message: str,
    conversation_history: Optional[List[Dict[str, str]]] = None,
    creativity_hint: str = "",
) -> str:
    """Build the user prompt for classification."""
    context = ""
    if conversation_history:
        recent = conversation_history[-6:]
        for msg in recent:
            role = "User" if msg["role"] == "user" else "Assistant"
            context += f"{role}: {msg['content']}\n"

    return f"""CONVERSATION HISTORY:
{context if context else '(new conversation)'}

CURRENT USER MESSAGE:
{message}
{creativity_hint}
Analyze the user's message. Determine the intent and extract parameters.
Respond ONLY with valid JSON matching the schema from your instructions."""


def parse_llm_response(raw: str) -> IntentResult:
    """Parse LLM response JSON, with fallback extraction."""
    # Try direct parse
    try:
        result = json.loads(raw)
        return IntentResult(
            intent=result.get("intent", "general_chat"),
            params=result.get("params", {}),
            response=result.get("response", "Done!"),
        )
    except json.JSONDecodeError:
        pass

    # Try extracting from code block
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.DOTALL)
    if match:
        try:
            result = json.loads(match.group(1))
            return IntentResult(
                intent=result.get("intent", "general_chat"),
                params=result.get("params", {}),
                response=result.get("response", "Done!"),
            )
        except json.JSONDecodeError:
            pass

    # Try finding JSON object
    match = re.search(r'\{[^{}]*"intent"[^{}]*\}', raw, re.DOTALL)
    if match:
        try:
            result = json.loads(match.group(0))
            return IntentResult(
                intent=result.get("intent", "general_chat"),
                params=result.get("params", {}),
                response=result.get("response", "Done!"),
            )
        except json.JSONDecodeError:
            pass

    # Fallback
    return IntentResult(intent="general_chat", params={}, response=raw.strip())


async def classify_intent(
    message: str,
    llm: BaseLLMProvider,
    user_context: str = "",
    conversation_history: Optional[List[Dict[str, str]]] = None,
    timeout_seconds: float = 30.0,
) -> IntentResult:
    """
    Classify user intent via LLM.
    Pure async function — no side effects, no DB access, no global state.

    Args:
        message: User's raw message
        llm: Injected LLM provider instance
        user_context: Pre-built user memory context string
        conversation_history: Recent conversation messages
        timeout_seconds: Max time for LLM call

    Returns:
        IntentResult with intent, params, and response
    """
    import asyncio
    from datetime import datetime

    current_date = datetime.now().strftime("%d %B %Y, %I:%M %p")
    memory_section = f"\nUSER CONTEXT: {user_context}" if user_context else ""
    system_prompt = _build_system_prompt(current_date, memory_section)

    # Add creativity hint for identity questions
    creativity_hint = ""
    if is_identity_question(message):
        import random
        styles = [
            "Be brief and punchy — 2-3 sentences max.",
            "Be warm and welcoming — like greeting an old friend.",
            "Be confident and futuristic — emphasize AI capabilities.",
            "Be playful and fun — use emojis and casual tone.",
            "Be professional and structured — use bullet points.",
            "Be mysterious and intriguing — tease capabilities.",
            "Focus on content creation and social media features.",
            "Focus on multi-model AI orchestration and analytics.",
            "Lead with your creator's vision.",
            "Start with the current date and what you've been up to.",
        ]
        creativity_hint = f"\nSTYLE INSTRUCTION: {random.choice(styles)} Do NOT repeat any previous introduction verbatim.\n"

    user_prompt = _build_user_prompt(message, conversation_history, creativity_hint)

    try:
        raw = await asyncio.wait_for(
            llm.generate(
                prompt=user_prompt,
                system_prompt=system_prompt,
                temperature=0.3,
                max_tokens=768,
                json_mode=True,
            ),
            timeout=timeout_seconds,
        )
        return parse_llm_response(raw)
    except asyncio.TimeoutError:
        logger.warning(f"Intent classification timed out after {timeout_seconds}s")
        raise
    except Exception as e:
        logger.error(f"Intent classification failed: {e}")
        raise
