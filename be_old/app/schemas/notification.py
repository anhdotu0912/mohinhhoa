"""Notification schemas — contract §4."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class NotificationOut(BaseModel):
    id: str
    user_id: str
    type: str
    title: str
    body: str
    scheduled_at: datetime | None = None
    status: str
    related_ids: dict
    payload: dict
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NotificationActionRequest(BaseModel):
    adherence: Literal["yes", "partial", "no"] | None = None
