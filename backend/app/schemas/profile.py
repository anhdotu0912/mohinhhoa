"""Pydantic schemas for Patient Profile — matches contract §1.1."""

import re
from typing import Literal, Self

from pydantic import BaseModel, Field, field_validator

from app.schemas.clinical_limits import (
    CARB_PER_MEAL_MAX,
    CARB_PER_MEAL_MIN,
    SALT_DAILY_MAX,
    SALT_DAILY_MIN,
    SODIUM_DAILY_MAX,
    SODIUM_DAILY_MIN,
    SUGAR_DAILY_MAX,
    SUGAR_DAILY_MIN,
    TARGET_KCAL_MAX,
    TARGET_KCAL_MIN,
    normalize_treatment_goals,
)


class Restrictions(BaseModel):
    """Dietary restrictions per-meal/daily limits."""
    carb_per_meal: float | None = Field(
        None, ge=CARB_PER_MEAL_MIN, le=CARB_PER_MEAL_MAX, description="Max carb grams per meal"
    )
    sodium_daily: float | None = Field(
        None, ge=SODIUM_DAILY_MIN, le=SODIUM_DAILY_MAX, description="Max sodium mg per day"
    )
    salt_daily_g: float | None = Field(
        None, ge=SALT_DAILY_MIN, le=SALT_DAILY_MAX, description="Max salt grams per day"
    )
    sugar_daily_g: float | None = Field(
        None, ge=SUGAR_DAILY_MIN, le=SUGAR_DAILY_MAX, description="Max free sugar grams per day"
    )


class PatientProfile(BaseModel):
    """Patient medical & dietary profile.

    `target_kcal` / `restrictions` / `treatment_goals` are the confirmed
    (doctor-approved) values used by meal planning. Patient proposals live in
    `proposed_*` until a doctor approves or overrides them.
    """
    id: str = ""
    user_id: str = ""
    disease: list[str] = Field(
        default_factory=list,
        description="e.g. diabetes_t1, diabetes_t2, diabetes_gestational, diabetic_neuropathy, prediabetes",
    )
    medications: list[str] = Field(default_factory=list, description="e.g. metformin, warfarin")
    allergies: list[str] = Field(default_factory=list, description="e.g. hải sản, đậu phộng")
    bmi: float | None = None
    weight: float | None = None
    height: float | None = None
    age: int | None = None
    gender: str | None = None
    phone: str | None = None
    address: str | None = None
    blood_pressure: str | None = None
    blood_glucose: str | None = None
    target_kcal: int = 1800
    restrictions: Restrictions = Field(default_factory=Restrictions)
    preferences: list[str] = Field(default_factory=list, description="e.g. thích ăn cơm, không ăn thịt bò")
    treatment_goals: list[str] = Field(default_factory=list)
    constraints_status: Literal["confirmed", "pending_doctor_review"] = "confirmed"
    proposed_target_kcal: int | None = None
    proposed_restrictions: Restrictions | None = None
    proposed_treatment_goals: list[str] | None = None

    model_config = {"from_attributes": True}

    def for_meal_planning(self) -> Self:
        """Copy whose clinical budgets are confirmed values only (ignore proposals)."""
        return self.model_copy(
            update={
                "proposed_target_kcal": None,
                "proposed_restrictions": None,
                "proposed_treatment_goals": None,
            }
        )


class ProfileUpsert(BaseModel):
    """POST /profile body.

    Patient-owned fields are persisted immediately. Clinical fields
    (`target_kcal`, `restrictions`, `treatment_goals`) are accepted so existing
    clients can still send them, but they are stored as proposals only — see
    `ProfileClinicalProposal` and `specs/04`.
    """

    full_name: str | None = Field(default=None, max_length=255)
    email: str | None = Field(default=None, max_length=255)
    disease: list[str] = Field(default_factory=list)
    medications: list[str] = Field(default_factory=list)
    allergies: list[str] = Field(default_factory=list)
    bmi: float | None = None
    weight: float | None = None
    height: float | None = None
    age: int | None = None
    gender: str | None = None
    phone: str | None = None
    address: str | None = None
    blood_pressure: str | None = None
    blood_glucose: str | None = None
    preferences: list[str] = Field(default_factory=list)
    target_kcal: int | None = Field(
        default=None,
        ge=TARGET_KCAL_MIN,
        le=TARGET_KCAL_MAX,
        description="Proposal only — not written to the effective column until doctor approve",
    )
    restrictions: Restrictions | None = Field(
        default=None,
        description="Proposal only — not written to the effective column until doctor approve",
    )
    treatment_goals: list[str] | None = Field(
        default=None,
        description="Proposal only — not written to the effective column until doctor approve",
    )

    @field_validator("treatment_goals")
    @classmethod
    def _goals(cls, value: list[str] | None) -> list[str] | None:
        return normalize_treatment_goals(value)

    @field_validator("email", mode="before")
    @classmethod
    def _email(cls, value: str | None) -> str:
        if not isinstance(value, str):
            raise ValueError("Email không được để trống.")
        normalized = value.strip().lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", normalized):
            raise ValueError("Nhập địa chỉ email hợp lệ.")
        return normalized


class ProfileClinicalProposal(BaseModel):
    """Clinical fields a patient may propose; doctor routes write the effective copy."""

    target_kcal: int | None = None
    restrictions: Restrictions | None = None
    treatment_goals: list[str] | None = None
