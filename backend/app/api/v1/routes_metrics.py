"""Patient metrics history routes — contract §13, ADR-013."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.core.security import require_roles
from app.db.session import get_db
from app.models.body_metrics import BodyMetricsEntry
from app.models.user import User
from app.schemas.body_metrics import MetricsHistoryPoint, MetricsLogCreate
from app.services.metrics_service import (
    delete_metrics_entry,
    list_metrics_history,
    record_patient_metrics,
)

router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.post("", response_model=MetricsHistoryPoint)
def post_metrics(
    payload: MetricsLogCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("patient")),
) -> BodyMetricsEntry:
    try:
        return record_patient_metrics(db, user.id, payload)
    except ValueError as exc:
        raise APIError(400, "METRICS_EMPTY", str(exc)) from exc


@router.get("/history", response_model=list[MetricsHistoryPoint])
def get_metrics_history(
    days: int = 90,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("patient")),
) -> list[BodyMetricsEntry]:
    return list_metrics_history(db, user.id, days=days)


@router.delete("/{entry_id}", status_code=204)
def delete_metrics(
    entry_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("patient")),
) -> Response:
    if not delete_metrics_entry(db, user.id, entry_id):
        raise APIError(404, "METRICS_NOT_FOUND", "Không tìm thấy bản ghi chỉ số.")
    return Response(status_code=204)
