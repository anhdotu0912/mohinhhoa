"""Shared chat LLM factory — OpenAI or DeepSeek via env."""

from __future__ import annotations

from typing import Any

from app.core.config import settings

_DEEPSEEK_BASE_URL = "https://api.deepseek.com"
_DEFAULT_MODELS = {
    "openai": "gpt-4o-mini",
    "deepseek": "deepseek-chat",
}


def llm_provider() -> str:
    return (settings.LLM_PROVIDER or "openai").strip().lower()


def llm_api_key() -> str:
    if settings.LLM_API_KEY.strip():
        return settings.LLM_API_KEY.strip()
    provider = llm_provider()
    if provider == "deepseek":
        return settings.DEEPSEEK_API_KEY.strip()
    return settings.OPENAI_API_KEY.strip()


def llm_base_url() -> str | None:
    if settings.LLM_BASE_URL.strip():
        return settings.LLM_BASE_URL.strip().rstrip("/")
    if llm_provider() == "deepseek":
        return _DEEPSEEK_BASE_URL
    return None


def llm_model() -> str:
    model = settings.LLM_MODEL.strip()
    provider = llm_provider()
    if provider == "deepseek" and (not model or model.startswith("gpt-")):
        return _DEFAULT_MODELS["deepseek"]
    return model or _DEFAULT_MODELS.get(provider, "gpt-4o-mini")


def llm_configured() -> bool:
    return bool(llm_api_key())


def flush_langfuse() -> None:
    """Flush pending traces to Langfuse Cloud."""
    import os

    if os.getenv("LANGFUSE_PUBLIC_KEY") and os.getenv("LANGFUSE_SECRET_KEY"):
        try:
            from langfuse import Langfuse

            Langfuse().flush()
        except Exception:
            pass


def get_chat_llm(*, temperature: float = 0.3, **kwargs: Any):
    """Return ChatOpenAI with automatic Langfuse tracing if configured, or None if no key."""
    api_key = llm_api_key()
    if not api_key:
        return None

    import os
    from langchain_openai import ChatOpenAI

    callbacks = list(kwargs.pop("callbacks", []) or [])
    if os.getenv("LANGFUSE_PUBLIC_KEY") and os.getenv("LANGFUSE_SECRET_KEY"):
        try:
            from langfuse.langchain import CallbackHandler

            if not any(isinstance(cb, CallbackHandler) for cb in callbacks):
                callbacks.append(CallbackHandler())
        except Exception:
            pass

    params: dict[str, Any] = {
        "model": llm_model(),
        "temperature": temperature,
        "api_key": api_key,
    }
    if callbacks:
        params["callbacks"] = callbacks

    base_url = llm_base_url()
    if base_url:
        params["base_url"] = base_url
    params.update(kwargs)
    return ChatOpenAI(**params)

