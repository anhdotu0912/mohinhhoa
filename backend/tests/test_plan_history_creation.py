"""A stale unapplied approval must not lock the next cycle's creation page."""

from datetime import datetime, time, timedelta

import pytest
from app.core.datetime_vn import vn_today
from app.models.meal_plan import MealPlan
from app.services.plan_expiry import is_plan_historical


@pytest.mark.parametrize("status", ["approved", "edited", "pending_review"])
def test_stale_unapplied_plan_moves_to_history_and_new_generation_succeeds(client, db_session, status):
    login = client.post("/api/v1/auth/login", json={
        "email": "demo_patient_1@example.com", "password": "demo1234",
    }).json()
    headers = {"Authorization": f"Bearer {login['access_token']}"}
    old = MealPlan(
        user_id="demo_patient_1", status=status,
        created_at=datetime.combine(vn_today() - timedelta(days=13), time(8)),
        reviewed_at=datetime.combine(vn_today(), time(8)),
        days=[{"day_index": i, "meals": []} for i in range(1, 8)],
        review_notes="Old review preserved",
    )
    db_session.add(old)
    db_session.commit()
    old_id = old.id
    schedule = client.get("/api/v1/meal-plans/schedule", headers=headers).json()
    assert schedule["unassigned_plans"] == []
    assert schedule["active_plan"] is None
    assert [p["id"] for p in schedule["history_plans"]] == [old_id]
    assert schedule["history_plans"][0]["starts_on"] is None
    assert client.get("/api/v1/meal-plans/me", headers=headers).status_code == 404
    notifications = client.get("/api/v1/notifications", headers=headers).json()
    reminder = next(n for n in notifications if n["type"] == "plan_expired")
    assert reminder["title"] == "Bạn chưa tạo thực đơn cho chu kỳ mới"
    assert reminder["payload"]["action_label"] == "Tạo thực đơn mới"
    assert "đã hoàn thành" not in reminder["body"]

    generated = client.post("/api/v1/meal-plans/generate", headers=headers)
    assert generated.status_code == 200, generated.text
    new_id = generated.json()["id"]
    assert new_id != old_id
    assert generated.json()["status"] == "pending_review"
    schedule = client.get("/api/v1/meal-plans/schedule", headers=headers).json()
    assert [p["id"] for p in schedule["unassigned_plans"]] == [new_id]
    assert [p["id"] for p in schedule["history_plans"]] == [old_id]
    db_session.refresh(old)
    assert old.status == status
    assert old.review_notes == "Old review preserved"
    assert old.starts_on is None and old.ends_on is None
    duplicate = client.post("/api/v1/meal-plans/generate", headers=headers)
    assert duplicate.status_code == 409
    assert duplicate.json()["code"] == "PLAN_ALREADY_PENDING"


def test_unapplied_cycle_expires_after_seven_vietnam_days():
    # 17:00 UTC is midnight of the following Vietnam day.
    row = MealPlan(created_at=datetime(2026, 11, 2, 17), days=[{}] * 7)
    from datetime import date
    assert not is_plan_historical(row, date(2026, 11, 9))
    assert is_plan_historical(row, date(2026, 11, 10))
    row.starts_on = date(2026, 11, 16)
    row.ends_on = date(2026, 11, 22)
    assert not is_plan_historical(row, date(2026, 11, 16))
