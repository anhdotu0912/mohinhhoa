"""SQLAlchemy engine/session — DATABASE_URL driven (SQLite local, Postgres prod)."""

from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    pass


def _database_url() -> str:
    """Normalize DATABASE_URL for SQLAlchemy.

    - ``postgres://`` → ``postgresql://`` (các provider external hay trả scheme này;
      SQLAlchemy 2.x chỉ chấp nhận ``postgresql://``).
    - Giữ nguyên SQLite URL.
    """
    url = settings.DATABASE_URL.strip()
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    return url


_engine_kwargs: dict = {}
if settings.DATABASE_URL.startswith("sqlite"):
    # SQLite: cần check_same_thread=False cho FastAPI multi-thread
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # Postgres: pool_pre_ping để né connection bị drop bởi managed DB
    # (Railway/Supabase/Neon...), giúp khởi động lại an toàn sau idle.
    _engine_kwargs["pool_pre_ping"] = True

engine = create_engine(_database_url(), **_engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db():
    """FastAPI dependency yielding a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
