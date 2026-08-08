"""Dietitian review schemas — contract §5."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class ReviewRequest(BaseModel):
    action: Literal["approve", "reject", "edit"]
    notes: str = ""
    edited_plan: dict | None = None


class ReviewResponse(BaseModel):
    meal_plan_id: str
    status: str
    trust_badge: str | None = None
    reviewed_at: str
    reviewer_id: str
