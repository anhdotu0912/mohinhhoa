"""Create tables and seed demo accounts on startup."""

from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.session import Base, SessionLocal, engine
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
            "target_kcal": 1800,
            "restrictions": {"carb_per_meal": 45, "sodium_daily": 2300},
            "preferences": ["thích ăn cơm", "không ăn thịt bò"],
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
            "target_kcal": 1600,
            "restrictions": {"carb_per_meal": 40, "sodium_daily": 1500},
            "preferences": ["ăn chay 2 ngày/tuần"],
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
            "target_kcal": 2000,
            "restrictions": {"carb_per_meal": 50, "sodium_daily": 2000},
            "preferences": ["thích ăn cá"],
        },
    },
    {
        "user_id": "demo_dietitian",
        "email": "demo_dietitian@example.com",
        "role": "dietitian",
        "profile": None,
    },
]

DEMO_PASSWORD = "demo1234"


def seed_demo_accounts(db: Session) -> None:
    for account in DEMO_ACCOUNTS:
        if db.get(User, account["user_id"]) is not None:
            continue
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
            db.add(Profile(user_id=user.id, **profile_data))
        logger.info("Seeded demo account %s", account["email"])
    db.commit()


def init_db() -> None:
    """Create all tables and seed demo accounts (idempotent)."""
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_demo_accounts(db)
