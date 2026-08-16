"""Shared test fixtures — isolated temp SQLite DB + seeded demo accounts."""

from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Hermetic tests: no LLM calls, demo mode on, local SQLite (ignore host .env Postgres).
os.environ["PYTEST_RUNNING"] = "1"
os.environ["OPENAI_API_KEY"] = ""
os.environ["DEEPSEEK_API_KEY"] = ""
os.environ["LLM_API_KEY"] = ""
os.environ["DEMO_MOCK"] = "true"
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["EMBEDDING_PROVIDER"] = "local"
os.environ["GEMINI_API_KEY"] = ""

import pytest  # noqa: E402
import app.models  # noqa: E402,F401 — register nutrition catalog tables
from app.db.init_db import seed_catalog, seed_demo_accounts  # noqa: E402
from app.db.session import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

TEST_ENGINE = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(bind=TEST_ENGINE, autocommit=False, autoflush=False)

Base.metadata.create_all(bind=TEST_ENGINE)


@pytest.fixture()
def db_session():
    with TestingSessionLocal() as db:
        yield db


@pytest.fixture()
def client():
    # Isolate each test: wipe rows then reseed demo accounts.
    with TestingSessionLocal() as db:
        for table in reversed(Base.metadata.sorted_tables):
            db.execute(table.delete())
        db.commit()
        seed_demo_accounts(db)
        seed_catalog(db)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()
