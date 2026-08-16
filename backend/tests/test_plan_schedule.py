"""Tests for meal plan schedule slots — ADR-012."""

from __future__ import annotations

from datetime import date, timedelta


def _login(client, email: str, password: str = "demo1234") -> dict:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    return {"Authorization": f"Bearer {data['access_token']}"}


def _generate_and_approve(client, patient_email: str, doctor_headers: dict) -> str:
    patient_headers = _login(client, patient_email)
    plan = client.post("/api/v1/meal-plans/generate", headers=patient_headers)
    assert plan.status_code == 200, plan.text
    plan_id = plan.json()["id"]
    review = client.post(
        f"/api/v1/doctor/meal-plans/{plan_id}/review",
        headers=doctor_headers,
        json={"action": "approve", "notes": "OK"},
    )
    assert review.status_code == 200, review.text
    return plan_id


def _apply(
    client,
    doctor_headers: dict,
    plan_id: str,
    start: date | None = None,
    *,
    slot_key: str | None = None,
    replace_active: bool = True,
):
    start = start or date.today()
    body: dict = {
        "start_date": start.isoformat(),
        "replace_active": replace_active,
    }
    if slot_key:
        body["slot_key"] = slot_key
    return client.post(
        f"/api/v1/doctor/meal-plans/{plan_id}/apply",
        headers=doctor_headers,
        json=body,
    )


def test_schedule_includes_unassigned_plans(client):
    doctor_headers = _login(client, "demo_doctor@example.com")
    patient_headers = _login(client, "demo_patient_2@example.com")
    plan = client.post("/api/v1/meal-plans/generate", headers=patient_headers)
    plan_id = plan.json()["id"]
    client.post(
        f"/api/v1/doctor/meal-plans/{plan_id}/review",
        headers=doctor_headers,
        json={"action": "approve", "notes": "OK"},
    )

    schedule = client.get(
        "/api/v1/doctor/patients/demo_patient_2/meal-plan-schedule",
        headers=doctor_headers,
    ).json()
    ids = [p["id"] for p in schedule.get("unassigned_plans", [])]
    assert plan_id in ids

    doctor_headers = _login(client, "demo_doctor@example.com")
    patient_id = "demo_patient_2"

    response = client.get(
        f"/api/v1/doctor/patients/{patient_id}/meal-plan-schedule",
        headers=doctor_headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["patient_id"] == patient_id
    assert body["active_plan_id"] is None
    assert len(body["slots"]) >= 2
    current = body["slots"][0]
    assert current["slot_key"] == "current"
    assert current["occupancy"] == "empty"
    assert "add" in current["actions"]


def test_list_patient_meal_plans(client):
    patient_headers = _login(client, "demo_patient_2@example.com")
    doctor_headers = _login(client, "demo_doctor@example.com")
    client.post("/api/v1/meal-plans/generate", headers=patient_headers)

    response = client.get(
        "/api/v1/doctor/patients/demo_patient_2/meal-plans?status=all",
        headers=doctor_headers,
    )
    assert response.status_code == 200, response.text
    rows = response.json()
    assert all(r["user_id"] == "demo_patient_2" for r in rows)


def test_schedule_active_and_upcoming(client):
    doctor_headers = _login(client, "demo_doctor@example.com")
    patient_id = "demo_patient_1"

    plan_a = _generate_and_approve(client, "demo_patient_1@example.com", doctor_headers)
    assert _apply(client, doctor_headers, plan_a, slot_key="current").status_code == 200

    plan_b = _generate_and_approve(client, "demo_patient_1@example.com", doctor_headers)
    next_start = date.today() + timedelta(days=7)
    assert (
        _apply(
            client,
            doctor_headers,
            plan_b,
            start=next_start,
            slot_key="next",
            replace_active=False,
        ).status_code
        == 200
    )

    schedule = client.get(
        f"/api/v1/doctor/patients/{patient_id}/meal-plan-schedule",
        headers=doctor_headers,
    ).json()
    assert schedule["active_plan_id"] == plan_a
    current = schedule["slots"][0]
    assert current["occupancy"] == "active"
    next_slot = schedule["slots"][1]
    assert next_slot["slot_key"] == "next"
    assert next_slot["occupancy"] == "upcoming"
    assert next_slot["plan"]["id"] == plan_b


def test_apply_invalid_slot_start(client):
    doctor_headers = _login(client, "demo_doctor@example.com")
    plan_id = _generate_and_approve(client, "demo_patient_1@example.com", doctor_headers)
    wrong = date.today() + timedelta(days=3)
    response = _apply(
        client,
        doctor_headers,
        plan_id,
        start=wrong,
        slot_key="current",
    )
    assert response.status_code == 400, response.text
    assert response.json()["code"] == "INVALID_SLOT_START"


def test_replace_next_week(client):
    doctor_headers = _login(client, "demo_doctor@example.com")
    patient_id = "demo_patient_1"

    plan_a = _generate_and_approve(client, "demo_patient_1@example.com", doctor_headers)
    assert _apply(client, doctor_headers, plan_a, slot_key="current").status_code == 200

    plan_b = _generate_and_approve(client, "demo_patient_1@example.com", doctor_headers)
    next_start = date.today() + timedelta(days=7)
    assert (
        _apply(
            client,
            doctor_headers,
            plan_b,
            start=next_start,
            slot_key="next",
            replace_active=False,
        ).status_code
        == 200
    )

    plan_c = _generate_and_approve(client, "demo_patient_1@example.com", doctor_headers)
    response = _apply(
        client,
        doctor_headers,
        plan_c,
        start=next_start,
        slot_key="next",
        replace_active=True,
    )
    assert response.status_code == 200, response.text

    plan_b_row = client.get(
        f"/api/v1/meal-plans/{plan_b}", headers=doctor_headers
    ).json()
    assert plan_b_row["starts_on"] is None
    assert plan_b_row["ends_on"] is None

    schedule = client.get(
        f"/api/v1/doctor/patients/{patient_id}/meal-plan-schedule",
        headers=doctor_headers,
    ).json()
    next_slot = schedule["slots"][1]
    assert next_slot["plan"]["id"] == plan_c


def _empty_add_slots(schedule: dict) -> list[dict]:
    return [
        slot
        for slot in schedule["slots"]
        if slot["occupancy"] == "empty" and "add" in slot["actions"]
    ]


def test_apply_trailing_empty_then_next_empty(client):
    """Assigning to tuần trống (slot_key=empty) must not freeze start_date to one canonical empty week."""
    doctor_headers = _login(client, "demo_doctor@example.com")
    patient_id = "demo_patient_1"

    plan_a = _generate_and_approve(client, "demo_patient_1@example.com", doctor_headers)
    assert _apply(client, doctor_headers, plan_a, slot_key="current").status_code == 200

    schedule = client.get(
        f"/api/v1/doctor/patients/{patient_id}/meal-plan-schedule",
        headers=doctor_headers,
    ).json()
    empty_slots = _empty_add_slots(schedule)
    trailing = next(s for s in empty_slots if s["slot_key"] == "empty")

    plan_b = _generate_and_approve(client, "demo_patient_1@example.com", doctor_headers)
    first = _apply(
        client,
        doctor_headers,
        plan_b,
        start=date.fromisoformat(trailing["starts_on"]),
        slot_key="empty",
        replace_active=False,
    )
    assert first.status_code == 200, first.text

    schedule = client.get(
        f"/api/v1/doctor/patients/{patient_id}/meal-plan-schedule",
        headers=doctor_headers,
    ).json()
    empty_slots = _empty_add_slots(schedule)
    assert empty_slots
    later = empty_slots[-1]
    later_start = date.fromisoformat(later["starts_on"])
    assert later_start != date.fromisoformat(trailing["starts_on"])

    plan_c = _generate_and_approve(client, "demo_patient_1@example.com", doctor_headers)
    second = _apply(
        client,
        doctor_headers,
        plan_c,
        start=later_start,
        slot_key="empty",
        replace_active=False,
    )
    assert second.status_code == 200, second.text
    assert second.json()["starts_on"] == later_start.isoformat()
