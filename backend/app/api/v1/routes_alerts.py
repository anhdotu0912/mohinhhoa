"""Alerts route — contract §1.4."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.core.security import get_current_user
from app.db.session import get_db
from app.models.alert import Alert
from app.models.user import User
from app.schemas.alert import AlertOut

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertOut])
def list_alerts(
    patient_id: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Alert]:
    query = db.query(Alert)
    if user.role == "dietitian":
        if patient_id is None:
            raise APIError(400, "PATIENT_ID_REQUIRED", "Dietitian cần truyền patient_id.")
        query = query.filter(Alert.user_id == patient_id)
    else:
        query = query.filter(Alert.user_id == user.id)
    return query.order_by(Alert.created_at.desc()).all()
