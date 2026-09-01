"""Seed compliance demo data for doctor compliance page.

Data lands in existing tables (no compliance_summary table):
  - notifications (type=adherence_checkin, status=done, payload.adherence)
  - alerts (severity Nguy hiểm / Cần chú ý)

Usage (from backend/):
  python -m scripts.seed_compliance_demo
"""

from __future__ import annotations

from datetime import date, datetime, timedelta

from app.db.session import SessionLocal
from app.models.alert import Alert
from app.models.notification import Notification
from app.models.user import User

SEED_TAG = "compliance_demo"

# day_offset (0=today) → adherence for each demo patient
CHECKIN_SCHEDULE: dict[str, list[tuple[int, str]]] = {
    "demo_patient_1": [
        (0, "yes"),
        (1, "yes"),
        (2, "partial"),
        (3, "yes"),
        (4, "yes"),
        (5, "yes"),
        (6, "yes"),
        (8, "yes"),
        (9, "yes"),
        (10, "partial"),
        (11, "yes"),
        (12, "yes"),
    ],
    "demo_patient_2": [
        (0, "partial"),
        (1, "yes"),
        (2, "no"),
        (3, "partial"),
        (4, "yes"),
        (5, "partial"),
        (6, "yes"),
        (7, "no"),
        (9, "yes"),
        (10, "partial"),
        (11, "yes"),
    ],
    "demo_patient_3": [
        (0, "no"),
        (1, "partial"),
        (2, "no"),
        (3, "partial"),
        (4, "no"),
        (5, "yes"),
        (6, "partial"),
        (7, "no"),
        (8, "partial"),
        (10, "no"),
        (12, "partial"),
    ],
}

ALERT_SAMPLES: dict[str, list[tuple[str, str, str, str]]] = {
    "demo_patient_1": [
        (
            "metformin",
            "rượu bia",
            "Nguy hiểm",
            "Tránh uống rượu bia khi dùng metformin — tăng nguy cơ acid lactic.",
        ),
    ],
    "demo_patient_2": [
        (
            "atorvastatin",
            "bưởi",
            "Cần chú ý",
            "Bưởi có thể tăng nồng độ statin — hạn chế hoặc tránh.",
        ),
        (
            "amlodipine",
            "rau muống",
            "Cần chú ý",
            "Rau muống giàu kali — theo dõi huyết áp và kali máu.",
        ),
    ],
    "demo_patient_3": [
        (
            "glipizide",
            "đồ ngọt",
            "Nguy hiểm",
            "Đường huyết có thể tăng/giảm bất thường — ưu tiên bữa ăn đúng giờ.",
        ),
    ],
}


def _clear_seed_rows(db) -> None:
    notif_rows = db.query(Notification).all()
    for row in notif_rows:
        if (row.related_ids or {}).get("seed") == SEED_TAG:
            db.delete(row)

    alert_rows = db.query(Alert).all()
    for row in alert_rows:
        if (row.sources or []) == [SEED_TAG]:
            db.delete(row)


def _seed_checkins(db, patient_id: str, schedule: list[tuple[int, str]]) -> int:
    today = date.today()
    count = 0
    for day_offset, adherence in schedule:
        day = today - timedelta(days=day_offset)
        scheduled_at = datetime.combine(day, datetime.min.time().replace(hour=21))
        db.add(
            Notification(
                user_id=patient_id,
                type="adherence_checkin",
                title=f"Kiểm tra tuân thủ — {day.isoformat()}",
                body="Hôm nay bạn đã tuân thủ thực đơn như thế nào?",
                scheduled_at=scheduled_at,
                status="done",
                related_ids={
                    "seed": SEED_TAG,
                    "day_offset": day_offset,
                    "meal_plan_id": "demo_plan",
                },
                payload={"adherence": adherence, "seed": SEED_TAG},
            )
        )
        count += 1
    return count


def _seed_alerts(db, patient_id: str, samples: list[tuple[str, str, str, str]]) -> int:
    today = date.today()
    count = 0
    for idx, (drug, food, severity, recommendation) in enumerate(samples):
        created_at = datetime.combine(
            today - timedelta(days=idx + 1),
            datetime.min.time().replace(hour=12, minute=30),
        )
        db.add(
            Alert(
                user_id=patient_id,
                drug=drug,
                food=food,
                mechanism="Demo seed — tương tác thuốc thực phẩm.",
                severity=severity,
                recommendation=recommendation,
                sources=[SEED_TAG],
                meal_plan_id="demo_plan",
                created_at=created_at,
            )
        )
        count += 1
    return count


def main() -> None:
    db = SessionLocal()
    try:
        _clear_seed_rows(db)
        db.flush()

        total_checkins = 0
        total_alerts = 0

        for patient_id, schedule in CHECKIN_SCHEDULE.items():
            user = db.get(User, patient_id)
            if user is None:
                print(f"SKIP {patient_id}: user not found")
                continue
            n = _seed_checkins(db, patient_id, schedule)
            total_checkins += n
            print(f"OK {patient_id}: {n} adherence check-ins")

        for patient_id, samples in ALERT_SAMPLES.items():
            user = db.get(User, patient_id)
            if user is None:
                continue
            n = _seed_alerts(db, patient_id, samples)
            total_alerts += n
            print(f"OK {patient_id}: {n} alerts")

        db.commit()
        print(
            f"Done. Seeded {total_checkins} check-ins + {total_alerts} alerts "
            f"(tag={SEED_TAG}). Refresh /doctor/patients/compliance."
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
