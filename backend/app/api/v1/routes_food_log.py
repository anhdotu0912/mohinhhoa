"""Food log routes — contract §12, ADR-009."""

from __future__ import annotations

from datetime import date as date_type, datetime, time

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db.session import get_db
from app.models.food_log import FoodLog
from app.models.user import User
from app.schemas.food_log import FoodLogCreate, FoodLogOut
from app.services.food_log_service import create_food_log

router = APIRouter(prefix="/food-log", tags=["food-log"])


@router.post("", response_model=FoodLogOut)
def post_food_log(
    payload: FoodLogCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("patient")),
) -> FoodLog:
    return create_food_log(db, user.id, payload)


@router.get("", response_model=list[FoodLogOut])
def list_food_logs(
    date: str | None = None,
    meal_plan_id: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("patient")),
) -> list[FoodLog]:
    query = db.query(FoodLog).filter(FoodLog.user_id == user.id)
    if meal_plan_id:
        query = query.filter(FoodLog.meal_plan_id == meal_plan_id)
    if date:
        try:
            day = date_type.fromisoformat(date)
        except ValueError:
            day = None
        if day is not None:
            start = datetime.combine(day, time.min)
            end = datetime.combine(day, time.max)
            query = query.filter(FoodLog.logged_at >= start, FoodLog.logged_at <= end)
    return query.order_by(FoodLog.logged_at.desc()).all()
