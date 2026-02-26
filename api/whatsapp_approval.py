"""
Zaytri — WhatsApp Approval Flow API
Sends content previews to WhatsApp for approval and handles webhook responses.

Endpoints:
  POST /whatsapp/send-approval/{content_id}   → Send content for approval via WhatsApp
  GET  /whatsapp/webhook                      → Meta webhook verification (challenge)
  POST /whatsapp/webhook                      → Incoming message/button webhook
  GET  /whatsapp/approvals                    → List approval history
  GET  /whatsapp/status                       → Check WhatsApp config status
  POST /whatsapp/approve/{token}              → Manual approve via HTTP (fallback)
  POST /whatsapp/reject/{token}               → Manual reject via HTTP (fallback)
"""

import logging
import secrets
from datetime import datetime, timedelta
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from auth.models import User
from config import settings
from db.database import get_db
from db.models import Content, ContentStatus
from db.whatsapp_approval import WhatsAppApproval, ApprovalStatus

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/whatsapp", tags=["WhatsApp Approval"])

WA_API_BASE = "https://graph.facebook.com/v19.0"


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _is_whatsapp_configured() -> bool:
    """Check if WhatsApp Business API credentials are set."""
    return bool(
        settings.whatsapp_access_token
        and settings.whatsapp_phone_number_id
        and settings.whatsapp_approval_phone
    )


async def _send_whatsapp_message(to: str, text: str) -> Optional[str]:
    """
    Send a text message via WhatsApp Business Cloud API.
    Returns the message ID on success, None on failure.
    """
    url = f"{WA_API_BASE}/{settings.whatsapp_phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {settings.whatsapp_access_token}",
        "Content-Type": "application/json",
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": text},
    }

    async with httpx.AsyncClient(timeout=15) as client:
        try:
            resp = await client.post(url, json=payload, headers=headers)
            data = resp.json()
            if resp.status_code == 200 and data.get("messages"):
                msg_id = data["messages"][0].get("id")
                logger.info(f"WhatsApp message sent: {msg_id}")
                return msg_id
            logger.error(f"WhatsApp API error: {resp.status_code} — {data}")
            return None
        except Exception as e:
            logger.error(f"WhatsApp send failed: {e}")
            return None


async def _send_interactive_approval(
    to: str,
    content_preview: str,
    approve_token: str,
    reject_token: str,
) -> Optional[str]:
    """
    Send an interactive button message for approve/reject.
    Falls back to plain text if interactive messages fail.
    """
    url = f"{WA_API_BASE}/{settings.whatsapp_phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {settings.whatsapp_access_token}",
        "Content-Type": "application/json",
    }

    # Interactive buttons
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "interactive",
        "interactive": {
            "type": "button",
            "body": {"text": content_preview[:1024]},  # WA body limit: 1024 chars
            "action": {
                "buttons": [
                    {
                        "type": "reply",
                        "reply": {"id": f"approve_{approve_token}", "title": "✅ Approve"},
                    },
                    {
                        "type": "reply",
                        "reply": {"id": f"reject_{reject_token}", "title": "❌ Reject"},
                    },
                ],
            },
        },
    }

    async with httpx.AsyncClient(timeout=15) as client:
        try:
            resp = await client.post(url, json=payload, headers=headers)
            data = resp.json()
            if resp.status_code == 200 and data.get("messages"):
                return data["messages"][0].get("id")

            # Fallback to plain text with instructions
            logger.warning(f"Interactive message failed ({resp.status_code}), falling back to text")
            fallback_text = (
                f"{content_preview}\n\n"
                f"─── Reply with ───\n"
                f"• 'APPROVE' to publish\n"
                f"• 'REJECT' to decline\n"
                f"Token: {approve_token}"
            )
            return await _send_whatsapp_message(to, fallback_text)

        except Exception as e:
            logger.error(f"Interactive message send failed: {e}")
            return None


def _build_content_preview(content: Content) -> str:
    """Build a readable preview of a content item for WhatsApp."""
    text = content.improved_text or content.post_text or content.caption or "(no content)"
    preview = text[:500] + "…" if len(text) > 500 else text

    platform_name = content.platform.value if hasattr(content.platform, "value") else str(content.platform)

    return (
        f"📋 *Zaytri — Content Approval*\n\n"
        f"*Topic:* {content.topic}\n"
        f"*Platform:* {platform_name.title()}\n"
        f"*Score:* {content.review_score or 'N/A'}/10\n\n"
        f"─── Content Preview ───\n{preview}\n"
    )


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/status")
async def whatsapp_status(user: User = Depends(get_current_user)):
    """Check if WhatsApp approval is configured and ready."""
    return {
        "configured": _is_whatsapp_configured(),
        "phone_number_id": settings.whatsapp_phone_number_id or None,
        "approval_phone": settings.whatsapp_approval_phone or None,
    }


@router.post("/send-approval/{content_id}")
async def send_for_approval(
    content_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Send a content item for WhatsApp approval."""
    if not _is_whatsapp_configured():
        raise HTTPException(
            status_code=400,
            detail="WhatsApp Business API not configured. Add credentials in .env",
        )

    # Fetch content with ownership check
    from uuid import UUID as PyUUID
    result = await db.execute(
        select(Content).where(
            Content.id == PyUUID(content_id),
            Content.created_by == user.id,
        )
    )
    content = result.scalar_one_or_none()
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    # Generate approval token
    token = secrets.token_urlsafe(24)

    # Build preview and send
    preview = _build_content_preview(content)
    msg_id = await _send_interactive_approval(
        to=settings.whatsapp_approval_phone,
        content_preview=preview,
        approve_token=token,
        reject_token=token,
    )

    if not msg_id:
        raise HTTPException(status_code=502, detail="Failed to send WhatsApp message")

    # Store approval record
    approval = WhatsAppApproval(
        content_id=content.id,
        user_id=user.id,
        whatsapp_message_id=msg_id,
        phone_number=settings.whatsapp_approval_phone,
        approval_token=token,
        status=ApprovalStatus.PENDING,
        expires_at=datetime.utcnow() + timedelta(hours=24),
    )
    db.add(approval)
    await db.commit()
    await db.refresh(approval)

    return {
        "status": "sent",
        "approval_id": str(approval.id),
        "token": token,
        "message_id": msg_id,
        "expires_at": approval.expires_at.isoformat(),
    }


@router.get("/webhook")
async def webhook_verify(request: Request):
    """
    Meta webhook verification endpoint.
    Meta sends a GET with hub.mode, hub.verify_token, hub.challenge.
    """
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")

    if mode == "subscribe" and token == settings.whatsapp_verify_token:
        logger.info("WhatsApp webhook verified")
        return int(challenge) if challenge else ""

    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/webhook")
async def webhook_receive(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Incoming WhatsApp message webhook.
    Handles button replies (approve/reject) and text replies.
    """
    try:
        body = await request.json()
    except Exception:
        return {"status": "ok"}

    # Parse incoming messages from WhatsApp Cloud API payload
    entries = body.get("entry", [])
    for entry in entries:
        changes = entry.get("changes", [])
        for change in changes:
            value = change.get("value", {})
            messages = value.get("messages", [])

            for msg in messages:
                msg_type = msg.get("type")
                from_number = msg.get("from", "")

                # Interactive button reply
                if msg_type == "interactive":
                    button = msg.get("interactive", {}).get("button_reply", {})
                    button_id = button.get("id", "")

                    if button_id.startswith("approve_"):
                        token = button_id.replace("approve_", "")
                        await _process_approval(db, token, ApprovalStatus.APPROVED, from_number)
                    elif button_id.startswith("reject_"):
                        token = button_id.replace("reject_", "")
                        await _process_approval(db, token, ApprovalStatus.REJECTED, from_number)

                # Plain text reply (fallback)
                elif msg_type == "text":
                    text = msg.get("text", {}).get("body", "").strip().upper()
                    if text == "APPROVE" or text == "REJECT":
                        # Find most recent pending approval for this phone
                        result = await db.execute(
                            select(WhatsAppApproval)
                            .where(
                                WhatsAppApproval.phone_number == from_number,
                                WhatsAppApproval.status == ApprovalStatus.PENDING,
                            )
                            .order_by(desc(WhatsAppApproval.sent_at))
                            .limit(1)
                        )
                        approval = result.scalar_one_or_none()
                        if approval:
                            status = ApprovalStatus.APPROVED if text == "APPROVE" else ApprovalStatus.REJECTED
                            await _process_approval(db, approval.approval_token, status, from_number)

    return {"status": "ok"}


async def _process_approval(
    db: AsyncSession,
    token: str,
    new_status: ApprovalStatus,
    from_number: str = "",
):
    """Process an approval/rejection by token."""
    result = await db.execute(
        select(WhatsAppApproval).where(WhatsAppApproval.approval_token == token)
    )
    approval = result.scalar_one_or_none()

    if not approval:
        logger.warning(f"Approval token not found: {token}")
        return

    if approval.status != ApprovalStatus.PENDING:
        logger.info(f"Approval {token} already processed ({approval.status.value})")
        return

    # Check expiry
    if approval.expires_at and datetime.utcnow() > approval.expires_at:
        approval.status = ApprovalStatus.EXPIRED
        await db.commit()
        logger.info(f"Approval {token} expired")
        return

    # Update approval
    approval.status = new_status
    approval.responded_at = datetime.utcnow()
    approval.response_text = f"via WhatsApp from {from_number}"

    # Update content status
    content_result = await db.execute(
        select(Content).where(Content.id == approval.content_id)
    )
    content = content_result.scalar_one_or_none()
    if content:
        if new_status == ApprovalStatus.APPROVED:
            content.status = ContentStatus.APPROVED
            logger.info(f"Content {content.id} APPROVED via WhatsApp")
        elif new_status == ApprovalStatus.REJECTED:
            content.status = ContentStatus.DRAFT
            logger.info(f"Content {content.id} REJECTED via WhatsApp → back to draft")

    await db.commit()

    # Send confirmation back to WhatsApp
    emoji = "✅" if new_status == ApprovalStatus.APPROVED else "❌"
    action = "approved" if new_status == ApprovalStatus.APPROVED else "rejected"
    topic = content.topic if content else "Unknown"
    await _send_whatsapp_message(
        to=from_number or settings.whatsapp_approval_phone,
        text=f"{emoji} Content *{action}*: {topic}",
    )


@router.post("/approve/{token}")
async def http_approve(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """HTTP fallback: approve content by token (e.g. from email link)."""
    await _process_approval(db, token, ApprovalStatus.APPROVED)
    return {"status": "approved", "token": token}


@router.post("/reject/{token}")
async def http_reject(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """HTTP fallback: reject content by token."""
    await _process_approval(db, token, ApprovalStatus.REJECTED)
    return {"status": "rejected", "token": token}


@router.get("/approvals")
async def list_approvals(
    status: Optional[str] = None,
    limit: int = Query(default=20, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List approval history."""
    query = select(WhatsAppApproval).where(
        WhatsAppApproval.user_id == user.id
    ).order_by(desc(WhatsAppApproval.sent_at)).limit(limit)

    if status:
        query = query.where(WhatsAppApproval.status == ApprovalStatus(status))

    result = await db.execute(query)
    approvals = result.scalars().all()

    return [
        {
            "id": str(a.id),
            "content_id": str(a.content_id),
            "status": a.status.value,
            "phone_number": a.phone_number,
            "sent_at": a.sent_at.isoformat() if a.sent_at else None,
            "responded_at": a.responded_at.isoformat() if a.responded_at else None,
            "expires_at": a.expires_at.isoformat() if a.expires_at else None,
        }
        for a in approvals
    ]
