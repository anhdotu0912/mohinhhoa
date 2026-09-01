"""Seed nutrition catalog tables from data/clean/*.json into DATABASE_URL (Postgres).

Usage (from repo root or backend/):
    python backend/scripts/seed_nutrition_catalog.py

Requires DATABASE_URL pointing to Postgres (reads .env at repo root).
Idempotent: upserts by primary key on each run.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

load_dotenv()
load_dotenv(REPO_ROOT / ".env", override=True)
load_dotenv(BACKEND_DIR / ".env", override=True)

from app.db.seed_nutrition_catalog import default_data_dir, seed_nutrition_catalog  # noqa: E402
from app.db.session import Base  # noqa: E402
import app.models  # noqa: E402,F401


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


def main() -> None:
    data_dir = default_data_dir()
    if not data_dir.exists():
        sys.exit(f"ERROR: không tìm thấy thư mục {data_dir}")

    target_url = _target_url()
    print(f"Target (Postgres): {target_url.split('@')[-1]}")
    print(f"Data dir: {data_dir}")

    engine = create_engine(target_url, pool_pre_ping=True)
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

    with SessionLocal() as db:
        counts = seed_nutrition_catalog(db, data_dir)
        if counts is None:
            sys.exit(1)

    print(f"  food_compositions: {counts.foods} rows upserted")
    print(f"  recipes:           {counts.recipes} rows upserted")
    print(f"  drug_products:     {counts.drug_products} rows upserted")
    print(f"  drug_rules:        {counts.drug_rules} rows upserted")
    print(f"  medicines (new):   {counts.medicines} names added")
    print("Done — seed idempotent, safe to re-run.")


if __name__ == "__main__":
    main()
