"""Gemini API key pool + sticky rotation for embedding calls.

Keys come from one env var `GEMINI_API_KEY`, comma-separated.
A key stays current until it fails with a rotatable HTTP status
(401/403/429/503). 401/403 keys are marked dead for the process lifetime;
429/503 are retried later after wrapping around the pool.
"""

from __future__ import annotations

import logging
import re
import threading

logger = logging.getLogger(__name__)

_SPLIT_KEYS = re.compile(r"\s*,\s*")

ROTATE_STATUS_CODES = frozenset({401, 403, 429, 503})
PERMANENT_FAIL_STATUS_CODES = frozenset({401, 403})


def parse_gemini_api_keys(*raw: str | None) -> list[str]:
    """Split comma-separated keys and de-duplicate, preserving first-seen order."""
    keys: list[str] = []
    seen: set[str] = set()
    for blob in raw:
        if not blob:
            continue
        for part in _SPLIT_KEYS.split(str(blob).strip()):
            key = part.strip().strip('"').strip("'")
            if key and key not in seen:
                seen.add(key)
                keys.append(key)
    return keys


class GeminiKeyRotator:
    """Sticky pool: keep a working key, rotate on quota/auth/unavailable."""

    def __init__(self, keys: list[str]) -> None:
        cleaned = parse_gemini_api_keys(*keys)
        if not cleaned:
            raise ValueError("GeminiKeyRotator requires at least one API key")
        self._keys = cleaned
        self._index = 0
        self._dead: set[int] = set()
        self._lock = threading.Lock()

    @property
    def size(self) -> int:
        return len(self._keys)

    @property
    def alive_count(self) -> int:
        with self._lock:
            return len(self._keys) - len(self._dead)

    def candidates(self) -> list[tuple[int, str]]:
        """Keys to try this request, starting at the sticky index, skipping dead."""
        with self._lock:
            start = self._index
            n = len(self._keys)
            out: list[tuple[int, str]] = []
            for offset in range(n):
                idx = (start + offset) % n
                if idx not in self._dead:
                    out.append((idx, self._keys[idx]))
            return out

    def mark_success(self, index: int) -> None:
        with self._lock:
            self._index = index

    def mark_failure(self, index: int, status_code: int | None) -> None:
        with self._lock:
            if status_code in PERMANENT_FAIL_STATUS_CODES:
                self._dead.add(index)
                logger.warning(
                    "Gemini API key #%s/%s marked dead (HTTP %s)",
                    index + 1,
                    len(self._keys),
                    status_code,
                )
            if self._index == index:
                self._advance_unlocked()

    def _advance_unlocked(self) -> None:
        n = len(self._keys)
        for offset in range(1, n + 1):
            nxt = (self._index + offset) % n
            if nxt not in self._dead:
                self._index = nxt
                return
