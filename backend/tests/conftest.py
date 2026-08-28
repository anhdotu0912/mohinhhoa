"""Shared test fixtures — isolated in-memory SQLite DB + seeded demo accounts.

Note: production/deployment only supports PostgreSQL (see ADR-005). The tests
use an in-memory SQLite DB purely as a fast, hermetic test double — it is not
a supported runtime configuration.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Hermetic tests: no LLM calls, in-memory SQLite (ignore host .env Postgres).
os.environ["PYTEST_RUNNING"] = "1"
os.environ["OPENAI_API_KEY"] = ""
os.environ["DEEPSEEK_API_KEY"] = ""
os.environ["LLM_API_KEY"] = ""
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["EMBEDDING_PROVIDER"] = "local"
os.environ["GEMINI_API_KEY"] = ""
os.environ["SMTP_USERNAME"] = ""
os.environ["SMTP_PASSWORD"] = ""

import app.models  # noqa: E402,F401 — register nutrition catalog tables
import pytest  # noqa: E402
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


@pytest.fixture(autouse=True)
def _stub_outbound_email(monkeypatch):
    """Do not hit real SMTP in tests; treat mail as configured + delivered."""
    monkeypatch.setattr("app.services.email.is_configured", lambda: True)
    monkeypatch.setattr(
        "app.services.email.send_password_reset_link", lambda *args, **kwargs: None
    )


def pytest_configure(config):
    config.addinivalue_line(
        "markers",
        "no_auto_claim: do not auto-claim demo patients (assignment tests)",
    )


@pytest.fixture()
def db_session():
    with TestingSessionLocal() as db:
        yield db


DEMO_PATIENT_IDS = tuple(f"demo_patient_{i}" for i in range(1, 6))
DEMO_DOCTOR_EMAIL = "demo_doctor@example.com"
DEMO_PASSWORD = "demo1234"


@pytest.fixture()
def client(request):
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
    test_client = TestClient(app)
    if request.node.get_closest_marker("no_auto_claim") is None:
        login = test_client.post(
            "/api/v1/auth/login",
            json={"email": DEMO_DOCTOR_EMAIL, "password": DEMO_PASSWORD},
        )
        assert login.status_code == 200, login.text
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
        for pid in DEMO_PATIENT_IDS:
            claimed = test_client.post(
                f"/api/v1/doctor/patients/{pid}/claim",
                headers=headers,
            )
            assert claimed.status_code == 200, claimed.text
    yield test_client
    app.dependency_overrides.clear()
