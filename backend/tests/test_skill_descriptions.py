"""Unit tests for Skill Description Engineering & Negative Constraints (P-014 Phase 3).

Verifies that:
1. All 11 skills (7 Primitive + 4 Utility) conform to the 3-part schema.
2. Docstrings in primitive_skills and utility_skills strictly follow the 3-part format.
3. OpenAI tool schema & LLM intent prompt block generators produce correct metadata.
4. Disambiguation rules and Negative Constraints operate cleanly.
"""

from __future__ import annotations

import inspect

import pytest
from app.agents.nodes.intent_classifier import (
    _detect_intents_by_keywords,
)
from app.agents.skills import (
    SKILL_REGISTRY,
    SkillCategory,
    SkillDefinition,
    ask_clarification,
    check_allergy_match,
    check_drug_food_interaction,
    chit_chat_greeting,
    emergency_triage_check,
    format_intent_classification_prompt_snippet,
    get_all_skill_descriptions,
    get_doctor_notes,
    get_metrics_delta_advice,
    get_openai_tools_schema,
    get_patient_meal_plan,
    get_skills_by_category,
    get_weekly_adherence_summary,
    log_food_adherence,
    refuse_unsafe_medication,
    search_medical_guidelines,
)

EXPECTED_SKILL_NAMES = {
    # 7 Primitive skills
    "get_patient_meal_plan",
    "check_drug_food_interaction",
    "search_medical_guidelines",
    "log_food_adherence",
    "get_weekly_adherence_summary",
    "get_metrics_delta_advice",
    "get_doctor_notes",
    # 4 Utility skills
    "emergency_triage_check",
    "ask_clarification",
    "chit_chat_greeting",
    "refuse_unsafe_medication",
}


# ===========================================================================
# 1. Registry Integrity & Schema Tests
# ===========================================================================
class TestSkillRegistryIntegrity:
    def test_all_11_skills_registered(self):
        """Verify that exactly 11 skills are registered."""
        registered_names = set(SKILL_REGISTRY.keys())
        assert registered_names == EXPECTED_SKILL_NAMES
        assert len(registered_names) == 11

    def test_primitive_and_utility_category_counts(self):
        """Verify 7 primitive skills and 4 utility skills."""
        primitive_skills = get_skills_by_category(SkillCategory.PRIMITIVE)
        utility_skills = get_skills_by_category(SkillCategory.UTILITY)

        assert len(primitive_skills) == 7
        assert len(utility_skills) == 4

    def test_skill_definitions_have_mandatory_3_parts(self):
        """Verify that every skill definition contains Purpose, Triggers, and Negative Constraints."""
        for name, skill in SKILL_REGISTRY.items():
            assert isinstance(skill, SkillDefinition)
            assert skill.name == name
            # 1. [MỤC ĐÍCH]
            assert skill.purpose and len(skill.purpose.strip()) > 10, (
                f"Skill {name} is missing a valid purpose."
            )
            # 2. [KHI NÀO DÙNG]
            assert len(skill.when_to_use) >= 2, (
                f"Skill {name} should have at least 2 when_to_use triggers."
            )
            for trigger in skill.when_to_use:
                assert len(trigger.strip()) > 0
            # 3. [TUYỆT ĐỐI KHÔNG DÙNG]
            assert len(skill.never_use) >= 1, (
                f"Skill {name} must have at least 1 negative constraint (never_use)."
            )
            for negative in skill.never_use:
                assert len(negative.strip()) > 0

    def test_to_standard_description_structure(self):
        """Verify that standard 3-part formatting produces exact section headers."""
        all_descriptions = get_all_skill_descriptions()
        assert len(all_descriptions) == 11

        for name, desc in all_descriptions.items():
            assert "[MỤC ĐÍCH]:" in desc, f"Skill {name} description missing [MỤC ĐÍCH]"
            assert "[KHI NÀO DÙNG]:" in desc, f"Skill {name} description missing [KHI NÀO DÙNG]"
            assert "[TUYỆT ĐỐI KHÔNG DÙNG]:" in desc, f"Skill {name} description missing [TUYỆT ĐỐI KHÔNG DÙNG]"

    def test_openai_tool_schema_export(self):
        """Verify OpenAI tools schema formatting."""
        tools_schema = get_openai_tools_schema()
        assert len(tools_schema) == 11

        for tool in tools_schema:
            assert tool["type"] == "function"
            fn = tool["function"]
            assert fn["name"] in EXPECTED_SKILL_NAMES
            assert "KHI NÀO DÙNG:" in fn["description"]
            assert "TUYỆT ĐỐI KHÔNG DÙNG" in fn["description"]
            assert "parameters" in fn
            assert fn["parameters"]["type"] == "object"

    def test_prompt_snippet_generation(self):
        """Verify that intent prompt snippet aggregates all registered skill rules."""
        snippet = format_intent_classification_prompt_snippet()
        assert "meal_plan" in snippet
        assert "interaction_check" in snippet
        assert "rag_qa" in snippet
        assert "TUYỆT ĐỐI KHÔNG DÙNG" in snippet


# ===========================================================================
# 2. Docstrings Format Validation
# ===========================================================================
class TestSkillDocstrings:
    @pytest.mark.parametrize(
        "fn",
        [
            get_patient_meal_plan,
            check_drug_food_interaction,
            search_medical_guidelines,
            log_food_adherence,
            get_weekly_adherence_summary,
            get_metrics_delta_advice,
            get_doctor_notes,
            check_allergy_match,
        ],
    )
    def test_primitive_skills_docstrings_contain_3_parts(self, fn):
        """Ensure all primitive skill functions have standardized 3-part docstrings."""
        doc = inspect.getdoc(fn)
        assert doc is not None, f"Function {fn.__name__} has no docstring."
        assert "[MỤC ĐÍCH]:" in doc, f"Function {fn.__name__} missing [MỤC ĐÍCH] in docstring."
        assert "[KHI NÀO DÙNG]:" in doc, f"Function {fn.__name__} missing [KHI NÀO DÙNG] in docstring."
        assert "[TUYỆT ĐỐI KHÔNG DÙNG]:" in doc, f"Function {fn.__name__} missing [TUYỆT ĐỐI KHÔNG DÙNG] in docstring."

    @pytest.mark.parametrize(
        "fn",
        [
            emergency_triage_check,
            ask_clarification,
            chit_chat_greeting,
            refuse_unsafe_medication,
        ],
    )
    def test_utility_skills_docstrings_contain_3_parts(self, fn):
        """Ensure all utility skill functions have standardized 3-part docstrings."""
        doc = inspect.getdoc(fn)
        assert doc is not None, f"Function {fn.__name__} has no docstring."
        assert "[MỤC ĐÍCH]:" in doc, f"Function {fn.__name__} missing [MỤC ĐÍCH] in docstring."
        assert "[KHI NÀO DÙNG]:" in doc, f"Function {fn.__name__} missing [KHI NÀO DÙNG] in docstring."
        assert "[TUYỆT ĐỐI KHÔNG DÙNG]:" in doc, f"Function {fn.__name__} missing [TUYỆT ĐỐI KHÔNG DÙNG] in docstring."


# ===========================================================================
# 3. Disambiguation & Negative Constraints Routing Tests
# ===========================================================================
class TestDisambiguationRules:
    @pytest.mark.parametrize(
        ("query", "expected_intent"),
        [
            # RAG QA: General knowledge / list of foods
            ("Những loại rau nào người tiểu đường không nên ăn?", "rag_qa"),
            ("Chỉ số GI của gạo lứt là bao nhiêu?", "rag_qa"),
            ("Bị đái tháo đường type 2 cần kiêng những gì?", "rag_qa"),
            # Interaction Check: Specific food item or medication interaction
            ("Uống metformin có ăn bưởi được không?", "interaction_check"),
            ("Tôi ăn cá hồi có được không khi đang uống thuốc?", "interaction_check"),
            ("Thuốc này có kỵ rượu không?", "interaction_check"),
            # Meal Plan: View planned meals
            ("Hôm nay tôi nên ăn gì?", "meal_plan"),
            ("Cho tôi xem thực đơn sáng nay", "meal_plan"),
            ("Bác sĩ đã lên thực đơn tuần này cho tôi chưa?", "meal_plan"),
            # Food Log: Logged past meals
            ("Sáng nay tôi đã ăn phở bò", "food_log"),
            ("Hôm nay tôi đã ghi nhận những bữa ăn nào?", "food_log"),
            # Weekly Compliance
            ("Tuần này tôi tuân thủ thực đơn bao nhiêu phần trăm?", "weekly_compliance"),
            ("Báo cáo tuân thủ tuần này của tôi thế nào?", "weekly_compliance"),
            # Doctor Notes
            ("Bác sĩ có dặn dò gì mới không?", "doctor_note"),
            ("Xem lời nhắc từ bác sĩ điều trị", "doctor_note"),
            # Metrics Delta Advice
            ("Dạo này cân nặng của tôi thế nào?", "metrics_delta_advice"),
            ("Đường huyết của tôi có xu hướng tăng hay giảm?", "metrics_delta_advice"),
            # Refuse: Unsafe medication requests
            ("Tăng liều thuốc metformin giúp tôi", "refuse"),
            ("Kê cho tôi đơn thuốc hạ đường", "refuse"),
            # Greeting: Chit-chat
            ("Xin chào bạn", "greeting"),
            ("Cảm ơn bạn nhiều nhé", "greeting"),
            ("Tạm biệt bot", "greeting"),
        ],
    )
    def test_keyword_fallback_routing_accuracy(self, query: str, expected_intent: str):
        """Verify that routing correctly maps queries without false activations."""
        primary_intent, _ = _detect_intents_by_keywords(query)
        assert primary_intent == expected_intent, (
            f"Query '{query}' was classified as '{primary_intent}', expected '{expected_intent}'."
        )
