"""Meal plan routes — contract §1.2."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.core.security import get_current_user, require_roles
from app.db.session import get_db
from app.models.meal_plan import MealPlan
from app.models.user import User
from app.schemas.meal_plan import MealPlanOutput
from app.services.meal_plan_service import generate_meal_plan, meal_plan_from_row

router = APIRouter(prefix="/meal-plans", tags=["meal-plans"])


@router.post("/generate", response_model=MealPlanOutput)
def generate_plan(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("patient")),
) -> MealPlanOutput:
    return generate_meal_plan(db, user)


@router.get("/me", response_model=MealPlanOutput)
def get_my_latest_plan(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("patient")),
) -> MealPlanOutput:
    row = (
        db.query(MealPlan)
        .filter(MealPlan.user_id == user.id)
        .order_by(MealPlan.created_at.desc())
        .first()
    )
    if row is None:
        raise APIError(404, "NO_MEAL_PLAN", "Bạn chưa có thực đơn nào.")
    return meal_plan_from_row(row)


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
