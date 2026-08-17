"""Body metrics history schemas — ADR-013."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, model_validator


class MetricsLogCreate(BaseModel):
    weight: float | None = Field(default=None, gt=0)
    height: float | None = Field(default=None, gt=0)
    blood_pressure: str | None = None
    blood_glucose: str | None = None
    note: str = ""

    @model_validator(mode="after")
    def at_least_one_metric(self) -> MetricsLogCreate:
        has_weight = self.weight is not None
        has_bp = bool(self.blood_pressure and self.blood_pressure.strip())
        has_glucose = bool(self.blood_glucose and self.blood_glucose.strip())
        if not (has_weight or has_bp or has_glucose):
            raise ValueError("Cần ít nhất một trong weight, blood_pressure, blood_glucose")
        return self


class MetricsHistoryPoint(BaseModel):
    id: str
    user_id: str
    weight: float | None = None
    height: float | None = None
    bmi: float | None = None
    blood_pressure: str | None = None
    blood_glucose: str | None = None
    note: str = ""
    recorded_by: str
    recorded_at: datetime

    model_config = {"from_attributes": True}
