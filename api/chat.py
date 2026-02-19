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
from agents.master_agent import MasterAgent

router = APIRouter(prefix="/chat", tags=["Chat"])

master_agent = MasterAgent()

GUEST_USER_ID = "guest"


# ─── Schemas ────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None  # Omit to start new conversation


class ChatResponse(BaseModel):
    conversation_id: str
    response: str
    intent: str
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
            .where(ChatMessage.conversation_id == conv_id)
            .order_by(ChatMessage.created_at.asc())
        )
        messages = result.scalars().all()
        history = [{"role": m.role, "content": m.content} for m in messages]

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

    # Process through Master Agent
    try:
        result = await master_agent.chat(
            message=req.message,
            user_id=user_id,
            conversation_history=history,
            is_authenticated=is_authenticated,
        )
    except Exception as e:
        import logging
        logging.getLogger("zaytri.chat").error(f"Master Agent error: {e}", exc_info=True)
        result = {
            "intent": "general_chat",
            "response": (
                "⚠️ I took too long processing your request. "
                "This usually happens when the local AI model is under heavy load.\n\n"
                "Please try again — shorter messages often get faster responses! 🔄"
            ),
            "action_success": False,
            "action_data": None,
        }

    # Save assistant response (only for authenticated users)
    if is_authenticated:
        assistant_msg = ChatMessage(
            conversation_id=conv_id,
            user_id=user_id,
            role="assistant",
            content=result["response"],
            intent=result.get("intent"),
        )
        db.add(assistant_msg)
        await db.commit()

    return ChatResponse(
        conversation_id=conv_id,
        response=result["response"],
        intent=result.get("intent", "general_chat"),
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
    from sqlalchemy import func, distinct

    # Get distinct conversation IDs with their latest message
    subq = (
        select(
            ChatMessage.conversation_id,
            func.max(ChatMessage.created_at).label("last_at"),
            func.min(ChatMessage.content).label("first_message"),
        )
        .where(
            ChatMessage.user_id == str(user.id),
            ChatMessage.role == "user",
        )
        .group_by(ChatMessage.conversation_id)
        .order_by(func.max(ChatMessage.created_at).desc())
        .limit(20)
    )

    result = await db.execute(subq)
    rows = result.all()

    return [
        {
            "conversation_id": r.conversation_id,
            "preview": (r.first_message or "")[:80],
            "last_at": r.last_at.isoformat() if r.last_at else None,
        }
        for r in rows
    ]
