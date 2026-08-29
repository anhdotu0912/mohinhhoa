"""Tests for create_demo_accounts CLI."""

from __future__ import annotations

import sys

from scripts import create_demo_accounts as cli


def test_mask_database_url_hides_credentials():
    assert cli._mask_database_url("postgresql://user:secret@db.example.com:5432/p014") == (
        "db.example.com:5432/p014"
    )


def test_main_non_interactive_creates_accounts(db_session, monkeypatch):
    from app.core.config import get_settings
    from app.db.session import Base
    from app.models.user import User

    for table in reversed(Base.metadata.sorted_tables):
        db_session.execute(table.delete())
    db_session.commit()

    get_settings.cache_clear()
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "create_demo_accounts",
            "--password",
            "demo1234",
            "-y",
            "--skip-init-db",
        ],
    )
    monkeypatch.setattr(cli, "SessionLocal", lambda: db_session)
    monkeypatch.setattr(cli, "init_db", lambda: None)

    exit_code = cli.main()
    assert exit_code == 0
    assert db_session.get(User, "demo_doctor") is not None

    get_settings.cache_clear()
