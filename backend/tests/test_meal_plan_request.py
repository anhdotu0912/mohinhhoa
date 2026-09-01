"""Tests for patient meal plan creation request workflow."""

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


def _patient_id(client, headers: dict) -> str:
    return client.get("/api/v1/auth/me", headers=headers).json()["id"]


def test_meal_plan_request_happy_path(client):
    patient_headers = _login(client, PATIENT)

    initial = client.get("/api/v1/meal-plans/request", headers=patient_headers)
    assert initial.status_code == 200, initial.text
    assert initial.json()["status"] == "none"

    response = client.post(
        "/api/v1/meal-plans/request",
        headers=patient_headers,
        json={"note": "Mong bác sĩ lập thực đơn tuần này"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "pending"
    assert body["note"] == "Mong bác sĩ lập thực đơn tuần này"
    assert body["requested_at"] is not None

    again = client.post(
        "/api/v1/meal-plans/request",
        headers=patient_headers,
        json={"note": "Ghi chú mới không được ghi đè"},
    )
    assert again.status_code == 200, again.text
    assert again.json()["note"] == "Mong bác sĩ lập thực đơn tuần này"


def test_doctor_sees_pending_request_filter(client):
    patient_headers = _login(client, PATIENT)
    doctor_headers = _login(client, DOCTOR)
    patient_id = _patient_id(client, patient_headers)

    client.post(
        "/api/v1/meal-plans/request",
        headers=patient_headers,
        json={"note": "Cần thực đơn mới"},
    )

    patients = client.get(
        "/api/v1/doctor/patients",
        headers=doctor_headers,
        params={"meal_plan_request": "pending"},
    )
    assert patients.status_code == 200, patients.text
    ids = {row["id"] for row in patients.json()}
    assert patient_id in ids

    detail = client.get(
        f"/api/v1/doctor/patients/{patient_id}",
        headers=doctor_headers,
    )
    assert detail.status_code == 200, detail.text
    assert detail.json()["meal_plan_request_status"] == "pending"
    assert detail.json()["meal_plan_request_note"] == "Cần thực đơn mới"


def test_generate_clears_request_flag(client):
    patient_headers = _login(client, PATIENT)
    doctor_headers = _login(client, DOCTOR)
    patient_id = _patient_id(client, patient_headers)

    client.post(
        "/api/v1/meal-plans/request",
        headers=patient_headers,
        json={"note": "Xin tạo thực đơn"},
    )

    generated = client.post(
        f"/api/v1/doctor/patients/{patient_id}/meal-plans/generate",
        headers=doctor_headers,
        json={"notes": "Theo yêu cầu bệnh nhân"},
    )
    assert generated.status_code == 200, generated.text

    detail = client.get(
        f"/api/v1/doctor/patients/{patient_id}",
        headers=doctor_headers,
    )
    assert detail.json()["meal_plan_request_status"] == "none"

    status = client.get("/api/v1/meal-plans/request", headers=patient_headers)
    assert status.json()["status"] == "none"


def test_request_blocked_when_plan_pending_review(client):
    patient_headers = _login(client, PATIENT)

    generate = client.post("/api/v1/meal-plans/generate", headers=patient_headers)
    assert generate.status_code == 200, generate.text

    response = client.post(
        "/api/v1/meal-plans/request",
        headers=patient_headers,
        json={"note": "Không nên được chấp nhận"},
    )
    assert response.status_code == 400, response.text
    assert response.json()["code"] == "PLAN_ALREADY_PENDING"
