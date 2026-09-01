"""Regression tests for demo account seeding guards."""

from __future__ import annotations

import pytest

from app.core.security import verify_password
from app.db.init_db import init_db, lock_known_demo_accounts, seed_demo_accounts
from app.db.session import Base


def test_development_seed_creates_demo_accounts(db_session, monkeypatch):
    monkeypatch.setenv("DEMO_PASSWORD", "demo1234")
    from app.core.config import get_settings

    get_settings.cache_clear()
    try:
        used = seed_demo_accounts(db_session, password="demo1234")
        assert used == "demo1234"
        from app.models.user import User

        doctor = db_session.get(User, "demo_doctor")
        assert doctor is not None
        assert verify_password("demo1234", doctor.hashed_password)
    finally:
        get_settings.cache_clear()


def test_seed_assigns_demo_patients_to_primary_doctor(db_session, monkeypatch):
    monkeypatch.setenv("DEMO_PASSWORD", "demo1234")
    from app.core.config import get_settings

    get_settings.cache_clear()
    try:
        seed_demo_accounts(db_session, password="demo1234")
        from app.models.user import User

        for pid in ("demo_patient_1", "demo_patient_2", "demo_patient_3", "demo_patient_4"):
            patient = db_session.get(User, pid)
            assert patient is not None
            assert patient.assigned_doctor_id == "demo_doctor"
        patient_5 = db_session.get(User, "demo_patient_5")
        assert patient_5 is not None
        assert patient_5.assigned_doctor_id is None
    finally:
        get_settings.cache_clear()


def test_lock_known_demo_accounts_invalidates_password(db_session):
    from app.models.user import User

    seed_demo_accounts(db_session, password="demo1234")
    user = db_session.get(User, "demo_doctor")
    assert user is not None
    old_hash = user.hashed_password

    lock_known_demo_accounts(db_session)
    db_session.refresh(user)

    assert user.hashed_password != old_hash
    assert not verify_password("demo1234", user.hashed_password)


def test_reset_passwords_updates_existing_demo_users(db_session):
    from app.models.user import User

    seed_demo_accounts(db_session, password="oldpass12")
    seed_demo_accounts(db_session, password="newpass12", reset_passwords=True)
    user = db_session.get(User, "demo_doctor")
    assert user is not None
    assert verify_password("newpass12", user.hashed_password)
    assert not verify_password("oldpass12", user.hashed_password)


def test_init_db_never_auto_seeds_demo_accounts(monkeypatch):
    calls = {"seed": 0, "lock": 0}

    def _fake_seed(db, **kwargs):
        calls["seed"] += 1
        return "unused"

    def _fake_lock(db):
        calls["lock"] += 1

    monkeypatch.setattr("app.db.init_db.seed_demo_accounts", _fake_seed)
    monkeypatch.setattr("app.db.init_db.lock_known_demo_accounts", _fake_lock)
    monkeypatch.setenv("APP_ENV", "development")
    from app.core.config import get_settings

    get_settings.cache_clear()
    try:
        init_db()
        assert calls == {"seed": 0, "lock": 0}
    finally:
        get_settings.cache_clear()


@pytest.fixture(autouse=True)
def _isolated_db(db_session):
    """Wipe shared in-memory DB so db_session tests do not collide with client fixture data."""
    for table in reversed(Base.metadata.sorted_tables):
        db_session.execute(table.delete())
    db_session.commit()
    yield
