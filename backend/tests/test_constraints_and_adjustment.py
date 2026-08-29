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
    effective_kcal = profile.get("target_kcal") or 1800
    new_kcal = effective_kcal + 50

    response = client.post(
        "/api/v1/profile",
        headers=headers,
        json={**profile, "target_kcal": new_kcal},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["constraints_status"] == "pending_doctor_review"
    assert body["target_kcal"] == effective_kcal
    assert body["proposed_target_kcal"] == new_kcal


def test_constraints_approve(client):
    patient_headers = _login(client, PATIENT)
    doctor_headers = _login(client, DOCTOR)
    patient_id = client.get("/api/v1/auth/me", headers=patient_headers).json()["id"]

    profile = client.get("/api/v1/profile/me", headers=patient_headers).json()
    proposed_kcal = (profile.get("target_kcal") or 1800) + 100
    client.post(
        "/api/v1/profile",
        headers=patient_headers,
        json={**profile, "target_kcal": proposed_kcal},
    )

    approve = client.post(
        f"/api/v1/doctor/patients/{patient_id}/constraints/approve",
        headers=doctor_headers,
    )
    assert approve.status_code == 200, approve.text
    body = approve.json()
    assert body["constraints_status"] == "confirmed"
    assert body["target_kcal"] == proposed_kcal
    assert body["proposed_target_kcal"] is None

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


def test_patient_kcal_proposal_not_used_until_doctor_approve(client):
    """Meal plan must keep doctor-set target_kcal while a patient proposal is pending."""
    patient_headers = _login(client, PATIENT)
    doctor_headers = _login(client, DOCTOR)
    patient_id = client.get("/api/v1/auth/me", headers=patient_headers).json()["id"]

    doctor_kcal = 1600
    patient_kcal = 2500
    put = client.put(
        f"/api/v1/doctor/patients/{patient_id}/constraints",
        headers=doctor_headers,
        json={"target_kcal": doctor_kcal},
    )
    assert put.status_code == 200, put.text
    assert put.json()["target_kcal"] == doctor_kcal

    profile = client.get("/api/v1/profile/me", headers=patient_headers).json()
    propose = client.post(
        "/api/v1/profile",
        headers=patient_headers,
        json={**profile, "target_kcal": patient_kcal},
    )
    assert propose.status_code == 200, propose.text
    pending = propose.json()
    assert pending["target_kcal"] == doctor_kcal
    assert pending["proposed_target_kcal"] == patient_kcal
    assert pending["constraints_status"] == "pending_doctor_review"

    generated = client.post("/api/v1/meal-plans/generate", headers=patient_headers)
    assert generated.status_code == 200, generated.text
    snapshot = generated.json()["profile_snapshot"]
    assert snapshot["target_kcal"] == doctor_kcal
    assert snapshot.get("proposed_target_kcal") is None

    approve = client.post(
        f"/api/v1/doctor/patients/{patient_id}/constraints/approve",
        headers=doctor_headers,
    )
    assert approve.status_code == 200, approve.text
    assert approve.json()["target_kcal"] == patient_kcal
    assert approve.json()["proposed_target_kcal"] is None


def test_doctor_put_constraints_full_field_set(client):
    """PUT constraints writes kcal, carb, sodium, salt, sugar, goals to effective columns."""
    patient_headers = _login(client, PATIENT)
    doctor_headers = _login(client, DOCTOR)
    patient_id = client.get("/api/v1/auth/me", headers=patient_headers).json()["id"]
    goals = ["Kiểm soát đường huyết ổn định (HbA1c < 7%)."]

    put = client.put(
        f"/api/v1/doctor/patients/{patient_id}/constraints",
        headers=doctor_headers,
        json={
            "target_kcal": 1700,
            "carb_per_meal": 40,
            "sodium_daily": 1500,
            "salt_daily_g": 4.5,
            "sugar_daily_g": 20,
            "treatment_goals": goals,
        },
    )
    assert put.status_code == 200, put.text
    body = put.json()
    assert body["target_kcal"] == 1700
    assert body["carb_per_meal"] == 40
    assert body["sodium_daily"] == 1500
    assert body["salt_daily_g"] == 4.5
    assert body["sugar_daily_g"] == 20
    assert body["treatment_goals"] == goals
    assert body["constraints_status"] == "confirmed"
    assert body.get("proposed_target_kcal") is None
    assert body.get("proposed_carb_per_meal") is None
