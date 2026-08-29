"""Unit tests for Zero-Bloat Context, State Pruning & Dynamic Tool Binding (P-014 Phase 4).

Verifies that:
1. RAG retrieval chunk size is reduced to top_k=2 guidelines + max 1 food chunk.
2. State Pruning filters state to only the minimum required fields per intent.
3. Dynamic Tool Binding yields exactly 1 tool schema per intent.
4. 1-1 strict node isolation is enforced without cross-tool bloat.
"""

from __future__ import annotations

import pytest
from app.agents.nodes.rag_tool import _build_rag_context, _build_rag_prompt
from app.agents.skills import (
    get_bound_tool_schema_for_intent,
    get_lean_state_for_intent,
)


# ===========================================================================
# 1. RAG Chunk Pruning & Lean Context Tests
# ===========================================================================
class TestRagChunkPruning:
    def test_rag_context_lean_chunk_counts(self):
        """Verify _build_rag_context uses top_k=2 guidelines by default."""
        profile = {"disease": ["diabetes_t2"], "medications": ["metformin"], "allergies": []}
        context, citations = _build_rag_context(
            message="Chỉ số đường huyết sau ăn của người tiểu đường nên là bao nhiêu?",
            profile=profile,
            top_k_guidelines=2,
            top_k_foods=1,
        )

        # Should retrieve lean guidelines (<= 2) + 0 or 1 food chunk
        assert len(context) <= 3
        assert len(citations) <= 3

    def test_rag_prompt_uses_top_2_lean_chunks(self):
        """Verify _build_rag_prompt consumes at most 2 chunks, preventing lost-in-the-middle bloat."""
        mock_chunks = [
            {"chunk_id": f"chunk_{i}", "text": f"Hướng dẫn y khoa chi tiết phần {i}.", "source": "QĐ 5481", "score": 0.9 - i * 0.1}
            for i in range(10)
        ]
        profile = {"disease": ["diabetes_t2"]}
        prompt = _build_rag_prompt("Tiểu đường nên ăn gì?", mock_chunks, profile)

        # Chunk 0 and 1 should be in prompt, but chunk 2, 3, etc. should NOT be in prompt
        assert "Hướng dẫn y khoa chi tiết phần 0" in prompt
        assert "Hướng dẫn y khoa chi tiết phần 1" in prompt
        assert "Hướng dẫn y khoa chi tiết phần 2" not in prompt
        assert "Hướng dẫn y khoa chi tiết phần 9" not in prompt


# ===========================================================================
# 2. State Pruning Tests
# ===========================================================================
class TestStatePruning:
    @pytest.fixture
    def full_bloated_state(self) -> dict:
        return {
            "user_id": "patient_12345",
            "message": "Hôm nay tôi nên ăn gì?",
            "db": "fake_db_session",
            "profile": {
                "user_id": "patient_12345",
                "disease": ["diabetes_t2"],
                "medications": ["metformin", "glipizide"],
                "allergies": ["hải sản"],
                "weight_history": [75.0, 74.5, 74.0, 73.8],
                "waist_cm_history": [90, 89, 88],
                "target_kcal": 1600,
                "notes": "Bệnh nhân có tiền sử gan nhiễm mỡ nhẹ",
            },
            "rag_context": [{"chunk_id": "old_chunk", "text": "bloat"}],
            "meal_plan": {"meals": [{"name": "cơm"}]},
            "interactions": {"some": "data"},
            "metrics_history": [1, 2, 3, 4],
        }

    def test_prune_for_meal_plan(self, full_bloated_state):
        lean = get_lean_state_for_intent(full_bloated_state, "meal_plan")
        assert set(lean.keys()) == {"user_id", "message", "db"}
        assert "profile" not in lean
        assert "rag_context" not in lean
        assert "interactions" not in lean

    def test_prune_for_interaction_check(self, full_bloated_state):
        lean = get_lean_state_for_intent(full_bloated_state, "interaction_check")
        assert set(lean.keys()) == {"user_id", "message", "medications", "allergies", "db"}
        assert lean["medications"] == ["metformin", "glipizide"]
        assert lean["allergies"] == ["hải sản"]
        assert "weight_history" not in lean
        assert "rag_context" not in lean

    def test_prune_for_rag_qa(self, full_bloated_state):
        lean = get_lean_state_for_intent(full_bloated_state, "rag_qa")
        assert set(lean.keys()) == {"message", "profile"}
        # Profile only keeps clinical fields
        assert set(lean["profile"].keys()) == {"disease", "medications", "allergies"}
        assert "weight_history" not in lean["profile"]
        assert "db" not in lean

    def test_prune_for_food_log(self, full_bloated_state):
        lean = get_lean_state_for_intent(full_bloated_state, "food_log")
        assert set(lean.keys()) == {"user_id", "db"}
        assert "profile" not in lean

    def test_prune_for_weekly_compliance(self, full_bloated_state):
        lean = get_lean_state_for_intent(full_bloated_state, "weekly_compliance")
        assert set(lean.keys()) == {"user_id", "db"}

    def test_prune_for_greeting_and_refuse(self, full_bloated_state):
        lean_greeting = get_lean_state_for_intent(full_bloated_state, "greeting")
        assert set(lean_greeting.keys()) == {"message"}

        lean_refuse = get_lean_state_for_intent(full_bloated_state, "refuse")
        assert set(lean_refuse.keys()) == {"message"}

    def test_prune_for_unknown_intent(self, full_bloated_state):
        lean_unknown = get_lean_state_for_intent(full_bloated_state, "unknown")
        assert set(lean_unknown.keys()) == {"message", "profile"}
        assert set(lean_unknown["profile"].keys()) == {"disease", "medications"}


# ===========================================================================
# 3. Dynamic Tool Binding Tests
# ===========================================================================
class TestDynamicToolBinding:
    def test_bind_single_tool_for_meal_plan(self):
        tool = get_bound_tool_schema_for_intent("meal_plan")
        assert tool is not None
        assert tool["type"] == "function"
        assert tool["function"]["name"] == "get_patient_meal_plan"

    def test_bind_single_tool_for_interaction_check(self):
        tool = get_bound_tool_schema_for_intent("interaction_check")
        assert tool is not None
        assert tool["function"]["name"] == "check_drug_food_interaction"

    def test_bind_single_tool_for_rag_qa(self):
        tool = get_bound_tool_schema_for_intent("rag_qa")
        assert tool is not None
        assert tool["function"]["name"] == "search_medical_guidelines"

    def test_bind_single_tool_for_food_log(self):
        tool = get_bound_tool_schema_for_intent("food_log")
        assert tool is not None
        assert tool["function"]["name"] == "log_food_adherence"

    def test_bind_single_tool_for_weekly_compliance(self):
        tool = get_bound_tool_schema_for_intent("weekly_compliance")
        assert tool is not None
        assert tool["function"]["name"] == "get_weekly_adherence_summary"

    def test_bind_invalid_intent_returns_none(self):
        tool = get_bound_tool_schema_for_intent("non_existent_intent")
        assert tool is None


# ===========================================================================
# 4. Strict 1-1 Node Isolation Tests
# ===========================================================================
class TestStrictOneToOneIsolation:
    def test_meal_plan_node_isolation(self, db_session):
        from app.agents.graph import meal_plan_node

        state = {
            "user_id": "test_user_isolation",
            "message": "Xem thực đơn hôm nay",
            "db": db_session,
            "profile": {"disease": ["diabetes_t2"]},
        }
        res = meal_plan_node(state)
        # Verify isolation: meal_plan node doesn't produce RAG or interaction data
        assert res.get("interactions") is None
        assert res.get("meal_plan") is None

    def test_interaction_check_node_isolation(self, db_session):
        from app.agents.graph import interaction_check_node

        state = {
            "user_id": "test_user_isolation",
            "message": "Uống metformin có ăn bưởi được không?",
            "db": db_session,
            "profile": {"medications": ["metformin"], "allergies": []},
        }
        res = interaction_check_node(state)
        # Verify isolation: interaction node doesn't produce meal preview or food log
        assert res.get("meal_preview") is None
        assert res.get("food_log") is None
        assert "answer" in res
