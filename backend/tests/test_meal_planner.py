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
            for meal in day.meals:
                for item in meal.items:
                    assert item.alternatives is not None
                    for alt in item.alternatives:
                        assert alt.name
                        assert alt.alternatives == []

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

    def test_standard_restrictions_have_no_hard_breaches(self):
        """Demo-like limits should be enforced (scale/repair), not only warned."""
        profile = PatientProfile(
            user_id="balanced_user",
            disease=["diabetes_t2"],
            target_kcal=1800,
            restrictions={"carb_per_meal": 45, "sodium_daily": 2300},
        )
        plan = generate_meal_plan(profile)

        for day in plan.days:
            assert 1800 * 0.9 <= day.totals.kcal <= 1800 * 1.1, (
                f"Day {day.day_index} kcal={day.totals.kcal} outside ±10% band"
            )
            assert day.totals.sodium_mg <= 2300
            for meal in day.meals:
                meal_carb = sum(i.macros.carb_g for i in meal.items)
                assert meal_carb <= 45.05, (
                    f"Day {day.day_index} {meal.slot} carb={meal_carb} > 45"
                )
            hard = [w for w in day.warnings if "sắp chạm" not in w]
            assert hard == [], f"Day {day.day_index} unexpected warnings: {hard}"

    def test_strict_restrictions_comply_or_warn(self):
        """Strict but feasible limits: repair should comply; else leave warnings."""
        profile = PatientProfile(
            user_id="test_restricted",
            target_kcal=1200,
            restrictions={"carb_per_meal": 30, "sodium_daily": 500},
        )
        plan = generate_meal_plan(profile)

        for day in plan.days:
            hard = [w for w in day.warnings if "sắp chạm" not in w]
            if hard:
                continue
            assert 1200 * 0.9 <= day.totals.kcal <= 1200 * 1.1
            assert day.totals.sodium_mg <= 500
            for meal in day.meals:
                assert sum(i.macros.carb_g for i in meal.items) <= 30.05

    def test_impossible_restrictions_still_warn(self):
        """Catalog cannot satisfy tiny carb/sodium budgets — warnings remain."""
        profile = PatientProfile(
            user_id="impossible",
            target_kcal=2200,
            restrictions={"carb_per_meal": 8, "sodium_daily": 60},
        )
        plan = generate_meal_plan(profile)
        assert any(len(d.warnings) > 0 for d in plan.days)


# ============================================================
# Test: Drug-Food Interaction Swapping (MP-05)
# ============================================================

class TestInteractionSwapping:
    def test_diabetes_interaction_swaps_dangerous_foods(self):
        """Diabetes patient taking Metformin/Glipizide should have safe food swaps for dangerous items."""
        profile = PatientProfile(
            user_id="diabetes_user",
            disease=["diabetes_t2"],
            medications=["metformin", "glipizide"],
            target_kcal=1800,
        )
        plan = generate_meal_plan(profile)

        assert isinstance(plan.swaps, list)
        for day in plan.days:
            for meal in day.meals:
                for item in meal.items:
                    assert "rượu" not in item.name.lower()
                    assert "bia" not in item.name.lower()


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


# ============================================================
# Test: DB-backed catalog + JSON fallback
# ============================================================

class TestDbCatalog:
    def test_generate_meal_plan_uses_db_catalog(self, db_session):
        """When nutrition tables are seeded, plan items should cite DB sources."""
        from app.models.nutrition_catalog import FoodComposition, Recipe

        db_session.add(
            FoodComposition(
                id="FOOD_TEST_FISH",
                name_vi="Cá hồi",
                food_group="Thủy sản và sản phẩm",
                basis_g=100,
                nutrition={
                    "energy_kcal": 200,
                    "protein_g": 20,
                    "fat_g": 10,
                    "carbohydrate_g": 0,
                    "sodium_mg": 50,
                },
            )
        )
        db_session.add(
            Recipe(
                id="RECIPE_TEST_001",
                name_vi="Cá hồi hấp test",
                category="dam_luoc_hap_nuong",
                cooking_method="hap",
                servings=1,
                ingredients=[
                    {
                        "food_id": "FOOD_TEST_FISH",
                        "role": "protein",
                        "name_vi": "Cá hồi",
                    }
                ],
                nutrition={
                    "energy_kcal": 200,
                    "carbohydrate_g": 0,
                    "protein_g": 22,
                    "fat_g": 12,
                    "sodium_mg": 55,
                },
            )
        )
        db_session.add(
            FoodComposition(
                id="FOOD_TEST_FRUIT",
                name_vi="Táo test",
                food_group="Quả chín",
                basis_g=100,
                nutrition={
                    "energy_kcal": 55,
                    "carbohydrate_g": 14,
                    "protein_g": 0.3,
                    "fat_g": 0.2,
                    "sodium_mg": 1,
                },
            )
        )
        db_session.commit()

        profile = PatientProfile(user_id="db_catalog_test", target_kcal=1800)
        plan = generate_meal_plan(profile, db=db_session)

        assert len(plan.days) == 7
        all_citations = [
            citation
            for day in plan.days
            for meal in day.meals
            for item in meal.items
            for citation in item.citations
        ]
        assert any("recipes_dm2#" in c for c in all_citations) or any(
            "foods_vn#" in c for c in all_citations
        )

    def test_empty_db_falls_back_to_json_catalog(self, db_session):
        """Empty nutrition tables should fall back to curated JSON catalog."""
        profile = PatientProfile(user_id="fallback_test", target_kcal=1800)
        plan = generate_meal_plan(profile, db=db_session)

        assert len(plan.days) == 7
        assert plan.status == "pending_review"
        all_citations = [
            citation
            for day in plan.days
            for meal in day.meals
            for item in meal.items
            for citation in item.citations
        ]
        assert any("food_catalog_demo#" in c for c in all_citations)
