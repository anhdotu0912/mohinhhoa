"""Fail-fast security checks at application startup."""

from __future__ import annotations

import logging

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_DEFAULT_JWT_SECRET = "change-me-dev-only"


def _has_llm_api_key(settings) -> bool:
    if settings.LLM_API_KEY.strip():
        return True
    provider = (settings.LLM_PROVIDER or "openai").lower()
    if provider == "deepseek":
        return bool(settings.DEEPSEEK_API_KEY.strip())
    return bool(settings.OPENAI_API_KEY.strip())


def _has_embedding_api_key(settings) -> bool:
    if (settings.EMBEDDING_PROVIDER or "gemini").lower() != "gemini":
        return True
    return bool(settings.GEMINI_API_KEY.strip())


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
    if not _has_llm_api_key(settings):
        logger.warning(
            "No LLM API key configured for provider=%s — agents may fail or fall back unexpectedly.",
            settings.LLM_PROVIDER,
        )
    if settings.RAG_RETRIEVAL_MODE != "keyword" and not _has_embedding_api_key(settings):
        logger.warning(
            "GEMINI_API_KEY is empty while EMBEDDING_PROVIDER=gemini — "
            "RAG will fall back to local MiniLM; re-index after deploy if embeddings change."
        )
