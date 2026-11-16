"""Tests cho plan_expiry: unit (pure helpers) + API (doctor patients fields).

- Unit: duration/start/end/days_left/bucket với ngày cố định.
- API: sau khi duyệt plan, GET /doctor/patients trả về plan_expiry/plan_days_left/plan_end_date;
  plan chưa duyệt → plan_expiry == "none".
"""

from __future__ import annotations

from datetime import date, datetime, timedelta

from app.services.plan_expiry import (
    EXPIRING_THRESHOLD_DAYS,
    bucket,
    days_left,
    duration_days,
    end_date,
    start_date,
)

REVIEWED = datetime(2026, 8, 10, 9, 0)  # ngày bắt đầu: 10/08/2026
CREATED = datetime(2026, 8, 9, 9, 0)


def _login(client, email: str, password: str = "demo1234") -> dict:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    return {"Authorization": f"Bearer {data['access_token']}"}


# ---------------- Unit ----------------

def test_duration_days_default_seven():
    assert duration_days(None) == 7
    assert duration_days(0) == 7
    assert duration_days(7) == 7
    assert duration_days(3) == 3


def test_start_date_prefers_reviewed_at():
    assert start_date(REVIEWED, CREATED) == date(2026, 8, 10)
    assert start_date(None, CREATED) == date(2026, 8, 9)
    assert start_date(None, None) is None


def test_end_date_and_days_left():
    # 7 ngày bắt đầu 10/08 → kết thúc 16/08
    assert end_date(REVIEWED, None, 7) == date(2026, 8, 16)
    # hôm nay 14/08 → còn 2 ngày
    assert days_left(REVIEWED, None, 7, today=date(2026, 8, 14)) == 2
    # không xác định được mốc → None
    assert days_left(None, None, 7) is None


def test_bucket_classification():
    # còn 2 ngày (đúng ngưỡng) → expiring
    assert bucket(REVIEWED, None, 7, today=date(2026, 8, 14)) == "expiring"
    assert bucket(REVIEWED, None, 7, today=date(2026, 8, 15)) == "expiring"
    # đã hết hạn → expired
    assert bucket(REVIEWED, None, 7, today=date(2026, 8, 17)) == "expired"
    # còn nhiều ngày → ok
    assert bucket(REVIEWED, None, 7, today=date(2026, 8, 11)) == "ok"
    # chưa có mốc → none
    assert bucket(None, None, 7) == "none"
    # fallback created_at khi chưa duyệt
    assert bucket(None, CREATED, 7, today=date(2026, 8, 11)) == "ok"


def test_expiring_threshold_constant():
    assert EXPIRING_THRESHOLD_DAYS == 2


# ---------------- API ----------------

def test_doctor_patients_expose_plan_expiry_after_approve(client):
    patient_headers = _login(client, "demo_patient_1@example.com")
    plan = client.post("/api/v1/meal-plans/generate", headers=patient_headers)
    assert plan.status_code == 200, plan.text
    plan_id = plan.json()["id"]

    doctor_headers = _login(client, "demo_doctor@example.com")
    response = client.post(
        f"/api/v1/doctor/meal-plans/{plan_id}/review",
        headers=doctor_headers,
        json={"action": "approve", "notes": "OK"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "approved"

    _apply_plan(client, doctor_headers, plan_id)

    rows = client.get("/api/v1/doctor/patients", headers=doctor_headers)
    assert rows.status_code == 200, rows.text
    row = next(x for x in rows.json() if x["id"] == "demo_patient_1")
    assert row["latest_plan_status"] == "approved"
    # Mới duyệt hôm nay → còn 6 ngày (7 ngày trừ ngày hôm nay) → bucket "ok"
    assert row["plan_expiry"] == "ok"
    assert row["plan_days_left"] == 6
    expected_end = (date.today() + timedelta(days=6)).strftime("%d/%m/%Y")
    assert row["plan_end_date"] == expected_end


def test_doctor_patients_plan_expiry_none_when_pending(client):
    patient_headers = _login(client, "demo_patient_2@example.com")
    response = client.post("/api/v1/meal-plans/generate", headers=patient_headers)
    assert response.status_code == 200, response.text

    doctor_headers = _login(client, "demo_doctor@example.com")
    rows = client.get("/api/v1/doctor/patients", headers=doctor_headers)
    assert rows.status_code == 200, rows.text
    row = next(x for x in rows.json() if x["id"] == "demo_patient_2")
    assert row["latest_plan_status"] == "pending_review"
    assert row["plan_expiry"] == "none"
    assert row["plan_usage"] == "none"
    assert row["plan_days_left"] is None
    assert row["plan_end_date"] is None


def _approve_latest_plan(client, doctor_headers: dict, plan_id: str):
    response = client.post(
        f"/api/v1/doctor/meal-plans/{plan_id}/review",
        headers=doctor_headers,
        json={"action": "approve", "notes": "OK"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "approved"


def _apply_plan(client, doctor_headers: dict, plan_id: str):
    from datetime import date

    response = client.post(
        f"/api/v1/doctor/meal-plans/{plan_id}/apply",
        headers=doctor_headers,
        json={"start_date": date.today().isoformat(), "replace_active": True},
    )
    assert response.status_code == 200, response.text


def _patient_expiry(client, doctor_headers: dict, patient_id: str) -> dict:
    rows = client.get("/api/v1/doctor/patients", headers=doctor_headers)
    assert rows.status_code == 200, rows.text
    return next(x for x in rows.json() if x["id"] == patient_id)


def test_demo_plan_expiry_backdates_reviewed_at(client):
    patient_headers = _login(client, "demo_patient_1@example.com")
    plan = client.post("/api/v1/meal-plans/generate", headers=patient_headers)
    assert plan.status_code == 200, plan.text
    plan_id = plan.json()["id"]

    doctor_headers = _login(client, "demo_doctor@example.com")
    _approve_latest_plan(client, doctor_headers, plan_id)
    _apply_plan(client, doctor_headers, plan_id)

    # mode=expired → plan đã hết hạn
    response = client.post(
        "/api/v1/doctor/demo/plan-expiry",
        headers=doctor_headers,
        json={"mode": "expired"},
    )
    assert response.status_code == 200, response.text
    assert "demo_patient_1" in response.json()["updated"]
    row = _patient_expiry(client, doctor_headers, "demo_patient_1")
    assert row["plan_expiry"] == "expired"
    assert row["plan_days_left"] is not None and row["plan_days_left"] <= 0

    # mode=expiring → còn đúng 1 ngày
    response = client.post(
        "/api/v1/doctor/demo/plan-expiry",
        headers=doctor_headers,
        json={"mode": "expiring"},
    )
    assert response.status_code == 200, response.text
    row = _patient_expiry(client, doctor_headers, "demo_patient_1")
    assert row["plan_expiry"] == "expiring"
    assert row["plan_days_left"] == 1


def test_demo_plan_expiry_skips_patients_without_approved_plan(client):
    patient_headers = _login(client, "demo_patient_2@example.com")
    plan = client.post("/api/v1/meal-plans/generate", headers=patient_headers)
    assert plan.status_code == 200, plan.text  # pending, chưa duyệt

    doctor_headers = _login(client, "demo_doctor@example.com")
    response = client.post(
        "/api/v1/doctor/demo/plan-expiry",
        headers=doctor_headers,
        json={"mode": "expired"},
    )
    assert response.status_code == 200, response.text
    assert "demo_patient_2" in response.json()["skipped"]


def test_demo_plan_expiry_requires_doctor(client):
    patient_headers = _login(client, "demo_patient_1@example.com")
    response = client.post(
        "/api/v1/doctor/demo/plan-expiry",
        headers=patient_headers,
        json={"mode": "expired"},
    )
    assert response.status_code == 403, response.text


def test_get_me_creates_plan_expired_notification(client):
    patient_headers = _login(client, "demo_patient_1@example.com")
    plan = client.post("/api/v1/meal-plans/generate", headers=patient_headers)
    assert plan.status_code == 200, plan.text
    plan_id = plan.json()["id"]

    doctor_headers = _login(client, "demo_doctor@example.com")
    _approve_latest_plan(client, doctor_headers, plan_id)
    _apply_plan(client, doctor_headers, plan_id)

    response = client.post(
        "/api/v1/doctor/demo/plan-expiry",
        headers=doctor_headers,
        json={"mode": "expired"},
    )
    assert response.status_code == 200, response.text

    response = client.get("/api/v1/meal-plans/me", headers=patient_headers)
    assert response.status_code == 404, response.text  # Completed plans live in history.

    notifications = client.get("/api/v1/notifications", headers=patient_headers)
    assert notifications.status_code == 200, notifications.text
    expired = [
        n
        for n in notifications.json()
        if n["type"] == "plan_expired"
        and n.get("related_ids", {}).get("meal_plan_id") == plan_id
    ]
    assert len(expired) == 1


def test_get_me_plan_expired_notification_is_idempotent(client):
    patient_headers = _login(client, "demo_patient_1@example.com")
    plan = client.post("/api/v1/meal-plans/generate", headers=patient_headers)
    assert plan.status_code == 200, plan.text
    plan_id = plan.json()["id"]

    doctor_headers = _login(client, "demo_doctor@example.com")
    _approve_latest_plan(client, doctor_headers, plan_id)
    _apply_plan(client, doctor_headers, plan_id)
    client.post(
        "/api/v1/doctor/demo/plan-expiry",
        headers=doctor_headers,
        json={"mode": "expired"},
    )

    client.get("/api/v1/meal-plans/me", headers=patient_headers)
    client.get("/api/v1/meal-plans/me", headers=patient_headers)

    notifications = client.get("/api/v1/notifications", headers=patient_headers)
    expired = [
        n
        for n in notifications.json()
        if n["type"] == "plan_expired"
        and n.get("related_ids", {}).get("meal_plan_id") == plan_id
    ]
    assert len(expired) == 1


def test_doctor_patients_plan_expiry_for_edited_plan(client):
    patient_headers = _login(client, "demo_patient_1@example.com")
    plan = client.post("/api/v1/meal-plans/generate", headers=patient_headers)
    assert plan.status_code == 200, plan.text
    plan_id = plan.json()["id"]
    edited = client.get(f"/api/v1/meal-plans/{plan_id}", headers=patient_headers).json()

    doctor_headers = _login(client, "demo_doctor@example.com")
    response = client.post(
        f"/api/v1/doctor/meal-plans/{plan_id}/review",
        headers=doctor_headers,
        json={"action": "edit", "notes": "Chỉnh nhẹ", "edited_plan": edited},
    )
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "edited"

    _apply_plan(client, doctor_headers, plan_id)

    row = _patient_expiry(client, doctor_headers, "demo_patient_1")
    assert row["latest_plan_status"] == "edited"
    assert row["plan_expiry"] == "ok"
    assert row["plan_days_left"] == 6
