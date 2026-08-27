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
        "full_name": "Nguyễn Văn A",
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
        "full_name": "Trần Thị B",
        "profile": {
            "disease": ["diabetes_t2", "diabetic_neuropathy", "dyslipidemia"],
            "medications": ["metformin", "atorvastatin", "alpha-lipoic acid"],
            "allergies": [],
            "bmi": 22.1,
            "weight": 58,
            "height": 162,
            "age": 52,
            "gender": "Nữ",
            "phone": "0912 345 678",
            "address": "Quận 3, TP. Hồ Chí Minh",
            "blood_pressure": "120/80 mmHg",
            "blood_glucose": "5.6 mmol/L",
            "target_kcal": 1600,
            "restrictions": {"carb_per_meal": 40, "sodium_daily": 1500},
            "preferences": ["ăn chay 2 ngày/tuần"],
            "treatment_goals": [
                "Cải thiện triệu chứng tê bì bàn chân (QĐ 3510/QĐ-BYT).",
                "Hạ Triglyceride máu xuống dưới 1.7 mmol/L.",
                "Duy trì HbA1c < 6.5%.",
            ],
        },
    },
    {
        "user_id": "demo_patient_3",
        "email": "demo_patient_3@example.com",
        "role": "patient",
        "full_name": "Lê Văn C",
        "profile": {
            "disease": ["diabetes_t2", "hypertension", "diabetic_neuropathy"],
            "medications": ["glipizide", "lisinopril"],
            "allergies": [],
            "bmi": 26.8,
            "weight": 78,
            "height": 170,
            "age": 60,
            "gender": "Nam",
            "phone": "0923 456 789",
            "address": "Bình Thạnh, TP. Hồ Chí Minh",
            "blood_pressure": "145/95 mmHg",
            "blood_glucose": "6.2 mmol/L",
            "target_kcal": 1900,
            "restrictions": {"carb_per_meal": 45, "sodium_daily": 2000},
            "preferences": ["thức ăn mềm dễ tiêu", "chia nhỏ bữa"],
            "treatment_goals": [
                "Giảm khó tiêu/liệt dạ dày do đái tháo đường.",
                "Kiểm soát huyết áp < 130/80 mmHg.",
                "Tránh nguy cơ hạ đường huyết do thuốc Sulfonylurea.",
            ],
        },
    },
    {
        "user_id": "demo_patient_4",
        "email": "demo_patient_4@example.com",
        "role": "patient",
        "full_name": "Hoàng Thị Mai",
        "profile": {
            "disease": ["diabetes_gestational"],
            "medications": [],
            "allergies": [],
            "bmi": 23.5,
            "weight": 61,
            "height": 161,
            "age": 29,
            "gender": "Nữ",
            "phone": "0934 567 890",
            "address": "Quận Phú Nhuận, TP. Hồ Chí Minh",
            "blood_pressure": "115/75 mmHg",
            "blood_glucose": "5.1 mmol/L",
            "target_kcal": 1900,
            "restrictions": {"carb_per_meal": 45, "sodium_daily": 2000},
            "preferences": ["chia 3 bữa chính 3 bữa phụ", "uống sữa hạt"],
            "treatment_goals": [
                "Đường huyết đói thai kỳ ≤ 95 mg/dL, 2h sau ăn ≤ 120 mg/dL (QĐ 1470/QĐ-BYT).",
                "Phân bổ 3 bữa chính + 3 bữa phụ, ăn nhẹ trước khi ngủ chống ceton niệu.",
                "Đảm bảo thai nhi tăng trưởng đạt chuẩn chu vi vòng bụng.",
            ],
        },
    },
    {
        "user_id": "demo_patient_5",
        "email": "demo_patient_5@example.com",
        "role": "patient",
        "full_name": "Vũ Minh Khang",
        "profile": {
            "disease": ["diabetes_t1"],
            "medications": ["insulin glargine", "insulin aspart"],
            "allergies": ["đậu phộng"],
            "bmi": 21.0,
            "weight": 63,
            "height": 173,
            "age": 19,
            "gender": "Nam",
            "phone": "0945 678 901",
            "address": "Quận Cầu Giấy, Hà Nội",
            "blood_pressure": "118/75 mmHg",
            "blood_glucose": "6.5 mmol/L",
            "target_kcal": 2100,
            "restrictions": {"carb_per_meal": 60, "sodium_daily": 2300},
            "preferences": ["tập thể thao bóng rổ", "ăn yến mạch"],
            "treatment_goals": [
                "Duy trì Time in Range (TIR) > 70%, HbA1c < 7.0% (QĐ 1760/QĐ-BYT).",
                "Thực hành đếm Carbohydrate chính xác theo tỷ lệ I:C cho từng bữa ăn.",
                "Dự phòng hạ đường huyết khi tập luyện thể thao (quy tắc 15-15).",
            ],
        },
    },
    {
        "user_id": "demo_doctor",
        "email": "demo_doctor@example.com",
        "role": "doctor",
        "full_name": "BS. Minh",
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
    "Insulin Lispro 100UI/ml",
    "Insulin Aspart 100UI/ml",
    "Insulin Glargine 100UI/ml",
    "Insulin Detemir 100UI/ml",
    "Insulin NPH 100UI/ml",
    "Alpha-lipoic acid 600mg",
    "Pregabalin 75mg",
    "Gabapentin 300mg",
    "Duloxetine 30mg",
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
    ("diabetes_t1", "Tiểu đường type 1"),
    ("diabetes_t2", "Tiểu đường type 2"),
    ("diabetes_gestational", "Đái tháo đường thai kỳ"),
    ("diabetic_neuropathy", "Bệnh thần kinh đái tháo đường"),
    ("prediabetes", "Tiền đái tháo đường"),
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
        full_name = account.get("full_name")
        if user is not None:
            user.role = account["role"]
            user.email = account["email"]
            if full_name:
                user.full_name = full_name
        else:
            by_email = db.query(User).filter(User.email == account["email"]).first()
            if by_email is not None:
                by_email.role = account["role"]
                if full_name:
                    by_email.full_name = full_name
                user = by_email
            else:
                user = User(
                    id=account["user_id"],
                    email=account["email"],
                    hashed_password=hash_password(DEMO_PASSWORD),
                    role=account["role"],
                    full_name=full_name,
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


def _migrate_add_alert_food_log_id(db: Session) -> None:
    """Add alerts.food_log_id to existing SQLite DBs (idempotent)."""
    from sqlalchemy import inspect, text

    try:
        columns = [c["name"] for c in inspect(engine).get_columns("alerts")]
    except Exception:
        return
    if "food_log_id" in columns:
        return
    db.execute(text("ALTER TABLE alerts ADD COLUMN food_log_id VARCHAR(36)"))
    db.commit()
    logger.info("Added alerts.food_log_id column")


def _migrate_add_constraints_status(db: Session) -> None:
    """Add profiles.constraints_status (idempotent)."""
    from sqlalchemy import inspect, text

    columns = [c["name"] for c in inspect(engine).get_columns("profiles")]
    if "constraints_status" not in columns:
        db.execute(
            text(
                "ALTER TABLE profiles ADD COLUMN constraints_status VARCHAR(32) "
                "DEFAULT 'confirmed'"
            )
        )
        db.commit()
        logger.info("Added profiles.constraints_status column")


def _migrate_add_meal_plan_adjustment_note(db: Session) -> None:
    """Add meal_plans.adjustment_note (idempotent)."""
    from sqlalchemy import inspect, text

    try:
        columns = [c["name"] for c in inspect(engine).get_columns("meal_plans")]
    except Exception:
        return
    if "adjustment_note" not in columns:
        db.execute(text("ALTER TABLE meal_plans ADD COLUMN adjustment_note VARCHAR"))
        db.commit()
        logger.info("Added meal_plans.adjustment_note column")


def _migrate_add_meal_plan_request_fields(db: Session) -> None:
    """Add profiles meal plan request columns (idempotent)."""
    from sqlalchemy import inspect, text

    columns = [c["name"] for c in inspect(engine).get_columns("profiles")]
    if "meal_plan_request_status" not in columns:
        db.execute(
            text(
                "ALTER TABLE profiles ADD COLUMN meal_plan_request_status VARCHAR(16) "
                "DEFAULT 'none'"
            )
        )
        db.commit()
        logger.info("Added profiles.meal_plan_request_status column")
    if "meal_plan_request_note" not in columns:
        db.execute(text("ALTER TABLE profiles ADD COLUMN meal_plan_request_note VARCHAR(500)"))
        db.commit()
        logger.info("Added profiles.meal_plan_request_note column")
    if "meal_plan_requested_at" not in columns:
        db.execute(text("ALTER TABLE profiles ADD COLUMN meal_plan_requested_at TIMESTAMP"))
        db.commit()
        logger.info("Added profiles.meal_plan_requested_at column")


def _migrate_add_metrics_clinical_fields(db: Session) -> None:
    """Add clinical metric columns on body_metrics_history (idempotent)."""
    from sqlalchemy import inspect, text

    try:
        table_names = inspect(engine).get_table_names()
    except Exception:
        return
    if "body_metrics_history" not in table_names:
        return
    columns = [c["name"] for c in inspect(engine).get_columns("body_metrics_history")]
    new_columns = {
        "waist_cm": "FLOAT",
        "systolic": "INTEGER",
        "diastolic": "INTEGER",
        "glucose_fasting": "FLOAT",
        "glucose_postprandial": "FLOAT",
        "hba1c": "FLOAT",
    }
    missing = {col: dtype for col, dtype in new_columns.items() if col not in columns}
    if not missing:
        return
    for col, dtype in missing.items():
        db.execute(text(f"ALTER TABLE body_metrics_history ADD COLUMN {col} {dtype}"))
    db.commit()
    logger.info("Added body_metrics_history columns: %s", ", ".join(missing))


def init_db() -> None:
    """Create all tables and seed demo accounts (idempotent)."""
    from app.db.seed_nutrition_catalog import default_data_dir, seed_nutrition_catalog

    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        _migrate_add_full_name(db)
        _migrate_add_user_avatar(db)
        _migrate_add_body_metrics(db)
        _migrate_add_profile_detail(db)
        _migrate_add_constraints_status(db)
        _migrate_add_meal_plan_request_fields(db)
        _migrate_add_metrics_clinical_fields(db)
        _migrate_widen_alert_severity(db)
        _migrate_add_alert_food_log_id(db)
        # Column ALTERs must run before any ORM query on MealPlan (e.g. reconcile).
        _migrate_add_meal_plan_adjustment_note(db)
        _migrate_add_meal_plan_dates(db)
        seed_demo_accounts(db)
        seed_catalog(db)
        if engine.dialect.name == "postgresql" and default_data_dir().exists():
            seed_nutrition_catalog(db, default_data_dir())
