"""Lightweight retrieval must never require loading an embedding model."""

import json

import pytest
from app.rag import retriever


@pytest.fixture()
def keyword_corpus(tmp_path, monkeypatch):
    data = tmp_path / "data"
    guidelines = data / "guidelines"
    guidelines.mkdir(parents=True)
    (data / "food_db_vn.json").write_text(json.dumps([
        {"id": "tomato", "name": "Cà chua", "category": "rau", "tags": []},
        {"id": "shrimp", "name": "Tôm cà chua", "category": "hai_san", "tags": ["allergen-shellfish"]},
        {"id": "rice", "name": "Cơm gạo lứt", "category": "tinh_bot", "tags": []},
    ], ensure_ascii=False), encoding="utf-8")
    (guidelines / "nutrition.md").write_text(
        "## Cà chua\nThông tin dinh dưỡng cà chua trong tài liệu kiểm thử.",
        encoding="utf-8",
    )
    (guidelines / "other.md").write_text("## Khác\nTài liệu khác.", encoding="utf-8")
    monkeypatch.setattr(retriever, "_BACKEND_DIR", tmp_path)
    monkeypatch.setattr(retriever, "_dense_memory_failed", False)
    return tmp_path


def test_keyword_mode_skips_model_and_qdrant_but_preserves_filters(keyword_corpus, monkeypatch):
    monkeypatch.setattr(retriever.settings, "RAG_RETRIEVAL_MODE", "keyword")

    def forbidden(*args, **kwargs):
        pytest.fail("Keyword retrieval must not load embeddings or initialize Qdrant")

    monkeypatch.setattr(retriever, "embed_query_texts", forbidden)
    monkeypatch.setattr(retriever, "_get_qdrant_client", forbidden)
    foods = retriever.retrieve_foods("cà chua", exclude_tags=["allergen-shellfish"])
    assert [food.chunk_id for food in foods] == ["tomato"]
    assert foods[0].source == "food_db_vn"
    assert foods[0].metadata["category"] == "rau"
    assert retriever.retrieve_foods("cà chua", category_filter="rau")[0].chunk_id == "tomato"
    docs = retriever.retrieve_guidelines("cà chua", source_filter="nutrition.md")
    assert docs and all(doc.source == "nutrition" for doc in docs)


@pytest.mark.parametrize("failure", [MemoryError("low memory"), OSError(1455, "paging file too small")])
def test_memory_failure_switches_following_queries_to_keywords(keyword_corpus, monkeypatch, failure):
    monkeypatch.setattr(retriever.settings, "RAG_RETRIEVAL_MODE", "dense")
    calls = []

    def fail_once(texts):
        calls.append(texts)
        raise failure

    monkeypatch.setattr(retriever, "embed_query_texts", fail_once)
    assert retriever.retrieve_guidelines("cà chua", client=object())
    assert retriever.retrieve_foods("cà chua", client=object())
    assert len(calls) == 1  # Do not repeatedly attempt to load an oversized model.


def test_non_memory_os_errors_are_not_treated_as_memory_fallback(keyword_corpus, monkeypatch):
    monkeypatch.setattr(retriever.settings, "RAG_RETRIEVAL_MODE", "dense")

    def unavailable(texts):
        raise OSError(2, "missing model")

    monkeypatch.setattr(retriever, "embed_query_texts", unavailable)
    with pytest.raises(OSError):
        retriever.retrieve_guidelines("cà chua", client=object())
    assert not retriever._dense_memory_failed


def test_stream_hides_internal_memory_error(monkeypatch):
    from app.agents import streaming
    from app.schemas.meal_plan import AgentRunInput

    def fail(state):
        raise OSError(1455, "internal checkpoint path")

    monkeypatch.setattr(streaming, "profile_loader", fail)
    events = list(streaming.stream_agent_events(AgentRunInput(user_id="memory-test", message="test")))
    error = next(event for event in events if event["type"] == "error")
    assert "thiếu bộ nhớ" in error["message"]
    assert "checkpoint" not in error["message"]
    assert "1455" not in error["message"]
