"""Shared Qdrant client — local file mode allows only one open handle per folder."""

from __future__ import annotations

import logging
import os
from pathlib import Path

from app.core.config import settings

logger = logging.getLogger(__name__)

_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
_client = None
_client_failed = False


def get_qdrant_client():
    """Return a process-wide Qdrant client (singleton). None if unavailable."""
    global _client, _client_failed
    if _client is not None:
        return _client
    if _client_failed:
        return None

    try:
        import qdrant_client
    except ImportError as exc:
        logger.warning("qdrant-client is not installed (%s). pip install -r requirements.txt", exc)
        _client_failed = True
        return None

    try:
        if settings.QDRANT_URL:
            logger.info("Connecting to Qdrant remote server at %s", settings.QDRANT_URL)
            _client = qdrant_client.QdrantClient(
                url=settings.QDRANT_URL,
                api_key=settings.QDRANT_API_KEY or None,
            )
        else:
            persist_dir = os.path.join(_BACKEND_DIR, settings.QDRANT_PERSIST_DIR)
            logger.info("Using local persistent Qdrant at %s", persist_dir)
            _client = qdrant_client.QdrantClient(path=persist_dir)
        return _client
    except Exception as exc:
        logger.warning("Qdrant client unavailable (%s)", exc)
        _client_failed = True
        return None


def close_qdrant_client() -> None:
    """Release the local file lock (needed for uvicorn --reload)."""
    global _client, _client_failed
    if _client is None:
        _client_failed = False
        return
    try:
        close = getattr(_client, "close", None)
        if callable(close):
            close()
    except Exception as exc:
        logger.debug("Qdrant client close ignored: %s", exc)
    _client = None
    _client_failed = False
