"""Compliance aggregation for doctor view — ADR-008, spec 10."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.datetime_vn import assume_utc, vn_calendar_date, vn_today
from app.models.alert import Alert
from app.models.food_log import FoodLog
from app.models.meal_plan import MealPlan
from app.models.notification import Notification
from app.schemas.doctor import ComplianceDayPoint, ComplianceEvent, PatientComplianceOut

ADHERENCE_SCORES = {"yes": 100, "partial": 50, "no": 0}
SLOT_WEIGHTS = {
    "morning": 30,
    "noon": 30,
    "evening": 30,
    "snack": 10,
}
FOOD_LOG_MULTIPLIERS = {
    "as_planned": 1.0,
    "custom": 0.5,
}
ALERT_SEVERITIES = {"Nguy hiểm", "Cần chú ý"}
CHECKIN_SEVERITY_LABELS = {"yes": "Tuân thủ", "partial": "Một phần", "no": "Không tuân thủ"}
CHECKIN_TITLE_LABELS = {
    "yes": "Check-in — Đã ăn đúng thực đơn",
    "partial": "Check-in — Có sai lệch một phần",
    "no": "Check-in — Không theo thực đơn",
}
FOOD_LOG_SLOT_LABELS = {"morning": "sáng", "noon": "trưa", "evening": "tối", "snack": "phụ"}


def _normalize_slot(slot: str) -> str:
    s = (slot or "").lower().strip()
    if s in ("morning", "breakfast"):
        return "morning"
    if s in ("noon", "lunch"):
        return "noon"
    if s in ("evening", "dinner"):
        return "evening"
    if s in ("snack", "afternoon_snack", "extra"):
        return "snack"
    return s


class ComplianceService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_patient_compliance(self, patient_id: str, days: int = 14) -> PatientComplianceOut:
        days = max(1, min(days, 90))
        today = vn_today()
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

        checkin_by_day: dict[date, list[int]] = defaultdict(list)
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
            checkin_by_day[event_date].append(score)
            checkins_done += 1
            if adherence == "yes":
                checkins_as_planned += 1

        food_by_day_pct, food_done, food_as_planned = _aggregate_food_logs(
            self.db, patient_id, start_date, today
        )
        checkins_done += food_done
        checkins_as_planned += food_as_planned

        daily_series: list[ComplianceDayPoint] = []
        day_scores_for_overall: list[float] = []

        for offset in range(days):
            d = start_date + timedelta(days=offset)
            if d in food_by_day_pct:
                pct = food_by_day_pct[d]
                day_scores_for_overall.append(float(pct))
                daily_series.append(ComplianceDayPoint(date=d.isoformat(), adherence_pct=pct))
            elif d in checkin_by_day:
                pct = round(sum(checkin_by_day[d]) / len(checkin_by_day[d]))
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
    if log.logged_at:
        return vn_calendar_date(log.logged_at)
    if log.meal_plan_id and log.day_index:
        plan = plan_cache.get(log.meal_plan_id)
        if log.meal_plan_id not in plan_cache:
            plan = db.get(MealPlan, log.meal_plan_id)
            plan_cache[log.meal_plan_id] = plan
        if plan and plan.starts_on:
            return plan.starts_on + timedelta(days=log.day_index - 1)
    return None


def _latest_food_logs_by_vn_slot(
    db: Session,
    patient_id: str,
) -> list[tuple[date, FoodLog]]:
    """One log per (VN calendar day, slot) — keep the latest logged_at."""
    logs = db.query(FoodLog).filter(FoodLog.user_id == patient_id).all()
    plan_cache: dict[str, MealPlan | None] = {}
    best: dict[tuple[date, str], FoodLog] = {}
    for log in logs:
        event_date = _food_log_calendar_date(log, plan_cache, db)
        if event_date is None:
            continue
        norm_slot = _normalize_slot(log.slot)
        key = (event_date, norm_slot)
        prev = best.get(key)
        if prev is None or (log.logged_at and (prev.logged_at is None or log.logged_at > prev.logged_at)):
            best[key] = log
    return [(event_date, log) for (event_date, _slot), log in best.items()]


def _aggregate_food_logs(
    db: Session,
    patient_id: str,
    start_date: date,
    today: date,
) -> tuple[dict[date, int], int, int]:
    """Derive day-level adherence percentage from structured food logs (spec 09).

    Rule:
    - 3 main meals (morning, noon, evening): 30% each (as_planned = 30%, custom = 15%)
    - 1 snack (snack): 10% (as_planned = 10%, custom = 5%)
    - Unlogged slot: 0%
    - Day adherence percentage is sum of logged slot points, capped at 100%.
    """
    day_logs: dict[date, dict[str, FoodLog]] = defaultdict(dict)
    checkins_done = 0
    checkins_as_planned = 0

    for event_date, log in _latest_food_logs_by_vn_slot(db, patient_id):
        if event_date < start_date or event_date > today:
            continue
        norm_slot = _normalize_slot(log.slot)
        day_logs[event_date][norm_slot] = log
        checkins_done += 1
        if log.type == "as_planned":
            checkins_as_planned += 1

    by_day_pct: dict[date, int] = {}
    for event_date, slots in day_logs.items():
        day_score = 0.0
        for norm_slot, log in slots.items():
            weight = SLOT_WEIGHTS.get(norm_slot, 0)
            multiplier = FOOD_LOG_MULTIPLIERS.get(log.type, 0.5)
            day_score += weight * multiplier
        by_day_pct[event_date] = min(100, round(day_score))

    return by_day_pct, checkins_done, checkins_as_planned


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

    for event_date, log in _latest_food_logs_by_vn_slot(db, patient_id):
        if event_date < start_date or event_date > today:
            continue
        slot_label = FOOD_LOG_SLOT_LABELS.get(log.slot, log.slot)
        event_at = assume_utc(log.logged_at).isoformat() if log.logged_at else event_date.isoformat()
        if log.type == "as_planned":
            events.append(
                ComplianceEvent(
                    type="food_log",
                    severity="Tuân thủ",
                    title=f"Ghi nhận bữa {slot_label} — đúng kế hoạch",
                    at=event_at,
                )
            )
        else:
            events.append(
                ComplianceEvent(
                    type="food_log",
                    severity="Sai lệch",
                    title=f"Ghi nhận bữa {slot_label} — ăn khác",
                    at=event_at,
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
