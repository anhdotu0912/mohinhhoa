"""Doctor routes — patients list, generate-for-patient, meal-plan review."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

from fastapi import APIRouter, Body, Depends, File, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.core.security import require_roles
from app.core.config import settings
from app.db.session import get_db
from app.models.alert import Alert
from app.models.catalog import Allergy, Diagnosis, Medicine
from app.models.meal_plan import MealPlan
from app.models.profile import Profile
from app.models.user import User
from app.schemas.doctor import (
    AvatarOut,
    CatalogItem,
    CatalogOut,
    ComplianceRemindRequest,
    DiagnosisItem,
    DoctorPatientSummary,
    DoctorPatientUpdate,
    DoctorConstraintsUpdate,
    FoodCatalogItem,
    FoodCatalogMacros,
    FoodCatalogOut,
    GoalsOut,
    GoalsUpdate,
    MetricsUpdateRequest,
    PatientComplianceOut,
    PatientMetricsOut,
    PlanExpiryDemoOut,
    PlanExpiryDemoRequest,
    ReviewRequest,
    ReviewResponse,
)
from app.schemas.meal_plan import GenerateMealPlanRequest, MealPlanOutput
from app.schemas.notification import NotificationOut
from app.services import plan_expiry
from app.services.compliance import ComplianceService
from app.services.meal_plan_service import generate_meal_plan, meal_plan_from_row
from app.services.notification import NotificationService

router = APIRouter(prefix="/doctor", tags=["doctor"])

STATIC_AVATARS_DIR = Path(__file__).resolve().parents[3] / "static" / "avatars"

_DISEASE_LABELS = {
    "diabetes_t2": "Tiểu đường type 2",
    "hypertension": "Tăng huyết áp",
    "ckd": "Suy thận mạn",
    "gout": "Gout",
    "dyslipidemia": "Rối loạn lipid máu",
    "nafld": "Gan nhiễm mỡ",
}

_DEMO_META: dict[str, tuple[str, int, str]] = {
    "demo_patient_1": ("Nguyễn Văn A", 45, "Nam"),
    "demo_patient_2": ("Trần Thị B", 52, "Nữ"),
    "demo_patient_3": ("Lê Văn C", 60, "Nam"),
}

_AVATAR_SEED = (
    "https://api.dicebear.com/7.x/avataaars/svg?seed="
)


def _bmi_category(bmi: float) -> str:
    if bmi < 18.5:
        return "Thiếu cân"
    if bmi < 23:
        return "Bình thường"
    if bmi < 25:
        return "Thừa cân nhẹ"
    return "Béo phì"


def _display_name(user: User) -> tuple[str, int | None, str | None]:
    if user.full_name:
        return user.full_name.strip(), None, None
    if user.id in _DEMO_META:
        return _DEMO_META[user.id]
    local = (user.email or "benh-nhan").split("@")[0]
    pretty = local.replace(".", " ").replace("_", " ").strip().title() or "Bệnh nhân"
    return pretty, None, None


def _condition_label(diseases: list[str]) -> str:
    if not diseases:
        return "Chưa khai báo bệnh lý"
    return ", ".join(_DISEASE_LABELS.get(d, d) for d in diseases)


def _derive_status(
    *,
    plan_status: str | None,
    severities: list[str],
    bmi: float | None,
) -> tuple[str, str]:
    if any(s == "Nguy hiểm" for s in severities):
        return "Cảnh báo", "warning"
    if plan_status == "pending_review":
        return "Chờ duyệt", "pending"
    if any(s == "Cần chú ý" for s in severities) or (bmi is not None and bmi >= 25):
        return "Cần chú ý", "attention"
    return "Ổn định", "stable"


def _format_dt(value: datetime | None) -> str:
    if value is None:
        return ""
    return value.strftime("%d/%m/%Y")


def _patient_summary(db: Session, user: User) -> DoctorPatientSummary:
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    diseases = list(profile.disease or []) if profile else []
    medications = list(profile.medications or []) if profile else []
    allergies = list(profile.allergies or []) if profile else []
    bmi = profile.bmi if profile else None
    target_kcal = profile.target_kcal if profile and profile.target_kcal else 1800
    preferences = list(profile.preferences or []) if profile else []
    restrictions = dict(profile.restrictions or {}) if profile else {}
    salt_daily_g = restrictions.get("salt_daily_g")
    sugar_daily_g = restrictions.get("sugar_daily_g")

    latest_plan = (
        db.query(MealPlan)
        .filter(MealPlan.user_id == user.id)
        .order_by(MealPlan.created_at.desc())
        .first()
    )
    plan_total = (
        db.query(func.count(MealPlan.id))
        .filter(MealPlan.user_id == user.id)
        .scalar()
        or 0
    )
    plan_pending = (
        db.query(func.count(MealPlan.id))
        .filter(MealPlan.user_id == user.id, MealPlan.status == "pending_review")
        .scalar()
        or 0
    )
    alerts = (
        db.query(Alert)
        .filter(Alert.user_id == user.id)
        .order_by(Alert.created_at.desc())
        .limit(20)
        .all()
    )
    severities = [a.severity for a in alerts]
    status, status_key = _derive_status(
        plan_status=latest_plan.status if latest_plan else None,
        severities=severities,
        bmi=bmi,
    )
    name, age, gender = _display_name(user)
    if profile and profile.age:
        age = profile.age
    if profile and profile.gender:
        gender = profile.gender
    last_src = None
    if latest_plan and latest_plan.created_at:
        last_src = latest_plan.created_at
    elif profile and profile.updated_at:
        last_src = profile.updated_at
    elif user.created_at:
        last_src = user.created_at

    # Hạn thực đơn: tính khi plan đã duyệt (approved hoặc edited)
    plan_end_date = None
    plan_days_left = None
    plan_expiry_bucket: str = "none"
    if (
        latest_plan is not None
        and latest_plan.status in plan_expiry.EXPIRY_ELIGIBLE_STATUSES
    ):
        plan_days = len(latest_plan.days or [])
        end = plan_expiry.end_date(
            latest_plan.reviewed_at, latest_plan.created_at, plan_days
        )
        plan_end_date = end.strftime("%d/%m/%Y") if end else None
        plan_days_left = plan_expiry.days_left(
            latest_plan.reviewed_at, latest_plan.created_at, plan_days
        )
        plan_expiry_bucket = plan_expiry.bucket(
            latest_plan.reviewed_at, latest_plan.created_at, plan_days
        )

    return DoctorPatientSummary(
        id=user.id,
        email=user.email,
        name=name,
        age=age,
        gender=gender,
        disease=diseases,
        condition_label=_condition_label(diseases),
        medications=medications,
        allergies=allergies,
        bmi=bmi,
        target_kcal=target_kcal,
        salt_daily_g=salt_daily_g,
        sugar_daily_g=sugar_daily_g,
        preferences=preferences,
        status=status,  # type: ignore[arg-type]
        status_key=status_key,  # type: ignore[arg-type]
        latest_plan_id=latest_plan.id if latest_plan else None,
        latest_plan_status=latest_plan.status if latest_plan else None,
        plan_pending=plan_pending,
        plan_total=plan_total,
        alert_count=len(alerts),
        weight=profile.weight if profile else None,
        height=profile.height if profile else None,
        phone=profile.phone if profile else None,
        address=profile.address if profile else None,
        blood_pressure=profile.blood_pressure if profile else None,
        blood_glucose=profile.blood_glucose if profile else None,
        treatment_goals=list(profile.treatment_goals or []) if profile else [],
        last_update=_format_dt(last_src),
        avatar=user.avatar or f"{_AVATAR_SEED}{user.id}",
        plan_end_date=plan_end_date,
        plan_days_left=plan_days_left,
        plan_expiry=plan_expiry_bucket,
    )


@router.get("/patients", response_model=list[DoctorPatientSummary])
def list_patients(
    q: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("doctor")),
) -> list[DoctorPatientSummary]:
    del user  # auth only
    patients = (
        db.query(User)
        .filter(User.role == "patient")
        .order_by(User.created_at.desc())
        .all()
    )
    rows = [_patient_summary(db, p) for p in patients]

    if q:
        needle = q.strip().lower()
        rows = [
            r
            for r in rows
            if needle in r.name.lower()
            or needle in r.id.lower()
            or needle in r.email.lower()
            or needle in r.condition_label.lower()
            or any(needle in d.lower() for d in r.disease)
        ]

    if status and status != "all":
        rows = [r for r in rows if r.status_key == status]

    return rows


@router.get("/patients/{patient_id}", response_model=DoctorPatientSummary)
def get_patient(
    patient_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("doctor")),
) -> DoctorPatientSummary:
    del user
    patient = db.get(User, patient_id)
    if patient is None or patient.role != "patient":
        raise APIError(404, "PATIENT_NOT_FOUND", "Không tìm thấy bệnh nhân.")
    return _patient_summary(db, patient)


@router.get("/patients/{patient_id}/compliance", response_model=PatientComplianceOut)
def get_patient_compliance(
    patient_id: str,
    days: int = 14,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("doctor")),
) -> PatientComplianceOut:
    del user
    patient = db.get(User, patient_id)
    if patient is None or patient.role != "patient":
        raise APIError(404, "PATIENT_NOT_FOUND", "Không tìm thấy bệnh nhân.")
    return ComplianceService(db).get_patient_compliance(patient_id, days=days)


@router.post(
    "/patients/{patient_id}/compliance/remind",
    response_model=NotificationOut,
)
def remind_patient_compliance(
    patient_id: str,
    payload: ComplianceRemindRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("doctor")),
) -> NotificationOut:
    del user
    patient = db.get(User, patient_id)
    if patient is None or patient.role != "patient":
        raise APIError(404, "PATIENT_NOT_FOUND", "Không tìm thấy bệnh nhân.")
    notification = NotificationService(db).create_manual_reminder(
        patient.id,
        payload.message,
    )
    db.commit()
    db.refresh(notification)
    return NotificationOut.model_validate(notification)


@router.put("/patients/{patient_id}/metrics", response_model=PatientMetricsOut)
def update_patient_metrics(
    patient_id: str,
    payload: MetricsUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("doctor")),
) -> PatientMetricsOut:
    del user
    patient = db.get(User, patient_id)
    if patient is None or patient.role != "patient":
        raise APIError(404, "PATIENT_NOT_FOUND", "Không tìm thấy bệnh nhân.")

    profile = db.query(Profile).filter(Profile.user_id == patient.id).first()
    if profile is None:
        profile = Profile(user_id=patient.id)
        db.add(profile)

    profile.weight = payload.weight
    profile.height = payload.height
    height_m = payload.height / 100.0
    profile.bmi = round(payload.weight / (height_m * height_m), 1)
    db.commit()
    db.refresh(profile)

    return PatientMetricsOut(
        weight=profile.weight,
        height=profile.height,
        bmi=profile.bmi,
        bmi_category=_bmi_category(profile.bmi),
        updated_at=_format_dt(datetime.now(UTC)),
    )


@router.put("/patients/{patient_id}/goals", response_model=GoalsOut)
def update_patient_goals(
    patient_id: str,
    payload: GoalsUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("doctor")),
) -> GoalsOut:
    del user
    patient = db.get(User, patient_id)
    if patient is None or patient.role != "patient":
        raise APIError(404, "PATIENT_NOT_FOUND", "Không tìm thấy bệnh nhân.")

    profile = db.query(Profile).filter(Profile.user_id == patient.id).first()
    if profile is None:
        profile = Profile(user_id=patient.id)
        db.add(profile)
    profile.treatment_goals = payload.goals
    db.commit()
    return GoalsOut(goals=list(profile.treatment_goals or []))


@router.put("/patients/{patient_id}/profile", response_model=DoctorPatientSummary)
def update_patient_profile(
    patient_id: str,
    payload: DoctorPatientUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("doctor")),
) -> DoctorPatientSummary:
    del user
    patient = db.get(User, patient_id)
    if patient is None or patient.role != "patient":
        raise APIError(404, "PATIENT_NOT_FOUND", "Không tìm thấy bệnh nhân.")

    provided = payload.model_fields_set
    if "email" in provided:
        new_email = payload.email.strip().lower() if payload.email else ""
        if not new_email:
            raise APIError(422, "INVALID_EMAIL", "Email không được để trống.")
        if new_email != patient.email:
            taken = (
                db.query(User)
                .filter(User.email == new_email, User.id != patient.id)
                .first()
            )
            if taken is not None:
                raise APIError(409, "EMAIL_EXISTS", "Email đã được đăng ký.")
            patient.email = new_email
    if "full_name" in provided:
        patient.full_name = (payload.full_name or "").strip() or None
    if "avatar" in provided:
        patient.avatar = (payload.avatar or "").strip() or None

    profile = db.query(Profile).filter(Profile.user_id == patient.id).first()
    if profile is None:
        profile = Profile(user_id=patient.id)
        db.add(profile)
    for field in (
        "age",
        "gender",
        "phone",
        "address",
        "blood_pressure",
        "blood_glucose",
        "disease",
        "medications",
        "allergies",
        "preferences",
        "treatment_goals",
    ):
        if field in provided:
            setattr(profile, field, getattr(payload, field))
    db.commit()
    return _patient_summary(db, patient)


@router.put("/patients/{patient_id}/constraints", response_model=DoctorPatientSummary)
def update_patient_constraints(
    patient_id: str,
    payload: DoctorConstraintsUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("doctor")),
) -> DoctorPatientSummary:
    del user
    patient = db.get(User, patient_id)
    if patient is None or patient.role != "patient":
        raise APIError(404, "PATIENT_NOT_FOUND", "Không tìm thấy bệnh nhân.")

    profile = db.query(Profile).filter(Profile.user_id == patient.id).first()
    if profile is None:
        profile = Profile(user_id=patient.id)
        db.add(profile)

    provided = payload.model_fields_set
    if "target_kcal" in provided and payload.target_kcal is not None:
        profile.target_kcal = payload.target_kcal

    restrictions = dict(profile.restrictions or {})
    if "salt_daily_g" in provided:
        restrictions["salt_daily_g"] = payload.salt_daily_g
    if "sugar_daily_g" in provided:
        restrictions["sugar_daily_g"] = payload.sugar_daily_g
    profile.restrictions = restrictions

    db.commit()
    return _patient_summary(db, patient)


@router.get("/catalog", response_model=CatalogOut)
def get_catalog(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("doctor", "patient")),
) -> CatalogOut:
    del user
    return CatalogOut(
        medicines=[
            CatalogItem(id=m.id, name=m.name)
            for m in db.query(Medicine).order_by(Medicine.name).all()
        ],
        allergies=[
            CatalogItem(id=a.id, name=a.name)
            for a in db.query(Allergy).order_by(Allergy.name).all()
        ],
        diagnoses=[
            DiagnosisItem(code=d.code, name=d.name)
            for d in db.query(Diagnosis).order_by(Diagnosis.name).all()
        ],
    )


@router.get("/foods", response_model=FoodCatalogOut)
def search_foods(
    q: str = "",
    limit: int = 40,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("doctor")),
) -> FoodCatalogOut:
    """Tra cứu món từ nutrition catalog (DB + JSON fallback) cho UI thêm món."""
    del user
    from app.agents.meal_planner_agent import _resolve_catalog

    limit = max(1, min(limit, 100))
    catalog = _resolve_catalog(db)
    query = (q or "").strip().lower()

    matched: list[FoodCatalogItem] = []
    for food in catalog.foods:
        name = str(food.get("name") or "")
        food_id = str(food.get("id") or "")
        aliases = [str(a).lower() for a in (food.get("aliases") or [])]
        if query:
            hay = " ".join([name.lower(), food_id.lower(), *aliases])
            if query not in hay:
                continue
        macros_raw = food.get("macros") or {}
        citation = str(food.get("citation") or "")
        source = "db" if citation.startswith(("recipes_", "foods_")) else "catalog"
        matched.append(
            FoodCatalogItem(
                id=food_id,
                name=name,
                portion=str(food.get("portion") or ""),
                kcal=float(food.get("kcal") or 0),
                macros=FoodCatalogMacros(
                    carb_g=float(macros_raw.get("carb_g") or 0),
                    protein_g=float(macros_raw.get("protein_g") or 0),
                    fat_g=float(macros_raw.get("fat_g") or 0),
                    sodium_mg=float(macros_raw.get("sodium_mg") or 0),
                ),
                category=str(food.get("category") or ""),
                source=source,
            )
        )

    matched.sort(key=lambda item: item.name.casefold())
    return FoodCatalogOut(items=matched[:limit], total=len(matched))


@router.post("/patients/{patient_id}/avatar", response_model=AvatarOut)
async def upload_patient_avatar(
    patient_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("doctor")),
) -> AvatarOut:
    del user
    patient = db.get(User, patient_id)
    if patient is None or patient.role != "patient":
        raise APIError(404, "PATIENT_NOT_FOUND", "Không tìm thấy bệnh nhân.")

    content_type = (file.content_type or "").lower()
    if not content_type.startswith("image/"):
        raise APIError(415, "INVALID_IMAGE", "File phải là ảnh (png/jpg/webp/gif).")
    ext = {
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/webp": ".webp",
        "image/gif": ".gif",
    }.get(content_type, ".img")

    content = await file.read()
    if len(content) > 2 * 1024 * 1024:
        raise APIError(413, "IMAGE_TOO_LARGE", "Ảnh tối đa 2MB.")

    avatars_dir = STATIC_AVATARS_DIR
    avatars_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{patient.id}{ext}"
    (avatars_dir / filename).write_bytes(content)

    patient.avatar = f"/static/avatars/{filename}"
    db.commit()
    return AvatarOut(avatar=patient.avatar)


@router.post(
    "/patients/{patient_id}/meal-plans/generate",
    response_model=MealPlanOutput,
)
def generate_plan_for_patient(
    patient_id: str,
    payload: GenerateMealPlanRequest | None = Body(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("doctor")),
) -> MealPlanOutput:
    del user
    patient = db.get(User, patient_id)
    if patient is None or patient.role != "patient":
        raise APIError(404, "PATIENT_NOT_FOUND", "Không tìm thấy bệnh nhân.")
    req = payload or GenerateMealPlanRequest()
    return generate_meal_plan(db, patient, notes=req.notes, priorities=req.priorities)


@router.get("/meal-plans", response_model=list[MealPlanOutput])
def list_meal_plans(
    status: str = "pending_review",
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("doctor")),
) -> list[MealPlanOutput]:
    del user
    query = db.query(MealPlan)
    if status != "all":
        query = query.filter(MealPlan.status == status)
    rows = query.order_by(MealPlan.created_at.desc()).all()
    return [meal_plan_from_row(row) for row in rows]


@router.post("/meal-plans/{meal_plan_id}/review", response_model=ReviewResponse)
def review_meal_plan(
    meal_plan_id: str,
    payload: ReviewRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("doctor")),
) -> ReviewResponse:
    row = db.get(MealPlan, meal_plan_id)
    if row is None:
        raise APIError(404, "MEAL_PLAN_NOT_FOUND", "Không tìm thấy thực đơn.")

    plan = meal_plan_from_row(row)
    now = datetime.now(UTC)

    if payload.action == "approve":
        row.status = "approved"
        row.trust_badge = "doctor_reviewed"
        row.reviewer_id = user.id
        row.review_notes = payload.notes
        row.reviewed_at = now
        NotificationService(db).on_plan_approved(plan)
    elif payload.action == "reject":
        row.status = "rejected"
        row.trust_badge = None
        row.reviewer_id = user.id
        row.review_notes = payload.notes
        row.reviewed_at = now
        NotificationService(db).on_plan_rejected(plan)
    elif payload.action == "edit":
        if payload.edited_plan is None:
            raise APIError(400, "EDITED_PLAN_REQUIRED", "Cần edited_plan khi action=edit.")
        edited = MealPlanOutput(**payload.edited_plan)
        row.days = [day.model_dump() for day in edited.days]
        row.swaps = [swap.model_dump() for swap in edited.swaps]
        row.citations = edited.citations
        row.status = "edited"
        row.trust_badge = "doctor_reviewed"
        row.reviewer_id = user.id
        row.review_notes = payload.notes
        row.reviewed_at = now

    db.commit()
    db.refresh(row)
    return ReviewResponse(
        meal_plan_id=row.id,
        status=row.status,
        trust_badge=row.trust_badge,
        reviewed_at=row.reviewed_at.isoformat() if row.reviewed_at else "",
        reviewer_id=row.reviewer_id or "",
    )


@router.post("/demo/plan-expiry", response_model=PlanExpiryDemoOut)
def simulate_plan_expiry(
    payload: PlanExpiryDemoRequest | None = Body(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("doctor")),
) -> PlanExpiryDemoOut:
    """Demo: đẩy reviewed_at của plan approved mới nhất mỗi bệnh nhân về quá khứ
    để trạng thái hạn thành "expiring" (sắp ăn xong) hoặc "expired" (đã ăn xong).

    Chỉ khả dụng ngoài production (giống /demo/simulate).
    """
    del user
    if settings.APP_ENV == "production":
        raise APIError(
            403,
            "DEMO_DISABLED",
            "Endpoint demo không khả dụng ở production.",
        )
    mode = payload.mode if payload else "expired"
    now = datetime.now(UTC)
    updated: list[str] = []
    skipped: list[str] = []

    patients = db.query(User).filter(User.role == "patient").all()
    for patient in patients:
        plan = (
            db.query(MealPlan)
            .filter(
                MealPlan.user_id == patient.id,
                MealPlan.status == "approved",
            )
            .order_by(MealPlan.created_at.desc())
            .first()
        )
        if plan is None:
            skipped.append(patient.id)
            continue
        duration = plan_expiry.duration_days(len(plan.days or []))
        if mode == "expiring":
            # reviewed_at = hôm nay − (duration − 2) → kết thúc = hôm nay + 1 → còn 1 ngày
            plan.reviewed_at = now - timedelta(days=max(1, duration - 2))
        else:
            # reviewed_at = hôm nay − duration → kết thúc = hôm nay − 1 → đã hết hạn
            plan.reviewed_at = now - timedelta(days=duration)
        updated.append(patient.id)

    db.commit()
    return PlanExpiryDemoOut(updated=updated, skipped=skipped)
