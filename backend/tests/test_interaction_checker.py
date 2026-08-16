"""Tests for InteractionCheckerAgent & KB (Diabetes focused).

Verifies drug-food interaction matching, alias resolution, severity classifications, and guardrail rules for diabetes medications.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.agents.interaction_checker_agent import (
    check_interactions,
    interaction_checker_agent,
    load_interaction_kb,
)
from app.schemas.meal_plan import InteractionCheckInput


class TestInteractionChecker:
    def test_kb_has_at_least_20_rules(self):
        """KB should contain at least 20 interaction rules."""
        kb = load_interaction_kb()
        assert len(kb) >= 20, f"Expected ≥20 rules in KB, found {len(kb)}"

    def test_glipizide_and_alcohol_dangerous(self):
        """Glipizide + Rượu should return 'Nguy hiểm' severity for severe hypoglycemia risk."""
        results = check_interactions(["glipizide"], ["rượu"])
        assert len(results) > 0

        match = results[0]
        assert match.drug == "glipizide"
        assert match.severity == "Nguy hiểm"
        assert "hạ đường huyết" in match.mechanism.lower()

    def test_metformin_and_alcohol_dangerous(self):
        """Metformin + Rượu/Bia should return 'Nguy hiểm' severity."""
        results = check_interactions(["metformin"], ["bia"])
        assert len(results) > 0

        match = results[0]
        assert match.severity == "Nguy hiểm"

    def test_insulin_and_alcohol_dangerous(self):
        """Insulin + Rượu should return dangerous severity (food or clinical rule)."""
        results = check_interactions(["insulin"], ["rượu"])
        assert len(results) > 0
        assert any(r.severity.startswith("Nguy hiểm") for r in results)

    def test_alias_matching_without_accents(self):
        """Should match generic drug name + food via legacy KB."""
        results = check_interactions(["glipizide"], ["rượu"])
        assert len(results) > 0
        food_matches = [r for r in results if r.food not in ("[Cảnh báo chung về bữa ăn]",)]
        assert any(r.severity == "Nguy hiểm" for r in food_matches)

    def test_no_match_returns_empty_list(self):
        """Unrelated drug and food should return empty list without hallucination."""
        results = check_interactions(["metformin"], ["cơm gạo lứt"])
        assert len(results) == 0

    def test_guardrail_recommendation_safety(self):
        """Recommendations must not advise changing or stopping prescribed medication doses."""
        results = check_interactions(["glipizide", "metformin", "insulin"], ["rượu", "bia", "mướp đắng"])

        forbidden_phrases = ["ngưng thuốc", "bỏ thuốc", "đổi liều", "tăng liều", "giảm liều", "tự ý ngắt thuốc"]
        for item in results:
            rec_lower = item.recommendation.lower()
            for phrase in forbidden_phrases:
                assert phrase not in rec_lower, f"Found unsafe phrase '{phrase}' in recommendation: {item.recommendation}"

    def test_agent_input_output_schema(self):
        """interaction_checker_agent should accept InteractionCheckInput and return InteractionCheckOutput."""
        input_data = InteractionCheckInput(
            medications=["metformin"],
            foods=["bia"],
        )
        output = interaction_checker_agent(input_data)

        assert len(output.interactions) > 0
        assert any(i.drug == "metformin" for i in output.interactions)
        assert any(i.severity.startswith("Nguy hiểm") for i in output.interactions)
