"""Trim duplicate meal plans — keep 1 draft / 1 unassigned / active + upcoming per patient.

Usage (from backend/):
  python -m scripts.cleanup_meal_plans
"""

from __future__ import annotations

import json
import logging

from app.db.session import SessionLocal
from app.services.plan_limits import cleanup_all_patient_meal_plans

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main() -> None:
    db = SessionLocal()
    try:
        totals = cleanup_all_patient_meal_plans(db)
        db.commit()
        logger.info("Meal plan cleanup done: %s", json.dumps(totals, ensure_ascii=False))
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
