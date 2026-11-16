"""NotificationService — materialize compliance notifications (contract §4)."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta

from sqlalchemy.orm import Session

from app.core.datetime_vn import vn_today
from app.core.errors import APIError
from app.models.alert import Alert
from app.models.meal_plan import MealPlan
from app.models.notification import Notification
from app.models.user import User
from app.schemas.meal_plan import MealPlanOutput
from app.services import plan_expiry

SLOT_TIMES: dict[str, tuple[int, int]] = {
    "breakfast": (7, 30),
    "lunch": (11, 30),
    "dinner": (18, 0),
    "snack": (15, 30),
}

SLOT_LABELS: dict[str, str] = {
    "breakfast": "sáng",
    "lunch": "trưa",
    "dinner": "tối",
    "snack": "phụ",
}

FOLLOWUP_SEVERITIES = {"Nguy hiểm", "Cần chú ý"}


class NotificationService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def materialize_from_meal_plan(
        self, plan: MealPlanOutput, start_date: date | None = None
    ) -> list[Notification]:
        """Create meal_reminder per slot/day + adherence_checkin per day."""
        created: list[Notification] = []
        base = start_date
        if base is None and plan.starts_on:
            base = date.fromisoformat(plan.starts_on)
        if base is None and plan.days:
            first_date = plan.days[0].date if hasattr(plan.days[0], "date") else plan.days[0].get("date")
            if first_date:
                base = date.fromisoformat(str(first_date))
        if base is None:
            base = date.today()
        now = datetime.now()
        for day in plan.days:
            day_date = base + timedelta(days=day.day_index - 1)
            for meal in day.meals:
                hh, mm = SLOT_TIMES.get(meal.slot, (12, 0))
                scheduled_at = datetime.combine(day_date, time(hh, mm))
                if scheduled_at < now:
                    continue
                slot_label = SLOT_LABELS.get(meal.slot, meal.slot)
                created.append(self._add(
                    user_id=plan.user_id,
                    type="meal_reminder",
                    title=f"Nhắc bữa {slot_label} — Ngày {day.day_index}",
                    body=f"Đến giờ bữa {slot_label}. Nhớ ăn đúng thực đơn và ghi nhận tuân thủ nhé.",
                    scheduled_at=scheduled_at,
                    related_ids={
                        "meal_plan_id": plan.id,
                        "day_index": day.day_index,
                        "slot": meal.slot,
                    },
                ))
            checkin_at = datetime.combine(day_date, time(21, 0))
            if checkin_at >= now:
                created.append(self._add(
                    user_id=plan.user_id,
                    type="adherence_checkin",
                    title=f"Kiểm tra tuân thủ — Ngày {day.day_index}",
                    body="Hôm nay bạn đã tuân thủ thực đơn như thế nào?",
                    scheduled_at=checkin_at,
                    related_ids={"meal_plan_id": plan.id, "day_index": day.day_index},
                ))
        self.db.flush()
        return created

    def on_plan_approved(self, plan: MealPlanOutput) -> Notification:
        """Plan approved — no meal reminders until apply."""
        return self._add(
            user_id=plan.user_id,
            type="plan_approved",
            title="Thực đơn đã được chuyên gia duyệt",
            body="Chuyên gia dinh dưỡng đã duyệt thực đơn 7 ngày của bạn. Chờ áp dụng lịch.",
            scheduled_at=datetime.now(),
            status="sent",
            related_ids={"meal_plan_id": plan.id},
        )

    def on_plan_applied(self, plan: MealPlanOutput, start_date: date) -> list[Notification]:
        """Materialize reminders when doctor applies validity window."""
        self.materialize_from_meal_plan(plan, start_date=start_date)
        return []

    def on_plan_rejected(self, plan: MealPlanOutput) -> int:
        """Cancel future reminders/checkins of a rejected plan."""
        cancelled = 0
        rows = self.db.query(Notification).filter(
            Notification.user_id == plan.user_id,
            Notification.status == "pending",
        ).all()
        for row in rows:
            if row.related_ids.get("meal_plan_id") == plan.id:
                row.status = "cancelled"
                cancelled += 1
        self.db.flush()
        return cancelled

    def ensure_plan_expiry_notification(
        self, plan_row: MealPlan, bucket: str, *, today: date | None = None
    ) -> Notification | None:
        """Tạo plan_expiring/plan_expired một lần (idempotent) cho patient."""
        if bucket not in ("expiring", "expired"):
            return None
        notif_type = f"plan_{bucket}"
        rows = (
            self.db.query(Notification)
            .filter(
                Notification.user_id == plan_row.user_id,
                Notification.type == notif_type,
            )
            .all()
        )
        if any(
            row.related_ids.get("meal_plan_id") == plan_row.id for row in rows
        ):
            return None
        today = today or vn_today()
        successors = (
            self.db.query(MealPlan)
            .filter(
                MealPlan.user_id == plan_row.user_id,
                MealPlan.id != plan_row.id,
                MealPlan.status.in_(["pending_review", "approved", "edited"]),
                (MealPlan.ends_on.is_(None)) | (MealPlan.ends_on >= today),
            )
            .order_by(MealPlan.created_at.desc())
            .all()
        )
        successor = next((row for row in successors if not plan_expiry.is_plan_historical(row, today)), None)
        action_label = "Tạo thực đơn mới"
        next_step = (
            "Hãy mở Tạo thực đơn của tôi để tạo bản dự thảo mới; "
            "bác sĩ sẽ kiểm tra và duyệt trước khi áp dụng."
        )
        if successor is not None:
            action_label = "Theo dõi thực đơn kế tiếp"
            if successor.status == "pending_review":
                next_step = "Bạn đã có bản mới đang chờ bác sĩ duyệt. Hãy theo dõi kết quả kiểm duyệt."
            elif successor.starts_on is None:
                next_step = "Bản thực đơn kế tiếp đã được duyệt và đang chờ bác sĩ áp dụng lịch."
            else:
                next_step = "Bạn đã có thực đơn kế tiếp được lên lịch. Hãy kiểm tra lịch áp dụng."
        title = (
            "Thực đơn sắp hoàn thành"
            if bucket == "expiring"
            else "Đã hoàn thành thực đơn 7 ngày"
        )
        body = ("Chu kỳ thực đơn 7 ngày của bạn sắp kết thúc. " if bucket == "expiring"
                else "Chu kỳ thực đơn 7 ngày của bạn đã hoàn thành. ") + next_step
        if plan_row.starts_on is None and bucket == "expired":
            title = "Bạn chưa tạo thực đơn cho chu kỳ mới"
            body = "Bản thực đơn cũ chưa được áp dụng đã được lưu vào Nhật ký. " + next_step
        return self._add(
            user_id=plan_row.user_id,
            type=notif_type,
            title=title,
            body=body,
            scheduled_at=datetime.now(),
            status="sent",
            related_ids={"meal_plan_id": plan_row.id},
            payload={"action_url": "/patient/meal-plan", "action_label": action_label},
        )

    def sync_plan_expiry_notifications(
        self, user_id: str, *, today: date | None = None
    ) -> list[Notification]:
        """Reconcile current/most recently completed cycles on any patient read path."""
        today = today or vn_today()
        # /notifications, /me and /schedule may arrive together. Serialize per patient
        # so the existing (plan, type) idempotency check also holds across requests.
        self.db.query(User).filter(User.id == user_id).with_for_update().first()
        applied = (
            self.db.query(MealPlan)
            .filter(
                MealPlan.user_id == user_id,
                MealPlan.status.in_(plan_expiry.EXPIRY_ELIGIBLE_STATUSES),
                MealPlan.starts_on.isnot(None),
                MealPlan.ends_on.isnot(None),
                MealPlan.starts_on <= today,
            )
            .order_by(MealPlan.ends_on.desc(), MealPlan.created_at.desc())
            .all()
        )
        current = next((row for row in applied if row.ends_on >= today), None)
        unapplied = self.db.query(MealPlan).filter(
            MealPlan.user_id == user_id,
            MealPlan.status.in_(["pending_review", "approved", "edited"]),
            MealPlan.starts_on.is_(None), MealPlan.ends_on.is_(None),
        ).all()
        historical = [row for row in applied + unapplied if plan_expiry.is_plan_historical(row, today)]
        completed = max(historical, key=plan_expiry.history_end_date) if historical else None
        created: list[Notification] = []
        for row in (current, completed):
            if row is None:
                continue
            bucket = "expired" if row is completed else plan_expiry.bucket(
                row.reviewed_at, row.created_at, len(row.days or []), today=today,
                starts_on=row.starts_on, ends_on=row.ends_on,
            )
            notification = self.ensure_plan_expiry_notification(row, bucket, today=today)
            if notification is not None:
                created.append(notification)
        self.db.flush()
        return created

    def on_alert_created(self, alert: Alert) -> Notification | None:
        if alert.severity not in FOLLOWUP_SEVERITIES:
            return None
        return self._add(
            user_id=alert.user_id,
            type="interaction_followup",
            title=f"Tương tác thuốc – thực phẩm: {alert.drug} × {alert.food}",
            body=alert.recommendation,
            scheduled_at=datetime.now(),
            status="sent",
            related_ids={"alert_id": alert.id, "meal_plan_id": alert.meal_plan_id},
        )

    def create_manual_reminder(self, user_id: str, message: str) -> Notification:
        """Doctor-initiated adherence reminder (contract §10)."""
        body = message.strip() or "Bác sĩ nhắc bạn tuân thủ thực đơn hôm nay."
        return self._add(
            user_id=user_id,
            type="manual_reminder",
            title="Nhắc nhở tuân thủ từ bác sĩ",
            body=body,
            scheduled_at=datetime.now(),
            status="sent",
            related_ids={},
            payload={"from_doctor": True},
        )

    def mark(
        self,
        notification: Notification,
        action: str,
        adherence: str | None = None,
    ) -> Notification:
        if action == "read":
            if notification.status in ("pending", "sent"):
                notification.status = "read"
        elif action == "dismiss":
            notification.status = "dismissed"
        elif action == "done":
            if notification.type == "adherence_checkin" and not adherence:
                raise APIError(400, "ADHERENCE_REQUIRED", "Cần cung cấp adherence cho check-in.")
            notification.status = "done"
            if adherence:
                notification.payload = {**notification.payload, "adherence": adherence}
        else:
            raise APIError(400, "INVALID_ACTION", "Hành động không hợp lệ.")
        self.db.flush()
        return notification

    def _add(
        self,
        user_id: str,
        type: str,
        title: str,
        body: str,
        scheduled_at: datetime | None,
        related_ids: dict,
        status: str = "pending",
        payload: dict | None = None,
    ) -> Notification:
        row = Notification(
            user_id=user_id,
            type=type,
            title=title,
            body=body,
            scheduled_at=scheduled_at,
            status=status,
            related_ids=related_ids,
            payload=payload or {},
        )
        self.db.add(row)
        return row
