"""Embedding utilities — Gemini Embedding 2 (default) with local MiniLM fallback."""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Any, Literal

import httpx

from app.core.config import settings
from app.rag.gemini_keys import (
    ROTATE_STATUS_CODES,
    GeminiKeyRotator,
    parse_gemini_api_keys,
)

logger = logging.getLogger(__name__)

_GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"
_BATCH_SIZE = 100


def prepare_query_text(text: str) -> str:
    """Format query for asymmetric retrieval (Gemini Embedding 2)."""
    return f"task: search result | query: {text}"


def prepare_document_text(content: str, title: str | None = None) -> str:
    """Format document for asymmetric retrieval (Gemini Embedding 2)."""
    return f"title: {title or 'none'} | text: {content}"


def gemini_api_keys() -> list[str]:
    """Resolved Gemini key pool from comma-separated GEMINI_API_KEY."""
    return parse_gemini_api_keys(settings.GEMINI_API_KEY)


def gemini_api_key() -> str:
    """First configured Gemini key (empty if none)."""
    keys = gemini_api_keys()
    return keys[0] if keys else ""


def embedding_provider() -> str:
    return (settings.EMBEDDING_PROVIDER or "gemini").strip().lower()


def _local_embedding_function():
    """Callable wrapper around a local sentence-transformers model."""
    from sentence_transformers import SentenceTransformer

    logger.info("Loading local embedding model: %s", settings.EMBEDDING_MODEL)
    model = SentenceTransformer(settings.EMBEDDING_MODEL)

    def _encode(texts: list[str]) -> list[list[float]]:
        vectors = model.encode(texts, convert_to_numpy=True)
        return vectors.tolist()

    return _encode


class GeminiEmbeddingFunction:
    """Embedding function via Gemini embedContent / batchEmbedContents."""

    def __init__(
        self,
        *,
        api_key: str = "",
        api_keys: list[str] | None = None,
        model: str,
        output_dimensionality: int,
        input_kind: Literal["document", "query"] = "document",
        rotator: GeminiKeyRotator | None = None,
    ) -> None:
        keys = list(api_keys or [])
        if api_key:
            keys = [api_key, *keys]
        self._rotator = rotator or GeminiKeyRotator(keys)
        self._model = model
        self._output_dimensionality = output_dimensionality
        self._input_kind = input_kind
        self._local_fn = None

    @property
    def _local_fallback(self):
        if self._local_fn is None:
            self._local_fn = _local_embedding_function()
        return self._local_fn

    def _format_inputs(self, texts: list[str]) -> list[str]:
        if self._input_kind == "query":
            return [prepare_query_text(t) for t in texts]
        return [prepare_document_text(t) for t in texts]

    def _post_json(self, url: str, payload: dict[str, Any], timeout: float) -> dict[str, Any]:
        candidates = self._rotator.candidates()
        if not candidates:
            raise RuntimeError("All Gemini API keys are marked dead")

        last_error: Exception | None = None
        for index, key in candidates:
            try:
                with httpx.Client(timeout=timeout) as client:
                    response = client.post(
                        url,
                        headers={
                            "Content-Type": "application/json",
                            "x-goog-api-key": key,
                        },
                        json=payload,
                    )
                if response.status_code in ROTATE_STATUS_CODES:
                    logger.warning(
                        "Gemini embedding HTTP %s on key #%s/%s — rotating",
                        response.status_code,
                        index + 1,
                        self._rotator.size,
                    )
                    self._rotator.mark_failure(index, response.status_code)
                    last_error = httpx.HTTPStatusError(
                        f"Gemini embedding HTTP {response.status_code}",
                        request=response.request,
                        response=response,
                    )
                    continue
                response.raise_for_status()
                self._rotator.mark_success(index)
                return response.json()
            except httpx.HTTPStatusError as exc:
                status = exc.response.status_code if exc.response is not None else None
                if status in ROTATE_STATUS_CODES:
                    logger.warning(
                        "Gemini embedding HTTP %s on key #%s/%s — rotating",
                        status,
                        index + 1,
                        self._rotator.size,
                    )
                    self._rotator.mark_failure(index, status)
                    last_error = exc
                    continue
                raise
            except (httpx.TimeoutException, httpx.NetworkError) as exc:
                logger.warning(
                    "Gemini embedding network error on key #%s/%s (%s) — rotating",
                    index + 1,
                    self._rotator.size,
                    exc,
                )
                self._rotator.mark_failure(index, None)
                last_error = exc
                continue

        raise last_error or RuntimeError("All Gemini API keys failed")

    def _embed_single(self, text: str) -> list[float]:
        url = f"{_GEMINI_API_BASE}/models/{self._model}:embedContent"
        payload = {
            "model": f"models/{self._model}",
            "content": {"parts": [{"text": text}]},
            "output_dimensionality": self._output_dimensionality,
        }
        data = self._post_json(url, payload, timeout=60.0)
        values = data.get("embedding", {}).get("values")
        if not values:
            raise RuntimeError("Gemini embedContent returned no embedding values")
        return values

    def _embed_batch(self, texts: list[str]) -> list[list[float]]:
        if len(texts) == 1:
            return [self._embed_single(texts[0])]

        url = f"{_GEMINI_API_BASE}/models/{self._model}:batchEmbedContents"
        requests_payload = [
            {
                "model": f"models/{self._model}",
                "content": {"parts": [{"text": text}]},
                "output_dimensionality": self._output_dimensionality,
            }
            for text in texts
        ]
        data = self._post_json(url, {"requests": requests_payload}, timeout=120.0)

        embeddings = data.get("embeddings") or []
        if len(embeddings) != len(texts):
            raise RuntimeError(
                f"Gemini batchEmbedContents size mismatch: "
                f"expected {len(texts)}, got {len(embeddings)}"
            )
        vectors: list[list[float]] = []
        for item in embeddings:
            values = item.get("values")
            if not values:
                raise RuntimeError("Gemini batchEmbedContents returned empty values")
            vectors.append(values)
        return vectors

    def _embed_gemini(self, texts: list[str]) -> list[list[float]]:
        formatted = self._format_inputs(texts)
        vectors: list[list[float]] = []
        for i in range(0, len(formatted), _BATCH_SIZE):
            vectors.extend(self._embed_batch(formatted[i : i + _BATCH_SIZE]))
        return vectors

    def __call__(self, input: list[str]) -> list[list[float]]:
        if not input:
            return []
        try:
            return self._embed_gemini(input)
        except Exception as exc:
            logger.warning(
                "Gemini embedding failed after trying %s key(s) (%s), "
                "falling back to local MiniLM — retrieval quality drops if "
                "the Qdrant index was built with Gemini",
                self._rotator.size,
                exc,
            )
            return self._local_fallback(input)

    def name(self) -> str:
        return f"gemini_embedding_{self._input_kind}"


class LocalEmbeddingFunction:
    """Thin wrapper exposing the local model as a callable embedding function."""

    def __init__(self) -> None:
        self._inner = _local_embedding_function()

    def __call__(self, input: list[str]) -> list[list[float]]:
        return self._inner(input)

    def name(self) -> str:
        return "local_minilm"


def _gemini_embedding_function(input_kind: Literal["document", "query"]):
    keys = gemini_api_keys()
    if not keys:
        return None
    logger.info(
        "Using Gemini embedding model: %s (dim=%s, keys=%s)",
        settings.GEMINI_EMBEDDING_MODEL,
        settings.GEMINI_EMBEDDING_DIMENSION,
        len(keys),
    )
    return GeminiEmbeddingFunction(
        api_keys=keys,
        model=settings.GEMINI_EMBEDDING_MODEL,
        output_dimensionality=settings.GEMINI_EMBEDDING_DIMENSION,
        input_kind=input_kind,
    )


@lru_cache(maxsize=1)
def get_embedding_function():
    """Return embedding function for Qdrant indexing (document mode)."""
    provider = embedding_provider()
    if provider == "gemini":
        fn = _gemini_embedding_function("document")
        if fn is not None:
            return fn
        logger.warning(
            "EMBEDDING_PROVIDER=gemini but GEMINI_API_KEY is empty — using local MiniLM"
        )
    return LocalEmbeddingFunction()


@lru_cache(maxsize=1)
def get_query_embedding_function():
    """Return embedding function for retrieval queries (query prefix)."""
    provider = embedding_provider()
    if provider == "gemini":
        fn = _gemini_embedding_function("query")
        if fn is not None:
            return fn
    return LocalEmbeddingFunction()


def embed_query_texts(texts: list[str]) -> list[list[float]]:
    """Embed search queries with the configured provider."""
    if not texts:
        return []
    return get_query_embedding_function()(texts)


def reset_embedding_cache() -> None:
    """Clear cached embedding functions (tests / hot reload)."""
    get_embedding_function.cache_clear()
    get_query_embedding_function.cache_clear()
