"""Shared clinical-constraint ranges — keep in sync with frontend/lib/clinical-constraints.ts."""

from __future__ import annotations

TARGET_KCAL_MIN = 800
TARGET_KCAL_MAX = 4000

CARB_PER_MEAL_MIN = 0.0
CARB_PER_MEAL_MAX = 200.0

SODIUM_DAILY_MIN = 0.0
SODIUM_DAILY_MAX = 5000.0

SALT_DAILY_MIN = 0.0
SALT_DAILY_MAX = 15.0

SUGAR_DAILY_MIN = 0.0
SUGAR_DAILY_MAX = 100.0

TREATMENT_GOAL_MIN_LEN = 3
TREATMENT_GOAL_MAX_LEN = 80
TREATMENT_GOALS_MAX_COUNT = 12


def normalize_treatment_goals(value: list[str] | None) -> list[str] | None:
    if value is None:
        return None
    if len(value) > TREATMENT_GOALS_MAX_COUNT:
        raise ValueError(f"Tối đa {TREATMENT_GOALS_MAX_COUNT} mục tiêu điều trị.")
    cleaned: list[str] = []
    for raw in value:
        item = (raw or "").strip()
        if not item:
            raise ValueError("Mục tiêu điều trị không được để trống.")
        if len(item) < TREATMENT_GOAL_MIN_LEN:
            raise ValueError(
                f"Mỗi mục tiêu tối thiểu {TREATMENT_GOAL_MIN_LEN} ký tự."
            )
        if len(item) > TREATMENT_GOAL_MAX_LEN:
            raise ValueError(
                f"Mỗi mục tiêu tối đa {TREATMENT_GOAL_MAX_LEN} ký tự."
            )
        cleaned.append(item)
    return cleaned
