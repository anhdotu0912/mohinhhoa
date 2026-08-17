"""Tests for meal plan apply / replace validity window."""

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


def _apply(client, doctor_headers: dict, plan_id: str, start: date | None = None):
    start = start or date.today()
    return client.post(
        f"/api/v1/doctor/meal-plans/{plan_id}/apply",
        headers=doctor_headers,
        json={"start_date": start.isoformat(), "replace_active": True},
    )


def test_apply_sets_dates_and_active_plan(client):
    doctor_headers = _login(client, "demo_doctor@example.com")
    plan_id = _generate_and_approve(client, "demo_patient_1@example.com", doctor_headers)

    response = _apply(client, doctor_headers, plan_id)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["starts_on"] == date.today().isoformat()
    assert body["ends_on"] == (date.today() + timedelta(days=6)).isoformat()
    assert body["days"][0]["date"] == date.today().isoformat()

    rows = client.get("/api/v1/doctor/patients", headers=doctor_headers)
    row = next(x for x in rows.json() if x["id"] == "demo_patient_1")
    assert row["active_plan_id"] == plan_id
    assert row["plan_usage"] == "active"
    assert row["plan_expiry"] == "ok"


def test_apply_pending_plan_rejected(client):
    patient_headers = _login(client, "demo_patient_2@example.com")
    doctor_headers = _login(client, "demo_doctor@example.com")
    plan = client.post("/api/v1/meal-plans/generate", headers=patient_headers)
    plan_id = plan.json()["id"]

    response = _apply(client, doctor_headers, plan_id)
    assert response.status_code == 400, response.text
    assert response.json()["code"] == "PLAN_NOT_APPLYABLE"


def test_apply_next_week_without_replace_keeps_active(client):
    """Queue an upcoming week while another plan is active — dates must not overlap."""
    doctor_headers = _login(client, "demo_doctor@example.com")
    plan_a = _generate_and_approve(client, "demo_patient_1@example.com", doctor_headers)
    assert _apply(client, doctor_headers, plan_a).status_code == 200

    plan_a_before = client.get(
        f"/api/v1/meal-plans/{plan_a}", headers=doctor_headers
    ).json()
    next_start = date.fromisoformat(plan_a_before["ends_on"]) + timedelta(days=1)

    plan_b = _generate_and_approve(client, "demo_patient_1@example.com", doctor_headers)
    response = client.post(
        f"/api/v1/doctor/meal-plans/{plan_b}/apply",
        headers=doctor_headers,
        json={
            "start_date": next_start.isoformat(),
            "replace_active": False,
            "slot_key": "next",
        },
    )
    assert response.status_code == 200, response.text

    plan_a_after = client.get(
        f"/api/v1/meal-plans/{plan_a}", headers=doctor_headers
    ).json()
    assert plan_a_after["starts_on"] == plan_a_before["starts_on"]
    assert plan_a_after["ends_on"] == plan_a_before["ends_on"]
    plan_b_row = client.get(f"/api/v1/meal-plans/{plan_b}", headers=doctor_headers).json()
    assert plan_b_row["starts_on"] == next_start.isoformat()


def test_apply_overlapping_active_without_replace_rejected(client):
    doctor_headers = _login(client, "demo_doctor@example.com")
    plan_a = _generate_and_approve(client, "demo_patient_1@example.com", doctor_headers)
    assert _apply(client, doctor_headers, plan_a).status_code == 200

    plan_b = _generate_and_approve(client, "demo_patient_1@example.com", doctor_headers)
    response = client.post(
        f"/api/v1/doctor/meal-plans/{plan_b}/apply",
        headers=doctor_headers,
        json={
            "start_date": date.today().isoformat(),
            "replace_active": False,
            "slot_key": "current",
        },
    )
    assert response.status_code == 409, response.text
    assert response.json()["code"] == "PLAN_DATE_OVERLAP"


def test_replace_active_plan(client):
    doctor_headers = _login(client, "demo_doctor@example.com")
    plan_a = _generate_and_approve(client, "demo_patient_1@example.com", doctor_headers)
    assert _apply(client, doctor_headers, plan_a).status_code == 200

    plan_b = _generate_and_approve(client, "demo_patient_1@example.com", doctor_headers)
    tomorrow = date.today() + timedelta(days=1)
    response = _apply(client, doctor_headers, plan_b, start=tomorrow)
    assert response.status_code == 200, response.text

    plan_a_row = client.get(f"/api/v1/meal-plans/{plan_a}", headers=doctor_headers).json()
    assert plan_a_row["ends_on"] == date.today().isoformat()
    plan_b_row = client.get(f"/api/v1/meal-plans/{plan_b}", headers=doctor_headers).json()
    assert plan_b_row["starts_on"] == tomorrow.isoformat()

    rows = client.get("/api/v1/doctor/patients", headers=doctor_headers)
    row = next(x for x in rows.json() if x["id"] == "demo_patient_1")
    assert row["active_plan_id"] == plan_a


def test_apply_next_week_displaces_misaligned_plan(client):
    """Plan applied as tuần sau yesterday is 1 day off today's sliding grid.

    Schedule must still show it on tuần sau, and applying a new plan to the
    canonical next week must succeed instead of 409 PLAN_DATE_OVERLAP.
    """
    from app.models.meal_plan import MealPlan
    from tests.conftest import TestingSessionLocal

    doctor_headers = _login(client, "demo_doctor@example.com")
    plan_old = _generate_and_approve(client, "demo_patient_3@example.com", doctor_headers)
    today = date.today()
    misaligned_start = today + timedelta(days=6)
    with TestingSessionLocal() as db:
        row = db.get(MealPlan, plan_old)
        assert row is not None
        row.starts_on = misaligned_start
        row.ends_on = misaligned_start + timedelta(days=6)
        db.commit()

    schedule = client.get(
        "/api/v1/doctor/patients/demo_patient_3/meal-plan-schedule",
        headers=doctor_headers,
    ).json()
    next_slot = next(s for s in schedule["slots"] if s["slot_key"] == "next")
    assert next_slot["plan"]["id"] == plan_old
    assert next_slot["occupancy"] == "upcoming"

    plan_new = _generate_and_approve(client, "demo_patient_3@example.com", doctor_headers)
    canonical_next = today + timedelta(days=7)
    response = client.post(
        f"/api/v1/doctor/meal-plans/{plan_new}/apply",
        headers=doctor_headers,
        json={
            "start_date": canonical_next.isoformat(),
            "replace_active": False,
            "slot_key": "next",
        },
    )
    assert response.status_code == 200, response.text
    old_row = client.get(f"/api/v1/meal-plans/{plan_old}", headers=doctor_headers).json()
    assert old_row["starts_on"] is None
    new_row = client.get(f"/api/v1/meal-plans/{plan_new}", headers=doctor_headers).json()
    assert new_row["starts_on"] == canonical_next.isoformat()


def test_plan_usage_for_row_windows():
    from app.services.plan_expiry import plan_usage_for_row

    today = date(2026, 8, 16)
    assert plan_usage_for_row("approved", None, None, today) == "none"
    assert (
        plan_usage_for_row("approved", date(2026, 8, 16), date(2026, 8, 22), today)
        == "active"
    )
    assert (
        plan_usage_for_row("approved", date(2026, 8, 23), date(2026, 8, 29), today)
        == "upcoming"
    )
    assert (
        plan_usage_for_row("approved", date(2026, 8, 9), date(2026, 8, 15), today)
        == "finished"
    )


def test_reconcile_unapplies_overlapping_plans(client):
    from app.models.meal_plan import MealPlan
    from app.services.plan_apply import reconcile_overlapping_applied_plans
    from tests.conftest import TestingSessionLocal

    doctor_headers = _login(client, "demo_doctor@example.com")
    plan_a = _generate_and_approve(client, "demo_patient_3@example.com", doctor_headers)
    plan_b = _generate_and_approve(client, "demo_patient_3@example.com", doctor_headers)
    today = date.today()
    end = today + timedelta(days=6)

    with TestingSessionLocal() as db:
        for plan_id in (plan_a, plan_b):
            row = db.get(MealPlan, plan_id)
            assert row is not None
            row.starts_on = today
            row.ends_on = end
        db.commit()
        n = reconcile_overlapping_applied_plans(db, user_id="demo_patient_3", today=today)
        db.commit()
        assert n == 1
        kept = [
            p
            for p in db.query(MealPlan)
            .filter(
                MealPlan.user_id == "demo_patient_3",
                MealPlan.starts_on.isnot(None),
            )
            .all()
        ]
        assert len(kept) == 1
        assert kept[0].id in {plan_a, plan_b}

    schedule = client.get(
        "/api/v1/doctor/patients/demo_patient_3/meal-plan-schedule",
        headers=doctor_headers,
    ).json()
    assert schedule["active_plan_id"] in {plan_a, plan_b}
    unassigned_ids = {p["id"] for p in schedule.get("unassigned_plans", [])}
    assert (plan_a in unassigned_ids) ^ (plan_b in unassigned_ids)


def test_list_patients_filter_plan_usage_none(client):
    patient_headers = _login(client, "demo_patient_2@example.com")
    doctor_headers = _login(client, "demo_doctor@example.com")
    client.post("/api/v1/meal-plans/generate", headers=patient_headers)

    rows = client.get(
        "/api/v1/doctor/patients?plan_usage=none",
        headers=doctor_headers,
    )
    assert rows.status_code == 200
    ids = [r["id"] for r in rows.json()]
    assert "demo_patient_2" in ids
