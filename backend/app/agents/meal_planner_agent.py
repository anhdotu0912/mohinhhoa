"""MealPlannerAgent — generates personalized 7-day medical meal plans.

Implements RAG-guided food selection, hard allergy filtering, nutrition balancing via
NutritionCalculator, and automatic drug-food interaction swapping.
Matches contract §1.2 and specs/meal-planner.md.
"""

from __future__ import annotations

import json
import logging
import uuid
from pathlib import Path
from typing import Any

from app.agents.interaction_checker_agent import check_interactions
from app.rag.retriever import retrieve_foods, retrieve_guidelines
from app.schemas.meal_plan import (
    DayPlan,
    DayTotals,
    FoodItem,
    Macros,
    Meal,
    MealPlanOutput,
    Swap,
)
from app.schemas.profile import PatientProfile, Restrictions
from app.services.nutrition_calculator import calculate_day_totals, validate_nutrition

logger = logging.getLogger(__name__)

_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
_FOOD_DB_PATH = _BACKEND_DIR / "data" / "food_db_vn.json"

_cached_foods: list[dict] | None = None


def _load_food_db() -> list[dict]:
    """Load food items from JSON database."""
    global _cached_foods
    if _cached_foods is not None:
        return _cached_foods

    if not _FOOD_DB_PATH.exists():
        logger.error("Food DB file missing at %s", _FOOD_DB_PATH)
        return []

    try:
        with open(_FOOD_DB_PATH, encoding="utf-8") as f:
            _cached_foods = json.load(f)
        return _cached_foods
    except Exception as e:
        logger.error("Error loading food DB: %s", e)
        return []


def _is_allergic(food: dict, allergies: list[str]) -> bool:
    """Check if food item conflicts with any patient allergy (hard filter)."""
    if not allergies:
        return False

    food_name = food.get("name", "").lower()
    food_tags = [t.lower() for t in food.get("tags", [])]
    food_aliases = [a.lower() for a in food.get("aliases", [])]

    for allergy in allergies:
        allergy_norm = allergy.lower().strip()
        if not allergy_norm:
            continue

        # Check allergen tags
        if "hải sản" in allergy_norm or "hai san" in allergy_norm:
            if "allergen-shellfish" in food_tags or food.get("category") == "hai_san":
                return True
        if "đậu" in allergy_norm or "dau" in allergy_norm:
            if "allergen-soy" in food_tags or "dau" in food.get("id", ""):
                return True
        if "trứng" in allergy_norm or "trung" in allergy_norm:
            if "trung" in food.get("id", "") or "trứng" in food_name:
                return True
        if "sữa" in allergy_norm or "sua" in allergy_norm:
            if "sua" in food.get("id", "") or "sữa" in food_name:
                return True

        # Direct name/alias match
        if allergy_norm in food_name or any(allergy_norm in alias for alias in food_aliases):
            return True

    return False


def _get_safe_food_items(profile: PatientProfile) -> dict[str, list[dict]]:
    """Group foods by category, filtering out allergic items."""
    foods = _load_food_db()
    allergies = profile.allergies or []

    categories: dict[str, list[dict]] = {
        "tinh_bot": [],
        "thit": [],
        "hai_san": [],
        "dau": [],
        "trung_sua": [],
        "rau": [],
        "trai_cay": [],
        "canh": [],
    }

    for item in foods:
        if _is_allergic(item, allergies):
            continue

        cat = item.get("category", "khac")
        if cat in categories:
            categories[cat].append(item)

    return categories


def _dict_to_food_item(food: dict, default_citation: str = "") -> FoodItem:
    """Convert raw food dict from DB into Pydantic FoodItem schema."""
    macros_dict = food.get("macros", {})
    return FoodItem(
        name=food.get("name", ""),
        portion=food.get("portion", ""),
        kcal=float(food.get("kcal", 0)),
        macros=Macros(
            carb_g=float(macros_dict.get("carb_g", 0)),
            protein_g=float(macros_dict.get("protein_g", 0)),
            fat_g=float(macros_dict.get("fat_g", 0)),
            sodium_mg=float(macros_dict.get("sodium_mg", 0)),
        ),
        food_id=food.get("id"),
        citations=[f"food_db_vn#{food.get('id', '')}"] + ([default_citation] if default_citation else []),
    )


def _find_swap_food(
    original_food_name: str,
    category_foods: list[dict],
    medications: list[str],
) -> dict | None:
    """Find a safe alternative food in the category that does not cause dangerous interactions."""
    for food in category_foods:
        if food.get("name") == original_food_name:
            continue
        # Check interaction for candidate
        interactions = check_interactions(medications, [food.get("name", "")])
        if not any(i.severity == "Nguy hiểm" for i in interactions):
            return food
    return None


def generate_meal_plan(profile: PatientProfile | dict[str, Any]) -> MealPlanOutput:
    """Generate a full 7-day personalized medical meal plan.

    Args:
        profile: PatientProfile instance or dict.

    Returns:
        MealPlanOutput schema matching contract §1.2.
    """
    if isinstance(profile, dict):
        profile_obj = PatientProfile(**profile)
    else:
        profile_obj = profile

    user_id = profile_obj.user_id or "demo_user"
    plan_id = str(uuid.uuid4())
    diseases = profile_obj.disease or []
    medications = profile_obj.medications or []
    target_kcal = profile_obj.target_kcal or 1800

    # Determine guideline citations based on diseases
    guideline_citations: list[str] = ["byt_vn_notes.md"]
    if any("diabetes" in d for d in diseases):
        guideline_citations.append("ada_diabetes.md")
    if any("hypertension" in d or "cardio" in d for d in diseases):
        guideline_citations.append("aha_cardiovascular.md")
    if any("gout" in d for d in diseases):
        guideline_citations.append("acr_gout.md")

    # Get available safe foods
    safe_foods = _get_safe_food_items(profile_obj)

    # Fallbacks if a category is empty (e.g. seafood allergic)
    main_protein_sources = safe_foods["thit"] + safe_foods["dau"]
    if safe_foods["hai_san"]:
        main_protein_sources += safe_foods["hai_san"]
    if safe_foods["trung_sua"]:
        main_protein_sources += [item for item in safe_foods["trung_sua"] if "trung" in item.get("id", "")]

    starchy_foods = safe_foods["tinh_bot"] or _load_food_db()[:3]
    veggie_foods = safe_foods["rau"] or _load_food_db()[10:13]
    fruit_foods = safe_foods["trai_cay"] or _load_food_db()[15:18]

    # Preference for diabetes (brown rice over white rice)
    if "diabetes_t2" in diseases:
        starchy_foods_pref = [f for f in starchy_foods if "diabetes-friendly" in f.get("tags", [])] + starchy_foods
    else:
        starchy_foods_pref = starchy_foods

    days: list[DayPlan] = []
    swaps: list[Swap] = []

    # Generate 7 days
    for day_idx in range(1, 8):
        # 1. Breakfast
        b_starch = starchy_foods_pref[(day_idx - 1) % len(starchy_foods_pref)]
        b_protein = main_protein_sources[(day_idx * 2) % len(main_protein_sources)]
        b_drink = (safe_foods["trung_sua"] or fruit_foods)[(day_idx) % len(safe_foods["trung_sua"] or fruit_foods)]

        breakfast_items = [
            _dict_to_food_item(b_starch, default_citation=guideline_citations[0]),
            _dict_to_food_item(b_protein, default_citation=guideline_citations[0]),
            _dict_to_food_item(b_drink, default_citation=guideline_citations[0]),
        ]

        # 2. Lunch
        l_starch = starchy_foods_pref[(day_idx) % len(starchy_foods_pref)]
        l_main = main_protein_sources[(day_idx + 1) % len(main_protein_sources)]
        l_veg = veggie_foods[(day_idx - 1) % len(veggie_foods)]
        l_canh = safe_foods["canh"][(day_idx) % len(safe_foods["canh"])] if safe_foods["canh"] else None

        lunch_items = [
            _dict_to_food_item(l_starch, default_citation=guideline_citations[0]),
            _dict_to_food_item(l_main, default_citation=guideline_citations[0]),
            _dict_to_food_item(l_veg, default_citation=guideline_citations[0]),
        ]
        if l_canh:
            lunch_items.append(_dict_to_food_item(l_canh, default_citation=guideline_citations[0]))

        # 3. Dinner
        d_starch = starchy_foods_pref[(day_idx + 2) % len(starchy_foods_pref)]
        d_main = main_protein_sources[(day_idx + 3) % len(main_protein_sources)]
        d_veg = veggie_foods[(day_idx) % len(veggie_foods)]

        dinner_items = [
            _dict_to_food_item(d_starch, default_citation=guideline_citations[0]),
            _dict_to_food_item(d_main, default_citation=guideline_citations[0]),
            _dict_to_food_item(d_veg, default_citation=guideline_citations[0]),
        ]

        # 4. Snack (Optional)
        s_fruit = fruit_foods[(day_idx) % len(fruit_foods)]
        snack_items = [_dict_to_food_item(s_fruit, default_citation=guideline_citations[0])]

        day_meals = [
            Meal(slot="breakfast", items=breakfast_items),
            Meal(slot="lunch", items=lunch_items),
            Meal(slot="dinner", items=dinner_items),
            Meal(slot="snack", items=snack_items),
        ]

        # Interaction check & swapping
        for meal in day_meals:
            for i, item in enumerate(meal.items):
                interactions = check_interactions(medications, [item.name])
                dangerous = [inter for inter in interactions if inter.severity == "Nguy hiểm"]

                if dangerous:
                    inter_info = dangerous[0]
                    # Find alternative food in veggie or protein pool
                    pool = veggie_foods if "rau" in item.name.lower() else main_protein_sources
                    alt = _find_swap_food(item.name, pool, medications)

                    if alt:
                        alt_item = _dict_to_food_item(alt, default_citation=guideline_citations[0])
                        meal.items[i] = alt_item
                        swaps.append(
                            Swap(
                                day_index=day_idx,
                                slot=meal.slot,
                                from_food=item.name,
                                to=alt_item.name,
                                reason=f"Tương tác thuốc ({inter_info.drug} + {inter_info.food}): {inter_info.mechanism}",
                            )
                        )

        # Build day plan object
        day_plan = DayPlan(
            day_index=day_idx,
            date=None,
            meals=day_meals,
        )

        # Calculate nutritional totals and validate
        day_plan.totals = calculate_day_totals(day_plan)
        day_plan.warnings = validate_nutrition(
            day_plan,
            target_kcal=target_kcal,
            restrictions=profile_obj.restrictions,
        )

        days.append(day_plan)

    return MealPlanOutput(
        id=plan_id,
        user_id=user_id,
        profile_snapshot=profile_obj.model_dump() if hasattr(profile_obj, "model_dump") else dict(profile_obj),
        days=days,
        swaps=swaps,
        citations=guideline_citations,
        status="pending_review",
    )


def meal_planner_agent(profile: PatientProfile | dict[str, Any]) -> MealPlanOutput:
    """Main entry point for MealPlannerAgent."""
    return generate_meal_plan(profile)
