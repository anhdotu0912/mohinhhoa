"""Chat history schemas — contract api-v1 §11 Chat Sessions."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.body_metrics import MetricsDeltaAdviceOut
from app.schemas.meal_plan import DoctorNoteOut, MealPlanOutput, MealPreviewOut, WeeklyComplianceOut


class ChatMessageOut(BaseModel):
    id: str
    sender: Literal["user", "ai"]
    text: str = ""
    intent: str | None = None
    secondary_intents: list[str] = Field(default_factory=list)
    citations: list[str] = Field(default_factory=list)
    guardrail_triggered: bool = False
    meal_plan_id: str | None = None
    meal_preview: MealPreviewOut | None = None
    weekly_compliance: WeeklyComplianceOut | None = None
    doctor_note: DoctorNoteOut | None = None
    metrics_delta_advice: MetricsDeltaAdviceOut | None = None
    meal_plan_week: MealPlanOutput | None = None
    show_weekly_plan: bool = False
    thinking_steps: list[dict[str, Any]] = Field(default_factory=list)
    corrected: bool = False
    correction_reason: str | None = None


class ChatMessageIn(BaseModel):
    id: str
    sender: Literal["user", "ai"]
    text: str = ""
    intent: str | None = None
    secondary_intents: list[str] = Field(default_factory=list)
    citations: list[str] = Field(default_factory=list)
    guardrail_triggered: bool = False
    meal_plan_id: str | None = None
    meal_preview: MealPreviewOut | None = None
    weekly_compliance: WeeklyComplianceOut | None = None
    doctor_note: DoctorNoteOut | None = None
    metrics_delta_advice: MetricsDeltaAdviceOut | None = None
    meal_plan_week: MealPlanOutput | None = None
    show_weekly_plan: bool = False
    thinking_steps: list[dict[str, Any]] = Field(default_factory=list)
    corrected: bool = False
    correction_reason: str | None = None


class ChatSessionSummaryOut(BaseModel):
    id: str
    title: str
    pinned: bool = False
    message_count: int = 0
    created_at: datetime
    updated_at: datetime


class ChatSessionOut(BaseModel):
    id: str
    title: str
    pinned: bool = False
    applied_plans: dict[str, bool] = Field(default_factory=dict)
    messages: list[ChatMessageOut] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class ChatSessionCreate(BaseModel):
    title: str = "Cuộc trò chuyện mới"


class ChatSessionPatch(BaseModel):
    title: str | None = None
    pinned: bool | None = None
    applied_plans: dict[str, bool] | None = None

    @model_validator(mode="after")
    def at_least_one_field(self) -> ChatSessionPatch:
        if self.title is None and self.pinned is None and self.applied_plans is None:
            raise ValueError("Cần ít nhất một field để cập nhật.")
        return self


class ChatMessagesReplace(BaseModel):
    messages: list[ChatMessageIn] = Field(default_factory=list)
