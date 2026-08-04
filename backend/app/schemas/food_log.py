"""Food log schemas."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class FoodLogCreate(BaseModel):
    profile_id: int
    text: str = Field(min_length=1)
    meal_type: str = "other"
    logged_at: datetime | None = None


class FoodLogOut(BaseModel):
    id: int
    profile_id: int
    meal_type: str
    raw_text: str
    items: list[dict[str, Any]]
    totals: dict[str, Any]
    alerts: list[dict[str, Any]] = Field(default_factory=list)
    logged_at: datetime | None = None

    model_config = {"from_attributes": True}
