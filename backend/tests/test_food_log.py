"""Tests for food log API — ADR-009."""

from __future__ import annotations

from datetime import datetime

from app.core.datetime_vn import vn_today
from app.models.food_log import FoodLog

from tests.test_api import PATIENT, _login


def test_create_food_log_as_planned(client):
    headers = _login(client, PATIENT)
    response = client.post(
        "/api/v1/food-log",
        json={"slot": "morning", "type": "as_planned"},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["slot"] == "morning"
    assert body["type"] == "as_planned"
    assert body["status"] == "logged"
    assert body["alert_ids"] == []
    logged_at = body["logged_at"]
    assert logged_at.endswith("Z") or "+" in logged_at or logged_at.endswith("00:00")


def test_create_food_log_custom_requires_note(client):
    headers = _login(client, PATIENT)
    response = client.post(
        "/api/v1/food-log",
        json={"slot": "noon", "type": "custom", "note": ""},
        headers=headers,
    )
    assert response.status_code == 422


def test_create_food_log_custom_with_interaction_alert(client):
    headers = _login(client, PATIENT)
    response = client.post(
        "/api/v1/food-log",
        json={"slot": "evening", "type": "custom", "note": "uống rượu tối qua"},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["type"] == "custom"
    assert len(body["alert_ids"]) >= 1

    alerts = client.get("/api/v1/alerts", headers=headers)
    assert alerts.status_code == 200
    linked = [a for a in alerts.json() if a.get("food_log_id") == body["id"]]
    assert len(linked) >= 1


def test_create_food_log_snack_as_planned(client):
    headers = _login(client, PATIENT)
    response = client.post(
        "/api/v1/food-log",
        json={"slot": "snack", "type": "as_planned"},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    assert response.json()["slot"] == "snack"


def test_list_food_logs_by_date(client):
    headers = _login(client, PATIENT)
    today = vn_today().isoformat()

    for slot in ("morning", "noon", "evening", "snack"):
        resp = client.post(
            "/api/v1/food-log",
            json={"slot": slot, "type": "as_planned"},
            headers=headers,
        )
        assert resp.status_code == 200

    response = client.get(f"/api/v1/food-log?date={today}", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) == 4


def test_create_food_log_upserts_same_slot_same_vn_day(client):
    headers = _login(client, PATIENT)
    first = client.post(
        "/api/v1/food-log",
        json={"slot": "morning", "type": "as_planned"},
        headers=headers,
    )
    assert first.status_code == 200, first.text
    first_id = first.json()["id"]

    second = client.post(
        "/api/v1/food-log",
        json={"slot": "morning", "type": "custom", "note": "bún bò"},
        headers=headers,
    )
    assert second.status_code == 200, second.text
    body = second.json()
    assert body["id"] == first_id
    assert body["type"] == "custom"
    assert body["note"] == "bún bò"
    assert body["status"] == "adjusted"

    listed = client.get(f"/api/v1/food-log?date={vn_today().isoformat()}", headers=headers)
    assert listed.status_code == 200
    morning = [row for row in listed.json() if row["slot"] == "morning"]
    assert len(morning) == 1


def test_list_food_logs_filters_by_vn_date_across_utc_midnight(client):
    headers = _login(client, PATIENT)
    user_id = client.get("/api/v1/auth/me", headers=headers).json()["id"]

    from tests.conftest import TestingSessionLocal

    db = TestingSessionLocal()
    try:
        db.add(
            FoodLog(
                user_id=user_id,
                slot="evening",
                type="as_planned",
                logged_at=datetime(2026, 8, 23, 17, 10, 0),
            )
        )
        db.commit()
    finally:
        db.close()

    on_vn_day = client.get("/api/v1/food-log?date=2026-08-24", headers=headers)
    assert on_vn_day.status_code == 200
    assert len(on_vn_day.json()) == 1
    assert on_vn_day.json()[0]["slot"] == "evening"

    on_utc_day = client.get("/api/v1/food-log?date=2026-08-23", headers=headers)
    assert on_utc_day.status_code == 200
    assert on_utc_day.json() == []


def test_create_food_log_rejects_foreign_meal_plan(client):
    patient2_headers = _login(client, "demo_patient_2@example.com")
    gen = client.post(
        "/api/v1/meal-plans/generate",
        headers=patient2_headers,
    )
    assert gen.status_code == 200, gen.text
    foreign_plan_id = gen.json()["id"]

    headers = _login(client, PATIENT)
    response = client.post(
        "/api/v1/food-log",
        json={
            "slot": "morning",
            "type": "as_planned",
            "meal_plan_id": foreign_plan_id,
        },
        headers=headers,
    )
    assert response.status_code == 403
    assert response.json()["code"] == "FORBIDDEN"
