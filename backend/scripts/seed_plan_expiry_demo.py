"""Seed mixed plan expiry demo data for demo_patient_1/2/3.

Usage (from repo root or backend/):
  python -m scripts.seed_plan_expiry_demo

Sets latest meal plan per demo patient to approved + backdated reviewed_at:
  - demo_patient_1 → expired
  - demo_patient_2 → expiring (còn ~1 ngày)
  - demo_patient_3 → expired
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.db.session import SessionLocal
from app.models.meal_plan import MealPlan
from app.models.user import User
from app.services import plan_expiry

TARGETS: dict[str, str] = {
    "demo_patient_1": "expired",
    "demo_patient_2": "expiring",
    "demo_patient_3": "expired",
}


def _backdate(plan: MealPlan, mode: str, now: datetime) -> None:
    duration = plan_expiry.duration_days(len(plan.days or []))
    if mode == "expiring":
        plan.reviewed_at = now - timedelta(days=max(1, duration - 2))
    else:
        plan.reviewed_at = now - timedelta(days=duration)
    plan.status = "approved"
    plan.trust_badge = "doctor_reviewed"


def main() -> None:
    db = SessionLocal()
    now = datetime.now(UTC)
    try:
        for patient_id, mode in TARGETS.items():
            user = db.get(User, patient_id)
            if user is None:
                print(f"SKIP {patient_id}: user not found")
                continue

            plan = (
                db.query(MealPlan)
                .filter(MealPlan.user_id == patient_id)
                .order_by(MealPlan.created_at.desc())
                .first()
            )
            if plan is None:
                print(f"SKIP {patient_id}: no meal plan — generate one first")
                continue

            _backdate(plan, mode, now)
            bucket = plan_expiry.bucket(plan.reviewed_at, plan.created_at, len(plan.days or []))
            left = plan_expiry.days_left(plan.reviewed_at, plan.created_at, len(plan.days or []))
            print(
                f"OK {patient_id}: plan={plan.id[:8]}… mode={mode} "
                f"bucket={bucket} days_left={left}"
            )

        db.commit()
        print("Done.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
