"""Pending / resolved doctor-to-doctor patient transfers."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


def new_uuid() -> str:
    return str(uuid.uuid4())


class PatientTransfer(Base):
    __tablename__ = "patient_transfers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    patient_id: Mapped[str] = mapped_column(String(36), index=True)
    from_doctor_id: Mapped[str] = mapped_column(String(36), index=True)
    to_doctor_id: Mapped[str] = mapped_column(String(36), index=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
