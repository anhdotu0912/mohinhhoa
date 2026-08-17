"""Body metrics history — time-series patient tracking (ADR-013)."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class BodyMetricsEntry(Base):
    __tablename__ = "body_metrics_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), index=True)
    weight: Mapped[float | None] = mapped_column(Float, nullable=True)
    height: Mapped[float | None] = mapped_column(Float, nullable=True)
    bmi: Mapped[float | None] = mapped_column(Float, nullable=True)
    blood_pressure: Mapped[str | None] = mapped_column(String(32), nullable=True)
    blood_glucose: Mapped[str | None] = mapped_column(String(32), nullable=True)
    note: Mapped[str] = mapped_column(String(300), default="")
    recorded_by: Mapped[str] = mapped_column(String(10), default="patient")
    recorded_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
