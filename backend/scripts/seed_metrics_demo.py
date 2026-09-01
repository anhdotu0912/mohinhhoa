"""Seed 7-day body metrics for demo_patient_1 so the overlay chart has lines.

Usage (from backend/):
  python -m scripts.seed_metrics_demo
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import argparse
import sys
from pathlib import Path

# Ensure backend directory is in sys.path when script is executed directly
_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from app.core.datetime_vn import VN_TZ, vn_today
from app.db.session import Base, SessionLocal, engine
import app.models  # noqa: F401 - ensure all tables are registered on Base.metadata
from app.models.body_metrics import BodyMetricsEntry
from app.models.profile import Profile
from app.models.user import User

USER_ID = "demo_patient_1"
HEIGHT_CM = 170.0
SEED_NOTE = "metrics_chart_demo"

# day_offset 6 = oldest in window, 0 = today (VN).
# Slight downward trend so the "Đang giảm" trend chip has a clean signal to detect.
SERIES: list[dict] = [
    {
        "offset": 6,
        "weight": 72.8,
        "waist_cm": 94.0,
        "systolic": 138,
        "diastolic": 86,
        "glucose_fasting": 7.9,
        "glucose_postprandial": 10.6,
        "hba1c": 7.1,
    },
    {
        "offset": 5,
        "weight": 72.5,
        "waist_cm": 93.6,
        "systolic": 136,
        "diastolic": 84,
        "glucose_fasting": 7.6,
        "glucose_postprandial": 10.1,
        "hba1c": None,
    },
    {
        "offset": 4,
        "weight": 72.2,
        "waist_cm": None,
        "systolic": 134,
        "diastolic": 83,
        "glucose_fasting": 7.4,
        "glucose_postprandial": 9.7,
        "hba1c": None,
    },
    {
        "offset": 3,
        "weight": 71.9,
        "waist_cm": 93.0,
        "systolic": 132,
        "diastolic": 81,
        "glucose_fasting": 7.1,
        "glucose_postprandial": 9.3,
        "hba1c": 6.9,
    },
    {
        "offset": 2,
        "weight": 71.6,
        "waist_cm": 92.6,
        "systolic": 130,
        "diastolic": 80,
        "glucose_fasting": 6.8,
        "glucose_postprandial": 8.9,
        "hba1c": None,
    },
    {
        "offset": 1,
        "weight": 71.4,
        "waist_cm": 92.3,
        "systolic": 129,
        "diastolic": 79,
        "glucose_fasting": 6.5,
        "glucose_postprandial": 8.6,
        "hba1c": None,
    },
    {
        "offset": 0,
        "weight": 71.2,
        "waist_cm": 92.0,
        "systolic": 128,
        "diastolic": 78,
        "glucose_fasting": 6.2,
        "glucose_postprandial": 8.4,
        "hba1c": 6.8,
    },
]


def _bmi(weight: float, height: float = HEIGHT_CM) -> float:
    m = (height or HEIGHT_CM) / 100.0
    return round(weight / (m * m), 1)


def _recorded_at(offset: int) -> datetime:
    day = vn_today() - timedelta(days=offset)
    vn_dt = datetime(day.year, day.month, day.day, 7, 30, tzinfo=VN_TZ)
    return vn_dt.astimezone(UTC).replace(tzinfo=None)


def seed(target_user_id: str = USER_ID) -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Check if target_user_id is an email, find user_id
        if "@" in target_user_id:
            user_row = db.query(User).filter(User.email == target_user_id).first()
            if user_row:
                target_user_id = user_row.id
            else:
                print(f"Warning: User with email '{target_user_id}' not found. Using as raw ID.")

        deleted = (
            db.query(BodyMetricsEntry)
            .filter(
                BodyMetricsEntry.user_id == target_user_id,
                BodyMetricsEntry.note == SEED_NOTE,
            )
            .delete(synchronize_session=False)
        )

        today = vn_today()
        window_start = datetime(today.year, today.month, today.day, tzinfo=VN_TZ) - timedelta(days=6)
        window_start_utc = window_start.astimezone(UTC).replace(tzinfo=None)
        extra = (
            db.query(BodyMetricsEntry)
            .filter(
                BodyMetricsEntry.user_id == target_user_id,
                BodyMetricsEntry.recorded_by == "patient",
                BodyMetricsEntry.recorded_at >= window_start_utc,
            )
            .delete(synchronize_session=False)
        )

        profile = db.query(Profile).filter(Profile.user_id == target_user_id).first()
        height_cm = (profile.height if profile and profile.height else HEIGHT_CM)

        latest = SERIES[-1]
        for row in SERIES:
            weight = row["weight"]
            sys_val = row["systolic"]
            dia_val = row["diastolic"]
            fasting = row["glucose_fasting"]
            db.add(
                BodyMetricsEntry(
                    id=str(uuid.uuid4()),
                    user_id=target_user_id,
                    weight=weight,
                    height=height_cm,
                    bmi=_bmi(weight, height_cm),
                    waist_cm=row["waist_cm"],
                    systolic=sys_val,
                    diastolic=dia_val,
                    glucose_fasting=fasting,
                    glucose_postprandial=row["glucose_postprandial"],
                    hba1c=row["hba1c"],
                    blood_pressure=f"{sys_val}/{dia_val} mmHg",
                    blood_glucose=f"{fasting} mmol/L",
                    note=SEED_NOTE,
                    recorded_by="patient",
                    recorded_at=_recorded_at(row["offset"]),
                )
            )

        if profile is not None:
            profile.weight = latest["weight"]
            profile.height = height_cm
            profile.bmi = _bmi(latest["weight"], height_cm)
            profile.blood_pressure = f"{latest['systolic']}/{latest['diastolic']} mmHg"
            profile.blood_glucose = f"{latest['glucose_fasting']} mmol/L"

        db.commit()
        print(
            f"✅ Seeded {len(SERIES)} metric days (7-day time series) for user '{target_user_id}' "
            f"(removed {deleted} prior seed rows, {extra} other patient rows in window)."
        )
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed 7-day metric data for chart demo")
    parser.add_argument(
        "--user-id",
        type=str,
        default=USER_ID,
        help="Target user_id or email (default: demo_patient_1)",
    )
    args = parser.parse_args()
    seed(target_user_id=args.user_id)
