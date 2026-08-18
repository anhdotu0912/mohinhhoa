"""Tests for auth extras and metrics validation."""

from __future__ import annotations

PATIENT = "demo_patient_1@example.com"
DOCTOR = "demo_doctor@example.com"


def _login(client, email: str, password: str = "demo1234") -> dict:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_forgot_password_always_200(client):
    response = client.post(
        "/api/v1/auth/forgot-password",
        json={"email": "missing@example.com"},
    )
    assert response.status_code == 200
    assert "message" in response.json()


def test_forgot_password_emails_new_password(client, monkeypatch):
    captured: dict[str, str] = {}

    def fake_send(to_email: str, new_password: str) -> None:
        captured["to"] = to_email
        captured["password"] = new_password

    monkeypatch.setattr("app.services.email.send_temporary_password", fake_send)

    response = client.post(
        "/api/v1/auth/forgot-password",
        json={"email": PATIENT},
    )
    assert response.status_code == 200
    assert captured["to"] == PATIENT
    assert len(captured["password"]) >= 6

    old = client.post(
        "/api/v1/auth/login",
        json={"email": PATIENT, "password": "demo1234"},
    )
    assert old.status_code == 401

    new = client.post(
        "/api/v1/auth/login",
        json={"email": PATIENT, "password": captured["password"]},
    )
    assert new.status_code == 200


def test_forgot_password_requires_smtp(client, monkeypatch):
    monkeypatch.setattr("app.services.email.is_configured", lambda: False)
    response = client.post(
        "/api/v1/auth/forgot-password",
        json={"email": PATIENT},
    )
    assert response.status_code == 503
    assert response.json()["code"] == "EMAIL_NOT_CONFIGURED"


def test_reset_password_invalid_token(client):
    response = client.post(
        "/api/v1/auth/reset-password",
        json={"token": "invalid-token", "new_password": "newpass123"},
    )
    assert response.status_code == 400
    assert response.json()["code"] == "INVALID_OR_EXPIRED_TOKEN"


def test_metrics_incomplete(client):
    doctor_headers = _login(client, DOCTOR)
    patient_id = client.get("/api/v1/auth/me", headers=_login(client, PATIENT)).json()["id"]
    response = client.put(
        f"/api/v1/doctor/patients/{patient_id}/metrics",
        headers=doctor_headers,
        json={"weight": 70},
    )
    assert response.status_code == 400
    assert response.json()["code"] == "METRICS_INCOMPLETE"


def test_simulate_notifications_idempotent(client):
    headers = _login(client, PATIENT)
    first = client.post("/api/v1/notifications/demo/simulate", headers=headers)
    assert first.status_code == 200
    first_count = len(first.json())

    second = client.post("/api/v1/notifications/demo/simulate", headers=headers)
    assert second.status_code == 200
    assert len(second.json()) == first_count
