"""API tests for doctor review (reject/edit) and role/ownership guards.

Covers gaps not in test_api.py: reject side-effect (cancel pending notifications),
edit (400 without edited_plan, success path), and role/ownership boundaries
(doctor vs patient routes, cross-patient notification access, alerts patient_id).
"""

from __future__ import annotations


def _login(client, email: str, password: str = "demo1234") -> dict:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    return {"Authorization": f"Bearer {data['access_token']}"}


PATIENT = "demo_patient_1@example.com"
PATIENT_2 = "demo_patient_2@example.com"
DOCTOR = "demo_doctor@example.com"


def _generate_plan(client, headers: dict) -> dict:
    response = client.post("/api/v1/meal-plans/generate", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def _pending_ids_for_plan(notifications: list[dict], plan_id: str) -> list[str]:
    return [
        n["id"]
        for n in notifications
        if n["status"] == "pending"
        and n.get("related_ids", {}).get("meal_plan_id") == plan_id
    ]


def test_doctor_reject_plan_cancels_pending_notifications(client):
    patient_headers = _login(client, PATIENT)
    plan = _generate_plan(client, patient_headers)
    plan_id = plan["id"]

    # Materialized notifications exist (pending reminders + checkins).
    response = client.get("/api/v1/notifications", headers=patient_headers)
    assert response.status_code == 200, response.text
    before = _pending_ids_for_plan(response.json(), plan_id)
    assert len(before) == 35  # 7 days × (4 reminders + 1 checkin)

    doctor_headers = _login(client, DOCTOR)
    response = client.post(
        f"/api/v1/doctor/meal-plans/{plan_id}/review",
        headers=doctor_headers,
        json={"action": "reject", "notes": "Cần giảm carb bữa tối"},
    )
    assert response.status_code == 200, response.text
    review = response.json()
    assert review["status"] == "rejected"
    assert review["trust_badge"] is None
    assert review["reviewer_id"] == "demo_doctor"

    # Rejected plan: future reminders/checkins cancelled, no plan_approved.
    response = client.get("/api/v1/notifications", headers=patient_headers)
    assert response.status_code == 200, response.text
    notifications = response.json()
    assert _pending_ids_for_plan(notifications, plan_id) == []
    assert all(
        n["status"] == "cancelled" for n in notifications if n["id"] in before
    )
    assert not any(n["type"] == "plan_approved" for n in notifications)

    response = client.get(f"/api/v1/meal-plans/{plan_id}", headers=patient_headers)
    assert response.json()["status"] == "rejected"


def test_doctor_edit_requires_edited_plan(client):
    patient_headers = _login(client, PATIENT)
    plan = _generate_plan(client, patient_headers)

    doctor_headers = _login(client, DOCTOR)
    response = client.post(
        f"/api/v1/doctor/meal-plans/{plan['id']}/review",
        headers=doctor_headers,
        json={"action": "edit", "notes": "Chỉnh món"},
    )
    assert response.status_code == 400, response.text
    assert response.json()["code"] == "EDITED_PLAN_REQUIRED"


def test_doctor_edit_plan_updates_days(client):
    patient_headers = _login(client, PATIENT)
    plan = _generate_plan(client, patient_headers)
    plan_id = plan["id"]

    response = client.get(f"/api/v1/meal-plans/{plan_id}", headers=patient_headers)
    assert response.status_code == 200, response.text
    edited = response.json()
    new_name = "Yến mạch ức gà xé (BS đã chỉnh)"
    edited["days"][0]["meals"][0]["items"][0]["name"] = new_name

    doctor_headers = _login(client, DOCTOR)
    response = client.post(
        f"/api/v1/doctor/meal-plans/{plan_id}/review",
        headers=doctor_headers,
        json={"action": "edit", "notes": "Thay bữa sáng ngày 1", "edited_plan": edited},
    )
    assert response.status_code == 200, response.text
    review = response.json()
    assert review["status"] == "edited"
    assert review["trust_badge"] == "doctor_reviewed"

    response = client.get(f"/api/v1/meal-plans/{plan_id}", headers=patient_headers)
    assert response.status_code == 200, response.text
    updated = response.json()
    assert updated["status"] == "edited"
    assert updated["days"][0]["meals"][0]["items"][0]["name"] == new_name


def test_patient_cannot_review_plan(client):
    patient_headers = _login(client, PATIENT)
    plan = _generate_plan(client, patient_headers)

    response = client.post(
        f"/api/v1/doctor/meal-plans/{plan['id']}/review",
        headers=patient_headers,
        json={"action": "approve", "notes": "OK"},
    )
    assert response.status_code == 403, response.text
    assert response.json()["code"] == "FORBIDDEN"


def test_review_missing_plan_returns_404(client):
    doctor_headers = _login(client, DOCTOR)
    response = client.post(
        "/api/v1/doctor/meal-plans/does-not-exist/review",
        headers=doctor_headers,
        json={"action": "approve", "notes": "OK"},
    )
    assert response.status_code == 404, response.text
    assert response.json()["code"] == "MEAL_PLAN_NOT_FOUND"


def test_doctor_cannot_access_patient_notifications(client):
    doctor_headers = _login(client, DOCTOR)
    response = client.get("/api/v1/notifications", headers=doctor_headers)
    assert response.status_code == 403, response.text
    assert response.json()["code"] == "FORBIDDEN"


def test_patient_cannot_touch_other_patients_notification(client):
    patient_headers = _login(client, PATIENT)
    plan = _generate_plan(client, patient_headers)

    response = client.get("/api/v1/notifications", headers=patient_headers)
    assert response.status_code == 200, response.text
    notifications = response.json()
    pending_ids = _pending_ids_for_plan(notifications, plan["id"])
    assert pending_ids, "expected pending notifications for the generated plan"
    notification_id = pending_ids[0]

    other_headers = _login(client, PATIENT_2)
    response = client.post(
        f"/api/v1/notifications/{notification_id}/read",
        headers=other_headers,
    )
    assert response.status_code == 403, response.text
    assert response.json()["code"] == "FORBIDDEN"

    # Original patient still sees it pending.
    response = client.get("/api/v1/notifications", headers=patient_headers)
    assert any(
        n["id"] == notification_id and n["status"] == "pending"
        for n in response.json()
    )


def test_doctor_alerts_requires_patient_id(client):
    doctor_headers = _login(client, DOCTOR)
    response = client.get("/api/v1/alerts", headers=doctor_headers)
    assert response.status_code == 400, response.text
    assert response.json()["code"] == "PATIENT_ID_REQUIRED"

    patient_headers = _login(client, PATIENT)
    _generate_plan(client, patient_headers)

    response = client.get(
        "/api/v1/alerts?patient_id=demo_patient_1",
        headers=doctor_headers,
    )
    assert response.status_code == 200, response.text
    alerts = response.json()
    assert any(a["drug"] == "warfarin" for a in alerts)
