"""Regression for the real 'cà chua vào bữa phụ đc không' chat failure."""

import json
from types import SimpleNamespace

import pytest
from app.agents.graph import interaction_check_node
from app.agents.interaction_checker_agent import extract_foods_from_message
from app.agents.nodes.intent_classifier import intent_classifier
from app.agents.nodes.rag_tool import (
    _generate_answer,
    _template_answer,
    retrieve_rag_context,
    stream_answer_tokens,
)
from app.rag.retriever import retrieve_foods

QUESTION = "tôi muốn ăn cà chua vào bữa phụ đc không"


@pytest.fixture
def keyword_no_llm(monkeypatch):
    monkeypatch.setattr("app.rag.retriever.settings.RAG_RETRIEVAL_MODE", "keyword")
    monkeypatch.setattr("app.core.llm.get_chat_llm", lambda **kwargs: None)


@pytest.mark.parametrize("question,food", [
    (QUESTION, "cà chua"),
    ("mình ăn dưa leo cho bữa phụ dc ko?", "dưa leo"),
    ("tối nay ăn tôm đc không?", "tôm"),
])
def test_colloquial_food_permission_is_deterministic(question, food, monkeypatch):
    monkeypatch.setattr("app.agents.nodes.intent_classifier._classify_by_llm", lambda _: pytest.fail("No LLM routing required"))
    assert intent_classifier({"message": question})["intent"] == "interaction_check"
    foods, specific = extract_foods_from_message(question)
    assert specific and food in foods
    assert all("bữa phụ" not in name and "đc" not in name for name in foods)


def test_accent_folding_does_not_rank_fish_above_tomato(keyword_no_llm):
    foods = retrieve_foods("cà chua", top_k=1)
    assert foods[0].metadata["name"] == "cà chua"
    context, citations = retrieve_rag_context(QUESTION, {"disease": ["diabetes_t2"]})
    assert context and citations
    assert "food_db_vn#f320" in citations
    assert all("cà chua" in chunk["text"].lower() for chunk in context)
    assert not any("gdm" in source or "1470" in source for source in citations)


def test_irrelevant_fallback_never_dumps_prenatal_document():
    answer = _template_answer(QUESTION, "CHƯƠNG 3. QUẢN LÝ ĐÁI THÁO ĐƯỜNG TRONG GIAI ĐOẠN MANG THAI. Theo dõi tiền sản.")
    assert "chưa tìm thấy nguồn phù hợp" in answer.lower()
    assert "cà chua" in answer
    assert "tiền sản" not in answer.lower()
    assert "CHƯƠNG" not in answer


@pytest.mark.parametrize("streaming", [False, True])
def test_actual_question_via_chat_api(client, monkeypatch, keyword_no_llm, streaming):
    monkeypatch.setattr("app.agents.streaming.time.sleep", lambda _: None)
    token = client.post("/api/v1/auth/login", json={"email": "demo_patient_1@example.com", "password": "demo1234"}).json()["access_token"]
    response = client.post(
        "/api/v1/chat/stream" if streaming else "/api/v1/chat",
        headers={"Authorization": f"Bearer {token}"}, json={"message": QUESTION},
    )
    assert response.status_code == 200
    if streaming:
        events = [json.loads(line[5:]) for line in response.text.splitlines() if line.startswith("data:")]
        assert not any(event["type"] == "error" for event in events)
        reply = next(event["data"] for event in events if event["type"] == "done")
        assert not any(event.get("node") == "meal_plan" for event in events)
    else:
        reply = response.json()
    assert reply["intent"] == "interaction_check"
    assert "cà chua" in reply["message"] and "bữa phụ" in reply["message"]
    assert "rau không chứa tinh bột" in reply["message"]
    for unrelated in ("mang thai", "tiền sản", "rượu", "bưởi", "cảnh báo dị ứng", "CHƯƠNG"):
        assert unrelated.lower() not in reply["message"].lower()
    assert reply["citation_chunks"]
    assert all("cà chua" in c["text"] for c in reply["citation_chunks"])


def test_allergy_blocks_food_suggestion_first(keyword_no_llm):
    result = interaction_check_node({"message": QUESTION, "profile": {"allergies": ["cà chua"], "medications": []}})
    assert "dị ứng" in result["answer"].lower()
    assert "có thể cân nhắc" not in result["answer"]


def test_unknown_food_has_no_unrelated_citations_or_invented_drugs(keyword_no_llm):
    result = interaction_check_node({"message": "ăn món xzyabc đc không", "profile": {"medications": [], "allergies": []}})
    assert "chưa tìm thấy nguồn phù hợp" in result["answer"].lower()
    assert "metformin" not in result["answer"].lower()
    assert result["citations"] == []


@pytest.mark.parametrize("streaming", [False, True])
def test_off_topic_llm_and_similar_cached_food_are_not_shown(monkeypatch, keyword_no_llm, streaming):
    context, _ = retrieve_rag_context(QUESTION, {"disease": ["diabetes_t2"]})
    monkeypatch.setattr("app.services.semantic_cache.semantic_qa_cache.get", lambda *args: pytest.fail("Do not reuse similar-question food answers"))
    monkeypatch.setattr("app.core.llm.get_chat_llm", lambda **kwargs: SimpleNamespace(invoke=lambda _: SimpleNamespace(content="Theo dõi tiền sản trong thai kỳ")))
    answer = "".join(stream_answer_tokens(QUESTION, context, {})) if streaming else _generate_answer(QUESTION, context, {})
    assert "cà chua" in answer
    assert "tiền sản" not in answer
