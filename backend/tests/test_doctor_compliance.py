"""Doctor compliance aggregation endpoints — spec 10, ADR-008."""

from __future__ import annotations

from datetime import date, datetime, timedelta

from app.models.alert import Alert
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


def test_compliance_patient_not_found(client):
    doctor_headers = _login(client, DOCTOR)
    res = client.get(
        "/api/v1/doctor/patients/nonexistent/compliance",
        headers=doctor_headers,
    )
    assert res.status_code == 404
