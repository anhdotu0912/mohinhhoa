"""Food log business logic — persist + interaction alert linkage."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.agents.interaction_checker_agent import check_interactions
from app.models.alert import Alert
from app.models.food_log import FoodLog
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


def create_food_log(
    db: Session,
    user_id: str,
    payload: FoodLogCreate,
) -> FoodLog:
    profile = db.query(Profile).filter(Profile.user_id == user_id).first()
    medications = (profile.medications if profile else None) or []

    row = FoodLog(
        user_id=user_id,
        meal_plan_id=payload.meal_plan_id,
        day_index=payload.day_index,
        slot=payload.slot,
        type=payload.type,
        note=payload.note.strip() if payload.type == "custom" else "",
        status="logged",
        alert_ids=[],
    )
    db.add(row)
    db.flush()

    if payload.type == "custom" and payload.note.strip():
        row.alert_ids = _persist_food_log_alerts(
            db,
            user_id,
            row.id,
            medications,
            payload.note,
            payload.meal_plan_id,
        )

    db.commit()
    db.refresh(row)
    return row
