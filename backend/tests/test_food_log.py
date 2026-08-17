"""Tests for food log API — ADR-009."""

from __future__ import annotations

from datetime import date

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


def test_list_food_logs_by_date(client):
    headers = _login(client, PATIENT)
    today = date.today().isoformat()

    for slot in ("morning", "noon", "evening"):
        resp = client.post(
            "/api/v1/food-log",
            json={"slot": slot, "type": "as_planned"},
            headers=headers,
        )
        assert resp.status_code == 200

    response = client.get(f"/api/v1/food-log?date={today}", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) == 3
