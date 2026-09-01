"""Doctor compliance aggregation endpoints — spec 10, ADR-008."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from app.core.datetime_vn import VN_TZ, vn_day_bounds_utc, vn_today
from app.models.alert import Alert
from app.models.food_log import FoodLog
from app.models.meal_plan import MealPlan
from app.models.notification import Notification
from app.services.compliance import ComplianceService


def _login(client, email: str, password: str = "demo1234") -> dict:
    res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


PATIENT = "demo_patient_1@example.com"
PATIENT_2 = "demo_patient_2@example.com"
DOCTOR = "demo_doctor@example.com"
PATIENT_ID = "demo_patient_1"


def _add_checkin(db, user_id: str, day: date, adherence: str) -> None:
    db.add(
        Notification(
            user_id=user_id,
            type="adherence_checkin",
            title=f"Check-in {day.isoformat()}",
            body="Test",
            scheduled_at=datetime.combine(day, datetime.min.time().replace(hour=21)),
            status="done",
            related_ids={"meal_plan_id": "plan_test"},
            payload={"adherence": adherence},
        )
    )


def test_compliance_empty_when_no_checkins(client):
    doctor_headers = _login(client, DOCTOR)
    res = client.get(
        f"/api/v1/doctor/patients/{PATIENT_ID}/compliance",
        headers=doctor_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["patient_id"] == PATIENT_ID
    assert data["days"] == 14
    assert data["overall_adherence_pct"] is None
    assert data["checkins_done"] == 0
    assert data["checkins_as_planned"] == 0
    assert len(data["daily_series"]) == 14
    assert all(row["adherence_pct"] is None for row in data["daily_series"])


def test_compliance_aggregation_scores(client):
    doctor_headers = _login(client, DOCTOR)
    today = date.today()
    yesterday = today - timedelta(days=1)

    from tests.conftest import TestingSessionLocal

    db = TestingSessionLocal()
    try:
        _add_checkin(db, PATIENT_ID, today, "yes")
        _add_checkin(db, PATIENT_ID, yesterday, "partial")
        db.commit()
    finally:
        db.close()

    res = client.get(
        f"/api/v1/doctor/patients/{PATIENT_ID}/compliance?days=14",
        headers=doctor_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["checkins_done"] == 2
    assert data["checkins_as_planned"] == 1
    assert data["overall_adherence_pct"] == 75

    by_date = {row["date"]: row["adherence_pct"] for row in data["daily_series"]}
    assert by_date[today.isoformat()] == 100
    assert by_date[yesterday.isoformat()] == 50


def test_compliance_includes_alert_events(client):
    doctor_headers = _login(client, DOCTOR)
    from tests.conftest import TestingSessionLocal

    db = TestingSessionLocal()
    try:
        db.add(
            Alert(
                user_id=PATIENT_ID,
                drug="metformin",
                food="rượu",
                mechanism="m",
                severity="Nguy hiểm",
                recommendation="Tránh rượu",
                sources=[],
            )
        )
        db.add(
            Alert(
                user_id=PATIENT_ID,
                drug="metformin",
                food="cơm",
                mechanism="m",
                severity="An toàn",
                recommendation="ok",
                sources=[],
            )
        )
        db.commit()
    finally:
        db.close()

    res = client.get(
        f"/api/v1/doctor/patients/{PATIENT_ID}/compliance",
        headers=doctor_headers,
    )
    assert res.status_code == 200
    events = res.json()["events"]
    assert len(events) == 1
    assert events[0]["type"] == "alert"
    assert events[0]["severity"] == "Nguy hiểm"


def test_compliance_service_unit(db_session):
    today = date.today()
    _add_checkin(db_session, "user_x", today, "no")
    db_session.flush()

    out = ComplianceService(db_session).get_patient_compliance("user_x", days=7)
    assert out.checkins_done == 1
    assert out.overall_adherence_pct == 0
    assert out.checkins_as_planned == 0


def test_remind_creates_manual_reminder(client):
    doctor_headers = _login(client, DOCTOR)
    res = client.post(
        f"/api/v1/doctor/patients/{PATIENT_ID}/compliance/remind",
        headers=doctor_headers,
        json={"message": "Nhớ check-in bữa tối nhé."},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["type"] == "manual_reminder"
    assert data["status"] == "sent"
    assert data["user_id"] == PATIENT_ID
    assert "Nhớ check-in" in data["body"]


def test_patient_cannot_access_compliance(client):
    patient_headers = _login(client, PATIENT)
    res = client.get(
        f"/api/v1/doctor/patients/{PATIENT_ID}/compliance",
        headers=patient_headers,
    )
    assert res.status_code == 403


def test_patient_get_my_compliance(client):
    patient_headers = _login(client, PATIENT)
    res = client.get("/api/v1/compliance/me?days=7", headers=patient_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["patient_id"] == PATIENT_ID
    assert data["days"] == 7
    assert "daily_series" in data
    assert len(data["daily_series"]) == 7
    assert "overall_adherence_pct" in data
    assert "events" in data


def test_patient_get_my_compliance_matches_doctor_view(client):
    patient_headers = _login(client, PATIENT)
    doctor_headers = _login(client, DOCTOR)
    today = date.today()

    from tests.conftest import TestingSessionLocal

    db = TestingSessionLocal()
    try:
        _add_checkin(db, PATIENT_ID, today, "yes")
        db.commit()
    finally:
        db.close()

    patient_res = client.get("/api/v1/compliance/me?days=7", headers=patient_headers)
    doctor_res = client.get(
        f"/api/v1/doctor/patients/{PATIENT_ID}/compliance?days=7",
        headers=doctor_headers,
    )
    assert patient_res.status_code == 200
    assert doctor_res.status_code == 200
    assert patient_res.json() == doctor_res.json()


def test_doctor_cannot_access_patient_compliance_me(client):
    doctor_headers = _login(client, DOCTOR)
    res = client.get("/api/v1/compliance/me?days=7", headers=doctor_headers)
    assert res.status_code == 403


def test_compliance_patient_not_found(client):
    doctor_headers = _login(client, DOCTOR)
    res = client.get(
        "/api/v1/doctor/patients/nonexistent/compliance",
        headers=doctor_headers,
    )
    assert res.status_code == 404


def test_compliance_includes_food_logs(client):
    doctor_headers = _login(client, DOCTOR)
    today = vn_today()

    from tests.conftest import TestingSessionLocal

    db = TestingSessionLocal()
    try:
        plan = MealPlan(
            id="plan_food_log_test",
            user_id=PATIENT_ID,
            days=[{"day_index": 1, "meals": []}],
            status="approved",
            starts_on=today,
            ends_on=today,
        )
        db.add(plan)
        db.add(
            FoodLog(
                user_id=PATIENT_ID,
                meal_plan_id=plan.id,
                day_index=1,
                slot="morning",
                type="as_planned",
            )
        )
        db.add(
            FoodLog(
                user_id=PATIENT_ID,
                meal_plan_id=plan.id,
                day_index=1,
                slot="noon",
                type="custom",
                note="com pho",
            )
        )
        db.commit()
    finally:
        db.close()

    res = client.get(
        f"/api/v1/doctor/patients/{PATIENT_ID}/compliance?days=14",
        headers=doctor_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["checkins_done"] == 2
    assert data["checkins_as_planned"] == 1
    # morning as_planned (30%) + noon custom (15%) = 45%
    assert data["overall_adherence_pct"] == 45
    by_date = {row["date"]: row["adherence_pct"] for row in data["daily_series"]}
    assert by_date[today.isoformat()] == 45


def test_compliance_dedupes_duplicate_slot_same_vn_day(client, db_session):
    today_vn = vn_today()
    start, _end = vn_day_bounds_utc(day=today_vn)
    db_session.add(
        FoodLog(
            user_id="user_dup",
            slot="morning",
            type="as_planned",
            logged_at=start + timedelta(minutes=10),
        )
    )
    db_session.add(
        FoodLog(
            user_id="user_dup",
            slot="morning",
            type="custom",
            note="trùng",
            logged_at=start + timedelta(minutes=20),
        )
    )
    db_session.flush()

    out = ComplianceService(db_session).get_patient_compliance("user_dup", days=7)
    assert out.checkins_done == 1
    assert out.checkins_as_planned == 0
    # Deduplicated to latest (custom morning = 30 * 0.5 = 15%)
    assert out.overall_adherence_pct == 15


def test_compliance_food_log_utc_evening_counts_on_vn_next_day(client):
    doctor_headers = _login(client, DOCTOR)
    today_vn = vn_today()
    yesterday_vn = today_vn - timedelta(days=1)
    logged_at = (
        datetime(today_vn.year, today_vn.month, today_vn.day, 0, 10, tzinfo=VN_TZ)
        .astimezone(UTC)
        .replace(tzinfo=None)
    )

    from tests.conftest import TestingSessionLocal

    db = TestingSessionLocal()
    try:
        db.add(
            FoodLog(
                user_id=PATIENT_ID,
                slot="evening",
                type="as_planned",
                logged_at=logged_at,
            )
        )
        db.commit()
    finally:
        db.close()

    res = client.get(
        f"/api/v1/doctor/patients/{PATIENT_ID}/compliance?days=7",
        headers=doctor_headers,
    )
    assert res.status_code == 200
    data = res.json()
    by_date = {row["date"]: row["adherence_pct"] for row in data["daily_series"]}
    # 1 main meal (evening as_planned) = 30%
    assert by_date[today_vn.isoformat()] == 30
    assert by_date[yesterday_vn.isoformat()] is None


def test_compliance_weighted_slots_all_combinations(client, db_session):
    """Verify 3 main meals = 30% each, snack = 10%, unlogged = 0%."""
    today_vn = vn_today()
    start, _end = vn_day_bounds_utc(day=today_vn)

    # Day 1: only morning as_planned -> 30%
    db_session.add(
        FoodLog(
            user_id="user_weights",
            slot="morning",
            type="as_planned",
            logged_at=start + timedelta(hours=8),
        )
    )
    db_session.flush()
    out = ComplianceService(db_session).get_patient_compliance("user_weights", days=1)
    assert out.overall_adherence_pct == 30

    # Add noon as_planned -> 30 + 30 = 60%
    db_session.add(
        FoodLog(
            user_id="user_weights",
            slot="noon",
            type="as_planned",
            logged_at=start + timedelta(hours=12),
        )
    )
    db_session.flush()
    out = ComplianceService(db_session).get_patient_compliance("user_weights", days=1)
    assert out.overall_adherence_pct == 60

    # Add evening as_planned -> 30 + 30 + 30 = 90%
    db_session.add(
        FoodLog(
            user_id="user_weights",
            slot="evening",
            type="as_planned",
            logged_at=start + timedelta(hours=18),
        )
    )
    db_session.flush()
    out = ComplianceService(db_session).get_patient_compliance("user_weights", days=1)
    assert out.overall_adherence_pct == 90

    # Add snack as_planned -> 90 + 10 = 100%
    db_session.add(
        FoodLog(
            user_id="user_weights",
            slot="snack",
            type="as_planned",
            logged_at=start + timedelta(hours=15),
        )
    )
    db_session.flush()
    out = ComplianceService(db_session).get_patient_compliance("user_weights", days=1)
    assert out.overall_adherence_pct == 100


def test_compliance_events_include_reminder_and_food_log(client):
    doctor_headers = _login(client, DOCTOR)
    today = date.today()

    from tests.conftest import TestingSessionLocal

    db = TestingSessionLocal()
    try:
        db.add(
            Notification(
                user_id=PATIENT_ID,
                type="manual_reminder",
                title="Nhắc nhở tuân thủ từ bác sĩ",
                body="Nhớ ghi nhận bữa tối nhé.",
                scheduled_at=datetime.combine(today, datetime.min.time().replace(hour=9)),
                status="sent",
                related_ids={},
                payload={"from_doctor": True},
            )
        )
        db.commit()
    finally:
        db.close()

    res = client.get(
        f"/api/v1/doctor/patients/{PATIENT_ID}/compliance?days=14",
        headers=doctor_headers,
    )
    assert res.status_code == 200
    events = res.json()["events"]
    assert any(e["type"] == "reminder" for e in events)
    assert any("Nhớ ghi nhận bữa tối" in e["title"] for e in events)
