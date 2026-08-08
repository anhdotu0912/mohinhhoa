"""Alert HTTP schema — contract §1.4."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AlertOut(BaseModel):
    id: str
    user_id: str
    drug: str
    food: str
    mechanism: str
    severity: str
    recommendation: str
    sources: list[str]
    meal_plan_id: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
