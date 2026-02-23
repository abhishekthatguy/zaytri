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

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None  # Omit to start new conversation
    model: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None

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
            .where(ChatMessage.conversation_id == conv_id)
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
        # Pass the requested constraints down if explicitly set from the UI
        kwargs = {}
        # In a fully fleshed out version, MasterOrchestrator would take these hints
        result = await master_orchestrator.chat(
            message=req.message,
            user_id=user_id,
            conversation_history=history,
            is_authenticated=is_authenticated,
        )
        
        # Mock token cost for now, since MasterOrchestrator might not return it natively yet
        import random
        model_used = req.model or "GPT-4o"
        token_cost = random.randint(50, 250)
        
        if is_authenticated:
           assistant_msg = ChatMessage(
               conversation_id=conv_id,
               user_id=user_id,
               role="assistant",
               content=result.get("response", ""),
               intent=result.get("intent", "general_chat"),
               model_used=model_used,
               token_cost=token_cost
           )
           db.add(assistant_msg)
           await db.commit()
           
        result["model_used"] = model_used
        result["token_cost"] = token_cost

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
    from sqlalchemy import update
    
    # Update the content of the first message to serve as the new preview/title
    subq = (
        select(ChatMessage.id)
        .where(
            ChatMessage.conversation_id == conversation_id,
            ChatMessage.user_id == str(user.id),
        )
        .order_by(ChatMessage.created_at.asc())
        .limit(1)
    )
    first_msg_id = await db.scalar(subq)

    if first_msg_id:
        await db.execute(
            update(ChatMessage)
            .where(ChatMessage.id == first_msg_id)
            .values(content=req.preview)
        )
        await db.commit()
        return {"status": "renamed"}
    return {"status": "not_found"}
