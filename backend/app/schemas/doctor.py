"""Doctor review & patient-list schemas — contract §5."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ReviewRequest(BaseModel):
    action: Literal["approve", "reject", "edit"]
    notes: str = ""
    edited_plan: dict | None = None


class ReviewResponse(BaseModel):
    meal_plan_id: str
    status: str
    trust_badge: str | None = None
    reviewed_at: str
    reviewer_id: str


class DoctorPatientSummary(BaseModel):
    """Patient row for doctor patients list / cards."""

    id: str
    email: str
    name: str
    age: int | None = None
    gender: str | None = None
    disease: list[str] = Field(default_factory=list)
    condition_label: str = ""
    medications: list[str] = Field(default_factory=list)
    allergies: list[str] = Field(default_factory=list)
    bmi: float | None = None
    weight: float | None = None
    height: float | None = None
    age: int | None = None
    phone: str | None = None
    address: str | None = None
    blood_pressure: str | None = None
    blood_glucose: str | None = None
    treatment_goals: list[str] = Field(default_factory=list)
    target_kcal: int = 1800
    preferences: list[str] = Field(default_factory=list)
    status: Literal["Cần chú ý", "Ổn định", "Cảnh báo", "Chờ duyệt"] = "Ổn định"
    status_key: Literal["attention", "stable", "warning", "pending"] = "stable"
    latest_plan_id: str | None = None
    latest_plan_status: str | None = None
    alert_count: int = 0
    last_update: str = ""
    avatar: str = ""


class MetricsUpdateRequest(BaseModel):
    """Cập nhật chỉ số cơ thể — contract §5."""

    weight: float = Field(gt=0, description="Cân nặng (kg), phải > 0")
    height: float = Field(gt=0, description="Chiều cao (cm), phải > 0")


class PatientMetricsOut(BaseModel):
    """Toàn bộ chỉ số mới để FE cập nhật UI (BMI do backend tính lại)."""

    weight: float
    height: float
    bmi: float
    bmi_category: str
    updated_at: str


class GoalsUpdate(BaseModel):
    """Danh sách mục tiêu điều trị (thay toàn bộ)."""

    goals: list[str] = Field(default_factory=list)


class GoalsOut(BaseModel):
    goals: list[str] = Field(default_factory=list)


class DoctorPatientUpdate(BaseModel):
    """Doctor cập nhật thông tin chung của bệnh nhân (contract §5).

    Các field bỏ qua (None) giữ nguyên giá trị cũ.
    """

    full_name: str | None = None
    email: str | None = None
    avatar: str | None = None
    age: int | None = Field(default=None, ge=0, le=130)
    gender: str | None = None
    phone: str | None = None
    address: str | None = None
    blood_pressure: str | None = None
    blood_glucose: str | None = None
    disease: list[str] | None = None
    medications: list[str] | None = None
    allergies: list[str] | None = None
    preferences: list[str] | None = None
    treatment_goals: list[str] | None = None


class CatalogItem(BaseModel):
    id: str
    name: str


class DiagnosisItem(BaseModel):
    code: str
    name: str


class CatalogOut(BaseModel):
    """Danh mục có sẵn cho doctor (thuốc, dị ứng, chẩn đoán)."""

    medicines: list[CatalogItem] = Field(default_factory=list)
    allergies: list[CatalogItem] = Field(default_factory=list)
    diagnoses: list[DiagnosisItem] = Field(default_factory=list)


class AvatarOut(BaseModel):
    avatar: str
