"""Food log business logic — persist + interaction alert linkage."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.agents.interaction_checker_agent import check_interactions
from app.core.datetime_vn import utc_now_naive, vn_day_bounds_utc
from app.core.errors import APIError
from app.models.alert import Alert
from app.models.food_log import FoodLog
from app.models.meal_plan import MealPlan
from app.models.profile import Profile
from app.schemas.food_log import FoodLogCreate
from app.services.notification import NotificationService


def _persist_food_log_alerts(
    db: Session,
    user_id: str,
    food_log_id: str,
    medications: list[str],
    note: str,
    meal_plan_id: str | None,
) -> list[str]:
    """Check custom food note against interaction KB and create alerts."""
    if not note.strip():
        return []

    items = check_interactions(
        medications=medications,
        foods=[note.strip()],
        db=db,
    )
    alert_ids: list[str] = []
    notifications = NotificationService(db)
    for item in items:
        alert = Alert(
            user_id=user_id,
            drug=item.drug,
            food=item.food,
            mechanism=item.mechanism,
            severity=item.severity,
            recommendation=item.recommendation,
            sources=item.sources,
            meal_plan_id=meal_plan_id,
            food_log_id=food_log_id,
        )
        db.add(alert)
        db.flush()
        notifications.on_alert_created(alert)
        alert_ids.append(alert.id)
    return alert_ids


def _find_slot_for_vn_day(
    db: Session,
    user_id: str,
    slot: str,
) -> FoodLog | None:
    start, end = vn_day_bounds_utc()
    return (
        db.query(FoodLog)
        .filter(
            FoodLog.user_id == user_id,
            FoodLog.slot == slot,
            FoodLog.logged_at >= start,
            FoodLog.logged_at < end,
        )
        .order_by(FoodLog.logged_at.desc())
        .first()
    )


def create_food_log(
    db: Session,
    user_id: str,
    payload: FoodLogCreate,
) -> FoodLog:
    profile = db.query(Profile).filter(Profile.user_id == user_id).first()
    medications = (profile.medications if profile else None) or []

    if payload.meal_plan_id:
        plan = db.get(MealPlan, payload.meal_plan_id)
        if plan is None or plan.user_id != user_id:
            raise APIError(
                403,
                "FORBIDDEN",
                "meal_plan_id không thuộc về bạn.",
            )

    note = payload.note.strip() if payload.type == "custom" else ""
    now = utc_now_naive()
    existing = _find_slot_for_vn_day(db, user_id, payload.slot)
    should_check_alerts = False

    if existing is not None:
        changed = existing.type != payload.type or existing.note != note
        existing.type = payload.type
        existing.note = note
        existing.logged_at = now
        if payload.meal_plan_id:
            existing.meal_plan_id = payload.meal_plan_id
        if payload.day_index is not None:
            existing.day_index = payload.day_index
        if changed:
            existing.status = "adjusted"
        should_check_alerts = payload.type == "custom" and note and not existing.alert_ids
        row = existing
    else:
        row = FoodLog(
            user_id=user_id,
            meal_plan_id=payload.meal_plan_id,
            day_index=payload.day_index,
            slot=payload.slot,
            type=payload.type,
            note=note,
            status="logged",
            alert_ids=[],
            logged_at=now,
        )
        db.add(row)
        db.flush()
        should_check_alerts = payload.type == "custom" and bool(note)

    if should_check_alerts:
        row.alert_ids = _persist_food_log_alerts(
            db,
            user_id,
            row.id,
            medications,
            payload.note,
            payload.meal_plan_id or row.meal_plan_id,
        )

    db.commit()
    db.refresh(row)
    return row
