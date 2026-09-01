"""Body metrics history schemas — ADR-013 + clinical expansion."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, model_validator


class MetricsDeltaAdviceOut(BaseModel):
    """Observational caption when body metrics change beyond threshold."""

    message: str
    changed_fields: list[str] = Field(default_factory=list)
    citations: list[str] = Field(default_factory=list)
    ask_doctor: bool = False


class MetricsLogCreate(BaseModel):
    weight: float | None = Field(default=None, gt=0)
    height: float | None = Field(default=None, gt=0)
    waist_cm: float | None = Field(default=None, ge=50, le=200)
    systolic: int | None = Field(default=None, ge=70, le=250)
    diastolic: int | None = Field(default=None, ge=40, le=150)
    glucose_fasting: float | None = Field(default=None, ge=2, le=33)
    glucose_postprandial: float | None = Field(default=None, ge=2, le=33)
    hba1c: float | None = Field(default=None, ge=4, le=15)
    blood_pressure: str | None = None
    blood_glucose: str | None = None
    note: str = ""

    @model_validator(mode="after")
    def validate_pairs_and_presence(self) -> MetricsLogCreate:
        sys_set = self.systolic is not None
        dia_set = self.diastolic is not None
        if sys_set != dia_set:
            raise ValueError("Cần cả huyết áp tâm thu và tâm trương.")

        has_weight = self.weight is not None
        has_bp = bool(self.blood_pressure and self.blood_pressure.strip()) or sys_set
        has_glucose = bool(self.blood_glucose and self.blood_glucose.strip()) or (
            self.glucose_fasting is not None or self.glucose_postprandial is not None
        )
        has_waist = self.waist_cm is not None
        has_hba1c = self.hba1c is not None
        if not (has_weight or has_bp or has_glucose or has_waist or has_hba1c):
            raise ValueError(
                "Cần ít nhất một chỉ số: cân nặng, huyết áp, đường huyết, vòng eo hoặc HbA1c"
            )
        return self


class MetricsHistoryPoint(BaseModel):
    id: str
    user_id: str
    weight: float | None = None
    height: float | None = None
    bmi: float | None = None
    waist_cm: float | None = None
    systolic: int | None = None
    diastolic: int | None = None
    glucose_fasting: float | None = None
    glucose_postprandial: float | None = None
    hba1c: float | None = None
    blood_pressure: str | None = None
    blood_glucose: str | None = None
    note: str = ""
    recorded_by: str
    recorded_at: datetime

    model_config = {"from_attributes": True}


class MetricsLogResult(MetricsHistoryPoint):
    delta_advice: MetricsDeltaAdviceOut | None = None
