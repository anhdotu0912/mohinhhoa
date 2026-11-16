"""Chat history business logic — patient session CRUD."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.errors import APIError
from app.models.chat_session import ChatMessage, ChatSession
from app.schemas.chat_history import (
    ChatMessageIn,
    ChatMessageOut,
    ChatMessagesReplace,
    ChatSessionCreate,
    ChatSessionOut,
    ChatSessionPatch,
    ChatSessionSummaryOut,
)

_PAYLOAD_FIELDS = (
    "intent",
    "secondary_intents",
    "citations",
    "citation_chunks",
    "guardrail_triggered",
    "meal_plan_id",
    "meal_preview",
    "weekly_compliance",
    "doctor_note",
    "metrics_delta_advice",
    "meal_plan_week",
    "show_weekly_plan",
    "thinking_steps",
    "corrected",
    "correction_reason",
    "unmatched_pairs",
    "escalation_id",
)


def _get_session_or_404(db: Session, user_id: str, session_id: str) -> ChatSession:
    session = (
        db.query(ChatSession)
        .options(joinedload(ChatSession.messages))
        .populate_existing()
        .filter(ChatSession.id == session_id, ChatSession.user_id == user_id)
        .first()
    )
    if session is None:
        raise APIError(404, "SESSION_NOT_FOUND", "Không tìm thấy cuộc trò chuyện.")
    return session


def _message_to_out(msg: ChatMessage) -> ChatMessageOut:
    payload = msg.payload or {}
    data = {
        "id": msg.id,
        "sender": msg.sender,
        "text": msg.text or "",
    }
    for field in _PAYLOAD_FIELDS:
        if field in payload:
            data[field] = payload[field]
    return ChatMessageOut.model_validate(data)


def conversation_context(db: Session, user_id: str, session_id: str | None) -> list[dict[str, str]]:
    """Read a bounded, owned transcript; it is context, never medical evidence."""
    if session_id is None:
        return []
    owned = db.query(ChatSession.id).filter(ChatSession.id == session_id, ChatSession.user_id == user_id).first()
    if owned is None:
        raise APIError(404, "SESSION_NOT_FOUND", "Không tìm thấy cuộc trò chuyện.")
    rows = db.query(ChatMessage).filter(ChatMessage.session_id == session_id).order_by(ChatMessage.position.desc()).limit(8).all()
    return [
        {"role": "user" if row.sender == "user" else "assistant", "content": (row.text or "")[:1200]}
        for row in reversed(rows) if row.sender in ("user", "ai")
    ]


def _message_in_to_payload(msg: ChatMessageIn) -> dict:
    return msg.model_dump(
        mode="json",
        exclude={"id", "sender", "text"},
        exclude_none=True,
        exclude_defaults=True,
    )


def _session_to_out(session: ChatSession) -> ChatSessionOut:
    return ChatSessionOut(
        id=session.id,
        title=session.title,
        pinned=bool(session.pinned),
        applied_plans=session.applied_plans or {},
        messages=[_message_to_out(m) for m in session.messages],
        created_at=session.created_at,
        updated_at=session.updated_at,
    )


def list_sessions(db: Session, user_id: str) -> list[ChatSessionSummaryOut]:
    rows = (
        db.query(
            ChatSession,
            func.count(ChatMessage.id).label("message_count"),
        )
        .outerjoin(ChatMessage, ChatMessage.session_id == ChatSession.id)
        .filter(ChatSession.user_id == user_id)
        .group_by(ChatSession.id)
        .order_by(ChatSession.updated_at.desc())
        .all()
    )
    return [
        ChatSessionSummaryOut(
            id=session.id,
            title=session.title,
            pinned=bool(session.pinned),
            message_count=int(message_count or 0),
            created_at=session.created_at,
            updated_at=session.updated_at,
        )
        for session, message_count in rows
    ]


def create_session(db: Session, user_id: str, payload: ChatSessionCreate) -> ChatSessionOut:
    session = ChatSession(
        user_id=user_id,
        title=payload.title.strip() or "Cuộc trò chuyện mới",
        pinned=False,
        applied_plans={},
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return _session_to_out(session)


def get_session(db: Session, user_id: str, session_id: str) -> ChatSessionOut:
    session = _get_session_or_404(db, user_id, session_id)
    return _session_to_out(session)


def patch_session(
    db: Session, user_id: str, session_id: str, payload: ChatSessionPatch
) -> ChatSessionOut:
    session = _get_session_or_404(db, user_id, session_id)
    if payload.title is not None:
        trimmed = payload.title.strip()
        if trimmed:
            session.title = trimmed
    if payload.pinned is not None:
        session.pinned = payload.pinned
    if payload.applied_plans is not None:
        session.applied_plans = payload.applied_plans
    session.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(session)
    return _session_to_out(session)


def delete_session(db: Session, user_id: str, session_id: str) -> None:
    session = _get_session_or_404(db, user_id, session_id)
    db.delete(session)
    db.commit()


def delete_all_sessions(db: Session, user_id: str) -> None:
    db.query(ChatSession).filter(ChatSession.user_id == user_id).delete()
    db.commit()


def replace_messages(
    db: Session, user_id: str, session_id: str, payload: ChatMessagesReplace
) -> ChatSessionOut:
    session = _get_session_or_404(db, user_id, session_id)
    db.query(ChatMessage).filter(ChatMessage.session_id == session.id).delete(
        synchronize_session=False
    )
    db.expire(session, ["messages"])
    db.flush()

    for position, msg in enumerate(payload.messages):
        db.add(
            ChatMessage(
                id=msg.id,
                session_id=session.id,
                position=position,
                sender=msg.sender,
                text=msg.text or "",
                payload=_message_in_to_payload(msg),
            )
        )

    session.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(session)
    db.expire(session, ["messages"])
    session = _get_session_or_404(db, user_id, session_id)
    # Identity-map can lag after bulk delete+insert; prefer the payload we just committed.
    if len(session.messages) != len(payload.messages):
        return ChatSessionOut(
            id=session.id,
            title=session.title,
            pinned=bool(session.pinned),
            applied_plans=session.applied_plans or {},
            messages=[ChatMessageOut.model_validate(m.model_dump()) for m in payload.messages],
            created_at=session.created_at,
            updated_at=session.updated_at,
        )
    return _session_to_out(session)
