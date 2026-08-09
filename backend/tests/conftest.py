"""Shared test fixtures — isolated temp SQLite DB + seeded demo accounts."""

from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Hermetic tests: no LLM calls, demo mode on.
os.environ["OPENAI_API_KEY"] = ""
os.environ["DEMO_MOCK"] = "true"

import pytest  # noqa: E402
from app.db.init_db import seed_demo_accounts  # noqa: E402
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
    with TestingSessionLocal() as db:
        seed_demo_accounts(db)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()
