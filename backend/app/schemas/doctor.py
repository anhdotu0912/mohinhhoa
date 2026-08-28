"""Doctor review & patient-list schemas — contract §5."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.meal_plan import MealPlanOutput
from app.schemas.profile import PatientProfile


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
    phone: str | None = None
    address: str | None = None
    blood_pressure: str | None = None
    blood_glucose: str | None = None
    treatment_goals: list[str] = Field(default_factory=list)
    target_kcal: int = 1800
    salt_daily_g: float | None = None
    sugar_daily_g: float | None = None
    preferences: list[str] = Field(default_factory=list)
    constraints_status: str = "confirmed"
    status: Literal["Cần chú ý", "Ổn định", "Cảnh báo", "Chờ duyệt"] = "Ổn định"
    status_key: Literal["attention", "stable", "warning", "pending"] = "stable"
    latest_plan_id: str | None = None
    latest_plan_status: str | None = None
    active_plan_id: str | None = None
    active_plan_status: str | None = None
    plan_starts_on: str | None = None
    plan_pending: int = 0
    plan_total: int = 0
    alert_count: int = 0
    last_update: str = ""
    avatar: str = ""
    # Hạn thực đơn đã duyệt (có ý nghĩa khi latest_plan_status ∈ {approved, edited})
    plan_end_date: str | None = None
    plan_days_left: int | None = None
    plan_expiry: Literal["expiring", "expired", "ok", "none"] = "none"
    plan_usage: Literal["none", "active", "finished"] = "none"
    meal_plan_request_status: Literal["none", "pending"] = "none"
    meal_plan_request_note: str | None = None
    meal_plan_requested_at: str | None = None
    pending_transfer: PendingTransferOut | None = None


class PendingTransferOut(BaseModel):
    id: str
    to_doctor_id: str
    to_doctor_name: str | None = None
    created_at: str


class CreateDoctorPatientRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)


class TransferRequest(BaseModel):
    to_doctor_id: str = Field(min_length=1, max_length=36)


class TransferOut(BaseModel):
    id: str
    patient_id: str
    from_doctor_id: str
    to_doctor_id: str
    status: Literal["pending", "accepted", "cancelled"]
    to_doctor_name: str | None = None
    created_at: str


class DoctorColleague(BaseModel):
    id: str
    full_name: str | None = None
    email: str
    avatar: str | None = None


class ClaimQueueItem(BaseModel):
    kind: Literal["unassigned", "transfer"]
    source: Literal["self_register", "unassigned_pool", "transfer"]
    patient_id: str
    patient: DoctorPatientSummary
    transfer_id: str | None = None
    from_doctor_id: str | None = None
    from_doctor_name: str | None = None
    created_at: str


class MetricsUpdateRequest(BaseModel):
    """Cập nhật chỉ số cơ thể — contract §5."""

    weight: float | None = Field(default=None, gt=0, description="Cân nặng (kg), phải > 0")
    height: float | None = Field(default=None, gt=0, description="Chiều cao (cm), phải > 0")


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


class DoctorConstraintsUpdate(BaseModel):
    """PUT /doctor/patients/{id}/constraints — partial update."""

    target_kcal: int | None = Field(default=None, ge=500, le=4000)
    salt_daily_g: float | None = Field(default=None, ge=0, le=20)
    sugar_daily_g: float | None = Field(default=None, ge=0, le=150)


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


class FoodCatalogMacros(BaseModel):
    carb_g: float = 0
    protein_g: float = 0
    fat_g: float = 0
    sodium_mg: float = 0
    sugar_g: float = 0


class FoodCatalogItem(BaseModel):
    """Món / thành phần từ nutrition catalog — dùng picker «Thêm món»."""

    id: str
    name: str
    portion: str = ""
    kcal: float = 0
    macros: FoodCatalogMacros = Field(default_factory=FoodCatalogMacros)
    category: str = ""
    source: str = "db"


class FoodCatalogOut(BaseModel):
    items: list[FoodCatalogItem] = Field(default_factory=list)
    total: int = 0


class AvatarOut(BaseModel):
    avatar: str


class PlanExpiryDemoRequest(BaseModel):
    """Demo: giả lập thực đơn sắp hết hạn / đã hết hạn (backdate reviewed_at)."""

    mode: Literal["expiring", "expired"] = "expired"


class PlanExpiryDemoOut(BaseModel):
    """Kết quả giả lập: patient ids đã backdate + bỏ qua (không có plan approved)."""

    updated: list[str] = Field(default_factory=list)
    skipped: list[str] = Field(default_factory=list)


class ComplianceDayPoint(BaseModel):
    date: str
    adherence_pct: int | None = None


class ComplianceEvent(BaseModel):
    type: Literal["alert", "food_log", "checkin", "reminder"] = "alert"
    severity: str
    title: str
    at: str


class PatientComplianceOut(BaseModel):
    patient_id: str
    days: int = 14
    low_threshold_pct: int = 50
    overall_adherence_pct: int | None = None
    checkins_done: int = 0
    checkins_as_planned: int = 0
    daily_series: list[ComplianceDayPoint] = Field(default_factory=list)
    events: list[ComplianceEvent] = Field(default_factory=list)


class ComplianceRemindRequest(BaseModel):
    message: str = Field(default="", max_length=500)


class MealPlanScheduleSlotOut(BaseModel):
    """One week slot on patient meal plan schedule — ADR-012."""

    slot_key: Literal["current", "next", "empty"]
    starts_on: str
    ends_on: str
    occupancy: Literal["empty", "active", "upcoming", "past"]
    plan: MealPlanOutput | None = None
    actions: list[Literal["add", "replace", "view"]] = Field(default_factory=list)


class MealPlanScheduleOut(BaseModel):
    patient_id: str
    today: str
    active_plan_id: str | None = None
    active_plan: MealPlanOutput | None = None
    unassigned_plans: list[MealPlanOutput] = Field(default_factory=list)
    slots: list[MealPlanScheduleSlotOut] = Field(default_factory=list)
