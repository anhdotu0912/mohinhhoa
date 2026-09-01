"""Food log model — structured manual meal entry (ADR-009)."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.datetime_vn import utc_now_naive
from app.db.session import Base


class FoodLog(Base):
    __tablename__ = "food_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), index=True)
    meal_plan_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    day_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    slot: Mapped[str] = mapped_column(String(10))
    type: Mapped[str] = mapped_column(String(20))
    note: Mapped[str] = mapped_column(String(500), default="")
    status: Mapped[str] = mapped_column(String(20), default="logged")
    alert_ids: Mapped[list] = mapped_column(JSON, default=list)
    # Naive UTC wall-clock (same as other timestamp columns). API serializes TZ-aware.
    logged_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=utc_now_naive,
        server_default=func.now(),
    )
