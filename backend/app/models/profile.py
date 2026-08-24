"""PatientProfile model — medical & dietary profile."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), unique=True, index=True)
    disease: Mapped[list] = mapped_column(JSON, default=list)
    medications: Mapped[list] = mapped_column(JSON, default=list)
    allergies: Mapped[list] = mapped_column(JSON, default=list)
    bmi: Mapped[float | None] = mapped_column(Float, nullable=True)
    weight: Mapped[float | None] = mapped_column(Float, nullable=True)
    height: Mapped[float | None] = mapped_column(Float, nullable=True)
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    gender: Mapped[str | None] = mapped_column(String(20), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    blood_pressure: Mapped[str | None] = mapped_column(String(32), nullable=True)
    blood_glucose: Mapped[str | None] = mapped_column(String(32), nullable=True)
    treatment_goals: Mapped[list] = mapped_column(JSON, default=list)
    target_kcal: Mapped[int] = mapped_column(Integer, default=1800)
    restrictions: Mapped[dict] = mapped_column(JSON, default=dict)
    preferences: Mapped[list] = mapped_column(JSON, default=list)
    constraints_status: Mapped[str] = mapped_column(String(32), default="confirmed")
    meal_plan_request_status: Mapped[str] = mapped_column(String(16), default="none")
    meal_plan_request_note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    meal_plan_requested_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
