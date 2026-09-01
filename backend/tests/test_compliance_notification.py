"""Service-level tests for NotificationService (contract §4 event matrix)."""

from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest
from app.core.errors import APIError
from app.models.alert import Alert
from app.models.notification import Notification
from app.schemas.meal_plan import DayPlan, DayTotals, FoodItem, Meal, MealPlanOutput
from app.services.notification import NotificationService


def _sample_plan(user_id: str) -> MealPlanOutput:
    return MealPlanOutput(
        id=str(uuid.uuid4()),
        user_id=user_id,
        days=[
            DayPlan(
                day_index=1,
                meals=[
                    Meal(slot="breakfast", items=[FoodItem(name="x", kcal=100)]),
                    Meal(slot="dinner", items=[FoodItem(name="y", kcal=200)]),
                ],
                totals=DayTotals(),
            ),
            DayPlan(
                day_index=2,
                meals=[Meal(slot="lunch", items=[FoodItem(name="z", kcal=150)])],
                totals=DayTotals(),
            ),
        ],
    )


def test_materialize_from_meal_plan(db_session):
    service = NotificationService(db_session)
    plan = _sample_plan("user_x")
    start = date.today() + timedelta(days=1)
    created = service.materialize_from_meal_plan(plan, start_date=start)
    db_session.flush()

    reminders = [n for n in created if n.type == "meal_reminder"]
    checkins = [n for n in created if n.type == "adherence_checkin"]
    assert len(reminders) == 3
    assert len(checkins) == 2
    assert all(n.status == "pending" for n in created)
    assert all(n.related_ids["meal_plan_id"] == plan.id for n in created)
    assert reminders[0].related_ids["slot"] == "breakfast"
    assert reminders[0].related_ids["day_index"] == 1


def test_plan_approved_notification(db_session):
    plan = _sample_plan("user_x")
    notification = NotificationService(db_session).on_plan_approved(plan)
    assert notification.type == "plan_approved"
    assert notification.status == "sent"
    assert notification.related_ids["meal_plan_id"] == plan.id


def test_plan_rejected_cancels_future_notifications(db_session):
    service = NotificationService(db_session)
    plan = _sample_plan("user_x")
    start = date.today() + timedelta(days=1)
    service.materialize_from_meal_plan(plan, start_date=start)
    db_session.flush()

    cancelled = service.on_plan_rejected(plan)
    db_session.flush()
    assert cancelled == 5

    rows = db_session.query(Notification).filter(Notification.user_id == "user_x").all()
    assert len(rows) == 5
    assert all(row.status == "cancelled" for row in rows)


def test_alert_creates_followup_only_for_warning_severities(db_session):
    service = NotificationService(db_session)

    danger = Alert(
        user_id="user_x",
        drug="metformin",
        food="rượu",
        mechanism="m",
        severity="Nguy hiểm",
        recommendation="r",
        sources=[],
    )
    notification = service.on_alert_created(danger)
    assert notification is not None
    assert notification.type == "interaction_followup"
    assert notification.status == "sent"
    assert notification.related_ids["alert_id"] == danger.id

    safe = Alert(
        user_id="user_x",
        drug="metformin",
        food="cơm",
        mechanism="m",
        severity="An toàn",
        recommendation="r",
        sources=[],
    )
    assert service.on_alert_created(safe) is None


def test_mark_status_transitions(db_session):
    service = NotificationService(db_session)
    plan = _sample_plan("user_x")
    start = date.today() + timedelta(days=1)
    service.materialize_from_meal_plan(plan, start_date=start)
    db_session.flush()

    checkin = (
        db_session.query(Notification)
        .filter(Notification.type == "adherence_checkin")
        .first()
    )
    with pytest.raises(APIError):
        service.mark(checkin, "done")

    service.mark(checkin, "done", adherence="yes")
    assert checkin.status == "done"
    assert checkin.payload["adherence"] == "yes"

    reminder = (
        db_session.query(Notification)
        .filter(Notification.type == "meal_reminder")
        .first()
    )
    service.mark(reminder, "read")
    assert reminder.status == "read"
    service.mark(reminder, "dismiss")
    assert reminder.status == "dismissed"
