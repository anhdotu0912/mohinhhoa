"""Tests for clinical constraints HITL, review lock, request-adjustment."""

from __future__ import annotations

PATIENT = "demo_patient_1@example.com"
DOCTOR = "demo_doctor@example.com"


def _login(client, email: str, password: str = "demo1234") -> dict:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _generate_plan(client, patient_headers: dict) -> str:
    response = client.post("/api/v1/meal-plans/generate", headers=patient_headers)
    assert response.status_code == 200, response.text
    return response.json()["id"]


def test_constraints_status_pending_on_patient_edit(client):
    headers = _login(client, PATIENT)
    profile = client.get("/api/v1/profile/me", headers=headers).json()
    new_kcal = (profile.get("target_kcal") or 1800) + 50

    response = client.post(
        "/api/v1/profile",
        headers=headers,
        json={**profile, "target_kcal": new_kcal},
    )
    assert response.status_code == 200, response.text
    assert response.json()["constraints_status"] == "pending_doctor_review"
    assert response.json()["target_kcal"] == new_kcal


def test_constraints_approve(client):
    patient_headers = _login(client, PATIENT)
    doctor_headers = _login(client, DOCTOR)
    patient_id = client.get("/api/v1/auth/me", headers=patient_headers).json()["id"]

    profile = client.get("/api/v1/profile/me", headers=patient_headers).json()
    client.post(
        "/api/v1/profile",
        headers=patient_headers,
        json={**profile, "target_kcal": (profile.get("target_kcal") or 1800) + 100},
    )

    approve = client.post(
        f"/api/v1/doctor/patients/{patient_id}/constraints/approve",
        headers=doctor_headers,
    )
    assert approve.status_code == 200, approve.text
    assert approve.json()["constraints_status"] == "confirmed"

    again = client.post(
        f"/api/v1/doctor/patients/{patient_id}/constraints/approve",
        headers=doctor_headers,
    )
    assert again.status_code == 400
    assert again.json()["code"] == "NOTHING_TO_APPROVE"


def test_review_optimistic_lock(client):
    patient_headers = _login(client, PATIENT)
    doctor_headers = _login(client, DOCTOR)
    plan_id = _generate_plan(client, patient_headers)

    first = client.post(
        f"/api/v1/doctor/meal-plans/{plan_id}/review",
        headers=doctor_headers,
        json={"action": "approve", "notes": "OK"},
    )
    assert first.status_code == 200, first.text

    second = client.post(
        f"/api/v1/doctor/meal-plans/{plan_id}/review",
        headers=doctor_headers,
        json={"action": "reject", "notes": "Too late"},
    )
    assert second.status_code == 409
    assert second.json()["code"] == "PLAN_ALREADY_REVIEWED"


def test_request_adjustment(client):
    patient_headers = _login(client, PATIENT)
    doctor_headers = _login(client, DOCTOR)
    plan_id = _generate_plan(client, patient_headers)

    not_approved = client.post(
        f"/api/v1/meal-plans/{plan_id}/request-adjustment",
        headers=patient_headers,
        json={"adjustment_note": "Đổi món ngày 2"},
    )
    assert not_approved.status_code == 400
    assert not_approved.json()["code"] == "PLAN_NOT_APPROVED"

    approve = client.post(
        f"/api/v1/doctor/meal-plans/{plan_id}/review",
        headers=doctor_headers,
        json={"action": "approve", "notes": "OK"},
    )
    assert approve.status_code == 200, approve.text

    adjust = client.post(
        f"/api/v1/meal-plans/{plan_id}/request-adjustment",
        headers=patient_headers,
        json={"adjustment_note": "Không ăn được rau ngót ngày 3"},
    )
    assert adjust.status_code == 200, adjust.text
    body = adjust.json()
    assert body["status"] == "pending_review"
    assert body["adjustment_note"] == "Không ăn được rau ngót ngày 3"
