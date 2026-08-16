"""Compliance aggregation for doctor view — ADR-008, spec 10."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.alert import Alert
from app.models.notification import Notification
from app.schemas.doctor import ComplianceDayPoint, ComplianceEvent, PatientComplianceOut

ADHERENCE_SCORES = {"yes": 100, "partial": 50, "no": 0}
ALERT_SEVERITIES = {"Nguy hiểm", "Cần chú ý"}


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

        events: list[ComplianceEvent] = []
        for alert in alerts:
            if not alert.created_at:
                continue
            alert_date = alert.created_at.date()
            if alert_date < start_date or alert_date > today:
                continue
            events.append(
                ComplianceEvent(
                    type="alert",
                    severity=alert.severity,
                    title=f"Tương tác {alert.drug} × {alert.food}",
                    at=alert.created_at.isoformat(),
                )
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
