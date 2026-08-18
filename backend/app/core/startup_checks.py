"""Fail-fast security checks at application startup."""

from __future__ import annotations

from app.core.config import get_settings

_DEFAULT_JWT_SECRET = "change-me-dev-only"


def validate_security_settings() -> None:
    """Reject unsafe defaults when not running in local development."""
    settings = get_settings()
    if settings.APP_ENV == "development":
        return
    if settings.JWT_SECRET == _DEFAULT_JWT_SECRET:
        raise RuntimeError(
            "JWT_SECRET is still the default value. "
            "Set a strong unique JWT_SECRET before running with APP_ENV != development."
        )
