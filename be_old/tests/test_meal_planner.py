"""Tests for MealPlannerAgent & NutritionCalculator (Milestone 2).

Verifies schema compliance, allergy filtering, nutrition balancing, drug interaction swapping,
citations, and performance (<15s latency).
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

import pytest

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.agents.graph import run_agent
from app.agents.meal_planner_agent import generate_meal_plan, meal_planner_agent
from app.agents.nodes.profile_loader import _DEMO_PROFILES
from app.schemas.meal_plan import AgentRunInput, MealPlanOutput
from app.schemas.profile import PatientProfile
from app.services.nutrition_calculator import calculate_day_totals, validate_nutrition


# ============================================================
# Test: 7-Day Meal Plan Schema & Structure
# ============================================================

class TestMealPlanSchema:
    def test_meal_plan_returns_correct_schema(self):
        """MealPlannerAgent should return MealPlanOutput with 7 days."""
        profile = PatientProfile(
            id="p_test1",
            user_id="demo_patient_1",
            disease=["diabetes_t2"],
            medications=["metformin"],
            target_kcal=1800,
        )
        plan = generate_meal_plan(profile)

        assert isinstance(plan, MealPlanOutput)
        assert plan.status == "pending_review"
        assert len(plan.days) == 7

        for i, day in enumerate(plan.days, start=1):
            assert day.day_index == i
            assert len(day.meals) >= 3  # breakfast, lunch, dinner (+ snack)
            assert day.totals.kcal > 0

    def test_demo_profiles_generation(self):
        """Should successfully generate 7-day plans for all 3 demo profiles."""
        for user_id, raw_profile in _DEMO_PROFILES.items():
            profile = PatientProfile(**raw_profile)
            plan = meal_planner_agent(profile)

            assert plan is not None
            assert len(plan.days) == 7
            assert plan.user_id == user_id


# ============================================================
# Test: Hard Allergy Filter (MP-02)
# ============================================================

class TestAllergyFilter:
    def test_hard_allergy_seafood_excluded(self):
        """demo_patient_1 has allergy 'hải sản'; no seafood items should appear."""
        raw_profile = _DEMO_PROFILES["demo_patient_1"]
        profile = PatientProfile(**raw_profile)

        assert "hải sản" in profile.allergies

        plan = generate_meal_plan(profile)

        for day in plan.days:
            for meal in day.meals:
                for item in meal.items:
                    food_name_lower = item.name.lower()
                    food_id_lower = (item.food_id or "").lower()

                    seafood_keywords = ["tôm", "cua", "mực", "ngao", "ốc", "hải sản"]
                    for kw in seafood_keywords:
                        assert kw not in food_name_lower, f"Found allergic food '{item.name}' on day {day.day_index}"
                        assert kw not in food_id_lower


# ============================================================
# Test: Nutrition Calculator & Validation (MP-03)
# ============================================================

class TestNutritionCalculator:
    def test_daily_kcal_and_warnings(self):
        """Nutrition Calculator should calculate totals and issue warnings if target breached."""
        profile = PatientProfile(
            user_id="test_user",
            target_kcal=1800,
            restrictions={"carb_per_meal": 45, "sodium_daily": 1500},
        )
        plan = generate_meal_plan(profile)

        for day in plan.days:
            calculated_totals = calculate_day_totals(day)
            assert abs(calculated_totals.kcal - day.totals.kcal) < 1.0
            assert isinstance(day.warnings, list)

    def test_sodium_and_carb_restriction_warnings(self):
        """High sodium or high carb meals should trigger warnings."""
        profile = PatientProfile(
            user_id="test_restricted",
            target_kcal=1200,  # low target to force kcal warning
            restrictions={"carb_per_meal": 30, "sodium_daily": 500},
        )
        plan = generate_meal_plan(profile)

        has_any_warning = any(len(d.warnings) > 0 for d in plan.days)
        assert has_any_warning, "Expected warnings for very strict restrictions"


# ============================================================
# Test: Drug-Food Interaction Swapping (MP-05)
# ============================================================

class TestInteractionSwapping:
    def test_warfarin_interaction_swaps_dangerous_foods(self):
        """Patient taking Warfarin with dangerous food items should trigger swaps."""
        profile = PatientProfile(
            user_id="warfarin_user",
            disease=["hypertension"],
            medications=["warfarin"],
            target_kcal=1800,
        )
        plan = generate_meal_plan(profile)

        assert isinstance(plan.swaps, list)
        for day in plan.days:
            for meal in day.meals:
                for item in meal.items:
                    # 'Rau muống' causes dangerous interaction with Warfarin
                    assert "rau muống" not in item.name.lower(), (
                        f"Found dangerous food 'Rau muống' for Warfarin patient on day {day.day_index}"
                    )


# ============================================================
# Test: Citations (MP-01)
# ============================================================

class TestCitations:
    def test_citations_populated_for_items_and_plan(self):
        """Every food item and plan should contain source citations."""
        profile = PatientProfile(
            user_id="cite_test",
            disease=["diabetes_t2"],
        )
        plan = generate_meal_plan(profile)

        assert len(plan.citations) > 0
        assert "ada_diabetes.md" in plan.citations or "byt_vn_notes.md" in plan.citations

        for day in plan.days:
            for meal in day.meals:
                for item in meal.items:
                    assert len(item.citations) > 0, f"Item {item.name} missing citations"


# ============================================================
# Test: Latency & Performance (MP-07)
# ============================================================

class TestPerformance:
    def test_generation_latency_under_15s(self):
        """Meal plan generation should take less than 15 seconds (p95 target)."""
        profile = PatientProfile(**_DEMO_PROFILES["demo_patient_1"])

        start_time = time.time()
        plan = generate_meal_plan(profile)
        elapsed = time.time() - start_time

        assert elapsed < 15.0, f"Meal plan generation took {elapsed:.2f}s, expected <15s"
        assert len(plan.days) == 7


# ============================================================
# Test: LangGraph Facade Integration
# ============================================================

class TestFacadeIntegration:
    def test_run_agent_meal_plan(self):
        """run_agent facade should return meal plan intent and non-empty response."""
        input_data = AgentRunInput(
            user_id="demo_patient_1",
            message="Lập cho tôi thực đơn 7 ngày",
            force_intent="meal_plan",
        )
        output = run_agent(input_data)

        assert output.intent == "meal_plan"
        assert "thực đơn 7 ngày" in output.message.lower()
        assert output.meal_plan_id is not None
