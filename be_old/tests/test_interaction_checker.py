"""Tests for InteractionCheckerAgent & KB (Milestone 3 / Milestone 2 requirement).

Verifies drug-food interaction matching, alias resolution, severity classifications, and guardrail rules.
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

    def test_warfarin_and_water_spinach_dangerous(self):
        """Warfarin + Rau muống should return 'Nguy hiểm' severity."""
        results = check_interactions(["warfarin"], ["rau muống"])
        assert len(results) > 0

        match = results[0]
        assert match.drug == "warfarin"
        assert match.food == "rau muống"
        assert match.severity == "Nguy hiểm"
        assert "Vitamin K" in match.mechanism

    def test_metformin_and_alcohol_dangerous(self):
        """Metformin + Rượu/Bia should return 'Nguy hiểm' severity."""
        results = check_interactions(["metformin"], ["bia"])
        assert len(results) > 0

        match = results[0]
        assert match.severity == "Nguy hiểm"

    def test_amlodipine_and_grapefruit_dangerous(self):
        """Amlodipine + Bưởi should return 'Nguy hiểm' severity."""
        results = check_interactions(["amlodipine"], ["bưởi"])
        assert len(results) > 0
        assert results[0].severity == "Nguy hiểm"

    def test_alias_matching_without_accents(self):
        """Should match aliases and unaccented terms like 'coumadin' or 'rau muong'."""
        results = check_interactions(["coumadin"], ["rau muong"])
        assert len(results) > 0
        assert results[0].severity == "Nguy hiểm"

    def test_no_match_returns_empty_list(self):
        """Unrelated drug and food should return empty list without hallucination."""
        results = check_interactions(["metformin"], ["cơm trắng"])
        assert len(results) == 0

    def test_guardrail_recommendation_safety(self):
        """Recommendations must not advise changing or stopping prescribed medication doses."""
        results = check_interactions(["warfarin", "metformin", "amlodipine"], ["rau muống", "bia", "bưởi"])

        forbidden_phrases = ["ngưng thuốc", "bỏ thuốc", "đổi liều", "tăng liều", "giảm liều", "tự ý ngắt thuốc"]
        for item in results:
            rec_lower = item.recommendation.lower()
            for phrase in forbidden_phrases:
                assert phrase not in rec_lower, f"Found unsafe phrase '{phrase}' in recommendation: {item.recommendation}"

    def test_agent_input_output_schema(self):
        """interaction_checker_agent should accept InteractionCheckInput and return InteractionCheckOutput."""
        input_data = InteractionCheckInput(
            medications=["allopurinol"],
            foods=["bia"],
        )
        output = interaction_checker_agent(input_data)

        assert len(output.interactions) > 0
        assert output.interactions[0].drug == "allopurinol"
        assert output.interactions[0].severity == "Nguy hiểm"
