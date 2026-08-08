"""Interaction check route — contract §3."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import APIError
from app.core.security import require_roles
from app.db.session import get_db
from app.models.alert import Alert
from app.models.user import User
from app.schemas.meal_plan import InteractionCheckInput, InteractionCheckOutput
from app.services.meal_plan_demo import check_interactions
from app.services.notification import NotificationService

router = APIRouter(prefix="/interactions", tags=["interactions"])


@router.post("/check", response_model=InteractionCheckOutput)
def check_interaction(
    payload: InteractionCheckInput,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("patient")),
) -> InteractionCheckOutput:
    if not settings.DEMO_MOCK:
        raise APIError(
            501,
            "INTERACTION_CHECK_NOT_READY",
            "InteractionCheckerAgent chưa sẵn sàng. Bật DEMO_MOCK hoặc chờ BE1 hoàn thiện.",
        )
    result = check_interactions(payload)
    notifications = NotificationService(db)
    for item in result.interactions:
        alert = Alert(
            user_id=user.id,
            drug=item.drug,
            food=item.food,
            mechanism=item.mechanism,
            severity=item.severity,
            recommendation=item.recommendation,
            sources=item.sources,
        )
        db.add(alert)
        db.flush()
        notifications.on_alert_created(alert)
    db.commit()
    return result
