"""Natural food questions in offline mode, including owned multi-turn context."""

import json
import re

import pytest
from app.agents.food_conversation import (
    answer_food_conversation,
    mentioned_foods,
    resolve_food_followup,
)
from app.agents.graph import run_agent
from app.schemas.meal_plan import AgentRunInput
from app.services.chat_history_service import conversation_context

from tests.test_api import PATIENT, _login


@pytest.fixture(autouse=True)
def offline(monkeypatch):
    monkeypatch.setattr("app.core.llm.get_chat_llm", lambda **kwargs: None)
    monkeypatch.setattr("app.rag.retriever.settings.RAG_RETRIEVAL_MODE", "keyword")
    monkeypatch.setattr("app.agents.streaming.time.sleep", lambda _: None)


@pytest.mark.parametrize("question,names", [
    ("so sánh gạo lứt vs gạo trắng", ["Gạo lứt", "Gạo tẻ máy"]),
    ("mình không thích thịt bò", []),
    ("ca chua bn calo?", ["Cà chua"]),
    ("cà chua và dưa leo", ["Cà chua", "Dưa chuột"]),
])
def test_names_preserve_subject_and_accents(question, names):
    assert [food["name"]["vi"] for food in mentioned_foods(question)] == names


def test_nutrition_comes_from_catalog_and_not_assumed_portion():
    result = answer_food_conversation("cà chua bn calo?", {})
    assert "20kcal" in result["answer"]
    assert "100g phần ăn được" in result["answer"]
    assert "nguyên liệu sống" in result["answer"]
    assert "không phải khẩu phần khuyến nghị" in result["answer"]
    assert result["citations"] == ["food_catalog_vn#FOOD_VN_0076"]
    assert '"energy_kcal": 20' in result["rag_context"][0]["text"]
    assert "tiền sản" not in result["answer"]


def test_missing_nutrient_is_not_reported_as_zero(monkeypatch):
    monkeypatch.setattr("app.agents.food_conversation.mentioned_foods", lambda _: [{
        "_id": "test", "name": {"vi": "Thực phẩm thử"}, "measurement": {"basis_g": 100},
        "nutrition_per_100g_edible": {"energy_kcal": 20, "fiber_g": None},
    }])
    result = answer_food_conversation("bao nhiêu calo", {})
    assert "20kcal" in result["answer"]
    assert "chất xơ" not in result["answer"]
    assert "fiber_g" not in result["rag_context"][0]["text"]


def test_rice_comparison_has_two_sources_and_raw_basis():
    result = answer_food_conversation("so sánh gạo lứt với gạo trắng", {})
    assert len(result["citations"]) == 2
    assert "Gạo lứt" in result["answer"] and "Gạo tẻ máy" in result["answer"]
    assert "nguyên liệu sống" in result["answer"]
    assert "Sò" not in result["answer"]


def test_avocado_is_not_assumed_to_be_butter():
    result = answer_food_conversation("bơ bao nhiêu calo", {})
    assert result["clarify"]
    assert "quả bơ" in result["answer"]
    assert result["citations"] == []


def test_unsupported_known_food_question_does_not_fall_through_to_random_documents():
    result = answer_food_conversation("ăn cà chua với mì tôm có khó tiêu ko?", {})
    assert result["clarify"]
    assert "Cà chua" in result["answer"]
    assert result["citations"] == []


def test_general_nutrient_guidance_keeps_medical_rag():
    assert answer_food_conversation("Carbohydrate nên ăn bao nhiêu?", {}) is None
    assert answer_food_conversation("người tiểu đường nên kiêng gì?", {}) is None


def test_recipe_respects_method_allergies_and_stated_preferences():
    result = answer_food_conversation("gợi ý món hấp dễ làm", {
        "allergies": ["hải sản"], "preferences": ["không ăn thịt bò"],
    })
    assert result["citations"]
    assert "công thức mẫu" in result["answer"]
    for chunk in result["rag_context"]:
        assert "thịt bò" not in chunk["text"].lower()
        assert not re.search(r"\b(?:tôm|cá|cua|mực)\b", chunk["text"].split("; cách chế biến:")[0].lower())


def test_recipe_honors_specific_method():
    result = answer_food_conversation("cách luộc rau muống", {})
    assert "Rau muống luộc" in result["answer"]
    assert "Thao tác bếp cơ bản" in result["answer"]
    assert all("cách chế biến: luộc" in chunk["text"] for chunk in result["rag_context"])


def test_partial_ingredient_recipe_matches_are_disclosed_after_allergy_filtering():
    result = answer_food_conversation("mình chỉ có trứng và cà chua, nấu món gì?", {"allergies": ["hải sản"]})
    assert result["citations"]
    assert "Chỉ khớp một phần nguyên liệu" in result["answer"]
    assert "có thể cần thêm nguyên liệu khác" in result["answer"]


@pytest.mark.parametrize("question", ["nó bn calo?", "món đó nấu sao", "xzyabc bao nhiêu calo", "so sánh cà chua", "cà chua để tủ lạnh bao lâu?"])
def test_missing_subject_or_unavailable_data_asks_instead_of_inventing(question):
    result = answer_food_conversation(question, {})
    assert result["clarify"]
    assert result["citations"] == []
    assert "115" not in result["answer"]
    assert "nước đường" not in result["answer"]


def test_context_uses_user_subject_only_and_does_not_guess_between_two():
    history = [{"role": "user", "content": "cà chua bn calo"}, {"role": "assistant", "content": "cá hồi"}]
    assert "Cà chua" in resolve_food_followup("nó bn calo?", history)
    assert "ăn " in resolve_food_followup("nó đc ko?", history).lower()
    assert resolve_food_followup("nó bn calo?", history[1:]) == "nó bn calo?"
    assert resolve_food_followup("nó bn calo?", [{"role": "user", "content": "cà chua và dưa leo"}]) == "nó bn calo?"


@pytest.mark.parametrize("question", ["đổi liều metformin cho tôi để ăn cà chua", "tăng liều insulin để ăn cơm"])
def test_natural_food_routing_preserves_medication_refusal(question):
    result = run_agent(AgentRunInput(user_id="demo_patient_1", message=question))
    assert result.intent == "refuse"


def _save_context(client, headers, messages):
    session = client.post("/api/v1/chat/sessions", json={"title": "Food QA"}, headers=headers).json()
    response = client.put(f"/api/v1/chat/sessions/{session['id']}/messages", headers=headers, json={"messages": messages})
    assert response.status_code == 200, response.text
    return session["id"]


@pytest.mark.parametrize("streaming", [False, True])
def test_followup_reads_owned_session_through_real_api(client, streaming):
    headers = _login(client, PATIENT)
    session_id = _save_context(client, headers, [
        {"id": "u", "sender": "user", "text": "tôi muốn hỏi về cà chua"},
        {"id": "a", "sender": "ai", "text": "Dữ liệu cũ sai: 999kcal"},
    ])
    response = client.post("/api/v1/chat/stream" if streaming else "/api/v1/chat", headers=headers,
                           json={"message": "nó bn calo?", "session_id": session_id})
    assert response.status_code == 200, response.text
    if streaming:
        events = [json.loads(line[5:]) for line in response.text.splitlines() if line.startswith("data:")]
        assert not any(event["type"] == "error" for event in events)
        result = next(event["data"] for event in events if event["type"] == "done")
    else:
        result = response.json()
    assert result["intent"] == "rag_qa"
    assert "Cà chua" in result["message"] and "20kcal" in result["message"]
    assert "999" not in result["message"]
    assert result["citation_chunks"]


@pytest.mark.parametrize("streaming", [False, True])
def test_other_patient_or_missing_session_rejected_before_stream(client, streaming):
    owner = _login(client, PATIENT)
    other = _login(client, "demo_patient_2@example.com")
    session_id = _save_context(client, owner, [{"id": "u", "sender": "user", "text": "cà chua"}])
    for value in (session_id, "missing-session"):
        response = client.post("/api/v1/chat/stream" if streaming else "/api/v1/chat", headers=other,
                               json={"message": "nó bn calo", "session_id": value})
        assert response.status_code == 404
        assert response.json()["code"] == "SESSION_NOT_FOUND"
        assert not response.headers["content-type"].startswith("text/event-stream")


def test_context_is_bounded_and_ordered(client, db_session):
    headers = _login(client, PATIENT)
    session_id = _save_context(client, headers, [
        {"id": f"u{i}", "sender": "user", "text": f"{i}:" + "x" * 1500} for i in range(12)
    ])
    context = conversation_context(db_session, "demo_patient_1", session_id)
    assert len(context) == 8
    assert context[0]["content"].startswith("4:")
    assert context[-1]["content"].startswith("11:")
    assert all(len(turn["content"]) == 1200 for turn in context)


def test_unknown_nonmedical_question_does_not_trigger_emergency():
    result = run_agent(AgentRunInput(user_id="demo_patient_1", message="Hôm nay trời có mưa không?"))
    assert "nước đường" not in result.message
    assert "115" not in result.message
    assert result.intent == "clarify"
    assert "nguyên liệu" in result.message
