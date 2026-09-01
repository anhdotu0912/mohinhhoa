"""SQLAlchemy engine/session — PostgreSQL only (see ADR-005 update 2026-08-19).

Note: pytest fixtures (`tests/conftest.py`) use an in-memory SQLite engine for
hermetic/fast test isolation. That is a test-harness detail only — it is not a
supported deployment target; `docker-compose.yml`/`.env.example` always point
DATABASE_URL at Postgres. The `check_same_thread` shim below exists solely so
those pytest fixtures keep working across FastAPI's threadpool.
"""

from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    pass


def _database_url() -> str:
    """Normalize DATABASE_URL for SQLAlchemy.

    ``postgres://`` → ``postgresql://`` — some managed Postgres providers hand out
    the former scheme, but SQLAlchemy 2.x only accepts ``postgresql://``.
    """
    url = settings.DATABASE_URL.strip()
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    return url


_engine_kwargs: dict = {}
if settings.DATABASE_URL.startswith("sqlite"):
    # Test-harness only (see module docstring) — never used in deployment.
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
