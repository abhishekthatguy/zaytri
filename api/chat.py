"""
Zaytri — Chat API Routes
Natural language interface to the Master Agent.
Supports both authenticated and guest users.
Guest users can chat freely but actions (workflows, settings, etc.)
will prompt them to log in first.
"""

import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user, get_optional_user
from auth.models import User
from db.database import get_db
from db.settings_models import ChatMessage
from brain.llm_router import llm_router
from orchestration.master_orchestrator import MasterOrchestrator

router = APIRouter(prefix="/chat", tags=["Chat"])

# Inject the default LLM provider info the V3 Orchestrator
master_orchestrator = MasterOrchestrator(llm=llm_router.get_default_provider())

GUEST_USER_ID = "guest"


# ─── Schemas ────────────────────────────────────────────────────────────────

class ContextControls(BaseModel):
    brand_memory: bool = True
    calendar_context: bool = True
    past_posts: bool = True
    engagement_data: bool = False

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None  # Omit to start new conversation
    model: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    exec_mode: Optional[str] = None
    context_controls: Optional[ContextControls] = None

class ChatResponse(BaseModel):
    conversation_id: str
    response: str
    intent: str
    model_used: Optional[str] = None
    token_cost: Optional[int] = None
    action_success: bool
    action_data: Optional[dict] = None


# ─── Endpoints ──────────────────────────────────────────────────────────────

@router.post("", response_model=ChatResponse)
async def send_chat_message(
    req: ChatRequest,
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
):
    """
    Send a message to the Master Agent and get a response.
    Works for both authenticated and guest users.
    Guest users can chat freely, but action intents (workflows,
    settings changes, etc.) will prompt them to log in.
    """
    is_authenticated = user is not None
    user_id = str(user.id) if user else GUEST_USER_ID
    conv_id = req.conversation_id or str(uuid.uuid4())

    # Load conversation history (only for authenticated users)
    history = []
    if req.conversation_id and is_authenticated:
        result = await db.execute(
            select(ChatMessage)
            .where(
                ChatMessage.conversation_id == conv_id,
                ChatMessage.user_id == user_id,
            )
            .order_by(ChatMessage.created_at.asc())
        )
        messages = result.scalars().all()
        history = [{"role": m.role, "content": m.content, "model_used": m.model_used, "token_cost": m.token_cost} for m in messages]

    # Save user message (only for authenticated users)
    if is_authenticated:
        user_msg = ChatMessage(
            conversation_id=conv_id,
            user_id=user_id,
            role="user",
            content=req.message,
        )
        db.add(user_msg)
        await db.flush()

    # Process through V3 Master Orchestrator
    try:
        # Check if the user specifically requested a model
        llm_instance = master_orchestrator.llm
        if req.model:
            llm_instance = llm_router.get_provider_for_model_override(req.model)
            if hasattr(req, "temperature") and req.temperature is not None:
                # Store overrides dynamically on the instance (safe because it's transient)
                setattr(llm_instance, "_temp_override", req.temperature)

        # Check execution modes
        deterministic = req.exec_mode == "deterministic"
        force_rag = req.exec_mode == "force-rag"

        # In a fully fleshed out version, MasterOrchestrator would take these hints
        context_controls_dict = req.context_controls.model_dump() if req.context_controls else {}
        
        result = await master_orchestrator.chat(
            message=req.message,
            user_id=user_id,
            conversation_history=history,
            is_authenticated=is_authenticated,
            llm_override=llm_instance,
            context_controls=context_controls_dict,
            deterministic=deterministic,
            force_rag=force_rag
        )
        
        # Mock token cost for now, since MasterOrchestrator might not return it natively yet
        import random
        model_used = req.model or "GPT-4o"
        token_cost = random.randint(50, 250)
        
        result["model_used"] = model_used
        result["token_cost"] = token_cost

    except Exception as e:
        import logging
        logger = logging.getLogger("zaytri.chat")
        logger.error(f"Master Agent error: {e}", exc_info=True)
        result = {
            "intent": "general_chat",
            "response": (
                "⚠️ I am having trouble processing your request right now. "
                "This can happen if there is a connection issue with the AI models or if the system is under heavy load.\n\n"
                "Please check your connection and try again! 🔄"
            ),
            "action_success": False,
            "action_data": {"error": str(e)},
        }

    # Save assistant response (only for authenticated users)
    if is_authenticated:
        assistant_msg = ChatMessage(
            conversation_id=conv_id,
            user_id=user_id,
            role="assistant",
            content=result.get("response", ""),
            intent=result.get("intent", "general_chat"),
            model_used=result.get("model_used"),
            token_cost=result.get("token_cost")
        )
        db.add(assistant_msg)
        await db.commit()

    return ChatResponse(
        conversation_id=conv_id,
        response=result.get("response", ""),
        intent=result.get("intent", "general_chat"),
        model_used=result.get("model_used"),
        token_cost=result.get("token_cost"),
        action_success=result.get("action_success", True),
        action_data=result.get("action_data"),
    )


@router.get("/history/{conversation_id}")
async def get_chat_history(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get conversation history for a specific conversation."""
    result = await db.execute(
        select(ChatMessage)
        .where(
            ChatMessage.conversation_id == conversation_id,
            ChatMessage.user_id == str(user.id),
        )
        .order_by(ChatMessage.created_at.asc())
    )
    messages = result.scalars().all()

    return [
        {
            "role": m.role,
            "content": m.content,
            "intent": m.intent,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in messages
    ]


@router.get("/conversations")
async def list_conversations(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List recent conversations for the current user."""
    from sqlalchemy import func, distinct, case

    # 1) Get the last activity time for each conversation
    last_activity_subq = (
        select(
            ChatMessage.conversation_id,
            func.max(ChatMessage.created_at).label("last_at")
        )
        .where(ChatMessage.user_id == str(user.id))
        .group_by(ChatMessage.conversation_id)
        .subquery()
    )

    # 2) Get the renamed title (if any)
    title_subq = (
        select(
            ChatMessage.conversation_id,
            ChatMessage.content.label("custom_title")
        )
        .where(
            ChatMessage.user_id == str(user.id),
            ChatMessage.role == "system",
            ChatMessage.intent == "chat_title"
        )
        # We only need the latest one if multiple exist
        .order_by(ChatMessage.created_at.desc())
        .subquery()
    )

    # 3) Get the FIRST user message (for preview fallback)
    # Using window function to get row_number per conversation ordered by created_at
    from sqlalchemy.orm import aliased
    user_msgs = (
        select(
            ChatMessage.conversation_id,
            ChatMessage.content,
            func.row_number().over(
                partition_by=ChatMessage.conversation_id,
                order_by=ChatMessage.created_at.asc()
            ).label("rn")
        )
        .where(
            ChatMessage.user_id == str(user.id),
            ChatMessage.role == "user"
        )
        .subquery()
    )
    first_msg_subq = select(user_msgs).where(user_msgs.c.rn == 1).subquery()

    # Join them all together
    query = (
        select(
            last_activity_subq.c.conversation_id,
            last_activity_subq.c.last_at,
            title_subq.c.custom_title,
            first_msg_subq.c.content.label("first_message")
        )
        .outerjoin(title_subq, last_activity_subq.c.conversation_id == title_subq.c.conversation_id)
        .outerjoin(first_msg_subq, last_activity_subq.c.conversation_id == first_msg_subq.c.conversation_id)
        .order_by(last_activity_subq.c.last_at.desc())
        .limit(20)
    )

    result = await db.execute(query)
    rows = result.all()

    conversations = []
    for r in rows:
        # Use custom title if defined, else fallback to first message prefix
        preview_text = r.custom_title if r.custom_title else (r.first_message or "")[:80]
        conversations.append({
            "conversation_id": r.conversation_id,
            "preview": preview_text,
            "last_at": r.last_at.isoformat() if r.last_at else None,
        })
    return conversations


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a conversation."""
    from sqlalchemy import delete
    await db.execute(
        delete(ChatMessage)
        .where(
            ChatMessage.conversation_id == conversation_id,
            ChatMessage.user_id == str(user.id),
        )
    )
    await db.commit()
    return {"status": "deleted"}


class RenameRequest(BaseModel):
    preview: str

@router.patch("/conversations/{conversation_id}")
async def rename_conversation(
    conversation_id: str,
    req: RenameRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Rename a conversation. Since we don't have a conversation table, we can just update the first message content which serves as the preview."""
    from sqlalchemy import update, literal_column
    
    # Check if a custom title message already exists
    subq = (
        select(ChatMessage)
        .where(
            ChatMessage.conversation_id == conversation_id,
            ChatMessage.user_id == str(user.id),
            ChatMessage.role == "system",
            ChatMessage.intent == "chat_title"
        )
        .order_by(ChatMessage.created_at.desc())
        .limit(1)
    )
    title_msg = await db.scalar(subq)

    # 1. Ensure the conversation actually exists (must have at least one message)
    conv_exists = await db.scalar(
        select(ChatMessage.id)
        .where(
            ChatMessage.conversation_id == conversation_id,
            ChatMessage.user_id == str(user.id)
        )
        .limit(1)
    )

    if not conv_exists:
        return {"status": "not_found"}

    if title_msg:
        # Update existing title
        title_msg.content = req.preview
    else:
        # Create new title message
        new_title = ChatMessage(
            conversation_id=conversation_id,
            user_id=str(user.id),
            role="system",
            intent="chat_title",
            content=req.preview
        )
        db.add(new_title)

    await db.commit()
    return {"status": "renamed"}
