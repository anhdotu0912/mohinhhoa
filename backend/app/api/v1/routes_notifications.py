"""Compliance notification routes — contract §4."""

from __future__ import annotations

from datetime import date, datetime, time

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.core.security import require_roles
from app.db.session import get_db
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import NotificationActionRequest, NotificationOut
from app.services.notification import NotificationService

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _get_own_notification(db: Session, user: User, notification_id: str) -> Notification:
    row = db.get(Notification, notification_id)
    if row is None:
        raise APIError(404, "NOTIFICATION_NOT_FOUND", "Không tìm thấy thông báo.")
    if row.user_id != user.id:
        raise APIError(403, "FORBIDDEN", "Bạn không có quyền truy cập thông báo này.")
    return row


@router.get("", response_model=list[NotificationOut])
def list_notifications(
    status: str | None = None,
    type: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("patient")),
) -> list[Notification]:
    query = db.query(Notification).filter(Notification.user_id == user.id)
    if status:
        query = query.filter(Notification.status == status)
    if type:
        query = query.filter(Notification.type == type)
    return query.order_by(Notification.created_at.desc()).all()


@router.post("/demo/simulate", response_model=list[NotificationOut])
def simulate_demo_notifications(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("patient")),
) -> list[Notification]:
    today = date.today()
    samples = [
        Notification(
            user_id=user.id,
            type="meal_reminder",
            title="Nhắc bữa trưa",
            body="Đến giờ bữa trưa. Nhớ ăn đúng thực đơn nhé.",
            scheduled_at=datetime.combine(today, time(11, 30)),
            status="pending",
            related_ids={"day_index": 1, "slot": "lunch"},
        ),
        Notification(
            user_id=user.id,
            type="adherence_checkin",
            title="Kiểm tra tuân thủ hôm nay",
            body="Hôm nay bạn đã tuân thủ thực đơn như thế nào?",
            scheduled_at=datetime.combine(today, time(21, 0)),
            status="pending",
            related_ids={"day_index": 1},
        ),
        Notification(
            user_id=user.id,
            type="plan_approved",
            title="Thực đơn đã được chuyên gia duyệt",
            body="Chuyên gia dinh dưỡng đã duyệt thực đơn 7 ngày của bạn.",
            scheduled_at=datetime.now(),
            status="sent",
            related_ids={},
        ),
    ]
    db.add_all(samples)
    db.commit()
    for sample in samples:
        db.refresh(sample)
    return samples


@router.post("/{notification_id}/read", response_model=NotificationOut)
def mark_read(
    notification_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("patient")),
) -> Notification:
    return NotificationService(db).mark(_get_own_notification(db, user, notification_id), "read")


@router.post("/{notification_id}/dismiss", response_model=NotificationOut)
def mark_dismiss(
    notification_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("patient")),
) -> Notification:
    return NotificationService(db).mark(_get_own_notification(db, user, notification_id), "dismiss")


@router.post("/{notification_id}/done", response_model=NotificationOut)
def mark_done(
    notification_id: str,
    payload: NotificationActionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("patient")),
) -> Notification:
    return NotificationService(db).mark(
        _get_own_notification(db, user, notification_id),
        "done",
        adherence=payload.adherence,
    )
