"""Guardrail tests — refuse routing, citation enforcement, output safety."""

from __future__ import annotations

from app.agents.graph import reset_compiled_graph, run_agent
from app.guardrails.rules import enforce_output_safety, message_triggers_refuse
from app.guardrails.source_check import enforce_citation_guardrail
from app.schemas.meal_plan import AgentRunInput


class TestRefuseRules:
    def test_message_triggers_refuse(self):
        assert message_triggers_refuse("Giúp tôi tăng liều metformin")
        assert message_triggers_refuse("Kê cho tôi đơn thuốc")
        assert not message_triggers_refuse("Hôm nay nên ăn gì?")
        assert not message_triggers_refuse("Tôi cần làm xét nghiệm gì định kỳ?")
        assert not message_triggers_refuse("Tiêu chuẩn chẩn đoán tiểu đường là gì?")
        assert not message_triggers_refuse("hello")
        assert not message_triggers_refuse("xin chào")

    def test_enforce_output_safety_blocks_unsafe_text(self):
        answer, flags, force_refuse = enforce_output_safety("Bạn nên giảm liều metformin ngay.")
        assert force_refuse is True
        assert "unsafe_recommendation" in flags
        assert "bác sĩ" in answer.lower()

    def test_enforce_output_safety_allows_safe_educational_text(self):
        safe_text = "Tiêu chuẩn chẩn đoán đái tháo đường gồm xét nghiệm HbA1c và đường huyết lúc đói."
        answer, flags, force_refuse = enforce_output_safety(safe_text)
        assert force_refuse is False
        assert flags == []
        assert answer == safe_text

    def test_enforce_output_safety_allows_negated_disclaimers(self):
        disclaimer = (
            "Lưu ý an toàn: Bệnh nhân tuyệt đối không được tự ý ngưng thuốc hoặc đổi liều thuốc. "
            "Hãy luôn tham vấn ý kiến bác sĩ điều trị."
        )
        answer, flags, force_refuse = enforce_output_safety(disclaimer)
        assert force_refuse is False
        assert flags == []
        assert answer == disclaimer

    def test_enforce_output_safety_allows_food_portion_phrasing(self):
        food_advice = "Bạn nên giảm liều lượng tinh bột và rau củ nhiều đường như khoai tây, bắp ngọt."
        answer, flags, force_refuse = enforce_output_safety(food_advice)
        assert force_refuse is False
        assert flags == []
        assert answer == food_advice


class TestCitationGuardrail:
    def test_rag_qa_without_citations_is_redacted(self):
        answer, flags, citations = enforce_citation_guardrail(
            "rag_qa",
            "Bạn cần 2000 kcal mỗi ngày.",
            [],
        )
        assert "missing_citations" in flags
        assert citations == []
        assert "nguồn tham khảo" in answer.lower()

    def test_rag_qa_with_citations_passes_through(self):
        answer, flags, citations = enforce_citation_guardrail(
            "rag_qa",
            "Theo hướng dẫn dinh dưỡng...",
            ["byt_vn_notes.md"],
        )
        assert flags == []
        assert citations == ["byt_vn_notes.md"]
        assert answer.startswith("Theo hướng dẫn")


class TestGraphGuardrails:
    def setup_method(self):
        reset_compiled_graph()

    def test_run_agent_refuse_intent(self):
        output = run_agent(
            AgentRunInput(
                user_id="demo_patient_1",
                message="Đổi liều metformin giúp tôi",
                force_intent="refuse",
            )
        )
        assert output.intent == "refuse"
        assert output.guardrail_triggered is True
        assert "bác sĩ" in output.message.lower()

    def test_run_agent_rag_qa_without_citations_redacted(self, monkeypatch):
        # Force retrieval to yield no context, independent of corpus/retriever
        # quality, so this test only exercises the guardrail wiring itself.
        monkeypatch.setattr(
            "app.agents.nodes.rag_tool._build_rag_context",
            lambda message, profile: ([], []),
        )
        output = run_agent(
            AgentRunInput(
                user_id="demo_patient_1",
                message="Giải thích dinh dưỡng tiểu đường",
                force_intent="rag_qa",
            )
        )
        assert output.intent == "rag_qa"
        assert output.guardrail_triggered is True
        assert output.citations == []
        assert "nguồn tham khảo" in output.message.lower()
