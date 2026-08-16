"""Guardrail tests — refuse routing, citation enforcement, output safety."""

from __future__ import annotations

from app.agents.graph import reset_compiled_graph, run_agent
from app.guardrails.rules import enforce_output_safety, message_triggers_refuse
from app.guardrails.source_check import enforce_citation_guardrail
from app.schemas.meal_plan import AgentRunInput


class TestRefuseRules:
    def test_message_triggers_refuse(self):
        assert message_triggers_refuse("Giúp tôi tăng liều metformin")
        assert not message_triggers_refuse("Hôm nay nên ăn gì?")

    def test_enforce_output_safety_blocks_unsafe_text(self):
        answer, flags, force_refuse = enforce_output_safety("Bạn nên giảm liều metformin ngay.")
        assert force_refuse is True
        assert "unsafe_recommendation" in flags
        assert "bác sĩ" in answer.lower()


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

    def test_run_agent_rag_qa_without_citations_redacted(self):
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
