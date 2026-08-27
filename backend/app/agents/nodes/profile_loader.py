"""Profile Loader node — loads patient profile into agent state (Diabetes focused)."""

from __future__ import annotations

import logging

from app.agents.state import AgentState

logger = logging.getLogger(__name__)

# Demo profiles for MVP (loaded by user_id) — Supporting various Diabetes categories & complications
_DEMO_PROFILES: dict[str, dict] = {
    "demo_patient_1": {
        "id": "profile_1",
        "user_id": "demo_patient_1",
        "disease": ["diabetes_t2"],
        "medications": ["metformin"],
        "allergies": ["hải sản"],
        "bmi": 26.5,
        "weight": 72,
        "height": 170,
        "target_kcal": 1800,
        "restrictions": {"carb_per_meal": 45, "sodium_daily": 2300},
        "preferences": ["thích ăn cơm", "không ăn thịt bò"],
        "treatment_goals": [
            "Kiểm soát đường huyết ổn định (HbA1c < 7%).",
            "Giảm cân 2kg trong 1 tháng thông qua chế độ ăn và tập thể dục.",
            "Duy trì huyết áp dưới 130/80 mmHg.",
        ],
    },
    "demo_patient_2": {
        "id": "profile_2",
        "user_id": "demo_patient_2",
        "disease": ["diabetes_t2", "diabetic_neuropathy", "dyslipidemia"],
        "medications": ["metformin", "atorvastatin", "alpha-lipoic acid"],
        "allergies": [],
        "bmi": 22.1,
        "weight": 58,
        "height": 162,
        "target_kcal": 1600,
        "restrictions": {"carb_per_meal": 40, "sodium_daily": 1500},
        "preferences": ["ăn chay 2 ngày/tuần"],
        "treatment_goals": [
            "Cải thiện triệu chứng tê bì bàn chân (QĐ 3510/QĐ-BYT).",
            "Hạ Triglyceride máu xuống dưới 1.7 mmol/L.",
            "Duy trì HbA1c < 6.5%.",
        ],
    },
    "demo_patient_3": {
        "id": "profile_3",
        "user_id": "demo_patient_3",
        "disease": ["diabetes_t2", "hypertension", "diabetic_neuropathy"],
        "medications": ["glipizide", "lisinopril"],
        "allergies": [],
        "bmi": 26.8,
        "weight": 78,
        "height": 170,
        "target_kcal": 1900,
        "restrictions": {"carb_per_meal": 45, "sodium_daily": 2000},
        "preferences": ["thức ăn mềm dễ tiêu", "chia nhỏ bữa"],
        "treatment_goals": [
            "Giảm khó tiêu/liệt dạ dày do đái tháo đường.",
            "Kiểm soát huyết áp < 130/80 mmHg.",
            "Tránh nguy cơ hạ đường huyết do thuốc Sulfonylurea.",
        ],
    },
    "demo_patient_4": {
        "id": "profile_4",
        "user_id": "demo_patient_4",
        "disease": ["diabetes_gestational"],
        "medications": [],
        "allergies": [],
        "bmi": 23.5,
        "weight": 61,
        "height": 161,
        "target_kcal": 1900,
        "restrictions": {"carb_per_meal": 45, "sodium_daily": 2000},
        "preferences": ["chia 3 bữa chính 3 bữa phụ", "uống sữa hạt"],
        "treatment_goals": [
            "Đường huyết đói thai kỳ ≤ 95 mg/dL, 2h sau ăn ≤ 120 mg/dL (QĐ 1470/QĐ-BYT).",
            "Phân bổ 3 bữa chính + 3 bữa phụ, ăn nhẹ trước khi ngủ chống ceton niệu.",
            "Đảm bảo thai nhi tăng trưởng đạt chuẩn chu vi vòng bụng.",
        ],
    },
    "demo_patient_5": {
        "id": "profile_5",
        "user_id": "demo_patient_5",
        "disease": ["diabetes_t1"],
        "medications": ["insulin glargine", "insulin aspart"],
        "allergies": ["đậu phộng"],
        "bmi": 21.0,
        "weight": 63,
        "height": 173,
        "target_kcal": 2100,
        "restrictions": {"carb_per_meal": 60, "sodium_daily": 2300},
        "preferences": ["tập thể thao bóng rổ", "ăn yến mạch"],
        "treatment_goals": [
            "Duy trì Time in Range (TIR) > 70%, HbA1c < 7.0% (QĐ 1760/QĐ-BYT).",
            "Thực hành đếm Carbohydrate chính xác theo tỷ lệ I:C cho từng bữa ăn.",
            "Dự phòng hạ đường huyết khi tập luyện thể thao (quy tắc 15-15).",
        ],
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
