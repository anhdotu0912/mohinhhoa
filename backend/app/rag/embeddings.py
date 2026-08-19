"""Embedding utilities — Gemini Embedding 2 (default) with local MiniLM fallback."""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Literal

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"
_BATCH_SIZE = 100


def prepare_query_text(text: str) -> str:
    """Format query for asymmetric retrieval (Gemini Embedding 2)."""
    return f"task: search result | query: {text}"


def prepare_document_text(content: str, title: str | None = None) -> str:
    """Format document for asymmetric retrieval (Gemini Embedding 2)."""
    return f"title: {title or 'none'} | text: {content}"


def gemini_api_key() -> str:
    return (settings.GEMINI_API_KEY or "").strip()


def embedding_provider() -> str:
    return (settings.EMBEDDING_PROVIDER or "gemini").strip().lower()


def _local_embedding_function():
    from chromadb.utils import embedding_functions

    logger.info("Loading local embedding model: %s", settings.EMBEDDING_MODEL)
    return embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name=settings.EMBEDDING_MODEL
    )


class GeminiEmbeddingFunction:
    """Chroma-compatible embedding function via Gemini embedContent / batchEmbedContents."""

    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        output_dimensionality: int,
        input_kind: Literal["document", "query"] = "document",
    ) -> None:
        self._api_key = api_key
        self._model = model
        self._output_dimensionality = output_dimensionality
        self._input_kind = input_kind
        self._local_fallback = _local_embedding_function()

    def _format_inputs(self, texts: list[str]) -> list[str]:
        if self._input_kind == "query":
            return [prepare_query_text(t) for t in texts]
        return [prepare_document_text(t) for t in texts]

    def _embed_single(self, text: str) -> list[float]:
        url = f"{_GEMINI_API_BASE}/models/{self._model}:embedContent"
        payload = {
            "model": f"models/{self._model}",
            "content": {"parts": [{"text": text}]},
            "output_dimensionality": self._output_dimensionality,
        }
        with httpx.Client(timeout=60.0) as client:
            response = client.post(
                url,
                headers={
                    "Content-Type": "application/json",
                    "x-goog-api-key": self._api_key,
                },
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
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
        with httpx.Client(timeout=120.0) as client:
            response = client.post(
                url,
                headers={
                    "Content-Type": "application/json",
                    "x-goog-api-key": self._api_key,
                },
                json={"requests": requests_payload},
            )
            response.raise_for_status()
            data = response.json()

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
                "Gemini embedding failed (%s), falling back to local MiniLM",
                exc,
            )
            return self._local_fallback(input)

    def name(self) -> str:
        return f"gemini_embedding_{self._input_kind}"


class LocalEmbeddingFunction:
    """Thin wrapper so Chroma always gets a callable object."""

    def __init__(self) -> None:
        self._inner = _local_embedding_function()

    def __call__(self, input: list[str]) -> list[list[float]]:
        return self._inner(input)

    def name(self) -> str:
        return "local_minilm"


@lru_cache(maxsize=1)
def get_embedding_function():
    """Return embedding function for Chroma indexing (document mode)."""
    provider = embedding_provider()
    if provider == "gemini" and gemini_api_key():
        logger.info(
            "Using Gemini embedding model: %s (dim=%s)",
            settings.GEMINI_EMBEDDING_MODEL,
            settings.GEMINI_EMBEDDING_DIMENSION,
        )
        return GeminiEmbeddingFunction(
            api_key=gemini_api_key(),
            model=settings.GEMINI_EMBEDDING_MODEL,
            output_dimensionality=settings.GEMINI_EMBEDDING_DIMENSION,
            input_kind="document",
        )

    if provider == "gemini" and not gemini_api_key():
        logger.warning(
            "EMBEDDING_PROVIDER=gemini but GEMINI_API_KEY is empty — using local MiniLM"
        )
    return LocalEmbeddingFunction()


@lru_cache(maxsize=1)
def get_query_embedding_function():
    """Return embedding function for retrieval queries (query prefix)."""
    provider = embedding_provider()
    if provider == "gemini" and gemini_api_key():
        return GeminiEmbeddingFunction(
            api_key=gemini_api_key(),
            model=settings.GEMINI_EMBEDDING_MODEL,
            output_dimensionality=settings.GEMINI_EMBEDDING_DIMENSION,
            input_kind="query",
        )
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
