"""In-memory auth rate limiting for prototype."""

from __future__ import annotations

from datetime import datetime, timedelta
from threading import Lock

from app.core.errors import APIError

_WINDOW = timedelta(minutes=15)
_MAX_ATTEMPTS = 5
_lock = Lock()
_attempts: dict[tuple[str, str, str], list[datetime]] = {}


def _key(action: str, email: str, ip: str) -> tuple[str, str, str]:
    return (action, email.strip().lower(), ip or "unknown")


def check_rate_limit(action: str, email: str, ip: str) -> None:
    now = datetime.now()
    key = _key(action, email, ip)
    with _lock:
        window_start = now - _WINDOW
        attempts = [t for t in _attempts.get(key, []) if t > window_start]
        _attempts[key] = attempts
        if len(attempts) >= _MAX_ATTEMPTS:
            raise APIError(
                429,
                "TOO_MANY_ATTEMPTS",
                "Quá nhiều lần thử. Thử lại sau 15 phút.",
            )


def record_failed_attempt(action: str, email: str, ip: str) -> None:
    key = _key(action, email, ip)
    with _lock:
        _attempts.setdefault(key, []).append(datetime.now())


def clear_attempts(action: str, email: str, ip: str) -> None:
    key = _key(action, email, ip)
    with _lock:
        _attempts.pop(key, None)
