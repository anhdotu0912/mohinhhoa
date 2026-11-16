"""Applied cycles finish after the final Vietnam calendar day, then prompt renewal."""

from datetime import date, timedelta

import pytest
from app.core.datetime_vn import vn_today
from app.models.meal_plan import MealPlan
from app.models.notification import Notification
from app.services.notification import NotificationService
from app.services.plan_expiry import bucket, plan_usage_for_row
from app.services.plan_schedule import build_meal_plan_schedule


def _plan(db, user_id, start, *, status="approved"):
    row = MealPlan(
        user_id=user_id, status=status, starts_on=start,
        ends_on=start + timedelta(days=6) if start else None,
        days=[{"day_index": i, "meals": []} for i in range(1, 8)],
    )
    db.add(row)
    db.commit()
    return row


def _headers(client):
    response = client.post("/api/v1/auth/login", json={
        "email": "demo_patient_1@example.com", "password": "demo1234",
    })
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_final_day_is_active_and_next_day_is_completed(db_session):
    start = date(2026, 11, 10)
    last_day = start + timedelta(days=6)
    row = _plan(db_session, "completion_boundary", start)
    assert bucket(None, None, 7, today=last_day, starts_on=start, ends_on=last_day) == "expiring"
    assert plan_usage_for_row(row.status, start, last_day, last_day) == "active"
    schedule = build_meal_plan_schedule(db_session, row.user_id, today=last_day)
    assert schedule["active_plan_id"] == row.id
    service = NotificationService(db_session)
    service.sync_plan_expiry_notifications(row.user_id, today=last_day)
    assert not db_session.query(Notification).filter_by(user_id=row.user_id, type="plan_expired").all()

    next_day = last_day + timedelta(days=1)
    assert bucket(None, None, 7, today=next_day, starts_on=start, ends_on=last_day) == "expired"
    schedule = build_meal_plan_schedule(db_session, row.user_id, today=next_day)
    assert schedule["active_plan_id"] is None
    past = next(slot for slot in schedule["slots"] if slot["plan"] and slot["plan"]["id"] == row.id)
    assert past["occupancy"] == "past"
    assert past["actions"] == ["view"]
    assert row.status == "approved"  # Clinical approval and historical contents are preserved.
    service.sync_plan_expiry_notifications(row.user_id, today=next_day)
    notification = db_session.query(Notification).filter_by(user_id=row.user_id, type="plan_expired").one()
    assert "hoàn thành" in notification.title
    assert notification.payload["action_label"] == "Tạo thực đơn mới"


@pytest.mark.parametrize("entrypoint", ["/notifications", "/meal-plans/schedule", "/meal-plans/me"])
def test_any_patient_entrypoint_creates_completion_reminder_once(client, db_session, entrypoint):
    headers = _headers(client)
    old = _plan(db_session, "demo_patient_1", vn_today() - timedelta(days=7))
    response = client.get("/api/v1" + entrypoint, headers=headers)
    assert response.status_code == (404 if entrypoint == "/meal-plans/me" else 200), response.text
    notifications = client.get("/api/v1/notifications", headers=headers).json()
    reminder = next(n for n in notifications if n["type"] == "plan_expired")
    assert reminder["related_ids"]["meal_plan_id"] == old.id
    assert reminder["payload"]["action_url"] == "/patient/meal-plan"
    assert reminder["payload"]["action_label"] == "Tạo thực đơn mới"
    assert client.post(f"/api/v1/notifications/{reminder['id']}/dismiss", headers=headers).status_code == 200
    for path in ("/meal-plans/me", "/meal-plans/schedule", "/notifications"):
        assert client.get("/api/v1" + path, headers=headers).status_code == (404 if path == "/meal-plans/me" else 200)
    assert db_session.query(Notification).filter_by(user_id=old.user_id, type="plan_expired").count() == 1


@pytest.mark.parametrize("successor", ["pending_review", "approved", "upcoming", "active"])
def test_successor_does_not_hide_completed_cycle_or_prompt_duplicate_creation(client, db_session, successor):
    headers = _headers(client)
    today = vn_today()
    old = _plan(db_session, "demo_patient_1", today - timedelta(days=7))
    start = today + timedelta(days=1) if successor == "upcoming" else today if successor == "active" else None
    _plan(db_session, old.user_id, start, status="pending_review" if successor == "pending_review" else "approved")
    notifications = client.get("/api/v1/notifications", headers=headers).json()
    reminder = next(n for n in notifications if n["type"] == "plan_expired")
    assert reminder["related_ids"]["meal_plan_id"] == old.id
    assert reminder["payload"]["action_label"] == "Theo dõi thực đơn kế tiếp"
    assert "Hãy mở Tạo thực đơn" not in reminder["body"]


def test_completed_plan_does_not_block_new_generation_or_disappear(client, db_session):
    headers = _headers(client)
    old = _plan(db_session, "demo_patient_1", vn_today() - timedelta(days=7))
    response = client.post("/api/v1/meal-plans/generate", headers=headers)
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "pending_review"
    schedule = client.get("/api/v1/meal-plans/schedule", headers=headers).json()
    assert any(s["occupancy"] == "past" and s["plan"]["id"] == old.id for s in schedule["slots"] if s["plan"])
    assert db_session.get(MealPlan, old.id).status == "approved"


def test_no_completed_reminder_for_unscheduled_or_other_patient_plan(client, db_session):
    headers = _headers(client)
    _plan(db_session, "demo_patient_1", None)
    _plan(db_session, "demo_patient_2", vn_today() - timedelta(days=7))
    notifications = client.get("/api/v1/notifications", headers=headers).json()
    assert not any(n["type"] == "plan_expired" for n in notifications)
