"""Compliance aggregation for doctor view — ADR-008, spec 10."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.alert import Alert
from app.models.food_log import FoodLog
from app.models.meal_plan import MealPlan
from app.models.notification import Notification
from app.schemas.doctor import ComplianceDayPoint, ComplianceEvent, PatientComplianceOut

ADHERENCE_SCORES = {"yes": 100, "partial": 50, "no": 0}
FOOD_LOG_SCORES = {"as_planned": 100, "custom": 50}
ALERT_SEVERITIES = {"Nguy hiểm", "Cần chú ý"}
CHECKIN_SEVERITY_LABELS = {"yes": "Tuân thủ", "partial": "Một phần", "no": "Không tuân thủ"}
CHECKIN_TITLE_LABELS = {
    "yes": "Check-in — Đã ăn đúng thực đơn",
    "partial": "Check-in — Có sai lệch một phần",
    "no": "Check-in — Không theo thực đơn",
}
FOOD_LOG_SLOT_LABELS = {"morning": "sáng", "noon": "trưa", "evening": "tối"}


class ComplianceService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_patient_compliance(self, patient_id: str, days: int = 14) -> PatientComplianceOut:
        days = max(1, min(days, 90))
        today = date.today()
        start_date = today - timedelta(days=days - 1)

        checkins = (
            self.db.query(Notification)
            .filter(
                Notification.user_id == patient_id,
                Notification.type == "adherence_checkin",
                Notification.status == "done",
            )
            .all()
        )

        by_day: dict[date, list[int]] = defaultdict(list)
        checkins_done = 0
        checkins_as_planned = 0

        for row in checkins:
            event_date = _notification_day(row)
            if event_date < start_date or event_date > today:
                continue
            adherence = (row.payload or {}).get("adherence")
            if adherence not in ADHERENCE_SCORES:
                continue
            score = ADHERENCE_SCORES[adherence]
            by_day[event_date].append(score)
            checkins_done += 1
            if adherence == "yes":
                checkins_as_planned += 1

        food_by_day, food_done, food_as_planned = _aggregate_food_logs(
            self.db, patient_id, start_date, today
        )
        for event_date, scores in food_by_day.items():
            by_day[event_date].extend(scores)
        checkins_done += food_done
        checkins_as_planned += food_as_planned

        daily_series: list[ComplianceDayPoint] = []
        day_scores_for_overall: list[float] = []

        for offset in range(days):
            d = start_date + timedelta(days=offset)
            if d in by_day:
                pct = round(sum(by_day[d]) / len(by_day[d]))
                day_scores_for_overall.append(float(pct))
                daily_series.append(ComplianceDayPoint(date=d.isoformat(), adherence_pct=pct))
            else:
                daily_series.append(ComplianceDayPoint(date=d.isoformat(), adherence_pct=None))

        overall = (
            round(sum(day_scores_for_overall) / len(day_scores_for_overall))
            if day_scores_for_overall
            else None
        )

        alerts = (
            self.db.query(Alert)
            .filter(
                Alert.user_id == patient_id,
                Alert.severity.in_(ALERT_SEVERITIES),
            )
            .order_by(Alert.created_at.desc())
            .all()
        )

        events = _build_compliance_events(
            self.db,
            patient_id,
            start_date,
            today,
            checkins,
            alerts,
        )

        return PatientComplianceOut(
            patient_id=patient_id,
            days=days,
            low_threshold_pct=settings.COMPLIANCE_LOW_THRESHOLD_PCT,
            overall_adherence_pct=overall,
            checkins_done=checkins_done,
            checkins_as_planned=checkins_as_planned,
            daily_series=daily_series,
            events=events,
        )


def _notification_day(row: Notification) -> date:
    if row.scheduled_at:
        return row.scheduled_at.date()
    if row.updated_at:
        return row.updated_at.date()
    return row.created_at.date()


def _food_log_calendar_date(
    log: FoodLog,
    plan_cache: dict[str, MealPlan | None],
    db: Session,
) -> date | None:
    if log.meal_plan_id and log.day_index:
        plan = plan_cache.get(log.meal_plan_id)
        if log.meal_plan_id not in plan_cache:
            plan = db.get(MealPlan, log.meal_plan_id)
            plan_cache[log.meal_plan_id] = plan
        if plan and plan.starts_on:
            return plan.starts_on + timedelta(days=log.day_index - 1)
    if log.logged_at:
        return log.logged_at.date()
    return None


def _aggregate_food_logs(
    db: Session,
    patient_id: str,
    start_date: date,
    today: date,
) -> tuple[dict[date, list[int]], int, int]:
    """Derive slot-level adherence scores from structured food logs (spec 09)."""
    logs = db.query(FoodLog).filter(FoodLog.user_id == patient_id).all()
    plan_cache: dict[str, MealPlan | None] = {}
    by_day: dict[date, list[int]] = defaultdict(list)
    checkins_done = 0
    checkins_as_planned = 0

    for log in logs:
        event_date = _food_log_calendar_date(log, plan_cache, db)
        if event_date is None or event_date < start_date or event_date > today:
            continue
        score = FOOD_LOG_SCORES.get(log.type, 50)
        by_day[event_date].append(score)
        checkins_done += 1
        if log.type == "as_planned":
            checkins_as_planned += 1

    return by_day, checkins_done, checkins_as_planned


def _event_in_window(at: datetime | None, start_date: date, today: date) -> bool:
    if not at:
        return False
    event_date = at.date()
    return start_date <= event_date <= today


def _build_compliance_events(
    db: Session,
    patient_id: str,
    start_date: date,
    today: date,
    checkins: list[Notification],
    alerts: list[Alert],
) -> list[ComplianceEvent]:
    events: list[ComplianceEvent] = []

    for alert in alerts:
        if not _event_in_window(alert.created_at, start_date, today):
            continue
        events.append(
            ComplianceEvent(
                type="alert",
                severity=alert.severity,
                title=f"Tương tác {alert.drug} × {alert.food}",
                at=alert.created_at.isoformat(),
            )
        )

    food_logs = db.query(FoodLog).filter(FoodLog.user_id == patient_id).all()
    plan_cache: dict[str, MealPlan | None] = {}
    for log in food_logs:
        event_date = _food_log_calendar_date(log, plan_cache, db)
        if event_date is None or event_date < start_date or event_date > today:
            continue
        slot_label = FOOD_LOG_SLOT_LABELS.get(log.slot, log.slot)
        if log.type == "as_planned":
            events.append(
                ComplianceEvent(
                    type="food_log",
                    severity="Tuân thủ",
                    title=f"Ghi nhận bữa {slot_label} — đúng kế hoạch",
                    at=log.logged_at.isoformat(),
                )
            )
        else:
            events.append(
                ComplianceEvent(
                    type="food_log",
                    severity="Sai lệch",
                    title=f"Ghi nhận bữa {slot_label} — ăn khác",
                    at=log.logged_at.isoformat(),
                )
            )

    for row in checkins:
        adherence = (row.payload or {}).get("adherence")
        if adherence not in CHECKIN_SEVERITY_LABELS:
            continue
        at = row.updated_at or row.scheduled_at or row.created_at
        if not _event_in_window(at, start_date, today):
            continue
        events.append(
            ComplianceEvent(
                type="checkin",
                severity=CHECKIN_SEVERITY_LABELS[adherence],
                title=CHECKIN_TITLE_LABELS[adherence],
                at=at.isoformat(),
            )
        )

    reminders = (
        db.query(Notification)
        .filter(
            Notification.user_id == patient_id,
            Notification.type == "manual_reminder",
        )
        .order_by(Notification.created_at.desc())
        .all()
    )
    for row in reminders:
        at = row.scheduled_at or row.created_at
        if not _event_in_window(at, start_date, today):
            continue
        events.append(
            ComplianceEvent(
                type="reminder",
                severity="Nhắc nhở",
                title=row.body.strip() or row.title,
                at=at.isoformat(),
            )
        )

    events.sort(key=lambda item: item.at, reverse=True)
    return events
