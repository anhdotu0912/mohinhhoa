"""Chat escalation — patient HITL handoff when AI cannot answer safely."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.datetime_vn import utc_now_naive
from app.db.session import Base


class ChatEscalation(Base):
    __tablename__ = "chat_escalations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id: Mapped[str] = mapped_column(String(36), index=True)
    doctor_id: Mapped[str] = mapped_column(String(36), index=True)
    session_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    ai_message_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    question_text: Mapped[str] = mapped_column(Text, default="")
    answer_text: Mapped[str] = mapped_column(Text, default="")
    reason: Mapped[str] = mapped_column(String(32))
    patient_note: Mapped[str] = mapped_column(String(200), default="")
    status: Mapped[str] = mapped_column(String(24), default="waiting_doctor", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now_naive, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now_naive, server_default=func.now(), onupdate=utc_now_naive
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    messages: Mapped[list[ChatEscalationMessage]] = relationship(
        "ChatEscalationMessage",
        back_populates="escalation",
        cascade="all, delete-orphan",
        order_by="ChatEscalationMessage.created_at",
    )


class ChatEscalationMessage(Base):
    __tablename__ = "chat_escalation_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    escalation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("chat_escalations.id", ondelete="CASCADE"), index=True
    )
    sender: Mapped[str] = mapped_column(String(12))
    body: Mapped[str] = mapped_column(Text, default="")
    kind: Mapped[str] = mapped_column(String(16), default="reply")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now_naive, server_default=func.now())

    escalation: Mapped[ChatEscalation] = relationship("ChatEscalation", back_populates="messages")
