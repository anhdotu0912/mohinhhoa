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


def profile_loader(state: AgentState) -> AgentState:
    """Load patient profile from demo data or existing state.

    In production, this would query the database via BE2 API.
    """
    user_id = state.get("user_id", "")

    # If profile already in state, keep it
    if state.get("profile"):
        logger.debug("Profile already loaded for user %s", user_id)
        return state

    # Look up demo profile
    profile = _DEMO_PROFILES.get(user_id)

    if profile:
        logger.info("Loaded demo profile for user %s", user_id)
    else:
        # Default minimal profile for diabetes
        logger.warning("No profile found for user %s, using diabetes defaults", user_id)
        profile = {
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

    return {**state, "profile": profile}
