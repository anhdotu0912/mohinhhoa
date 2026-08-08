"""Dietitian review routes — contract §5."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.core.security import require_roles
from app.db.session import get_db
from app.models.meal_plan import MealPlan
from app.models.user import User
from app.schemas.dietitian import ReviewRequest, ReviewResponse
from app.schemas.meal_plan import MealPlanOutput
from app.services.meal_plan_service import meal_plan_from_row
from app.services.notification import NotificationService

router = APIRouter(prefix="/dietitian", tags=["dietitian"])


@router.get("/meal-plans", response_model=list[MealPlanOutput])
def list_meal_plans(
    status: str = "pending_review",
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("dietitian")),
) -> list[MealPlanOutput]:
    rows = (
        db.query(MealPlan)
        .filter(MealPlan.status == status)
        .order_by(MealPlan.created_at.desc())
        .all()
    )
    return [meal_plan_from_row(row) for row in rows]


@router.post("/meal-plans/{meal_plan_id}/review", response_model=ReviewResponse)
def review_meal_plan(
    meal_plan_id: str,
    payload: ReviewRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("dietitian")),
) -> ReviewResponse:
    row = db.get(MealPlan, meal_plan_id)
    if row is None:
        raise APIError(404, "MEAL_PLAN_NOT_FOUND", "Không tìm thấy thực đơn.")

    plan = meal_plan_from_row(row)
    now = datetime.now(UTC)

    if payload.action == "approve":
        row.status = "approved"
        row.trust_badge = "dietitian_reviewed"
        row.reviewer_id = user.id
        row.review_notes = payload.notes
        row.reviewed_at = now
        NotificationService(db).on_plan_approved(plan)
    elif payload.action == "reject":
        row.status = "rejected"
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
        row.trust_badge = "dietitian_reviewed"
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
