"""Pydantic schemas for Patient Profile — matches contract §1.1."""

from typing import Literal

from pydantic import BaseModel, Field


class Restrictions(BaseModel):
    """Dietary restrictions per-meal/daily limits."""
    carb_per_meal: float | None = Field(None, description="Max carb grams per meal")
    sodium_daily: float | None = Field(None, description="Max sodium mg per day")
    salt_daily_g: float | None = Field(None, description="Max salt grams per day (doctor-set)")
    sugar_daily_g: float | None = Field(None, description="Max free sugar grams per day (doctor-set)")


class PatientProfile(BaseModel):
    """Patient medical & dietary profile."""
    id: str = ""
    user_id: str = ""
    disease: list[str] = Field(default_factory=list, description="e.g. diabetes_t2, hypertension, gout")
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

    model_config = {"from_attributes": True}


class ProfileUpsert(BaseModel):
    """Input for POST /profile — contract §1.1 (upsert)."""

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
    target_kcal: int = 1800
    restrictions: Restrictions = Field(default_factory=Restrictions)
    preferences: list[str] = Field(default_factory=list)
    treatment_goals: list[str] = Field(default_factory=list)
