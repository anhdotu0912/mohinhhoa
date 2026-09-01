"""Chat escalation schemas — contract api-v1 §11 Chat escalations."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.meal_plan import UnmatchedPair

EscalationReason = Literal["missing_citations", "unknown", "refuse", "unmatched_kb"]
EscalationStatus = Literal["waiting_doctor", "waiting_patient", "resolved"]
EscalationMsgKind = Literal["note", "reply", "context"]


class EscalationCreate(BaseModel):
    session_id: str
    ai_message_id: str
    note: str = Field(default="", max_length=200)
    question_text: str = ""
    answer_text: str = ""
    intent: str | None = None
    citations: list[str] = Field(default_factory=list)
    correction_reason: str | None = None
    unmatched_pairs: list[UnmatchedPair] = Field(default_factory=list)
    guardrail_triggered: bool = False


class EscalationMessageIn(BaseModel):
    body: str = Field(..., min_length=1, max_length=2000)


class EscalationMessageOut(BaseModel):
    id: str
    sender: Literal["patient", "doctor"]
    body: str
    created_at: datetime
    kind: EscalationMsgKind = "reply"

    model_config = ConfigDict(from_attributes=True)


class EscalationOut(BaseModel):
    id: str
    patient_id: str
    doctor_id: str
    patient_name: str | None = None
    patient_avatar: str | None = None
    patient_disease: list[str] = Field(default_factory=list)
    session_id: str | None = None
    ai_message_id: str | None = None
    question_text: str = ""
    answer_text: str = ""
    reason: EscalationReason
    patient_note: str = ""
    status: EscalationStatus
    messages: list[EscalationMessageOut] = Field(default_factory=list)
    notification_id: str | None = None
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class EscalationListItem(BaseModel):
    id: str
    patient_id: str
    doctor_id: str
    patient_name: str | None = None
    patient_avatar: str | None = None
    patient_disease: list[str] = Field(default_factory=list)
    question_text: str = ""
    reason: EscalationReason
    status: EscalationStatus
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
