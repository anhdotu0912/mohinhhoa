"""Doctor routes — patients list, generate-for-patient, meal-plan review."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, Body, Depends, File, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import APIError
from app.core.security import require_roles
from app.db.session import get_db
from app.models.alert import Alert
from app.models.catalog import Allergy, Diagnosis, Medicine
from app.models.meal_plan import MealPlan
from app.models.patient_transfer import PatientTransfer
from app.models.profile import Profile
from app.models.user import User
from app.schemas.body_metrics import MetricsHistoryPoint
from app.schemas.doctor import (
    AvatarOut,
    CatalogItem,
    CatalogOut,
    ClaimQueueItem,
    ComplianceRemindRequest,
    CreateDoctorPatientRequest,
    DiagnosisItem,
    DoctorColleague,
    DoctorConstraintsUpdate,
    DoctorPatientSummary,
    DoctorPatientUpdate,
    FoodCatalogItem,
    FoodCatalogMacros,
    FoodCatalogOut,
    GoalsOut,
    GoalsUpdate,
    MealPlanScheduleOut,
    MetricsUpdateRequest,
    PatientComplianceOut,
    PatientMetricsOut,
    PendingTransferOut,
    PlanExpiryDemoOut,
    PlanExpiryDemoRequest,
    ReviewRequest,
    ReviewResponse,
    TransferOut,
    TransferRequest,
)
from app.schemas.meal_plan import ApplyMealPlanRequest, GenerateMealPlanRequest, MealPlanOutput
from app.schemas.notification import NotificationOut
from app.schemas.profile import PatientProfile
from app.services import assignment as assignment_service
from app.services import plan_expiry
from app.services.avatar_service import save_user_avatar
from app.services.compliance import ComplianceService
from app.services.meal_plan_service import _format_request_dt, generate_meal_plan, get_profile, meal_plan_from_row
from app.services.notification import NotificationService
from app.services.plan_apply import (
    apply_meal_plan,
    find_active_plan,
    find_upcoming_plan,
    patient_plan_usage,
    resolve_apply_request,
)
from app.services.plan_schedule import build_meal_plan_schedule, validate_slot_start

router = APIRouter(prefix="/doctor", tags=["doctor"])

_DISEASE_LABELS = {
    "diabetes_t1": "Tiểu đường type 1",
    "diabetes_t2": "Tiểu đường type 2",
    "diabetes_gestational": "Đái tháo đường thai kỳ",
    "diabetic_neuropathy": "Bệnh thần kinh đái tháo đường",
    "prediabetes": "Tiền đái tháo đường",
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


def _format_iso(value: datetime | None) -> str:
    if value is None:
        return ""
    return value.isoformat()


def _transfer_out(db: Session, row: PatientTransfer) -> TransferOut:
    target = db.get(User, row.to_doctor_id)
    return TransferOut(
        id=row.id,
        patient_id=row.patient_id,
        from_doctor_id=row.from_doctor_id,
        to_doctor_id=row.to_doctor_id,
        status=row.status,  # type: ignore[arg-type]
        to_doctor_name=assignment_service.display_doctor_name(target),
        created_at=_format_iso(row.created_at),
    )


def _pending_transfer_out(db: Session, patient_id: str) -> PendingTransferOut | None:
    row = assignment_service.pending_transfer_for_patient(db, patient_id)
    if row is None:
        return None
    target = db.get(User, row.to_doctor_id)
    return PendingTransferOut(
        id=row.id,
        to_doctor_id=row.to_doctor_id,
        to_doctor_name=assignment_service.display_doctor_name(target),
        created_at=_format_iso(row.created_at),
    )


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

    # Hạn / usage: ưu tiên plan đang active, không thì upcoming, không thì latest đã apply
    active_plan = find_active_plan(db, user.id)
    if active_plan is None:
        active_plan = find_upcoming_plan(db, user.id)

    display_plan = active_plan or latest_plan
    plan_end_date = None
    plan_days_left = None
    plan_expiry_bucket: str = "none"
    plan_starts_on = None
    active_plan_id = None
    active_plan_status = None

    if active_plan is not None:
        active_plan_id = active_plan.id
        active_plan_status = active_plan.status

    usage = patient_plan_usage(db, user.id)

    if (
        display_plan is not None
        and display_plan.status in plan_expiry.EXPIRY_ELIGIBLE_STATUSES
        and display_plan.starts_on is not None
    ):
        plan_days = len(display_plan.days or [])
        end = plan_expiry.end_date(
            display_plan.reviewed_at,
            display_plan.created_at,
            plan_days,
            starts_on=display_plan.starts_on,
            ends_on=display_plan.ends_on,
        )
        start = display_plan.starts_on
        plan_starts_on = start.strftime("%d/%m/%Y") if start else None
        plan_end_date = end.strftime("%d/%m/%Y") if end else None
        plan_days_left = plan_expiry.days_left(
            display_plan.reviewed_at,
            display_plan.created_at,
            plan_days,
            starts_on=display_plan.starts_on,
            ends_on=display_plan.ends_on,
        )
        plan_expiry_bucket = plan_expiry.bucket(
            display_plan.reviewed_at,
            display_plan.created_at,
            plan_days,
            starts_on=display_plan.starts_on,
            ends_on=display_plan.ends_on,
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
        constraints_status=getattr(profile, "constraints_status", None) or "confirmed",
        status=status,  # type: ignore[arg-type]
        status_key=status_key,  # type: ignore[arg-type]
        latest_plan_id=latest_plan.id if latest_plan else None,
        latest_plan_status=latest_plan.status if latest_plan else None,
        active_plan_id=active_plan_id,
        active_plan_status=active_plan_status,
        plan_starts_on=plan_starts_on,
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
        plan_usage=usage,  # type: ignore[arg-type]
        meal_plan_request_status=(
            getattr(profile, "meal_plan_request_status", None) or "none"
            if profile
            else "none"
        ),  # type: ignore[arg-type]
        meal_plan_request_note=getattr(profile, "meal_plan_request_note", None)
        if profile
        else None,
        meal_plan_requested_at=_format_request_dt(
            getattr(profile, "meal_plan_requested_at", None) if profile else None
        ),
        pending_transfer=_pending_transfer_out(db, user.id),
    )


@router.get("/patients", response_model=list[DoctorPatientSummary])
def list_patients(
    q: str | None = None,
    status: str | None = None,
    plan_usage: str | None = None,
    meal_plan_request: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("doctor")),
) -> list[DoctorPatientSummary]:
    patients = assignment_service.list_assigned_patients(db, user.id)
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

    if plan_usage and plan_usage != "all":
        rows = [r for r in rows if r.plan_usage == plan_usage]

    if meal_plan_request and meal_plan_request != "all":
        if meal_plan_request == "pending":
            rows = [r for r in rows if r.meal_plan_request_status == "pending"]

    return rows


@router.post("/patients", response_model=DoctorPatientSummary, status_code=201)
def create_patient(
    payload: CreateDoctorPatientRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("doctor")),
) -> DoctorPatientSummary:
    patient = assignment_service.create_patient_for_doctor(
        db,
        user,
        email=payload.email,
        password=payload.password,
        full_name=payload.full_name,
    )
    return _patient_summary(db, patient)


@router.get("/claim-queue", response_model=list[ClaimQueueItem])
def get_claim_queue(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("doctor")),
) -> list[ClaimQueueItem]:
    items: list[ClaimQueueItem] = []
    for row in assignment_service.list_claim_queue(db, user):
        items.append(
            ClaimQueueItem(
                kind=row.kind,  # type: ignore[arg-type]
                source=row.source,  # type: ignore[arg-type]
                patient_id=row.patient.id,
                patient=_patient_summary(db, row.patient),
                transfer_id=row.transfer.id if row.transfer else None,
                from_doctor_id=row.from_doctor.id if row.from_doctor else None,
                from_doctor_name=assignment_service.display_doctor_name(row.from_doctor),
                created_at=_format_iso(row.created_at),
            )
        )
    return items


@router.get("/colleagues", response_model=list[DoctorColleague])
def get_colleagues(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("doctor")),
) -> list[DoctorColleague]:
    return [
        DoctorColleague(
            id=doc.id,
            full_name=doc.full_name,
            email=doc.email,
            avatar=doc.avatar,
        )
        for doc in assignment_service.list_colleagues(db, user.id)
    ]


@router.post("/patients/{patient_id}/claim", response_model=DoctorPatientSummary)
def claim_patient(
    patient_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("doctor")),
) -> DoctorPatientSummary:
    patient = assignment_service.claim_patient(db, user, patient_id)
    return _patient_summary(db, patient)


@router.post("/patients/{patient_id}/transfer", response_model=TransferOut)
def transfer_patient(
    patient_id: str,
    payload: TransferRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("doctor")),
) -> TransferOut:
    row = assignment_service.request_transfer(db, user, patient_id, payload.to_doctor_id)
    return _transfer_out(db, row)


@router.post("/transfers/{transfer_id}/accept", response_model=DoctorPatientSummary)
def accept_transfer(
    transfer_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("doctor")),
) -> DoctorPatientSummary:
    patient = assignment_service.accept_transfer(db, user, transfer_id)
    return _patient_summary(db, patient)


@router.get("/patients/{patient_id}", response_model=DoctorPatientSummary)
def get_patient(
    patient_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("doctor")),
) -> DoctorPatientSummary:
    patient = assignment_service.require_assigned_patient(db, user, patient_id)
    return _patient_summary(db, patient)


@router.get("/patients/{patient_id}/compliance", response_model=PatientComplianceOut)
def get_patient_compliance(
    patient_id: str,
    days: int = 14,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("doctor")),
) -> PatientComplianceOut:
    assignment_service.require_assigned_patient(db, user, patient_id)
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
    patient = assignment_service.require_assigned_patient(db, user, patient_id)
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
    patient = assignment_service.require_assigned_patient(db, user, patient_id)

    profile = db.query(Profile).filter(Profile.user_id == patient.id).first()
    if profile is None:
        profile = Profile(user_id=patient.id)
        db.add(profile)

    if payload.weight is None or payload.height is None:
        raise APIError(
            400,
            "METRICS_INCOMPLETE",
            "Cần gửi đủ weight và height cùng lúc.",
        )

    profile.weight = payload.weight
    profile.height = payload.height
    height_m = payload.height / 100.0
    profile.bmi = round(payload.weight / (height_m * height_m), 1)
    db.flush()

    from app.services.metrics_service import record_doctor_metrics

    record_doctor_metrics(db, patient.id, profile.weight, profile.height, profile.bmi)
    db.commit()
    db.refresh(profile)

    return PatientMetricsOut(
        weight=profile.weight,
        height=profile.height,
        bmi=profile.bmi,
        bmi_category=_bmi_category(profile.bmi),
        updated_at=_format_dt(datetime.now(UTC)),
    )


@router.get(
    "/patients/{patient_id}/metrics/history",
    response_model=list[MetricsHistoryPoint],
)
def get_doctor_patient_metrics_history(
    patient_id: str,
    days: int = 90,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("doctor")),
) -> list[MetricsHistoryPoint]:
    patient = assignment_service.require_assigned_patient(db, user, patient_id)
    from app.services.metrics_service import list_metrics_history
    entries = list_metrics_history(db, patient.id, days=days)
    return [MetricsHistoryPoint.model_validate(e) for e in entries]


@router.put("/patients/{patient_id}/goals", response_model=GoalsOut)
def update_patient_goals(
    patient_id: str,
    payload: GoalsUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("doctor")),
) -> GoalsOut:
    patient = assignment_service.require_assigned_patient(db, user, patient_id)

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
    patient = assignment_service.require_assigned_patient(db, user, patient_id)

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
    patient = assignment_service.require_assigned_patient(db, user, patient_id)

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
    profile.constraints_status = "confirmed"

    db.commit()
    return _patient_summary(db, patient)


@router.post("/patients/{patient_id}/constraints/approve", response_model=PatientProfile)
def approve_patient_constraints(
    patient_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("doctor")),
) -> PatientProfile:
    patient = assignment_service.require_assigned_patient(db, user, patient_id)

    profile = db.query(Profile).filter(Profile.user_id == patient.id).first()
    if profile is None:
        raise APIError(404, "PATIENT_NOT_FOUND", "Không tìm thấy hồ sơ bệnh nhân.")

    if getattr(profile, "constraints_status", "confirmed") != "pending_doctor_review":
        raise APIError(
            400,
            "NOTHING_TO_APPROVE",
            "Không có thay đổi nào đang chờ duyệt.",
        )

    profile.constraints_status = "confirmed"
    db.commit()
    return get_profile(db, patient.id)


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
    patient = assignment_service.require_assigned_patient(db, user, patient_id)

    content = await file.read()
    avatar = save_user_avatar(
        user=patient,
        content=content,
        content_type=file.content_type or "",
        db=db,
    )
    return AvatarOut(avatar=avatar)


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
    patient = assignment_service.require_assigned_patient(db, user, patient_id)
    req = payload or GenerateMealPlanRequest()
    return generate_meal_plan(db, patient, notes=req.notes, priorities=req.priorities)


@router.get("/meal-plans", response_model=list[MealPlanOutput])
def list_meal_plans(
    status: str = "pending_review",
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("doctor")),
) -> list[MealPlanOutput]:
    ids = assignment_service.assigned_patient_ids(db, user.id)
    if not ids:
        return []
    query = db.query(MealPlan).filter(MealPlan.user_id.in_(ids))
    if status != "all":
        query = query.filter(MealPlan.status == status)
    rows = query.order_by(MealPlan.created_at.desc()).all()
    return [meal_plan_from_row(row) for row in rows]


@router.get(
    "/patients/{patient_id}/meal-plans",
    response_model=list[MealPlanOutput],
)
def list_patient_meal_plans(
    patient_id: str,
    status: str = "all",
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("doctor")),
) -> list[MealPlanOutput]:
    assignment_service.require_assigned_patient(db, user, patient_id)
    query = db.query(MealPlan).filter(MealPlan.user_id == patient_id)
    if status != "all":
        query = query.filter(MealPlan.status == status)
    rows = query.order_by(MealPlan.created_at.desc()).all()
    return [meal_plan_from_row(row) for row in rows]


@router.get(
    "/patients/{patient_id}/meal-plan-schedule",
    response_model=MealPlanScheduleOut,
)
def get_patient_meal_plan_schedule(
    patient_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("doctor")),
) -> MealPlanScheduleOut:
    assignment_service.require_assigned_patient(db, user, patient_id)
    data = build_meal_plan_schedule(db, patient_id)
    return MealPlanScheduleOut(**data)


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
    assignment_service.require_assigned_patient(db, user, row.user_id)

    if row.status != "pending_review":
        raise APIError(
            409,
            "PLAN_ALREADY_REVIEWED",
            f"Thực đơn này đã được xử lý (status hiện tại: {row.status}). "
            "Tải lại danh sách để xem trạng thái mới nhất.",
        )

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
        NotificationService(db).on_plan_approved(meal_plan_from_row(row))

    db.commit()
    db.refresh(row)
    return ReviewResponse(
        meal_plan_id=row.id,
        status=row.status,
        trust_badge=row.trust_badge,
        reviewed_at=row.reviewed_at.isoformat() if row.reviewed_at else "",
        reviewer_id=row.reviewer_id or "",
    )


@router.post("/meal-plans/{meal_plan_id}/apply", response_model=MealPlanOutput)
def apply_plan_validity(
    meal_plan_id: str,
    payload: ApplyMealPlanRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("doctor")),
) -> MealPlanOutput:
    row = db.get(MealPlan, meal_plan_id)
    if row is None:
        raise APIError(404, "MEAL_PLAN_NOT_FOUND", "Không tìm thấy thực đơn.")
    assignment_service.require_assigned_patient(db, user, row.user_id)
    start_date, replace_active = resolve_apply_request(
        db,
        row.user_id,
        plan_id=row.id,
        apply_mode=payload.apply_mode,
        start_date=payload.start_date,
        replace_active=payload.replace_active,
    )
    if payload.slot_key is not None:
        validate_slot_start(
            db,
            row.user_id,
            start_date,
            payload.slot_key,
            replace_active=replace_active,
        )
    result = apply_meal_plan(
        db,
        row,
        start_date,
        replace_active=replace_active,
    )
    db.commit()
    db.refresh(row)
    return result


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
    if settings.APP_ENV == "production":
        raise APIError(
            403,
            "DEMO_DISABLED",
            "Endpoint demo không khả dụng ở production.",
        )
    mode = payload.mode if payload else "expired"
    updated: list[str] = []
    skipped: list[str] = []
    today = date.today()

    patients = assignment_service.list_assigned_patients(db, user.id)
    for patient in patients:
        plan = find_active_plan(db, patient.id, today)
        if plan is None:
            plan = (
                db.query(MealPlan)
                .filter(
                    MealPlan.user_id == patient.id,
                    MealPlan.status.in_(plan_expiry.EXPIRY_ELIGIBLE_STATUSES),
                )
                .order_by(MealPlan.created_at.desc())
                .first()
            )
        if plan is None or plan.starts_on is None:
            if plan is not None and plan.status in plan_expiry.EXPIRY_ELIGIBLE_STATUSES:
                duration = plan_expiry.duration_days(len(plan.days or []))
                plan.starts_on = today
                plan.ends_on = today + timedelta(days=duration - 1)
            else:
                skipped.append(patient.id)
                continue
        duration = plan_expiry.duration_days(len(plan.days or []))
        if mode == "expiring":
            plan.starts_on = today - timedelta(days=max(1, duration - 2))
            plan.ends_on = today + timedelta(days=1)
        else:
            plan.starts_on = today - timedelta(days=duration)
            plan.ends_on = today - timedelta(days=1)
        updated.append(patient.id)

    db.commit()
    return PlanExpiryDemoOut(updated=updated, skipped=skipped)


@router.delete("/meal-plans/{meal_plan_id}", status_code=204)
def delete_doctor_meal_plan(
    meal_plan_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("doctor")),
) -> None:
    """Xóa một thực đơn đã tạo (chờ duyệt, đã duyệt, hoặc đã áp dụng)."""
    plan = db.get(MealPlan, meal_plan_id)
    if plan is None:
        raise APIError(404, "MEAL_PLAN_NOT_FOUND", "Không tìm thấy thực đơn.")
    assignment_service.require_assigned_patient(db, user, plan.user_id)

    from app.services.plan_limits import delete_meal_plan_cascade

    delete_meal_plan_cascade(db, plan)
    db.commit()
    return None


@router.delete("/patients/{patient_id}", status_code=204)
def delete_doctor_patient(
    patient_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("doctor")),
) -> None:
    """Xóa hoàn toàn một bệnh nhân và toàn bộ dữ liệu phụ thuộc liên quan."""
    target_user = assignment_service.require_assigned_patient(db, user, patient_id)

    from app.models.body_metrics import BodyMetricsEntry
    from app.models.chat_session import ChatMessage, ChatSession
    from app.models.food_log import FoodLog
    from app.models.notification import Notification
    from app.models.password_reset import PasswordResetToken

    # Cascade delete all related records
    session_ids = [s.id for s in db.query(ChatSession.id).filter(ChatSession.user_id == patient_id).all()]
    if session_ids:
        db.query(ChatMessage).filter(ChatMessage.session_id.in_(session_ids)).delete(synchronize_session=False)
    db.query(ChatSession).filter(ChatSession.user_id == patient_id).delete(synchronize_session=False)
    db.query(FoodLog).filter(FoodLog.user_id == patient_id).delete(synchronize_session=False)
    db.query(Notification).filter(Notification.user_id == patient_id).delete(synchronize_session=False)
    db.query(Alert).filter(Alert.user_id == patient_id).delete(synchronize_session=False)
    db.query(MealPlan).filter(MealPlan.user_id == patient_id).delete(synchronize_session=False)
    db.query(BodyMetricsEntry).filter(BodyMetricsEntry.user_id == patient_id).delete(synchronize_session=False)
    db.query(PasswordResetToken).filter(PasswordResetToken.user_id == patient_id).delete(synchronize_session=False)
    db.query(PatientTransfer).filter(PatientTransfer.patient_id == patient_id).delete(synchronize_session=False)
    db.query(Profile).filter(Profile.user_id == patient_id).delete(synchronize_session=False)
    db.delete(target_user)
    db.commit()
    return None

