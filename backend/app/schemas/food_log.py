"""Food log schemas — contract §3, ADR-009."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_serializer, model_validator

from app.core.datetime_vn import assume_utc


class FoodLogCreate(BaseModel):
    meal_plan_id: str | None = None
    day_index: int | None = None
    slot: Literal["morning", "noon", "evening"]
    type: Literal["as_planned", "custom"]
    note: str = ""

    @model_validator(mode="after")
    def note_required_for_custom(self) -> FoodLogCreate:
        if self.type == "custom" and not self.note.strip():
            raise ValueError("note bắt buộc khi type=custom")
        return self


class FoodLogOut(BaseModel):
    id: str
    user_id: str
    meal_plan_id: str | None = None
    day_index: int | None = None
    slot: str
    type: str
    note: str = ""
    status: str = "logged"
    alert_ids: list[str] = Field(default_factory=list)
    logged_at: datetime

    model_config = {"from_attributes": True}

    @field_serializer("logged_at")
    def _logged_at_utc(self, value: datetime) -> datetime:
        return assume_utc(value)
