"""Tests for Gemini embedding API key parsing and rotation."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import httpx
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.rag.gemini_keys import (
    GeminiKeyRotator,
    parse_gemini_api_keys,
)


def _fn(keys: list[str]):
    from app.rag.embeddings import GeminiEmbeddingFunction

    return GeminiEmbeddingFunction(
        api_keys=keys,
        model="gemini-embedding-2",
        output_dimensionality=768,
        input_kind="document",
    )


def _ok_embedding(values: list[float] | None = None) -> httpx.Response:
    return httpx.Response(
        200,
        json={"embedding": {"values": values or [0.1, 0.2, 0.3]}},
        request=httpx.Request("POST", "https://example.invalid"),
    )


def _status(code: int) -> httpx.Response:
    return httpx.Response(
        code,
        json={"error": {"message": f"http {code}"}},
        request=httpx.Request("POST", "https://example.invalid"),
    )


class _Client:
    def __init__(self, posts):
        self._posts = posts

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def post(self, url, headers=None, json=None):
        return self._posts(url, headers or {}, json)


class TestParseGeminiApiKeys:
    def test_splits_comma_and_optional_spaces(self):
        assert parse_gemini_api_keys("k1, k2,k3") == ["k1", "k2", "k3"]

    def test_dedupes_preserving_order(self):
        assert parse_gemini_api_keys("k1,k2", "k2,k3") == ["k1", "k2", "k3"]

    def test_strips_quotes_and_ignores_empty(self):
        assert parse_gemini_api_keys('  "k1" , , \'k2\' ') == ["k1", "k2"]


class TestGeminiKeyRotator:
    def test_requires_at_least_one_key(self):
        with pytest.raises(ValueError):
            GeminiKeyRotator([])

    def test_candidates_start_at_sticky_index(self):
        rotator = GeminiKeyRotator(["a", "b", "c"])
        rotator.mark_success(1)
        assert [k for _, k in rotator.candidates()] == ["b", "c", "a"]

    def test_401_marks_key_dead(self):
        rotator = GeminiKeyRotator(["a", "b"])
        rotator.mark_failure(0, 401)
        assert rotator.alive_count == 1
        assert [k for _, k in rotator.candidates()] == ["b"]

    def test_429_does_not_kill_key(self):
        rotator = GeminiKeyRotator(["a", "b"])
        rotator.mark_failure(0, 429)
        assert rotator.alive_count == 2
        assert [k for _, k in rotator.candidates()] == ["b", "a"]


class TestGeminiEmbeddingRotation:
    def test_rotates_on_429_then_succeeds(self):
        keys_used: list[str] = []

        def posts(_url, headers, _json):
            key = headers["x-goog-api-key"]
            keys_used.append(key)
            if key == "k1":
                return _status(429)
            return _ok_embedding([0.5, 0.6])

        fn = _fn(["k1", "k2"])
        with patch("app.rag.embeddings.httpx.Client", return_value=_Client(posts)):
            vectors = fn(["cơm gạo lứt"])

        assert keys_used == ["k1", "k2"]
        assert vectors == [[0.5, 0.6]]

        keys_used.clear()
        with patch("app.rag.embeddings.httpx.Client", return_value=_Client(posts)):
            fn(["bún chả"])
        assert keys_used == ["k2"]

    def test_skips_dead_401_key_on_later_calls(self):
        keys_used: list[str] = []

        def posts(_url, headers, _json):
            key = headers["x-goog-api-key"]
            keys_used.append(key)
            if key == "dead":
                return _status(401)
            return _ok_embedding()

        fn = _fn(["dead", "live"])
        with patch("app.rag.embeddings.httpx.Client", return_value=_Client(posts)):
            fn(["một"])
            keys_used.clear()
            fn(["hai"])
        assert keys_used == ["live"]

    def test_does_not_rotate_on_400(self):
        keys_used: list[str] = []

        def posts(_url, headers, _json):
            keys_used.append(headers["x-goog-api-key"])
            return _status(400)

        fallback = MagicMock(return_value=[[9.0]])
        fn = _fn(["k1", "k2"])
        fn._local_fn = fallback
        with patch("app.rag.embeddings.httpx.Client", return_value=_Client(posts)):
            result = fn(["x"])
        assert keys_used == ["k1"]
        assert result == [[9.0]]
        fallback.assert_called_once()

    def test_all_keys_fail_falls_back_to_local(self):
        def posts(_url, headers, _json):
            return _status(429)

        fallback = MagicMock(return_value=[[1.0, 2.0]])
        fn = _fn(["k1", "k2"])
        fn._local_fn = fallback
        with patch("app.rag.embeddings.httpx.Client", return_value=_Client(posts)):
            result = fn(["x"])
        assert result == [[1.0, 2.0]]
        fallback.assert_called_once_with(["x"])
