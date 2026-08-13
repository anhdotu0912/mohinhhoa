"""Catalog models — danh mục có sẵn cho doctor (thuốc, dị ứng, chẩn đoán)."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


def new_uuid() -> str:
    return str(uuid.uuid4())


class Medicine(Base):
    """Một record = một loại thuốc."""

    __tablename__ = "medicines"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Allergy(Base):
    """Một record = một loại dị ứng."""

    __tablename__ = "allergies"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Diagnosis(Base):
    """Danh mục chẩn đoán/bệnh lý."""

    __tablename__ = "diagnoses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
