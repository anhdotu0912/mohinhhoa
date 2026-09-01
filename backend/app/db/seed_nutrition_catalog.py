"""Seed nutrition catalog tables from data/clean/*.json (Postgres only)."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.catalog import Medicine
from app.models.nutrition_catalog import DrugProduct, DrugRule, FoodComposition, Recipe

logger = logging.getLogger(__name__)

_REPO_ROOT = Path(__file__).resolve().parents[3]


@dataclass(frozen=True)
class SeedCounts:
    foods: int
    recipes: int
    drug_products: int
    drug_rules: int
    medicines: int


def default_data_dir() -> Path:
    """Resolve catalog JSON directory (Docker /data/clean or repo data/clean)."""
    for candidate in (Path("/data/clean"), _REPO_ROOT / "data" / "clean"):
        if candidate.exists():
            return candidate
    return _REPO_ROOT / "data" / "clean"


def _load_json(path: Path) -> list | dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _upsert_foods(db: Session, rows: list[dict]) -> int:
    count = 0
    for raw in rows:
        name = raw.get("name") or {}
        row = db.get(FoodComposition, raw["_id"])
        if row is None:
            row = FoodComposition(id=raw["_id"])
            db.add(row)
        row.name_vi = name.get("vi", "")
        row.name_en = name.get("en")
        row.normalized_vi = name.get("normalized_vi")
        row.aliases = name.get("aliases") or []
        row.food_group = (raw.get("classification") or {}).get("food_group", "")
        row.basis_g = float((raw.get("measurement") or {}).get("basis_g") or 100)
        row.nutrition = raw.get("nutrition_per_100g_edible") or {}
        row.diabetes_metadata = raw.get("diabetes_metadata") or {}
        row.source = raw.get("source") or {}
        count += 1
    db.flush()
    return count


def _upsert_recipes(db: Session, rows: list[dict]) -> int:
    count = 0
    for raw in rows:
        row = db.get(Recipe, raw["_id"])
        if row is None:
            row = Recipe(id=raw["_id"])
            db.add(row)
        row.name_vi = raw.get("name_vi", "")
        row.category = raw.get("category", "")
        row.cooking_method = raw.get("cooking_method")
        row.servings = int(raw.get("servings") or 1)
        row.ingredients = raw.get("ingredients") or []
        row.nutrition = raw.get("nutrition_calculated_from_main_ingredients") or {}
        row.diabetes_screening = raw.get("diabetes_screening") or {}
        row.source = raw.get("source") or {}
        count += 1
    db.flush()
    return count


def _upsert_drug_products(db: Session, rows: list[dict]) -> int:
    count = 0
    for raw in rows:
        row = db.get(DrugProduct, raw["productId"])
        if row is None:
            row = DrugProduct(id=raw["productId"])
            db.add(row)
        row.product_name = raw.get("productName", "")
        row.normalized_name = raw.get("normalizedName", "")
        row.aliases = raw.get("aliases") or []
        row.active_ingredient_text = raw.get("activeIngredientText", "")
        row.active_key = raw.get("activeKey", "")
        row.drug_class = raw.get("drugClass")
        row.formulation_profile = raw.get("formulationProfile")
        row.rule_id = raw.get("ruleId")
        row.sources = raw.get("sources") or {}
        row.is_active = bool(raw.get("isActive", True))
        count += 1
    db.flush()
    return count


def _upsert_drug_rules(db: Session, rows: list[dict]) -> int:
    count = 0
    for raw in rows:
        row = db.get(DrugRule, raw["ruleId"])
        if row is None:
            row = DrugRule(id=raw["ruleId"])
            db.add(row)
        row.version = int(raw.get("version") or 1)
        row.active_key = raw.get("activeKey", "")
        row.active_ingredients = raw.get("activeIngredients") or []
        row.drug_class = raw.get("drugClass")
        row.formulation_profile = raw.get("formulationProfile")
        row.applicable_diabetes_types = raw.get("applicableDiabetesTypes") or []
        row.diabetes_applicability = raw.get("diabetesApplicability") or {}
        row.meal_timing = raw.get("mealTiming") or {}
        row.carbohydrate_rule = raw.get("carbohydrateRule") or {}
        row.safety = raw.get("safety") or {}
        row.sources = raw.get("sources") or {}
        row.is_active = bool(raw.get("isActive", True))
        count += 1
    db.flush()
    return count


def _upsert_medicines_from_products(db: Session, rows: list[dict]) -> int:
    added = 0
    for raw in rows:
        if not raw.get("isActive", True):
            continue
        name = (raw.get("productName") or "").strip()
        if not name:
            continue
        if db.query(Medicine).filter(Medicine.name == name).first() is None:
            db.add(Medicine(name=name))
            added += 1
    db.flush()
    return added


def seed_nutrition_catalog(db: Session, data_dir: Path | None = None) -> SeedCounts | None:
    """Upsert catalog rows from data/clean/*.json. Returns counts or None if data dir missing."""
    resolved = data_dir or default_data_dir()
    if not resolved.exists():
        logger.warning("Nutrition catalog seed skipped — data dir not found: %s", resolved)
        return None

    foods = _load_json(resolved / "foods.sample.json")
    recipes = _load_json(resolved / "recipes.sample.json")
    drug_products = _load_json(resolved / "drug_products.json")
    drug_rules = _load_json(resolved / "drug_rules.json")

    counts = SeedCounts(
        foods=_upsert_foods(db, foods),
        recipes=_upsert_recipes(db, recipes),
        drug_products=_upsert_drug_products(db, drug_products),
        drug_rules=_upsert_drug_rules(db, drug_rules),
        medicines=_upsert_medicines_from_products(db, drug_products),
    )
    db.commit()
    logger.info(
        "Seeded nutrition catalog from %s: foods=%d recipes=%d drug_products=%d drug_rules=%d medicines=%d",
        resolved,
        counts.foods,
        counts.recipes,
        counts.drug_products,
        counts.drug_rules,
        counts.medicines,
    )
    return counts
