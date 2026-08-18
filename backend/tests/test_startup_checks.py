"""Startup security validation tests."""

from __future__ import annotations

import pytest

from app.core.startup_checks import validate_security_settings


def test_validate_security_settings_allows_dev_default(monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("JWT_SECRET", "change-me-dev-only")
    from app.core.config import get_settings

    get_settings.cache_clear()
    try:
        validate_security_settings()
    finally:
        get_settings.cache_clear()


def test_validate_security_settings_rejects_default_in_production(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET", "change-me-dev-only")
    from app.core.config import get_settings

    get_settings.cache_clear()
    try:
        with pytest.raises(RuntimeError, match="JWT_SECRET"):
            validate_security_settings()
    finally:
        get_settings.cache_clear()
