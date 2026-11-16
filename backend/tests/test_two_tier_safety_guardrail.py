"""Unit tests for Two-Tier Clinical Safety Architecture & Deterministic Guardrail (P-014).

Tests:
1. RAG prompt generation is clean and does not leak unprompted medications/allergies.
2. Deterministic Food Safety Guardrail leaves clean answers untouched when no conflicts exist.
3. Guardrail attaches targeted medical footnotes when food-drug conflicts (e.g. Warfarin + Spinach) are present.
4. Guardrail attaches targeted allergy footnotes when allergen foods are present.
5. Integration with LangGraph apply_guardrails node.
"""

from __future__ import annotations

import pytest
from app.agents.graph import apply_guardrails
from app.agents.nodes.rag_tool import _build_rag_prompt
from app.guardrails.food_safety import enforce_food_safety_guardrail


class TestTier1LeanGeneration:
    def test_rag_prompt_focuses_strictly_on_query_without_leaking_unneeded_profile(self):
        """Prompt should contain disease context and negative constraints, without bloating medications/allergies into general FAQ."""
        mock_chunks = [
            {"chunk_id": "chunk_1", "text": "Khuyến nghị dinh dưỡng cho người đái tháo đường.", "source": "QĐ 5481", "score": 0.9}
        ]
        profile = {
            "disease": ["diabetes_t2"],
            "medications": ["metformin"],
            "allergies": ["hải sản"],
        }
        prompt = _build_rag_prompt("Những loại rau nào người tiểu đường không nên ăn?", mock_chunks, profile)

        # Must have disease context and negative constraints
        assert "diabetes_t2" in prompt
        assert "TUYỆT ĐỐI KHÔNG SUY DIỄN LAN MAN" in prompt
        assert "Những loại rau nào người tiểu đường không nên ăn?" in prompt


class TestTier2DeterministicFoodSafetyGuardrail:
    @pytest.mark.parametrize(
        "answer",
        [
            "Để được tư vấn chính xác và cá thể hóa, hãy hỏi bác sĩ điều trị.",
            "Thực đơn được cá nhân hóa theo hồ sơ của bạn.",
            "Cần xem xét các trường hợp cá biệt.",
            "Sở thích và cá tính của mỗi người khác nhau.",
        ],
    )
    def test_non_food_ca_phrases_do_not_trigger_seafood_allergy(self, answer):
        updated, flags = enforce_food_safety_guardrail(
            answer=answer, medications=[], allergies=["hải sản"]
        )
        assert updated == answer
        assert flags == []

    @pytest.mark.parametrize(
        "answer",
        [
            "Bữa trưa có cá hấp.",
            "Thực đơn cá nhân hóa: cá hồi hấp với rau.",
        ],
    )
    def test_actual_fish_still_triggers_seafood_allergy(self, answer):
        _, flags = enforce_food_safety_guardrail(
            answer=answer, medications=[], allergies=["hải sản"]
        )
        assert "targeted_allergy_alert" in flags

    def test_clean_safe_answer_remains_untouched(self):
        """When answer mentions safe vegetables for a Metformin patient, no false-positive alert is added."""
        clean_answer = (
            "🎯 **Kết luận trực diện:**\n"
            "Người đái tháo đường nên ăn các loại rau không chứa tinh bột như dưa chuột, xà lách, bí xanh.\n"
            "Nên hạn chế khoai tây, bắp ngô."
        )
        updated, flags = enforce_food_safety_guardrail(
            answer=clean_answer,
            medications=["metformin"],
            allergies=["hải sản"],
        )

        assert updated == clean_answer
        assert len(flags) == 0
        assert "Lưu ý an toàn theo hồ sơ" not in updated

    def test_drug_food_interaction_targeted_alert_injected(self):
        """When answer mentions 'cải bó xôi' for a patient taking Warfarin, targeted Vitamin K warning is injected."""
        answer_with_spinach = (
            "🎯 **Các loại rau lá xanh nên ăn:**\n"
            "• Xà lách, rau muống, cải bó xôi, dưa chuột.\n"
            "Các loại rau này có chỉ số GI thấp và giàu chất xơ."
        )
        updated, flags = enforce_food_safety_guardrail(
            answer=answer_with_spinach,
            medications=["warfarin"],
            allergies=[],
        )

        assert "targeted_drug_food_interaction_alert" in flags
        assert "⚠️ **Lưu ý an toàn theo hồ sơ của bạn:**" in updated
        assert "Warfarin" in updated
        assert "Vitamin K" in updated

    def test_allergy_conflict_targeted_alert_injected(self):
        """When answer mentions 'tôm' for a patient with seafood allergy, targeted allergy alert is injected."""
        answer_with_shrimp = (
            "🎯 **Gợi ý món ăn nhẹ lành mạnh:**\n"
            "• Salad rau bina trộn tôm hấp ít dầu mỡ."
        )
        updated, flags = enforce_food_safety_guardrail(
            answer=answer_with_shrimp,
            medications=["metformin"],
            allergies=["hải sản"],
        )

        assert "targeted_allergy_alert" in flags
        assert "⚠️ **Lưu ý an toàn theo hồ sơ của bạn:**" in updated
        assert "Hải sản" in updated
        assert "Tôm" in updated

    def test_apply_guardrails_integration_in_graph(self):
        """Full LangGraph apply_guardrails node correctly checks citations and food safety."""
        state = {
            "intent": "rag_qa",
            "answer": "Gợi ý thực phẩm tốt: cải bó xôi và bông cải xanh. Tham khảo: [Bộ Y Tế].",
            "citations": ["QĐ 5481/QĐ-BYT"],
            "guardrail_flags": [],
            "profile": {
                "medications": ["warfarin"],
                "allergies": [],
            },
        }

        final_state = apply_guardrails(state)

        assert "targeted_drug_food_interaction_alert" in final_state["guardrail_flags"]
        assert "Warfarin" in final_state["answer"]
        assert "QĐ 5481/QĐ-BYT" in final_state["citations"]
