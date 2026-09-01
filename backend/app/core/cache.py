"""In-memory thread-safe TTL cache for patient profiles and session metadata (P-014 Tier 1 Cost Optimization)."""

from __future__ import annotations

import logging
import threading
import time
from typing import Any

logger = logging.getLogger(__name__)


class ProfileCache:
    """Thread-safe In-Memory Cache with Time-To-Live (TTL) for patient profiles."""

    def __init__(self, default_ttl_seconds: int = 900, max_entries: int = 1000) -> None:
        self._cache: dict[str, tuple[dict[str, Any], float]] = {}
        self._ttl = default_ttl_seconds
        self._max_entries = max_entries
        self._lock = threading.Lock()

    def get(self, user_id: str) -> dict[str, Any] | None:
        """Retrieve profile dict if cached and not expired."""
        if not user_id:
            return None
        with self._lock:
            entry = self._cache.get(user_id)
            if entry is None:
                return None
            profile, expiry = entry
            if time.time() > expiry:
                del self._cache[user_id]
                logger.debug("Profile cache expired for user %s", user_id)
                return None
            logger.debug("Profile cache hit for user %s", user_id)
            return dict(profile)

    def set(self, user_id: str, profile: dict[str, Any], ttl: int | None = None) -> None:
        """Store profile dict with expiration timestamp."""
        if not user_id or not profile:
            return
        with self._lock:
            if len(self._cache) >= self._max_entries:
                # Evict oldest entry
                oldest_key = min(self._cache, key=lambda k: self._cache[k][1])
                del self._cache[oldest_key]
            effective_ttl = ttl if ttl is not None else self._ttl
            self._cache[user_id] = (dict(profile), time.time() + effective_ttl)
            logger.debug("Profile cached for user %s (TTL: %ds)", user_id, effective_ttl)

    def is_cached(self, user_id: str) -> bool:
        """Check whether a valid unexpired profile exists in cache."""
        if not user_id:
            return False
        with self._lock:
            entry = self._cache.get(user_id)
            if entry is None:
                return False
            _, expiry = entry
            if time.time() > expiry:
                del self._cache[user_id]
                return False
            return True

    def invalidate(self, user_id: str) -> bool:
        """Manually invalidate cache for a user when profile updates."""
        if not user_id:
            return False
        with self._lock:
            if user_id in self._cache:
                del self._cache[user_id]
                logger.info("Invalidated profile cache for user %s", user_id)
                return True
            return False

    def clear(self) -> None:
        """Clear all entries (useful for testing)."""
        with self._lock:
            self._cache.clear()


# Global singleton instance (15 min TTL)
profile_cache = ProfileCache(default_ttl_seconds=900, max_entries=1000)
