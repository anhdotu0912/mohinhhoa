"""Meal plan routes — contract §1.2."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.core.security import get_current_user, require_roles
from app.db.session import get_db
from app.models.meal_plan import MealPlan
from app.models.user import User
from app.schemas.doctor import MealPlanScheduleOut
from app.schemas.meal_plan import (
    GenerateMealPlanRequest,
    MealPlanOutput,
    MealPlanRequestIn,
    MealPlanRequestOut,
    RequestAdjustmentRequest,
)
from app.services import plan_expiry
from app.services.meal_plan_service import (
    generate_meal_plan,
    get_meal_plan_request,
    meal_plan_from_row,
    resolve_patient_plan_row,
    submit_meal_plan_request,
)
from app.services.notification import NotificationService
from app.services.plan_schedule import build_meal_plan_schedule

router = APIRouter(prefix="/meal-plans", tags=["meal-plans"])


@router.post("/generate", response_model=MealPlanOutput)
def generate_plan(
    payload: GenerateMealPlanRequest | None = Body(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("patient")),
) -> MealPlanOutput:
    req = payload or GenerateMealPlanRequest()
    return generate_meal_plan(db, user, notes=req.notes, priorities=req.priorities)


@router.get("/me", response_model=MealPlanOutput)
def get_my_latest_plan(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("patient")),
) -> MealPlanOutput:
    row = resolve_patient_plan_row(db, user.id)
    if row is None:
        raise APIError(404, "NO_MEAL_PLAN", "Bạn chưa có thực đơn nào.")

    if (
        row.status in plan_expiry.EXPIRY_ELIGIBLE_STATUSES
        and row.starts_on is not None
    ):
        expiry_bucket = plan_expiry.bucket(
            row.reviewed_at,
            row.created_at,
            len(row.days or []),
            starts_on=row.starts_on,
            ends_on=row.ends_on,
        )
        notification = NotificationService(db).ensure_plan_expiry_notification(
            row, expiry_bucket
        )
        if notification is not None:
            db.commit()

    return meal_plan_from_row(row)


@router.get("/schedule", response_model=MealPlanScheduleOut)
def get_my_meal_plan_schedule(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("patient")),
) -> MealPlanScheduleOut:
    data = build_meal_plan_schedule(db, user.id)
    return MealPlanScheduleOut(**data)


@router.get("/request", response_model=MealPlanRequestOut)
def get_meal_plan_request_status(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("patient")),
) -> MealPlanRequestOut:
    return get_meal_plan_request(db, user.id)


@router.post("/request", response_model=MealPlanRequestOut)
def create_meal_plan_request(
    payload: MealPlanRequestIn | None = Body(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("patient")),
) -> MealPlanRequestOut:
    req = payload or MealPlanRequestIn()
    return submit_meal_plan_request(db, user, note=req.note)


@router.get("/{meal_plan_id}", response_model=MealPlanOutput)
def get_plan(
    meal_plan_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MealPlanOutput:
    row = db.get(MealPlan, meal_plan_id)
    if row is None:
        raise APIError(404, "MEAL_PLAN_NOT_FOUND", "Không tìm thấy thực đơn.")
    if user.role == "patient" and row.user_id != user.id:
        raise APIError(403, "FORBIDDEN", "Bạn không có quyền xem thực đơn này.")
    return meal_plan_from_row(row)


@router.post("/{meal_plan_id}/request-adjustment", response_model=MealPlanOutput)
def request_plan_adjustment(
    meal_plan_id: str,
    payload: RequestAdjustmentRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("patient")),
) -> MealPlanOutput:
    row = db.get(MealPlan, meal_plan_id)
    if row is None:
        raise APIError(404, "MEAL_PLAN_NOT_FOUND", "Không tìm thấy thực đơn.")
    if row.user_id != user.id:
        raise APIError(403, "FORBIDDEN", "Bạn không có quyền yêu cầu điều chỉnh thực đơn này.")
    if row.status != "approved":
        raise APIError(
            400,
            "PLAN_NOT_APPROVED",
            "Chỉ yêu cầu điều chỉnh trên thực đơn đã được duyệt.",
        )

    row.status = "pending_review"
    row.adjustment_note = payload.adjustment_note.strip()
    db.commit()
    db.refresh(row)
    return meal_plan_from_row(row)
