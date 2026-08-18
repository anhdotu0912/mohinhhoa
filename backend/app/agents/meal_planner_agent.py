"""MealPlannerAgent — 7-day medical meal plan from DB catalog + optional LLM.

Primary catalog: Postgres tables `recipes` + `food_compositions` (seeded from data/clean/).
Supplement/fallback: curated items in `backend/app/kb/food_catalog_demo.json` for
tinh_bot/trứng/đồ uống when DB is available, or full JSON when DB is empty/unavailable.
"""

from __future__ import annotations

import json
import logging
import re
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from app.agents.interaction_checker_agent import check_interactions
from app.schemas.meal_plan import (
    DayPlan,
    FoodItem,
    Macros,
    Meal,
    MealPlanOutput,
    Swap,
)
from app.schemas.profile import PatientProfile, Restrictions
from app.services.nutrition_calculator import (
    calculate_day_totals,
    calculate_meal_totals,
    validate_nutrition,
)

logger = logging.getLogger(__name__)

_SALT_TO_SODIUM_MG = 400.0

_APP_DIR = Path(__file__).resolve().parent.parent
_CATALOG_PATH = _APP_DIR / "kb" / "food_catalog_demo.json"

_cached_json_foods: list[dict] | None = None
_cached_json_by_id: dict[str, dict] | None = None

_CURATED_SUPPLEMENT_CATEGORIES = frozenset({"tinh_bot", "do_uong"})
_PROTEIN_GROUP_TO_CATEGORY = {
    "Thủy sản và sản phẩm": "hai_san",
    "Thịt và sản phẩm": "thit",
    "Hạt, đậu và sản phẩm": "dau",
    "Trứng và sản phẩm": "trung_sua",
    "Sữa và sản phẩm": "trung_sua",
}
_FOOD_GROUP_TO_CATEGORY = {
    "Quả chín": "trai_cay",
    "Sữa và sản phẩm": "trung_sua",
}


@dataclass
class _Catalog:
    foods: list[dict]
    by_id: dict[str, dict]


def _load_json_catalog_cached() -> _Catalog:
    """Load full curated JSON catalog (cached in-process)."""
    global _cached_json_foods, _cached_json_by_id
    if _cached_json_foods is not None:
        return _Catalog(foods=_cached_json_foods, by_id=_cached_json_by_id or {})

    if not _CATALOG_PATH.exists():
        logger.error("Food catalog missing at %s", _CATALOG_PATH)
        _cached_json_foods = []
        _cached_json_by_id = {}
        return _Catalog(foods=[], by_id={})

    try:
        with open(_CATALOG_PATH, encoding="utf-8") as f:
            _cached_json_foods = json.load(f)
        _cached_json_by_id = {item["id"]: item for item in _cached_json_foods if item.get("id")}
        return _Catalog(foods=_cached_json_foods, by_id=_cached_json_by_id)
    except Exception as e:
        logger.error("Error loading food catalog: %s", e)
        _cached_json_foods = []
        _cached_json_by_id = {}
        return _Catalog(foods=[], by_id={})


def _json_supplement_items() -> list[dict]:
    """Curated JSON items for tinh_bot/trứng/đồ uống only."""
    catalog = _load_json_catalog_cached()
    return [
        item
        for item in catalog.foods
        if item.get("category") in _CURATED_SUPPLEMENT_CATEGORIES
        or "trung" in item.get("id", "")
    ]


def _recipe_category(recipe_category: str, ingredients: list[dict], food_groups: dict[str, str]) -> str:
    if recipe_category == "canh":
        return "canh"
    if recipe_category in ("rau_luoc_hap", "goi_salad"):
        return "rau"
    for ing in ingredients:
        if ing.get("role") != "protein":
            continue
        group = food_groups.get(ing.get("food_id", ""), "")
        mapped = _PROTEIN_GROUP_TO_CATEGORY.get(group)
        if mapped:
            return mapped
    return "rau"


def _recipe_to_item(recipe_row, food_groups: dict[str, str]) -> dict:
    nutrition = recipe_row.nutrition or {}
    category = _recipe_category(recipe_row.category, recipe_row.ingredients or [], food_groups)
    return {
        "id": recipe_row.id,
        "name": recipe_row.name_vi,
        "portion": "1 phần theo công thức",
        "kcal": float(nutrition.get("energy_kcal") or 0),
        "macros": {
            "carb_g": float(nutrition.get("carbohydrate_g") or 0),
            "protein_g": float(nutrition.get("protein_g") or 0),
            "fat_g": float(nutrition.get("fat_g") or 0),
            "sodium_mg": float(nutrition.get("sodium_mg") or 0),
            "sugar_g": float(nutrition.get("sugar_g") or 0),
        },
        "category": category,
        "tags": [],
        "alternative_ids": [],
        "aliases": [],
        "citation": f"recipes_dm2#{recipe_row.id}",
    }


def _food_composition_to_item(row) -> dict | None:
    group = row.food_group or ""
    category = _FOOD_GROUP_TO_CATEGORY.get(group)
    if category is None:
        return None
    nutrition = row.nutrition or {}
    return {
        "id": row.id,
        "name": row.name_vi,
        "portion": f"{row.basis_g}g phần ăn được",
        "kcal": float(nutrition.get("energy_kcal") or 0),
        "macros": {
            "carb_g": float(nutrition.get("carbohydrate_g") or 0),
            "protein_g": float(nutrition.get("protein_g") or 0),
            "fat_g": float(nutrition.get("fat_g") or 0),
            "sodium_mg": float(nutrition.get("sodium_mg") or 0),
            "sugar_g": float(nutrition.get("sugar_g") or 0),
        },
        "category": category,
        "tags": [],
        "alternative_ids": [],
        "aliases": list(row.aliases or []),
        "citation": f"foods_vn#{row.id}",
    }


def _build_catalog_from_db(db: Session) -> _Catalog | None:
    """Build catalog from Postgres; returns None if tables are empty."""
    from app.models.nutrition_catalog import FoodComposition, Recipe

    recipes = db.query(Recipe).all()
    compositions = db.query(FoodComposition).filter(
        FoodComposition.food_group.in_(list(_FOOD_GROUP_TO_CATEGORY.keys()))
    ).all()
    if not recipes and not compositions:
        return None

    food_groups = {row.id: row.food_group for row in db.query(FoodComposition.id, FoodComposition.food_group).all()}
    items: list[dict] = []
    for recipe in recipes:
        items.append(_recipe_to_item(recipe, food_groups))
    for row in compositions:
        item = _food_composition_to_item(row)
        if item:
            items.append(item)

    by_id = {item["id"]: item for item in items if item.get("id")}
    return _Catalog(foods=items, by_id=by_id)


def _resolve_catalog(db: Session | None = None) -> _Catalog:
    """Hybrid catalog: DB recipes/compositions + JSON supplement, or full JSON fallback."""
    if db is not None:
        db_catalog = _build_catalog_from_db(db)
        if db_catalog and db_catalog.foods:
            supplement = _json_supplement_items()
            merged = list(db_catalog.foods)
            seen = set(db_catalog.by_id.keys())
            for item in supplement:
                if item.get("id") not in seen:
                    merged.append(item)
                    seen.add(item.get("id", ""))
            by_id = {item["id"]: item for item in merged if item.get("id")}
            logger.info(
                "Loaded hybrid catalog: %d DB + %d JSON supplement = %d total",
                len(db_catalog.foods),
                len(supplement),
                len(merged),
            )
            return _Catalog(foods=merged, by_id=by_id)

    return _load_json_catalog_cached()


def _is_allergic(food: dict, allergies: list[str]) -> bool:
    """Check if food item conflicts with any patient allergy (hard filter)."""
    if not allergies:
        return False

    food_name = food.get("name", "").lower()
    food_tags = [t.lower() for t in food.get("tags", [])]
    food_aliases = [a.lower() for a in food.get("aliases", [])]
    category = food.get("category", "")

    for allergy in allergies:
        allergy_norm = allergy.lower().strip()
        if not allergy_norm:
            continue

        if "hải sản" in allergy_norm or "hai san" in allergy_norm:
            if "allergen-shellfish" in food_tags or category == "hai_san":
                return True
        if "đậu" in allergy_norm or "dau" in allergy_norm:
            if "allergen-soy" in food_tags or category == "dau":
                return True
        if "trứng" in allergy_norm or "trung" in allergy_norm:
            if "trứng" in food_name or "trung" in food.get("id", ""):
                return True
        if "sữa" in allergy_norm or "sua" in allergy_norm:
            if "sữa" in food_name or "sua" in food.get("id", ""):
                return True

        if allergy_norm in food_name or any(allergy_norm in alias for alias in food_aliases):
            return True

    return False


def _blocked_by_preference(food: dict, preferences: list[str]) -> bool:
    name = food.get("name", "").lower()
    food_id = food.get("id", "").lower()
    category = str(food.get("category") or "").lower()

    for pref in preferences or []:
        pref_l = pref.lower()
        if "không ăn thịt bò" in pref_l or "khong an thit bo" in pref_l:
            if "bò" in name or "bo nac" in food_id:
                return True
        if "ăn chay" in pref_l or pref_l.strip() == "chay":
            if category in {"thit", "hai_san", "trung_sua"} or any(
                token in name
                for token in ("thịt", "gà", "heo", "lợn", "bò", "cá", "tôm", "cua", "trứng", "sữa")
            ):
                return True
        if "không ăn hải sản" in pref_l or "khong an hai san" in pref_l:
            if category == "hai_san" or any(
                token in name for token in ("tôm", "cua", "cá", "mực", "nghêu", "hải sản")
            ):
                return True
        if any(
            phrase in pref_l
            for phrase in ("không ăn heo", "không ăn lợn", "khong an heo", "khong an lon")
        ):
            if any(token in name for token in ("heo", "lợn", "ba rọi", "sườn heo")):
                return True
        if "không ăn gà" in pref_l or "khong an ga" in pref_l:
            if "gà" in name or "ga" in food_id:
                return True
    return False


def _get_safe_food_items(profile: PatientProfile, catalog: _Catalog) -> dict[str, list[dict]]:
    """Group foods by category, filtering allergies and hard preferences."""
    allergies = profile.allergies or []
    preferences = profile.preferences or []

    categories: dict[str, list[dict]] = {
        "tinh_bot": [],
        "thit": [],
        "hai_san": [],
        "dau": [],
        "trung_sua": [],
        "rau": [],
        "trai_cay": [],
        "canh": [],
        "do_uong": [],
    }

    for item in catalog.foods:
        if _is_allergic(item, allergies):
            continue
        if _blocked_by_preference(item, preferences):
            continue
        cat = item.get("category", "khac")
        if cat in categories:
            categories[cat].append(item)

    return categories


def _dict_to_food_item(
    food: dict,
    default_citation: str = "",
    with_alts: bool = False,
    catalog: _Catalog | None = None,
) -> FoodItem:
    macros_dict = food.get("macros", {})
    item_citation = food.get("citation") or f"food_catalog_demo#{food.get('id', '')}"
    item = FoodItem(
        name=food.get("name", ""),
        portion=food.get("portion", ""),
        kcal=float(food.get("kcal", 0)),
        macros=Macros(
            carb_g=float(macros_dict.get("carb_g", 0)),
            protein_g=float(macros_dict.get("protein_g", 0)),
            fat_g=float(macros_dict.get("fat_g", 0)),
            sodium_mg=float(macros_dict.get("sodium_mg", 0)),
            sugar_g=float(macros_dict.get("sugar_g", 0)),
        ),
        food_id=food.get("id"),
        citations=[item_citation] + ([default_citation] if default_citation else []),
        alternatives=[],
    )
    if with_alts and catalog is not None:
        item.alternatives = _alternatives_for(food, default_citation, catalog)
    return item


def _alternatives_for(food: dict, default_citation: str, catalog: _Catalog) -> list[FoodItem]:
    alts: list[FoodItem] = []
    for alt_id in food.get("alternative_ids") or []:
        raw = catalog.by_id.get(alt_id)
        if not raw or raw.get("id") == food.get("id"):
            continue
        alts.append(_dict_to_food_item(raw, default_citation, with_alts=False, catalog=catalog))
        if len(alts) >= 2:
            break
    return alts


def _find_swap_food(
    original_food_name: str,
    category_foods: list[dict],
    medications: list[str],
    db: Session | None = None,
) -> dict | None:
    for food in category_foods:
        if food.get("name") == original_food_name:
            continue
        interactions = check_interactions(medications, [food.get("name", "")], db=db)
        if not any(i.severity == "Nguy hiểm" for i in interactions):
            return food
    return None


def _is_dangerous(food_name: str, medications: list[str], db: Session | None = None) -> bool:
    if not medications:
        return False
    interactions = check_interactions(medications, [food_name], db=db)
    return any(i.severity == "Nguy hiểm" for i in interactions)


def _protein_pool(safe_foods: dict[str, list[dict]]) -> list[dict]:
    pool = list(safe_foods["thit"]) + list(safe_foods["dau"])
    if safe_foods["hai_san"]:
        pool += safe_foods["hai_san"]
    eggs = [item for item in safe_foods["trung_sua"] if "trung" in item.get("id", "")]
    pool += eggs
    return pool


def _guideline_citations(diseases: list[str]) -> list[str]:
    citations = ["byt_vn_notes.md"]
    if any("diabetes" in d for d in diseases):
        citations.append("ada_diabetes.md")
    if any("hypertension" in d or "cardio" in d for d in diseases):
        citations.append("aha_cardiovascular.md")
    if any("gout" in d for d in diseases):
        citations.append("acr_gout.md")
    return citations


def _pick(seq: list[dict], index: int) -> dict | None:
    if not seq:
        return None
    return seq[index % len(seq)]


# --- Clinical constraint enforcement (kcal / carb / sodium) ---

_SCALE_MIN = 0.4
_SCALE_MAX = 1.75
_MEAL_KCAL_SHARE = {
    "breakfast": 0.25,
    "lunch": 0.35,
    "dinner": 0.30,
    "snack": 0.10,
}
_STARCH_CATEGORIES = frozenset({"tinh_bot"})
_SCALABLE_CATEGORIES = frozenset({"tinh_bot", "thit", "hai_san", "dau", "trung_sua"})


def _macro(food: dict, key: str) -> float:
    return float((food.get("macros") or {}).get(key, 0) or 0)


def _food_kcal(food: dict) -> float:
    return float(food.get("kcal", 0) or 0)


def _format_scaled_portion(base_portion: str, factor: float) -> str:
    base = (base_portion or "1 phần").strip()
    match = re.search(r"^(.*?)\s*\(×([0-9.]+)\)$", base)
    if match:
        base = match.group(1).strip()
        factor = float(match.group(2)) * factor
    if abs(factor - 1.0) < 0.05:
        return base or "1 phần"
    return f"{base} (×{factor:.2f})"


def _scale_food_dict(food: dict, factor: float) -> dict:
    """Return a shallow-copied food dict with nutrition × factor."""
    factor = max(_SCALE_MIN, min(_SCALE_MAX, factor))
    macros = food.get("macros") or {}
    scaled = dict(food)
    scaled["kcal"] = round(_food_kcal(food) * factor, 1)
    scaled["macros"] = {
        "carb_g": round(float(macros.get("carb_g", 0) or 0) * factor, 1),
        "protein_g": round(float(macros.get("protein_g", 0) or 0) * factor, 1),
        "fat_g": round(float(macros.get("fat_g", 0) or 0) * factor, 1),
        "sodium_mg": round(float(macros.get("sodium_mg", 0) or 0) * factor, 1),
    }
    scaled["portion"] = _format_scaled_portion(str(food.get("portion", "")), factor)
    scaled["_scale"] = factor
    return scaled


def _scaled_item(
    food: dict | None,
    factor: float,
    citation: str,
    catalog: _Catalog,
) -> FoodItem | None:
    if food is None:
        return None
    return _dict_to_food_item(
        _scale_food_dict(food, factor),
        citation,
        with_alts=True,
        catalog=catalog,
    )


def _sort_pool(pool: list[dict], *, prefer_low_carb: bool, prefer_low_sodium: bool) -> list[dict]:
    def key(f: dict) -> tuple:
        carb = _macro(f, "carb_g")
        sodium = _macro(f, "sodium_mg")
        diabetes = 0 if "diabetes-friendly" in (f.get("tags") or []) else 1
        return (
            diabetes,
            carb if prefer_low_carb else -_food_kcal(f),
            sodium if prefer_low_sodium else 0,
            f.get("id", ""),
        )

    return sorted(pool, key=key)


def _pick_rotated(pool: list[dict], index: int, ranked: list[dict]) -> dict | None:
    """Prefer constraint-friendly foods while rotating for day variety."""
    if not pool:
        return None
    if not ranked:
        return _pick(pool, index)
    # Mix top candidates with rotation so plans stay diverse.
    top_n = min(5, len(ranked))
    return ranked[(index % top_n)]


def _restriction_value(restrictions: Restrictions | dict | None, key: str) -> float | None:
    if restrictions is None:
        return None
    if hasattr(restrictions, key):
        return getattr(restrictions, key)
    if isinstance(restrictions, dict):
        return restrictions.get(key)
    return None


def _restriction_limits(
    profile: PatientProfile,
) -> tuple[float | None, float | None, float | None]:
    restrictions = profile.restrictions
    carb_limit = _restriction_value(restrictions, "carb_per_meal")
    sodium_daily = _restriction_value(restrictions, "sodium_daily")
    salt_daily_g = _restriction_value(restrictions, "salt_daily_g")
    sugar_limit = _restriction_value(restrictions, "sugar_daily_g")

    sodium_from_salt = (
        float(salt_daily_g) * _SALT_TO_SODIUM_MG if salt_daily_g is not None else None
    )
    sodium_candidates = [v for v in (sodium_daily, sodium_from_salt) if v is not None]
    effective_sodium = min(sodium_candidates) if sodium_candidates else None

    return carb_limit, effective_sodium, sugar_limit


def _effective_restrictions(profile: PatientProfile) -> Restrictions | None:
    carb_limit, effective_sodium, sugar_limit = _restriction_limits(profile)
    restrictions = profile.restrictions
    salt_daily_g = _restriction_value(restrictions, "salt_daily_g")
    if (
        carb_limit is None
        and effective_sodium is None
        and sugar_limit is None
        and salt_daily_g is None
    ):
        return restrictions if restrictions else None
    return Restrictions(
        carb_per_meal=carb_limit,
        sodium_daily=effective_sodium,
        salt_daily_g=salt_daily_g,
        sugar_daily_g=sugar_limit,
    )


def _carb_factor(food: dict, carb_budget: float | None) -> float:
    if carb_budget is None:
        return 1.0
    carb = _macro(food, "carb_g")
    if carb <= 0:
        return 1.0
    if carb <= carb_budget:
        return 1.0
    return max(_SCALE_MIN, carb_budget / carb)


def _items_totals(items: list[FoodItem]) -> tuple[float, float, float]:
    kcal = sum(i.kcal for i in items)
    carb = sum(i.macros.carb_g for i in items)
    sodium = sum(i.macros.sodium_mg for i in items)
    return kcal, carb, sodium


def _scale_food_item(item: FoodItem, factor: float) -> FoodItem:
    factor = max(_SCALE_MIN, min(_SCALE_MAX, factor))
    return item.model_copy(
        update={
            "portion": _format_scaled_portion(item.portion, factor),
            "kcal": round(item.kcal * factor, 1),
            "macros": Macros(
                carb_g=round(item.macros.carb_g * factor, 1),
                protein_g=round(item.macros.protein_g * factor, 1),
                fat_g=round(item.macros.fat_g * factor, 1),
                sodium_mg=round(item.macros.sodium_mg * factor, 1),
                sugar_g=round(item.macros.sugar_g * factor, 1),
            ),
            "alternatives": item.alternatives,
        }
    )


def _category_of_item(item: FoodItem, catalog: _Catalog) -> str:
    if item.food_id and item.food_id in catalog.by_id:
        return str(catalog.by_id[item.food_id].get("category") or "")
    return ""


def _build_slot_items(
    slot: str,
    day_idx: int,
    pools: dict[str, list[dict]],
    citation: str,
    catalog: _Catalog,
    meal_kcal_target: float,
    carb_limit: float | None,
    sodium_budget: float | None,
) -> list[FoodItem]:
    """Assemble one meal under carb/sodium budgets, then scale toward kcal target."""
    starch_pool = pools["starch"]
    protein_pool = pools["proteins"]
    veggie_pool = pools["veggies"]
    soup_pool = pools["soups"]
    fruit_pool = pools["fruit"]
    drink_pool = pools["drinks"]

    prefer_low_carb = carb_limit is not None
    prefer_low_na = sodium_budget is not None
    ranked_starch = _sort_pool(starch_pool, prefer_low_carb=prefer_low_carb, prefer_low_sodium=prefer_low_na)
    ranked_protein = _sort_pool(protein_pool, prefer_low_carb=False, prefer_low_sodium=prefer_low_na)
    ranked_veg = _sort_pool(veggie_pool, prefer_low_carb=prefer_low_carb, prefer_low_sodium=prefer_low_na)
    ranked_soup = _sort_pool(soup_pool, prefer_low_carb=prefer_low_carb, prefer_low_sodium=True)
    ranked_fruit = _sort_pool(fruit_pool, prefer_low_carb=prefer_low_carb, prefer_low_sodium=prefer_low_na)
    ranked_drink = _sort_pool(drink_pool, prefer_low_carb=prefer_low_carb, prefer_low_sodium=prefer_low_na)

    chosen: list[tuple[str, dict, float]] = []  # role, food, scale

    def add(role: str, food: dict | None, scale: float = 1.0) -> None:
        if food is None:
            return
        chosen.append((role, food, scale))

    if slot == "breakfast":
        add("starch", _pick_rotated(starch_pool, day_idx - 1, ranked_starch))
        add("protein", _pick_rotated(protein_pool, day_idx * 2, ranked_protein))
        add("drink", _pick_rotated(drink_pool, day_idx, ranked_drink))
    elif slot == "lunch":
        add("starch", _pick_rotated(starch_pool, day_idx, ranked_starch))
        add("protein", _pick_rotated(protein_pool, day_idx + 1, ranked_protein))
        add("veggie", _pick_rotated(veggie_pool, day_idx - 1, ranked_veg))
        # Skip soup when sodium budget is tight (< 350mg remaining for sides).
        soup = _pick_rotated(soup_pool, day_idx, ranked_soup) if soup_pool else None
        if soup is not None:
            side_na = sum(_macro(f, "sodium_mg") * s for r, f, s in chosen) + _macro(soup, "sodium_mg")
            if sodium_budget is None or side_na <= sodium_budget * 0.85:
                add("soup", soup)
    elif slot == "dinner":
        add("starch", _pick_rotated(starch_pool, day_idx + 2, ranked_starch))
        add("protein", _pick_rotated(protein_pool, day_idx + 3, ranked_protein))
        add("veggie", _pick_rotated(veggie_pool, day_idx, ranked_veg))
    else:  # snack
        add("fruit", _pick_rotated(fruit_pool, day_idx, ranked_fruit))

    if not chosen:
        return []

    # 1) Fit carb: scale starch (or fruit for snack) down first.
    if carb_limit is not None:
        non_starch_carb = sum(
            _macro(f, "carb_g") * s for r, f, s in chosen if r not in ("starch", "fruit")
        )
        starch_budget = max(0.0, carb_limit - non_starch_carb)
        adjusted: list[tuple[str, dict, float]] = []
        for role, food, scale in chosen:
            if role in ("starch", "fruit"):
                scale = min(scale, _carb_factor(food, starch_budget))
                # If still over after min scale, drop optional soup/veggie next pass.
            adjusted.append((role, food, scale))
        chosen = adjusted

        # Drop soup then veggie if still over carb at min starch scale.
        def total_carb(rows: list[tuple[str, dict, float]]) -> float:
            return sum(_macro(f, "carb_g") * s for _, f, s in rows)

        for drop_role in ("soup", "veggie", "drink"):
            if total_carb(chosen) <= carb_limit:
                break
            chosen = [row for row in chosen if row[0] != drop_role]

        # Final starch/fruit shrink if needed.
        non_primary = sum(
            _macro(f, "carb_g") * s for r, f, s in chosen if r not in ("starch", "fruit")
        )
        primary_budget = max(0.0, carb_limit - non_primary)
        chosen = [
            (r, f, min(s, _carb_factor(f, primary_budget)) if r in ("starch", "fruit") else s)
            for r, f, s in chosen
        ]

    # 2) Fit sodium: shrink high-sodium items / drop soup.
    if sodium_budget is not None:
        def total_na(rows: list[tuple[str, dict, float]]) -> float:
            return sum(_macro(f, "sodium_mg") * s for _, f, s in rows)

        if total_na(chosen) > sodium_budget:
            chosen = [row for row in chosen if row[0] != "soup"]
        if total_na(chosen) > sodium_budget:
            shrunk: list[tuple[str, dict, float]] = []
            for role, food, scale in chosen:
                na = _macro(food, "sodium_mg")
                if na <= 0:
                    shrunk.append((role, food, scale))
                    continue
                # Leave ~equal headroom; scale down if this item alone is heavy.
                max_scale = min(scale, max(_SCALE_MIN, (sodium_budget / max(len(chosen), 1)) / na))
                shrunk.append((role, food, max_scale))
            chosen = shrunk

    items = [
        item
        for item in (_scaled_item(food, scale, citation, catalog) for _, food, scale in chosen)
        if item is not None
    ]

    # 3) Approach meal kcal target without breaking carb/sodium.
    kcal, carb, sodium = _items_totals(items)
    if meal_kcal_target > 0 and kcal > 0:
        needed = meal_kcal_target / kcal
        if needed > 1.05:
            # Scale protein (and drink/fruit) up; keep starch fixed if carb-limited.
            boost = min(_SCALE_MAX, needed)
            new_items: list[FoodItem] = []
            for item, (role, _, scale) in zip(items, chosen):
                if role in ("protein", "drink", "fruit", "veggie"):
                    factor = min(_SCALE_MAX / max(scale, 0.01), boost)
                    # Recheck carb/sodium after boost.
                    trial = _scale_food_item(item, factor)
                    trial_carb = carb - item.macros.carb_g + trial.macros.carb_g
                    trial_na = sodium - item.macros.sodium_mg + trial.macros.sodium_mg
                    if carb_limit is not None and trial_carb > carb_limit + 0.05:
                        new_items.append(item)
                        continue
                    if sodium_budget is not None and trial_na > sodium_budget + 0.5:
                        new_items.append(item)
                        continue
                    carb = trial_carb
                    sodium = trial_na
                    new_items.append(trial)
                else:
                    new_items.append(item)
            items = new_items
            kcal, carb, sodium = _items_totals(items)

            # If still low, carefully boost starch within carb room.
            if kcal < meal_kcal_target * 0.92:
                room_carb = None if carb_limit is None else max(0.0, carb_limit - carb)
                room_na = None if sodium_budget is None else max(0.0, sodium_budget - sodium)
                boosted: list[FoodItem] = []
                for item, (role, _, _) in zip(items, chosen):
                    if role != "starch" or item.kcal <= 0:
                        boosted.append(item)
                        continue
                    max_by_kcal = meal_kcal_target / max(kcal, 1.0)
                    max_by_carb = (
                        1.0
                        if room_carb is None or item.macros.carb_g <= 0
                        else 1.0 + room_carb / item.macros.carb_g
                    )
                    max_by_na = (
                        1.0
                        if room_na is None or item.macros.sodium_mg <= 0
                        else 1.0 + room_na / item.macros.sodium_mg
                    )
                    factor = min(_SCALE_MAX, max_by_kcal, max_by_carb, max_by_na)
                    if factor > 1.02:
                        boosted.append(_scale_food_item(item, factor))
                    else:
                        boosted.append(item)
                items = boosted
        elif needed < 0.9:
            # Over meal kcal — scale everything down proportionally within SCALE_MIN.
            factor = max(_SCALE_MIN, needed)
            if carb_limit is not None:
                # Prefer shrinking starch first.
                shrunk_items: list[FoodItem] = []
                for item, (role, _, _) in zip(items, chosen):
                    if role in ("starch", "fruit", "soup"):
                        shrunk_items.append(_scale_food_item(item, max(_SCALE_MIN, factor)))
                    else:
                        shrunk_items.append(item)
                items = shrunk_items
            else:
                items = [_scale_food_item(i, factor) for i in items]

    # Final hard clip on carb.
    if carb_limit is not None:
        _, carb, _ = _items_totals(items)
        if carb > carb_limit and carb > 0:
            factor = max(_SCALE_MIN, carb_limit / carb)
            # Scale only carb-heavy roles.
            clipped: list[FoodItem] = []
            for item, (role, _, _) in zip(items, chosen[: len(items)]):
                if role in ("starch", "fruit", "soup", "veggie", "drink") and item.macros.carb_g > 0:
                    clipped.append(_scale_food_item(item, factor))
                else:
                    clipped.append(item)
            items = clipped

    return items


def _apply_interaction_swaps(
    days: list[DayPlan],
    medications: list[str],
    veggie_foods: list[dict],
    protein_foods: list[dict],
    citation: str,
    catalog: _Catalog,
    db: Session | None = None,
) -> list[Swap]:
    swaps: list[Swap] = []
    for day in days:
        for meal in day.meals:
            for i, item in enumerate(meal.items):
                interactions = check_interactions(medications, [item.name], db=db)
                dangerous = [inter for inter in interactions if inter.severity == "Nguy hiểm"]
                if not dangerous:
                    meal.items[i] = _ensure_safe_alternatives(item, medications, db=db)
                    continue
                inter_info = dangerous[0]
                pool = veggie_foods if "rau" in item.name.lower() else protein_foods
                alt = _find_swap_food(item.name, pool, medications, db=db)
                if not alt:
                    continue
                alt_item = _dict_to_food_item(alt, citation, with_alts=True, catalog=catalog)
                alt_item = _ensure_safe_alternatives(alt_item, medications, db=db)
                meal.items[i] = alt_item
                swaps.append(
                    Swap(
                        day_index=day.day_index,
                        slot=meal.slot,
                        from_food=item.name,
                        to=alt_item.name,
                        reason=(
                            f"Tương tác thuốc ({inter_info.drug} + {inter_info.food}): "
                            f"{inter_info.mechanism}"
                        ),
                    )
                )
    return swaps


def _filter_allergic_alternatives(
    days: list[DayPlan],
    profile: PatientProfile,
    catalog: _Catalog,
) -> None:
    allergies = profile.allergies or []
    preferences = profile.preferences or []
    for day in days:
        for meal in day.meals:
            for item in meal.items:
                item.alternatives = [
                    alt
                    for alt in item.alternatives
                    if not (
                        _is_allergic(catalog.by_id.get(alt.food_id or "", {}), allergies)
                        or _blocked_by_preference(
                            catalog.by_id.get(alt.food_id or "", {}), preferences
                        )
                    )
                ]


def _ensure_safe_alternatives(
    item: FoodItem,
    medications: list[str],
    db: Session | None = None,
) -> FoodItem:
    safe = [
        alt
        for alt in item.alternatives
        if not _is_dangerous(alt.name, medications, db=db)
    ]
    item.alternatives = safe
    return item


def _hydrate_item_ids(
    item_ids: list[str],
    citation: str,
    allergies: list[str],
    preferences: list[str],
    catalog: _Catalog,
) -> list[FoodItem]:
    items: list[FoodItem] = []
    for food_id in item_ids:
        raw = catalog.by_id.get(food_id)
        if raw is None:
            continue
        if _is_allergic(raw, allergies) or _blocked_by_preference(raw, preferences):
            continue
        items.append(_dict_to_food_item(raw, citation, with_alts=True, catalog=catalog))
    return items


def _try_llm_plan(
    profile: PatientProfile,
    days_count: int,
    notes: str,
    priorities: list[str],
    citation: str,
    catalog: _Catalog,
) -> list[DayPlan] | None:
    from app.core.llm import get_chat_llm, llm_configured

    if not llm_configured():
        return None

    carb_limit, sodium_limit, sugar_limit = _restriction_limits(profile)
    compact = [
        {
            "id": f.get("id"),
            "name": f.get("name"),
            "category": f.get("category"),
            "kcal": f.get("kcal"),
            "portion": f.get("portion"),
            "carb_g": _macro(f, "carb_g"),
            "protein_g": _macro(f, "protein_g"),
            "fat_g": _macro(f, "fat_g"),
            "sodium_mg": _macro(f, "sodium_mg"),
            "sugar_g": _macro(f, "sugar_g"),
        }
        for f in catalog.foods
        if not _is_allergic(f, profile.allergies or [])
        and not _blocked_by_preference(f, profile.preferences or [])
    ]
    if not compact:
        return None

    target_kcal = profile.target_kcal or 1800
    prompt = f"""Bạn là chuyên gia dinh dưỡng lâm sàng. Tạo thực đơn {days_count} ngày.
CHỈ được chọn món từ catalog (dùng đúng id). Không bịa món mới.

HỒ SƠ BỆNH NHÂN:
{json.dumps(profile.model_dump(), ensure_ascii=False)}

GHI CHÚ BÁC SĨ: {notes or "(không)"}
ƯU TIÊN: {", ".join(priorities) if priorities else "(không)"}

CATALOG (có macros):
{json.dumps(compact, ensure_ascii=False)}

QUY TẮC CỨNG:
- Mỗi ngày đủ breakfast, lunch, dinner, snack.
- Breakfast: tinh_bot + protein/trứng + đồ uống hoặc trái cây.
- Lunch: tinh_bot + protein + rau + canh (nếu có và còn ngân sách natri).
- Dinner: tinh_bot + protein + rau.
- Snack: trái cây hoặc sữa chua.
- Tổng kcal/ngày trong khoảng ±10% của {target_kcal} kcal.
- Carb mỗi bữa ≤ {carb_limit if carb_limit is not None else "không giới hạn"} g (ưu tiên tinh bột carb thấp / ít phần).
- Natri cả ngày ≤ {sodium_limit if sodium_limit is not None else "không giới hạn"} mg.
- Đường tự do cả ngày ≤ {sugar_limit if sugar_limit is not None else "không giới hạn"} g.
- Tôn trọng dị ứng, thuốc.
- KHÔNG khuyến nghị đổi thuốc/liều.

Trả về JSON thuần (không markdown):
{{"days":[{{"day_index":1,"meals":[{{"slot":"breakfast","item_ids":["f_yen_mach","f_trung_luoc"]}}]}}]}}
"""

    try:
        llm = get_chat_llm(temperature=0.3)
        if llm is None:
            return None
        response = llm.invoke(prompt)
        text = getattr(response, "content", "") or ""
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            logger.warning("LLM meal plan response was not JSON")
            return None
        payload = json.loads(match.group(0))
    except Exception:
        logger.exception("LLM meal plan generation failed")
        return None

    raw_days = payload.get("days") or []
    if len(raw_days) < days_count:
        return None

    allergies = profile.allergies or []
    preferences = profile.preferences or []
    days: list[DayPlan] = []
    for idx in range(1, days_count + 1):
        raw_day = next((d for d in raw_days if int(d.get("day_index", 0)) == idx), None)
        if raw_day is None:
            return None
        meals: list[Meal] = []
        for slot in ("breakfast", "lunch", "dinner", "snack"):
            raw_meal = next(
                (m for m in raw_day.get("meals") or [] if m.get("slot") == slot),
                None,
            )
            ids = list((raw_meal or {}).get("item_ids") or [])
            items = _hydrate_item_ids(ids, citation, allergies, preferences, catalog)
            if not items:
                return None
            meals.append(Meal(slot=slot, items=items))
        days.append(DayPlan(day_index=idx, meals=meals))
    return days


def _pools_from_safe(
    profile: PatientProfile,
    catalog: _Catalog,
) -> dict[str, list[dict]]:
    safe = _get_safe_food_items(profile, catalog)
    diseases = profile.disease or []

    proteins = _protein_pool(safe)
    starch = list(safe["tinh_bot"])
    veggies = list(safe["rau"])
    fruit = list(safe["trai_cay"])
    drinks = list(safe["do_uong"]) or list(safe["trung_sua"])
    soups = list(safe["canh"])
    dairy = list(safe["trung_sua"])

    all_foods = catalog.foods
    if not starch:
        starch = all_foods[:3]
    if not veggies:
        veggies = all_foods[3:6]
    if not fruit:
        fruit = all_foods[6:9]
    if not proteins:
        proteins = all_foods[:4]

    if "diabetes_t2" in diseases:
        pref_starch = [f for f in starch if "diabetes-friendly" in f.get("tags", [])] + starch
    else:
        pref_starch = starch

    return {
        "starch": pref_starch,
        "proteins": proteins,
        "veggies": veggies,
        "fruit": fruit,
        "drinks": drinks or dairy or fruit,
        "soups": soups,
        "dairy": dairy,
    }


def _rule_based_days(
    profile: PatientProfile,
    days_count: int,
    citation: str,
    catalog: _Catalog,
) -> list[DayPlan]:
    pools = _pools_from_safe(profile, catalog)
    target_kcal = float(profile.target_kcal or 1800)
    carb_limit, sodium_daily, _sugar_daily = _restriction_limits(profile)

    days: list[DayPlan] = []
    for day_idx in range(1, days_count + 1):
        meals: list[Meal] = []
        # Reserve sodium across slots (lunch gets more for optional soup).
        slot_na_share = {
            "breakfast": 0.25,
            "lunch": 0.35,
            "dinner": 0.30,
            "snack": 0.10,
        }
        for slot in ("breakfast", "lunch", "dinner", "snack"):
            meal_kcal = target_kcal * _MEAL_KCAL_SHARE[slot]
            sodium_budget = (
                None if sodium_daily is None else float(sodium_daily) * slot_na_share[slot]
            )
            items = _build_slot_items(
                slot=slot,
                day_idx=day_idx,
                pools=pools,
                citation=citation,
                catalog=catalog,
                meal_kcal_target=meal_kcal,
                carb_limit=carb_limit,
                sodium_budget=sodium_budget,
            )
            meals.append(Meal(slot=slot, items=items))
        days.append(DayPlan(day_index=day_idx, meals=meals))
    return days


def _hard_breaches(
    day: DayPlan,
    target_kcal: float,
    carb_limit: float | None,
    sodium_daily: float | None,
    sugar_daily: float | None,
) -> list[str]:
    """Return only hard clinical breaches (ignore near-limit soft warnings)."""
    restrictions = None
    if carb_limit is not None or sodium_daily is not None or sugar_daily is not None:
        restrictions = Restrictions(
            carb_per_meal=carb_limit,
            sodium_daily=sodium_daily,
            sugar_daily_g=sugar_daily,
        )
    warnings = validate_nutrition(
        day,
        target_kcal=target_kcal,
        restrictions=restrictions,
    )
    return [w for w in warnings if "sắp chạm" not in w]


def _repair_meal_carb(meal: Meal, carb_limit: float) -> None:
    total = calculate_meal_totals(meal)
    if total.carb_g <= carb_limit or total.carb_g <= 0:
        return
    # Scale down highest-carb item (usually starch) first.
    indexed = sorted(
        enumerate(meal.items),
        key=lambda pair: pair[1].macros.carb_g,
        reverse=True,
    )
    remaining_over = total.carb_g - carb_limit
    for idx, item in indexed:
        if remaining_over <= 0.05:
            break
        if item.macros.carb_g <= 0:
            continue
        reducible = item.macros.carb_g * (1.0 - _SCALE_MIN)
        cut = min(remaining_over, reducible)
        factor = max(_SCALE_MIN, (item.macros.carb_g - cut) / item.macros.carb_g)
        meal.items[idx] = _scale_food_item(item, factor)
        remaining_over -= cut


def _repair_day_sodium(day: DayPlan, sodium_daily: float, catalog: _Catalog) -> None:
    totals = calculate_day_totals(day)
    if totals.sodium_mg <= sodium_daily or totals.sodium_mg <= 0:
        return
    factor = max(_SCALE_MIN, sodium_daily / totals.sodium_mg)
    # Prefer shrinking soups / high-sodium items.
    for meal in day.meals:
        new_items: list[FoodItem] = []
        for item in meal.items:
            cat = _category_of_item(item, catalog)
            if cat == "canh" or item.macros.sodium_mg >= 100:
                new_items.append(_scale_food_item(item, factor))
            else:
                new_items.append(item)
        meal.items = new_items
    totals = calculate_day_totals(day)
    if totals.sodium_mg > sodium_daily and totals.sodium_mg > 0:
        global_factor = max(_SCALE_MIN, sodium_daily / totals.sodium_mg)
        for meal in day.meals:
            meal.items = [_scale_food_item(i, global_factor) for i in meal.items]


def _repair_day_sugar(day: DayPlan, sugar_daily: float, catalog: _Catalog) -> None:
    totals = calculate_day_totals(day)
    if totals.sugar_g <= sugar_daily or totals.sugar_g <= 0:
        return
    factor = max(_SCALE_MIN, sugar_daily / totals.sugar_g)
    for meal in day.meals:
        new_items: list[FoodItem] = []
        for item in meal.items:
            cat = _category_of_item(item, catalog)
            if cat in ("trai_cay", "trung_sua") or item.macros.sugar_g >= 5:
                new_items.append(_scale_food_item(item, factor))
            else:
                new_items.append(item)
        meal.items = new_items
    totals = calculate_day_totals(day)
    if totals.sugar_g > sugar_daily and totals.sugar_g > 0:
        global_factor = max(_SCALE_MIN, sugar_daily / totals.sugar_g)
        for meal in day.meals:
            meal.items = [_scale_food_item(i, global_factor) for i in meal.items]


def _repair_day_kcal(
    day: DayPlan,
    target_kcal: float,
    carb_limit: float | None,
    sodium_daily: float | None,
    pools: dict[str, list[dict]],
    citation: str,
    catalog: _Catalog,
) -> None:
    totals = calculate_day_totals(day)
    lower = target_kcal * 0.9
    upper = target_kcal * 1.1

    if totals.kcal > upper and totals.kcal > 0:
        factor = max(_SCALE_MIN, upper / totals.kcal)
        for meal in day.meals:
            meal.items = [_scale_food_item(i, factor) for i in meal.items]
        return

    if totals.kcal >= lower:
        return

    # Under target: boost protein items, then add extra protein/dairy if needed.
    deficit = lower - totals.kcal
    for meal in day.meals:
        if deficit <= 5:
            break
        boosted: list[FoodItem] = []
        for item in meal.items:
            cat = _category_of_item(item, catalog)
            if cat not in _SCALABLE_CATEGORIES or cat in _STARCH_CATEGORIES:
                boosted.append(item)
                continue
            # How much can we grow this item?
            room = _SCALE_MAX  # relative to current portion already scaled; cap gently
            growth = min(1.35, room)
            trial = _scale_food_item(item, growth)
            # Guard meal carb.
            if carb_limit is not None:
                meal_carb = sum(i.macros.carb_g for i in meal.items) - item.macros.carb_g + trial.macros.carb_g
                if meal_carb > carb_limit + 0.05:
                    boosted.append(item)
                    continue
            gained = trial.kcal - item.kcal
            if gained > 0:
                deficit -= gained
            boosted.append(trial)
        meal.items = boosted

    totals = calculate_day_totals(day)
    if totals.kcal >= lower:
        return

    # Add an extra low-carb protein or dairy to the lowest-kcal main meal.
    extra_pool = pools.get("proteins") or pools.get("dairy") or []
    if not extra_pool:
        return
    main_meals = [m for m in day.meals if m.slot in ("breakfast", "lunch", "dinner")]
    if not main_meals:
        return
    target_meal = min(main_meals, key=lambda m: sum(i.kcal for i in m.items))
    # Pick lowest-carb protein that fits.
    ranked = _sort_pool(extra_pool, prefer_low_carb=True, prefer_low_sodium=sodium_daily is not None)
    for food in ranked[:8]:
        factor = 1.0
        if carb_limit is not None:
            meal_carb = sum(i.macros.carb_g for i in target_meal.items)
            room = carb_limit - meal_carb
            factor = _carb_factor(food, room)
            if factor < _SCALE_MIN + 0.01 and _macro(food, "carb_g") > room:
                continue
        if sodium_daily is not None:
            day_na = calculate_day_totals(day).sodium_mg
            room_na = sodium_daily - day_na
            na = _macro(food, "sodium_mg")
            if na > 0 and na * factor > room_na:
                factor = min(factor, max(_SCALE_MIN, room_na / na))
        item = _scaled_item(food, factor, citation, catalog)
        if item is None:
            continue
        target_meal.items.append(item)
        if calculate_day_totals(day).kcal >= lower:
            break


def _enforce_clinical_constraints(
    days: list[DayPlan],
    profile: PatientProfile,
    citation: str,
    catalog: _Catalog,
    max_passes: int = 4,
) -> None:
    """Repair days in-place so kcal/carb/sodium/sugar hard limits are met when feasible."""
    target_kcal = float(profile.target_kcal or 1800)
    carb_limit, sodium_daily, sugar_daily = _restriction_limits(profile)
    pools = _pools_from_safe(profile, catalog)

    for day in days:
        for _ in range(max_passes):
            day.totals = calculate_day_totals(day)
            breaches = _hard_breaches(
                day, target_kcal, carb_limit, sodium_daily, sugar_daily
            )
            if not breaches:
                break

            if carb_limit is not None:
                for meal in day.meals:
                    if calculate_meal_totals(meal).carb_g > carb_limit:
                        _repair_meal_carb(meal, carb_limit)

            if sodium_daily is not None:
                day.totals = calculate_day_totals(day)
                if day.totals.sodium_mg > sodium_daily:
                    _repair_day_sodium(day, sodium_daily, catalog)

            if sugar_daily is not None:
                day.totals = calculate_day_totals(day)
                if day.totals.sugar_g > sugar_daily:
                    _repair_day_sugar(day, sugar_daily, catalog)

            day.totals = calculate_day_totals(day)
            if day.totals.kcal < target_kcal * 0.9 or day.totals.kcal > target_kcal * 1.1:
                _repair_day_kcal(
                    day,
                    target_kcal,
                    carb_limit,
                    sodium_daily,
                    pools,
                    citation,
                    catalog,
                )

            # Re-check carb after kcal boost.
            if carb_limit is not None:
                for meal in day.meals:
                    if calculate_meal_totals(meal).carb_g > carb_limit:
                        _repair_meal_carb(meal, carb_limit)

        day.totals = calculate_day_totals(day)


def generate_meal_plan(
    profile: PatientProfile | dict[str, Any],
    days_count: int = 7,
    variant_group_id: str | None = None,
    variant_index: int | None = None,
    total_variants: int | None = None,
    notes: str = "",
    priorities: list[str] | None = None,
    db: Session | None = None,
) -> MealPlanOutput:
    """Generate a full multi-day personalized medical meal plan."""
    if isinstance(profile, dict):
        profile_obj = PatientProfile(**profile)
    else:
        profile_obj = profile

    catalog = _resolve_catalog(db)
    user_id = profile_obj.user_id or "demo_user"
    plan_id = str(uuid.uuid4())
    diseases = profile_obj.disease or []
    medications = profile_obj.medications or []
    target_kcal = profile_obj.target_kcal or 1800
    guideline_citations = _guideline_citations(diseases)
    citation = guideline_citations[0]

    days = _try_llm_plan(
        profile_obj,
        days_count,
        notes,
        priorities or [],
        citation,
        catalog,
    )
    if days is None:
        days = _rule_based_days(profile_obj, days_count, citation, catalog)

    _filter_allergic_alternatives(days, profile_obj, catalog)

    safe = _get_safe_food_items(profile_obj, catalog)
    swaps = _apply_interaction_swaps(
        days,
        medications,
        safe["rau"],
        _protein_pool(safe),
        citation,
        catalog,
        db=db,
    )

    # Hard-enforce clinical budgets after swaps (scale / drop / top-up).
    _enforce_clinical_constraints(days, profile_obj, citation, catalog)

    for day in days:
        day.totals = calculate_day_totals(day)
        day.warnings = validate_nutrition(
            day,
            target_kcal=target_kcal,
            restrictions=_effective_restrictions(profile_obj),
        )

    return MealPlanOutput(
        id=plan_id,
        variant_group_id=variant_group_id,
        variant_index=variant_index,
        total_variants=total_variants,
        user_id=user_id,
        profile_snapshot=profile_obj.model_dump()
        if hasattr(profile_obj, "model_dump")
        else dict(profile_obj),
        days=days,
        swaps=swaps,
        citations=guideline_citations,
        status="pending_review",
    )


def meal_planner_agent(
    profile: PatientProfile | dict[str, Any],
    notes: str = "",
    priorities: list[str] | None = None,
    db: Session | None = None,
) -> MealPlanOutput:
    """Main entry point for MealPlannerAgent."""
    return generate_meal_plan(profile, notes=notes, priorities=priorities, db=db)
