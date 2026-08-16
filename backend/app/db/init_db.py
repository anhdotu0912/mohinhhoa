"""Create tables and seed demo accounts on startup."""

from __future__ import annotations

import logging
from datetime import timedelta

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.session import Base, SessionLocal, engine
from app.models.catalog import Allergy, Diagnosis, Medicine
from app.models.profile import Profile
from app.models.user import User

logger = logging.getLogger(__name__)

# Demo accounts: user_id must match the agent's `_DEMO_PROFILES` keys so that
# the LangGraph profile_loader can personalize chat/meal-plan for these users.
DEMO_ACCOUNTS = [
    {
        "user_id": "demo_patient_1",
        "email": "demo_patient_1@example.com",
        "role": "patient",
        "profile": {
            "disease": ["diabetes_t2"],
            "medications": ["metformin"],
            "allergies": ["hải sản"],
            "bmi": 26.5,
            "weight": 72,
            "height": 170,
            "age": 45,
            "gender": "Nam",
            "phone": "0901 234 567",
            "address": "Quận 1, TP. Hồ Chí Minh",
            "blood_pressure": "130/80 mmHg",
            "blood_glucose": "135 mg/dL",
            "target_kcal": 1800,
            "restrictions": {"carb_per_meal": 45, "sodium_daily": 2300},
            "preferences": ["thích ăn cơm", "không ăn thịt bò"],
            "treatment_goals": [
                "Kiểm soát đường huyết ổn định (HbA1c < 7%).",
                "Giảm cân 2kg trong 1 tháng thông qua chế độ ăn và tập thể dục.",
                "Duy trì huyết áp dưới 130/80 mmHg.",
            ],
        },
    },
    {
        "user_id": "demo_patient_2",
        "email": "demo_patient_2@example.com",
        "role": "patient",
        "profile": {
            "disease": ["diabetes_t2"],
            "medications": ["metformin", "atorvastatin", "amlodipine"],
            "allergies": [],
            "bmi": 28.0,
            "weight": 58,
            "height": 162,
            "age": 52,
            "gender": "Nữ",
            "phone": "0912 345 678",
            "address": "Quận 3, TP. Hồ Chí Minh",
            "blood_pressure": "120/80 mmHg",
            "blood_glucose": "105 mg/dL",
            "target_kcal": 1600,
            "restrictions": {"carb_per_meal": 40, "sodium_daily": 1500},
            "preferences": ["ăn chay 2 ngày/tuần"],
            "treatment_goals": [
                "Hạ Triglyceride máu xuống dưới 1.7 mmol/L.",
                "Giảm natri trong khẩu phần ăn dưới 2000mg/ngày.",
                "Duy trì chỉ số Creatinine máu ở mức an toàn.",
            ],
        },
    },
    {
        "user_id": "demo_patient_3",
        "email": "demo_patient_3@example.com",
        "role": "patient",
        "profile": {
            "disease": ["diabetes_t2"],
            "medications": ["glipizide", "lisinopril"],
            "allergies": [],
            "bmi": 24.0,
            "weight": 70,
            "height": 170,
            "age": 60,
            "gender": "Nam",
            "phone": "0923 456 789",
            "address": "Bình Thạnh, TP. Hồ Chí Minh",
            "blood_pressure": "145/95 mmHg",
            "blood_glucose": "6.2 mmol/L",
            "target_kcal": 2000,
            "restrictions": {"carb_per_meal": 50, "sodium_daily": 2000},
            "preferences": ["thích ăn cá"],
            "treatment_goals": ["Duy trì acid uric dưới 360 µmol/L."],
        },
    },
    {
        "user_id": "demo_doctor",
        "email": "demo_doctor@example.com",
        "role": "doctor",
        "profile": None,
    },
]

DEMO_PASSWORD = "demo1234"

CATALOG_MEDICINES = [
    "Metformin 500mg",
    "Amlodipine 5mg",
    "Atorvastatin 10mg",
    "Warfarin 5mg",
    "Allopurinol 100mg",
    "Losartan 50mg",
    "Glimepiride 2mg",
    "Insulin (tiêm)",
    "Perindopril 5mg",
    "Febuxostat 80mg",
    "Aspirin 81mg",
    "Furosemide 40mg",
]

CATALOG_ALLERGIES = [
    "Hải sản",
    "Đậu phộng",
    "Sữa (lactose)",
    "Trứng",
    "Gluten",
    "Penicillin",
    "Sulfonamides",
    "Phấn hoa",
    "Bụi mịn",
    "Hạt mè",
]

CATALOG_DIAGNOSES = [
    ("diabetes_t2", "Tiểu đường type 2"),
    ("hypertension", "Tăng huyết áp"),
    ("ckd", "Suy thận mạn"),
    ("gout", "Gout"),
    ("dyslipidemia", "Rối loạn lipid máu"),
    ("nafld", "Gan nhiễm mỡ"),
    ("obesity", "Béo phì"),
    ("asthma", "Hen phế quản"),
]


def _migrate_legacy_dietitian(db: Session) -> None:
    """Map legacy role/account `dietitian` → `doctor` (idempotent)."""
    for user in db.query(User).filter(User.role == "dietitian").all():
        user.role = "doctor"
        logger.info("Migrated role dietitian → doctor for %s", user.email)

    legacy = db.get(User, "demo_dietitian")
    if legacy is not None:
        legacy.role = "doctor"
        doctor_exists = db.get(User, "demo_doctor") is not None
        email_taken = (
            db.query(User)
            .filter(User.email == "demo_doctor@example.com", User.id != legacy.id)
            .first()
            is not None
        )
        if not doctor_exists and not email_taken:
            legacy.email = "demo_doctor@example.com"
            logger.info("Renamed demo_dietitian email → demo_doctor@example.com")

    db.commit()


def seed_demo_accounts(db: Session) -> None:
    _migrate_legacy_dietitian(db)
    for account in DEMO_ACCOUNTS:
        user = db.get(User, account["user_id"])
        if user is not None:
            user.role = account["role"]
            user.email = account["email"]
        else:
            by_email = db.query(User).filter(User.email == account["email"]).first()
            if by_email is not None:
                by_email.role = account["role"]
                user = by_email
            else:
                user = User(
                    id=account["user_id"],
                    email=account["email"],
                    hashed_password=hash_password(DEMO_PASSWORD),
                    role=account["role"],
                )
                db.add(user)
                db.flush()
        profile_data = account["profile"]
        if profile_data is not None:
            profile = (
                db.query(Profile).filter(Profile.user_id == user.id).first()
            )
            if profile is None:
                profile = Profile(user_id=user.id)
                db.add(profile)
            # Upsert deterministic demo profile fields (idempotent)
            for key, value in profile_data.items():
                setattr(profile, key, value)
            db.flush()
        logger.info("Seeded demo account %s", account["email"])
    db.commit()


def _migrate_add_full_name(db: Session) -> None:
    """Add users.full_name to existing SQLite DBs (idempotent).

    `create_all` only creates missing tables, so old DB files need ALTER.
    """
    from sqlalchemy import inspect, text

    columns = [c["name"] for c in inspect(engine).get_columns("users")]
    if "full_name" in columns:
        return
    db.execute(text("ALTER TABLE users ADD COLUMN full_name VARCHAR(255)"))
    db.commit()
    logger.info("Added users.full_name column")


def _migrate_add_body_metrics(db: Session) -> None:
    """Add profiles.weight/height to existing SQLite DBs (idempotent)."""
    from sqlalchemy import inspect, text

    columns = [c["name"] for c in inspect(engine).get_columns("profiles")]
    missing = [col for col in ("weight", "height") if col not in columns]
    if not missing:
        return
    for col in missing:
        db.execute(text(f"ALTER TABLE profiles ADD COLUMN {col} FLOAT"))
    db.commit()
    logger.info("Added profiles columns: %s", ", ".join(missing))


def _migrate_add_profile_detail(db: Session) -> None:
    """Add profiles detail columns to existing SQLite DBs (idempotent)."""
    from sqlalchemy import inspect, text

    columns = [c["name"] for c in inspect(engine).get_columns("profiles")]
    new_columns = {
        "age": "INTEGER",
        "gender": "VARCHAR(20)",
        "phone": "VARCHAR(32)",
        "address": "VARCHAR(255)",
        "blood_pressure": "VARCHAR(32)",
        "blood_glucose": "VARCHAR(32)",
        "treatment_goals": "JSON",
    }
    missing = {col: dtype for col, dtype in new_columns.items() if col not in columns}
    if not missing:
        return
    for col, dtype in missing.items():
        db.execute(text(f"ALTER TABLE profiles ADD COLUMN {col} {dtype}"))
    db.commit()
    logger.info("Added profiles columns: %s", ", ".join(missing))


def _migrate_add_user_avatar(db: Session) -> None:
    """Add users.avatar to existing SQLite DBs (idempotent)."""
    from sqlalchemy import inspect, text

    columns = [c["name"] for c in inspect(engine).get_columns("users")]
    if "avatar" not in columns:
        db.execute(text("ALTER TABLE users ADD COLUMN avatar VARCHAR(500)"))
        db.commit()
        logger.info("Added users.avatar column")


def _migrate_widen_alert_severity(db: Session) -> None:
    """Widen alerts.severity for extended clinical labels (idempotent).

    Interaction checker may emit values like
    ``Nguy hiểm — Nguy cơ hạ đường huyết CAO`` (>20 chars).
    """
    from sqlalchemy import inspect, text

    try:
        columns = {c["name"]: c for c in inspect(engine).get_columns("alerts")}
    except Exception:
        return
    if "severity" not in columns:
        return
    length = getattr(columns["severity"]["type"], "length", None)
    if length is not None and length >= 100:
        return

    dialect = engine.dialect.name
    if dialect == "postgresql":
        db.execute(text("ALTER TABLE alerts ALTER COLUMN severity TYPE VARCHAR(100)"))
        db.commit()
        logger.info("Widened alerts.severity to VARCHAR(100)")
    # SQLite ignores VARCHAR length at runtime; model change is enough for new DBs.


def seed_catalog(db: Session) -> None:
    """Seed danh mục thuốc/dị ứng/chẩn đoán (idempotent theo tên/code)."""
    for name in CATALOG_MEDICINES:
        if db.query(Medicine).filter(Medicine.name == name).first() is None:
            db.add(Medicine(name=name))
    for name in CATALOG_ALLERGIES:
        if db.query(Allergy).filter(Allergy.name == name).first() is None:
            db.add(Allergy(name=name))
    for code, label in CATALOG_DIAGNOSES:
        if db.query(Diagnosis).filter(Diagnosis.code == code).first() is None:
            db.add(Diagnosis(code=code, name=label))
    db.commit()
    logger.info(
        "Seeded catalog: %d medicines, %d allergies, %d diagnoses",
        len(CATALOG_MEDICINES),
        len(CATALOG_ALLERGIES),
        len(CATALOG_DIAGNOSES),
    )


def _migrate_add_meal_plan_dates(db: Session) -> None:
    """Add meal_plans.starts_on/ends_on; one-time backfill only when columns are new."""
    from sqlalchemy import inspect, text

    from app.models.meal_plan import MealPlan
    from app.services import plan_expiry
    from app.services.plan_apply import reconcile_overlapping_applied_plans

    try:
        columns = [c["name"] for c in inspect(engine).get_columns("meal_plans")]
    except Exception:
        return
    missing = [col for col in ("starts_on", "ends_on") if col not in columns]
    for col in missing:
        db.execute(text(f"ALTER TABLE meal_plans ADD COLUMN {col} DATE"))
    if missing:
        db.commit()
        logger.info("Added meal_plans columns: %s", ", ".join(missing))
        # Legacy approve==apply: stamp windows only the first time columns appear.
        # Re-running this on every startup would re-apply unassigned approved plans.
        rows = (
            db.query(MealPlan)
            .filter(
                MealPlan.status.in_(plan_expiry.EXPIRY_ELIGIBLE_STATUSES),
                MealPlan.starts_on.is_(None),
            )
            .all()
        )
        for row in rows:
            duration = plan_expiry.duration_days(len(row.days or []))
            start = plan_expiry.start_date(row.reviewed_at, row.created_at)
            if start is None:
                continue
            row.starts_on = start
            row.ends_on = start + timedelta(days=duration - 1)
        if rows:
            db.commit()
            logger.info("Backfilled meal plan dates for %d rows", len(rows))

    n = reconcile_overlapping_applied_plans(db)
    if n:
        db.commit()
        logger.info("Unapplied %d overlapping meal plans (one plan per week)", n)


def init_db() -> None:
    """Create all tables and seed demo accounts (idempotent)."""
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        _migrate_add_full_name(db)
        _migrate_add_user_avatar(db)
        _migrate_add_body_metrics(db)
        _migrate_add_profile_detail(db)
        _migrate_widen_alert_severity(db)
        _migrate_add_meal_plan_dates(db)
        seed_demo_accounts(db)
        seed_catalog(db)
