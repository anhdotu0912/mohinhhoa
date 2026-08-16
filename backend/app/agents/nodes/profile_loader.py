"""Profile Loader node — loads patient profile into agent state (Diabetes focused)."""

from __future__ import annotations

import logging

from app.agents.state import AgentState

logger = logging.getLogger(__name__)

# Demo profiles for MVP (loaded by user_id) — All focused on Diabetes (Đái tháo đường T2)
_DEMO_PROFILES: dict[str, dict] = {
    "demo_patient_1": {
        "id": "profile_1",
        "user_id": "demo_patient_1",
        "disease": ["diabetes_t2"],
        "medications": ["metformin"],
        "allergies": ["hải sản"],
        "bmi": 26.5,
        "target_kcal": 1800,
        "restrictions": {"carb_per_meal": 45, "sodium_daily": 2300},
        "preferences": ["thích ăn cơm", "không ăn thịt bò"],
    },
    "demo_patient_2": {
        "id": "profile_2",
        "user_id": "demo_patient_2",
        "disease": ["diabetes_t2"],
        "medications": ["metformin", "atorvastatin", "amlodipine"],
        "allergies": [],
        "bmi": 28.0,
        "target_kcal": 1600,
        "restrictions": {"carb_per_meal": 40, "sodium_daily": 1500},
        "preferences": ["ăn chay 2 ngày/tuần"],
    },
    "demo_patient_3": {
        "id": "profile_3",
        "user_id": "demo_patient_3",
        "disease": ["diabetes_t2"],
        "medications": ["glipizide", "lisinopril"],
        "allergies": [],
        "bmi": 24.0,
        "target_kcal": 2000,
        "restrictions": {"carb_per_meal": 50, "sodium_daily": 2000},
        "preferences": ["thích ăn cá"],
    },
}


def _default_profile(user_id: str) -> dict:
    return {
        "id": "",
        "user_id": user_id,
        "disease": ["diabetes_t2"],
        "medications": ["metformin"],
        "allergies": [],
        "bmi": None,
        "target_kcal": 1800,
        "restrictions": {"carb_per_meal": 45, "sodium_daily": 2300},
        "preferences": [],
    }


def profile_loader(state: AgentState) -> AgentState:
    """Load patient profile from DB, demo data, or defaults."""
    user_id = state.get("user_id", "")

    if state.get("profile"):
        logger.debug("Profile already loaded for user %s", user_id)
        return state

    db = state.get("db")
    if db is not None:
        from app.services.meal_plan_service import get_profile_row

        profile_obj = get_profile_row(db, user_id)
        if profile_obj is not None:
            logger.info("Loaded DB profile for user %s", user_id)
            return {
                **state,
                "profile": profile_obj.model_dump(mode="json"),
            }

    profile = _DEMO_PROFILES.get(user_id)
    if profile:
        logger.info("Loaded demo profile for user %s", user_id)
    else:
        logger.warning("No profile found for user %s, using diabetes defaults", user_id)
        profile = _default_profile(user_id)

    return {**state, "profile": profile}
