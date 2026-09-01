"""Tests for meal plan hard caps (generate / apply)."""

from __future__ import annotations


def _login(client, email: str, password: str = "demo1234") -> dict:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _generate(client, headers: dict) -> str:
    response = client.post("/api/v1/meal-plans/generate", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()["id"]


def test_generate_blocked_when_pending_exists(client):
    patient_headers = _login(client, "demo_patient_2@example.com")
    _generate(client, patient_headers)
    second = client.post("/api/v1/meal-plans/generate", headers=patient_headers)
    assert second.status_code == 409, second.text
    assert second.json()["code"] == "PLAN_ALREADY_PENDING"


def test_generate_blocked_when_unassigned_approved_exists(client):
    patient_headers = _login(client, "demo_patient_2@example.com")
    doctor_headers = _login(client, "demo_doctor@example.com")
    plan_id = _generate(client, patient_headers)
    client.post(
        f"/api/v1/doctor/meal-plans/{plan_id}/review",
        headers=doctor_headers,
        json={"action": "approve", "notes": "OK"},
    )
    blocked = client.post("/api/v1/meal-plans/generate", headers=patient_headers)
    assert blocked.status_code == 409, blocked.text
    assert blocked.json()["code"] == "PLAN_UNASSIGNED_APPROVED"


def test_after_current_blocked_when_upcoming_exists(client):
    doctor_headers = _login(client, "demo_doctor@example.com")
    patient_headers = _login(client, "demo_patient_1@example.com")

    plan_a = _generate(client, patient_headers)
    client.post(
        f"/api/v1/doctor/meal-plans/{plan_a}/review",
        headers=doctor_headers,
        json={"action": "approve", "notes": "OK"},
    )
    client.post(
        f"/api/v1/doctor/meal-plans/{plan_a}/apply",
        headers=doctor_headers,
        json={"apply_mode": "from_today"},
    )

    plan_b = _generate(client, patient_headers)
    client.post(
        f"/api/v1/doctor/meal-plans/{plan_b}/review",
        headers=doctor_headers,
        json={"action": "approve", "notes": "OK"},
    )
    client.post(
        f"/api/v1/doctor/meal-plans/{plan_b}/apply",
        headers=doctor_headers,
        json={"apply_mode": "after_current"},
    )

    plan_c = _generate(client, patient_headers)
    client.post(
        f"/api/v1/doctor/meal-plans/{plan_c}/review",
        headers=doctor_headers,
        json={"action": "approve", "notes": "OK"},
    )
    blocked = client.post(
        f"/api/v1/doctor/meal-plans/{plan_c}/apply",
        headers=doctor_headers,
        json={"apply_mode": "after_current"},
    )
    assert blocked.status_code == 409, blocked.text
    assert blocked.json()["code"] == "UPCOMING_EXISTS"
