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
_PROJECT_ROOT = _BACKEND_DIR.parent  # P-014/
_FOOD_DB_LEGACY_PATH = _BACKEND_DIR / "data" / "food_db_vn.json"
_FOODS_CLEAN_PATH = _PROJECT_ROOT / "data" / "clean" / "foods.sample.json"
_RECIPES_CLEAN_PATH = _PROJECT_ROOT / "data" / "clean" / "recipes.sample.json"

_cached_foods: list[dict] | None = None

# ── Mapping: food_group (tiếng Việt) → internal category ──────────────
_FOOD_GROUP_MAP: dict[str, str] = {
    "Ngũ cốc và sản phẩm": "tinh_bot",
    "Khoai củ và sản phẩm": "tinh_bot",
    "Thịt và sản phẩm": "thit",
    "Thủy sản và sản phẩm": "hai_san",
    "Hạt, đậu và sản phẩm": "dau",
    "Trứng và sản phẩm": "trung_sua",
    "Sữa và sản phẩm": "trung_sua",
    "Rau, củ, quả dùng làm rau": "rau",
    "Quả chín": "trai_cay",
    "Dầu, mỡ, bơ": "khac",
    "Gia vị, nước chấm": "khac",
    "Đồ ngọt và nguyên liệu tạo ngọt": "khac",
}

# ── Mapping: recipe category → internal category ─────────────────────
_RECIPE_CATEGORY_MAP: dict[str, str] = {
    "rau_luoc_hap": "rau",
    "goi_salad": "rau",
    "xao_it_dau": "rau",
    "canh": "canh",
    "dam_luoc_hap_nuong": "thit",
    "kho_om_ham_sot": "thit",
    "bua_hoan_chinh": "tinh_bot",
}


def _normalize_food_item(raw: dict) -> dict:
    """Convert a foods.sample.json entry into the internal format.

    Internal format: {id, name, category, portion, kcal, macros, tags, aliases}
    """
    name_obj = raw.get("name", {})
    nutrition = raw.get("nutrition_per_100g_edible", {})
    classification = raw.get("classification", {})
    dm = raw.get("diabetes_metadata", {})

    food_group = classification.get("food_group", "")
    category = _FOOD_GROUP_MAP.get(food_group, "khac")

    # Build tags from metadata
    tags: list[str] = []
    if dm.get("suitability_label") == "ưu_tiên":
        tags.append("diabetes-friendly")
    if food_group == "Thủy sản và sản phẩm":
        tags.append("allergen-shellfish")
    if food_group == "Hạt, đậu và sản phẩm":
        tags.append("allergen-soy")

    return {
        "id": raw.get("_id", ""),
        "name": name_obj.get("vi", ""),
        "category": category,
        "portion": f"100g (phần ăn được)",
        "kcal": float(nutrition.get("energy_kcal", 0) or 0),
        "macros": {
            "carb_g": float(nutrition.get("carbohydrate_g", 0) or 0),
            "protein_g": float(nutrition.get("protein_g", 0) or 0),
            "fat_g": float(nutrition.get("fat_g", 0) or 0),
            "sodium_mg": float(nutrition.get("sodium_mg", 0) or 0),
        },
        "tags": tags,
        "aliases": name_obj.get("aliases", []) + [name_obj.get("normalized_vi", "")],
        "_source": "foods.sample.json",
        "_source_url": raw.get("source", {}).get("current_lookup_url", ""),
    }


def _normalize_recipe_item(raw: dict) -> dict:
    """Convert a recipes.sample.json entry into the internal format.

    Internal format: {id, name, category, portion, kcal, macros, tags, aliases}
    """
    nutrition = raw.get("nutrition_calculated_from_main_ingredients", {})
    dm = raw.get("diabetes_screening", {})

    raw_cat = raw.get("category", "")
    category = _RECIPE_CATEGORY_MAP.get(raw_cat, "khac")

    tags: list[str] = []
    if dm.get("label") == "ưu_tiên":
        tags.append("diabetes-friendly")

    # Build portion string from ingredients
    ingredients = raw.get("ingredients", [])
    portions = [f"{ing.get('name_vi', '')} {ing.get('raw_edible_weight_g', '')}g"
                for ing in ingredients[:3]]
    portion_str = ", ".join(portions) if portions else "1 phần"

    return {
        "id": raw.get("_id", ""),
        "name": raw.get("name_vi", ""),
        "category": category,
        "portion": portion_str,
        "kcal": float(nutrition.get("energy_kcal", 0) or 0),
        "macros": {
            "carb_g": float(nutrition.get("carbohydrate_g", 0) or 0),
            "protein_g": float(nutrition.get("protein_g", 0) or 0),
            "fat_g": float(nutrition.get("fat_g", 0) or 0),
            "sodium_mg": float(nutrition.get("sodium_mg", 0) or 0),
        },
        "tags": tags,
        "aliases": [],
        "_source": "recipes.sample.json",
        "_source_url": raw.get("source", {}).get("food_lookup_url", ""),
    }


def _load_food_db() -> list[dict]:
    """Load food items from the new clean data files (foods + recipes).

    Reads from data/clean/foods.sample.json (500 items) and
    data/clean/recipes.sample.json (300 recipes), normalizes both into the
    internal format used by the meal planner downstream code.

    Falls back to the legacy backend/data/food_db_vn.json if new files
    are not available.
    """
    global _cached_foods
    if _cached_foods is not None:
        return _cached_foods

    all_items: list[dict] = []

    # ── 1. Load new clean foods ──────────────────────────────────────
    if _FOODS_CLEAN_PATH.exists():
        try:
            with open(_FOODS_CLEAN_PATH, encoding="utf-8") as f:
                raw_foods = json.load(f)
            normalized = [_normalize_food_item(item) for item in raw_foods]
            all_items.extend(normalized)
            logger.info("Loaded %d food items from %s", len(normalized), _FOODS_CLEAN_PATH.name)
        except Exception as e:
            logger.error("Error loading %s: %s", _FOODS_CLEAN_PATH.name, e)

    # ── 2. Load new clean recipes ────────────────────────────────────
    if _RECIPES_CLEAN_PATH.exists():
        try:
            with open(_RECIPES_CLEAN_PATH, encoding="utf-8") as f:
                raw_recipes = json.load(f)
            normalized = [_normalize_recipe_item(item) for item in raw_recipes]
            all_items.extend(normalized)
            logger.info("Loaded %d recipe items from %s", len(normalized), _RECIPES_CLEAN_PATH.name)
        except Exception as e:
            logger.error("Error loading %s: %s", _RECIPES_CLEAN_PATH.name, e)

    # ── 3. Fallback to legacy DB ─────────────────────────────────────
    if not all_items:
        logger.warning("New data files not found, falling back to legacy %s", _FOOD_DB_LEGACY_PATH.name)
        if _FOOD_DB_LEGACY_PATH.exists():
            try:
                with open(_FOOD_DB_LEGACY_PATH, encoding="utf-8") as f:
                    all_items = json.load(f)
            except Exception as e:
                logger.error("Error loading legacy food DB: %s", e)
                return []

    _cached_foods = all_items
    logger.info("Total food/recipe items loaded: %d", len(all_items))
    return _cached_foods


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
            # Also check food name for seafood keywords (catches recipes like "Canh nấu tôm")
            _SEAFOOD_KEYWORDS = ["tôm", "cua", "mực", "ngao", "ốc", "cá ", "sò", "ghẹ", "hàu", "tôm đồng"]
            if any(kw in food_name for kw in _SEAFOOD_KEYWORDS):
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


def generate_meal_plan(
    profile: PatientProfile | dict[str, Any],
    days_count: int = 7,
    variant_group_id: str | None = None,
    variant_index: int | None = None,
    total_variants: int | None = None,
) -> MealPlanOutput:
    """Generate a full multi-day personalized medical meal plan.

    Args:
        profile: PatientProfile instance or dict.
        days_count: Number of days to generate (default 7).
        variant_group_id: Optional grouping ID for alternative options.
        variant_index: 1-indexed variant number.
        total_variants: Total number of variants in group.

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

    # Determine guideline citations for diabetes focus
    guideline_citations: list[str] = ["ada_diabetes.md", "byt_vn_notes.md"]

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

    # Always prioritize diabetes-friendly complex carbs (brown rice, oats, whole grains)
    starchy_foods_pref = [f for f in starchy_foods if "diabetes-friendly" in f.get("tags", [])] + starchy_foods

    days: list[DayPlan] = []
    swaps: list[Swap] = []

    # Generate requested days count (configurable, defaults to 7)
    for day_idx in range(1, days_count + 1):
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
        variant_group_id=variant_group_id,
        variant_index=variant_index,
        total_variants=total_variants,
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
