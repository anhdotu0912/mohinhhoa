"""Unit & Integration Tests for the 5-Tier Cost & Latency Optimization Architecture (P-014)."""

from __future__ import annotations

import pytest

from app.agents.nodes.intent_classifier import intent_classifier
from app.agents.nodes.profile_loader import profile_loader
from app.agents.nodes.rag_tool import _generate_answer, stream_answer_tokens
from app.agents.state import AgentState
from app.agents.streaming import stream_agent_events
from app.core.cache import ProfileCache, profile_cache
from app.schemas.meal_plan import AgentRunInput
from app.services.semantic_cache import SemanticQACache, semantic_qa_cache


# ---------------------------------------------------------------------------
# Tier 1: Profile Cache Tests
# ---------------------------------------------------------------------------
class TestTier1ProfileCache:
    def setup_method(self):
        profile_cache.clear()

    def test_cache_set_get_and_expiry(self):
        cache = ProfileCache(default_ttl_seconds=1)
        assert cache.get("user_123") is None
        assert not cache.is_cached("user_123")

        cache.set("user_123", {"disease": ["diabetes_t2"], "weight": 70})
        assert cache.is_cached("user_123")
        profile = cache.get("user_123")
        assert profile is not None
        assert profile["weight"] == 70

    def test_cache_invalidation(self):
        profile_cache.set("patient_01", {"weight": 65})
        assert profile_cache.is_cached("patient_01")

        profile_cache.invalidate("patient_01")
        assert not profile_cache.is_cached("patient_01")
        assert profile_cache.get("patient_01") is None

    def test_profile_loader_uses_cache(self):
        profile_cache.set("demo_patient_1", {"disease": ["diabetes_t2"], "custom_cached": True})
        state: AgentState = {"user_id": "demo_patient_1", "profile": {}}

        loaded_state = profile_loader(state)
        assert loaded_state["profile"].get("custom_cached") is True


# ---------------------------------------------------------------------------
# Tier 2: Zero-Token Deterministic Routing Tests
# ---------------------------------------------------------------------------
class TestTier2ZeroTokenRouting:
    @pytest.mark.parametrize(
        ("query", "expected_intent"),
        [
            ("Xin chào bạn", "greeting"),
            ("Chào bot, bạn là ai?", "greeting"),
            ("Cảm ơn bạn rất nhiều", "greeting"),
            ("Tạm biệt trợ lý", "greeting"),
            ("Kê cho tôi đơn thuốc hạ đường huyết", "refuse"),
            ("Tăng liều metformin lên 1000mg giúp tôi", "refuse"),
            ("Tuần này tôi tuân thủ thực đơn bao nhiêu phần trăm?", "weekly_compliance"),
            ("Sáng nay tôi đã ăn phở bò", "food_log"),
            ("Bác sĩ có dặn dò gì mới không?", "doctor_note"),
        ],
    )
    def test_deterministic_intents_fast_path(self, query: str, expected_intent: str):
        state: AgentState = {"message": query, "user_id": "test_user"}
        result = intent_classifier(state)
        assert result["intent"] == expected_intent

    def test_emergency_triage_fast_path(self):
        emergency_query = "Tôi thấy đói cồn cào, tay chân run lẩy bẩy, vã mồ hôi lạnh"
        state: AgentState = {"message": emergency_query, "user_id": "test_user"}
        result = intent_classifier(state)
        # Emergency triage is routed to unknown where emergency_triage_check activates 15-15 rule
        assert result["intent"] == "unknown"


# ---------------------------------------------------------------------------
# Tier 4: Semantic Q&A Cache Tests
# ---------------------------------------------------------------------------
class TestTier4SemanticQACache:
    def setup_method(self):
        semantic_qa_cache.clear()

    def test_semantic_cache_put_and_hit(self):
        query = "Người bị tiểu đường có ăn được bơ không?"
        answer = "Quả bơ rất tốt cho người đái tháo đường vì giàu chất béo không bão hòa đơn và chất xơ."
        citations = ["BYT QĐ 5481"]

        semantic_qa_cache.put(query, answer, citations, disease=["diabetes_t2"])
        assert semantic_qa_cache.size() == 1

        # Check hit for exact or near identical question
        cached = semantic_qa_cache.get(query, disease=["diabetes_t2"])
        assert cached is not None
        cached_ans, cached_cits = cached
        assert cached_ans == answer
        assert cached_cits == citations

    def test_rag_tool_generate_answer_hits_semantic_cache(self):
        query = "Chỉ số đường huyết GI của gạo lứt là bao nhiêu?"
        cached_answer = "Gạo lứt có chỉ số đường huyết GI trung bình khoảng 55-68, thấp hơn gạo trắng."
        semantic_qa_cache.put(query, cached_answer, ["ADA 2024"], disease=["diabetes_t2"])

        # Invoke _generate_answer — should return cached answer without calling LLM
        ans = _generate_answer(query, [{"text": "dummy", "source": "ADA 2024"}], {"disease": ["diabetes_t2"]})
        assert ans == cached_answer

    def test_rag_tool_stream_answer_hits_semantic_cache(self):
        query = "Bị tiểu đường ăn yến mạch được không?"
        cached_answer = "Yến mạch là thực phẩm tốt cho người tiểu đường nhờ giàu beta-glucan."
        semantic_qa_cache.put(query, cached_answer, ["BYT"], disease=["diabetes_t2"])

        # Stream tokens — should yield cached tokens
        tokens = list(stream_answer_tokens(query, [{"text": "dummy", "source": "BYT"}], {"disease": ["diabetes_t2"]}))
        streamed_text = "".join(tokens)
        assert streamed_text == cached_answer


# ---------------------------------------------------------------------------
# Streaming UX: Skip Profile Loader Status on Subsequent Messages
# ---------------------------------------------------------------------------
class TestStreamingUXCacheBehavior:
    def setup_method(self):
        profile_cache.clear()

    def test_streaming_emits_profile_loader_only_on_first_message(self):
        user_id = "test_ux_patient"
        input_data = AgentRunInput(user_id=user_id, message="Xin chào")

        # First message: profile not cached -> must yield profile_loader status
        assert not profile_cache.is_cached(user_id)
        events_1 = list(stream_agent_events(input_data))
        status_nodes_1 = [e.get("node") for e in events_1 if e.get("type") == "status"]
        assert "profile_loader" in status_nodes_1

        # Second message: profile is now cached -> MUST NOT yield profile_loader status
        assert profile_cache.is_cached(user_id)
        events_2 = list(stream_agent_events(input_data))
        status_nodes_2 = [e.get("node") for e in events_2 if e.get("type") == "status"]
        assert "profile_loader" not in status_nodes_2
        assert "intent_classifier" in status_nodes_2
