"""MealPlannerAgent — 7-day medical meal plan from demo catalog + optional LLM.

Uses `backend/app/kb/food_catalog_demo.json` as the knowledge source while RAG/food DB
is incomplete. If an LLM API key is set, the LLM composes the plan from catalog ids;
otherwise a deterministic rotation is used. Nutrition numbers always come from the catalog.
"""

from __future__ import annotations

import json
import logging
import re
import uuid
from pathlib import Path
from typing import Any

from app.agents.interaction_checker_agent import check_interactions
from app.schemas.meal_plan import (
    DayPlan,
    FoodItem,
    Macros,
    Meal,
    MealPlanOutput,
    Swap,
)
from app.schemas.profile import PatientProfile
from app.services.nutrition_calculator import calculate_day_totals, validate_nutrition

logger = logging.getLogger(__name__)

_APP_DIR = Path(__file__).resolve().parent.parent
_CATALOG_PATH = _APP_DIR / "kb" / "food_catalog_demo.json"

_cached_foods: list[dict] | None = None
_cached_by_id: dict[str, dict] | None = None


def _load_food_db() -> list[dict]:
    """Load curated demo catalog (not the stub food_db_vn.json)."""
    global _cached_foods, _cached_by_id
    if _cached_foods is not None:
        return _cached_foods

    if not _CATALOG_PATH.exists():
        logger.error("Food catalog missing at %s", _CATALOG_PATH)
        _cached_foods = []
        _cached_by_id = {}
        return _cached_foods

    try:
        with open(_CATALOG_PATH, encoding="utf-8") as f:
            _cached_foods = json.load(f)
        _cached_by_id = {item["id"]: item for item in _cached_foods if item.get("id")}
        return _cached_foods
    except Exception as e:
        logger.error("Error loading food catalog: %s", e)
        _cached_foods = []
        _cached_by_id = {}
        return _cached_foods


def _foods_by_id() -> dict[str, dict]:
    _load_food_db()
    return _cached_by_id or {}


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
    for pref in preferences or []:
        pref_l = pref.lower()
        if "không ăn thịt bò" in pref_l or "khong an thit bo" in pref_l:
            if "bò" in name or "bo nac" in food.get("id", ""):
                return True
    return False


def _get_safe_food_items(profile: PatientProfile) -> dict[str, list[dict]]:
    """Group foods by category, filtering allergies and hard preferences."""
    foods = _load_food_db()
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

    for item in foods:
        if _is_allergic(item, allergies):
            continue
        if _blocked_by_preference(item, preferences):
            continue
        cat = item.get("category", "khac")
        if cat in categories:
            categories[cat].append(item)

    return categories


def _dict_to_food_item(food: dict, default_citation: str = "", with_alts: bool = False) -> FoodItem:
    macros_dict = food.get("macros", {})
    item = FoodItem(
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
        citations=[f"food_catalog_demo#{food.get('id', '')}"]
        + ([default_citation] if default_citation else []),
        alternatives=[],
    )
    if with_alts:
        item.alternatives = _alternatives_for(food, default_citation)
    return item


def _alternatives_for(food: dict, default_citation: str = "") -> list[FoodItem]:
    by_id = _foods_by_id()
    alts: list[FoodItem] = []
    for alt_id in food.get("alternative_ids") or []:
        raw = by_id.get(alt_id)
        if not raw or raw.get("id") == food.get("id"):
            continue
        alts.append(_dict_to_food_item(raw, default_citation, with_alts=False))
        if len(alts) >= 2:
            break
    return alts


def _find_swap_food(
    original_food_name: str,
    category_foods: list[dict],
    medications: list[str],
) -> dict | None:
    for food in category_foods:
        if food.get("name") == original_food_name:
            continue
        interactions = check_interactions(medications, [food.get("name", "")])
        if not any(i.severity == "Nguy hiểm" for i in interactions):
            return food
    return None


def _is_dangerous(food_name: str, medications: list[str]) -> bool:
    if not medications:
        return False
    interactions = check_interactions(medications, [food_name])
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


def _item(food: dict | None, citation: str) -> FoodItem | None:
    if food is None:
        return None
    return _dict_to_food_item(food, citation, with_alts=True)


def _apply_interaction_swaps(
    days: list[DayPlan],
    medications: list[str],
    veggie_foods: list[dict],
    protein_foods: list[dict],
    citation: str,
) -> list[Swap]:
    swaps: list[Swap] = []
    for day in days:
        for meal in day.meals:
            for i, item in enumerate(meal.items):
                interactions = check_interactions(medications, [item.name])
                dangerous = [inter for inter in interactions if inter.severity == "Nguy hiểm"]
                if not dangerous:
                    meal.items[i] = _ensure_safe_alternatives(item, medications)
                    continue
                inter_info = dangerous[0]
                pool = veggie_foods if "rau" in item.name.lower() else protein_foods
                alt = _find_swap_food(item.name, pool, medications)
                if not alt:
                    continue
                alt_item = _dict_to_food_item(alt, citation, with_alts=True)
                alt_item = _ensure_safe_alternatives(alt_item, medications)
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


def _filter_allergic_alternatives(days: list[DayPlan], profile: PatientProfile) -> None:
    by_id = _foods_by_id()
    allergies = profile.allergies or []
    preferences = profile.preferences or []
    for day in days:
        for meal in day.meals:
            for item in meal.items:
                item.alternatives = [
                    alt
                    for alt in item.alternatives
                    if not (
                        _is_allergic(by_id.get(alt.food_id or "", {}), allergies)
                        or _blocked_by_preference(by_id.get(alt.food_id or "", {}), preferences)
                    )
                ]


def _ensure_safe_alternatives(item: FoodItem, medications: list[str]) -> FoodItem:
    safe = [
        alt
        for alt in item.alternatives
        if not _is_dangerous(alt.name, medications)
    ]
    item.alternatives = safe
    return item


def _hydrate_item_ids(
    item_ids: list[str],
    citation: str,
    allergies: list[str],
    preferences: list[str],
) -> list[FoodItem]:
    by_id = _foods_by_id()
    items: list[FoodItem] = []
    for food_id in item_ids:
        raw = by_id.get(food_id)
        if raw is None:
            continue
        if _is_allergic(raw, allergies) or _blocked_by_preference(raw, preferences):
            continue
        items.append(_dict_to_food_item(raw, citation, with_alts=True))
    return items


def _try_llm_plan(
    profile: PatientProfile,
    days_count: int,
    notes: str,
    priorities: list[str],
    citation: str,
) -> list[DayPlan] | None:
    from app.core.llm import get_chat_llm, llm_configured

    if not llm_configured():
        return None

    catalog = _load_food_db()
    compact = [
        {
            "id": f.get("id"),
            "name": f.get("name"),
            "category": f.get("category"),
            "kcal": f.get("kcal"),
            "portion": f.get("portion"),
        }
        for f in catalog
        if not _is_allergic(f, profile.allergies or [])
        and not _blocked_by_preference(f, profile.preferences or [])
    ]
    if not compact:
        return None

    prompt = f"""Bạn là chuyên gia dinh dưỡng lâm sàng. Tạo thực đơn {days_count} ngày.
CHỈ được chọn món từ catalog (dùng đúng id). Không bịa món mới.

HỒ SƠ BỆNH NHÂN:
{json.dumps(profile.model_dump(), ensure_ascii=False)}

GHI CHÚ BÁC SĨ: {notes or "(không)"}
ƯU TIÊN: {", ".join(priorities) if priorities else "(không)"}

CATALOG:
{json.dumps(compact, ensure_ascii=False)}

QUY TẮC:
- Mỗi ngày đủ breakfast, lunch, dinner, snack.
- Breakfast: tinh_bot + protein/trứng + đồ uống hoặc trái cây.
- Lunch: tinh_bot + protein + rau + canh (nếu có).
- Dinner: tinh_bot + protein + rau.
- Snack: trái cây hoặc sữa chua.
- Tôn trọng dị ứng, thuốc, target_kcal.
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
            items = _hydrate_item_ids(ids, citation, allergies, preferences)
            if not items:
                return None
            meals.append(Meal(slot=slot, items=items))
        days.append(DayPlan(day_index=idx, meals=meals))
    return days


def _rule_based_days(
    profile: PatientProfile,
    days_count: int,
    citation: str,
) -> list[DayPlan]:
    safe = _get_safe_food_items(profile)
    diseases = profile.disease or []

    proteins = _protein_pool(safe)
    starch = list(safe["tinh_bot"])
    veggies = list(safe["rau"])
    fruit = list(safe["trai_cay"])
    drinks = list(safe["do_uong"]) or list(safe["trung_sua"])
    soups = list(safe["canh"])
    dairy = list(safe["trung_sua"])

    all_foods = _load_food_db()
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

    days: list[DayPlan] = []
    for day_idx in range(1, days_count + 1):
        b_items = [
            _item(_pick(pref_starch, day_idx - 1), citation),
            _item(_pick(proteins, day_idx * 2), citation),
            _item(_pick(drinks or dairy or fruit, day_idx), citation),
        ]
        l_items = [
            _item(_pick(pref_starch, day_idx), citation),
            _item(_pick(proteins, day_idx + 1), citation),
            _item(_pick(veggies, day_idx - 1), citation),
        ]
        soup = _pick(soups, day_idx) if soups else None
        if soup:
            l_items.append(_item(soup, citation))
        d_items = [
            _item(_pick(pref_starch, day_idx + 2), citation),
            _item(_pick(proteins, day_idx + 3), citation),
            _item(_pick(veggies, day_idx), citation),
        ]
        s_items = [_item(_pick(fruit, day_idx), citation)]

        days.append(
            DayPlan(
                day_index=day_idx,
                meals=[
                    Meal(slot="breakfast", items=[i for i in b_items if i is not None]),
                    Meal(slot="lunch", items=[i for i in l_items if i is not None]),
                    Meal(slot="dinner", items=[i for i in d_items if i is not None]),
                    Meal(slot="snack", items=[i for i in s_items if i is not None]),
                ],
            )
        )
    return days


def generate_meal_plan(
    profile: PatientProfile | dict[str, Any],
    days_count: int = 7,
    variant_group_id: str | None = None,
    variant_index: int | None = None,
    total_variants: int | None = None,
    notes: str = "",
    priorities: list[str] | None = None,
) -> MealPlanOutput:
    """Generate a full multi-day personalized medical meal plan."""
    if isinstance(profile, dict):
        profile_obj = PatientProfile(**profile)
    else:
        profile_obj = profile

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
    )
    if days is None:
        days = _rule_based_days(profile_obj, days_count, citation)

    _filter_allergic_alternatives(days, profile_obj)

    safe = _get_safe_food_items(profile_obj)
    swaps = _apply_interaction_swaps(
        days,
        medications,
        safe["rau"],
        _protein_pool(safe),
        citation,
    )

    for day in days:
        day.totals = calculate_day_totals(day)
        day.warnings = validate_nutrition(
            day,
            target_kcal=target_kcal,
            restrictions=profile_obj.restrictions,
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
) -> MealPlanOutput:
    """Main entry point for MealPlannerAgent."""
    return generate_meal_plan(profile, notes=notes, priorities=priorities)
