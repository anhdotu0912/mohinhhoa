"""MealPlan model — persisted 7-day meal plan JSON payload."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import JSON, Date, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class MealPlan(Base):
    __tablename__ = "meal_plans"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    variant_group_id: Mapped[str | None] = mapped_column(String(36), index=True, nullable=True)
    variant_index: Mapped[int | None] = mapped_column(nullable=True)
    total_variants: Mapped[int | None] = mapped_column(nullable=True)
    user_id: Mapped[str] = mapped_column(String(36), index=True)
    profile_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    days: Mapped[list] = mapped_column(JSON, default=list)
    swaps: Mapped[list] = mapped_column(JSON, default=list)
    citations: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(20), default="pending_review")
    trust_badge: Mapped[str | None] = mapped_column(String(50), nullable=True)
    reviewer_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    review_notes: Mapped[str | None] = mapped_column(String, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    starts_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    ends_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
