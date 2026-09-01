"""NotificationService — materialize compliance notifications (contract §4)."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta

from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.models.alert import Alert
from app.models.meal_plan import MealPlan
from app.models.notification import Notification
from app.schemas.meal_plan import MealPlanOutput

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
        self, plan_row: MealPlan, bucket: str
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
        title = (
            "Thực đơn sắp hết hạn"
            if bucket == "expiring"
            else "Thực đơn đã hết hạn"
        )
        body = (
            "Thực đơn 7 ngày của bạn sắp kết thúc. Hãy liên hệ chuyên gia dinh dưỡng để được tạo thực đơn mới."
            if bucket == "expiring"
            else "Thực đơn 7 ngày của bạn đã hết hạn. Hãy liên hệ chuyên gia dinh dưỡng hoặc tạo thực đơn mới."
        )
        return self._add(
            user_id=plan_row.user_id,
            type=notif_type,
            title=title,
            body=body,
            scheduled_at=datetime.now(),
            status="sent",
            related_ids={"meal_plan_id": plan_row.id},
        )

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
