"""Seed nutrition catalog tables from data/clean/*.json into DATABASE_URL (Postgres).

Usage (from repo root or backend/):
    python backend/scripts/seed_nutrition_catalog.py

Requires DATABASE_URL pointing to Postgres (reads .env at repo root).
Idempotent: upserts by primary key on each run.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

load_dotenv()
load_dotenv(REPO_ROOT / ".env", override=True)
load_dotenv(BACKEND_DIR / ".env", override=True)

from app.db.session import Base  # noqa: E402
import app.models  # noqa: E402,F401
from app.models.catalog import Medicine  # noqa: E402
from app.models.nutrition_catalog import DrugProduct, DrugRule, FoodComposition, Recipe  # noqa: E402


def _normalize_url(url: str) -> str:
    url = url.strip()
    if url.startswith("postgres://"):
        return "postgresql://" + url[len("postgres://") :]
    return url


def _target_url() -> str:
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        sys.exit(
            "ERROR: chưa set DATABASE_URL (Postgres). "
            "Đặt trong .env hoặc export trước khi chạy."
        )
    url = _normalize_url(url)
    if url.startswith("sqlite"):
        sys.exit("ERROR: DATABASE_URL đang trỏ tới SQLite — cần URL Postgres để seed catalog.")
    return url


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
    """Add commercial drug names to medicines catalog (idempotent by name)."""
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


def main() -> None:
    data_dir = REPO_ROOT / "data" / "clean"
    if not data_dir.exists():
        sys.exit(f"ERROR: không tìm thấy thư mục {data_dir}")

    target_url = _target_url()
    print(f"Target (Postgres): {target_url.split('@')[-1]}")
    print(f"Data dir: {data_dir}")

    engine = create_engine(target_url, pool_pre_ping=True)
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

    foods = _load_json(data_dir / "foods.sample.json")
    recipes = _load_json(data_dir / "recipes.sample.json")
    drug_products = _load_json(data_dir / "drug_products.json")
    drug_rules = _load_json(data_dir / "drug_rules.json")

    with SessionLocal() as db:
        n_foods = _upsert_foods(db, foods)
        n_recipes = _upsert_recipes(db, recipes)
        n_products = _upsert_drug_products(db, drug_products)
        n_rules = _upsert_drug_rules(db, drug_rules)
        n_meds = _upsert_medicines_from_products(db, drug_products)
        db.commit()

    print(f"  food_compositions: {n_foods} rows upserted")
    print(f"  recipes:           {n_recipes} rows upserted")
    print(f"  drug_products:     {n_products} rows upserted")
    print(f"  drug_rules:        {n_rules} rows upserted")
    print(f"  medicines (new):   {n_meds} names added")
    print("Done — seed idempotent, safe to re-run.")


if __name__ == "__main__":
    main()
