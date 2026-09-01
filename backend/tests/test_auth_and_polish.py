"""Tests for auth extras and metrics validation."""

from __future__ import annotations

from urllib.parse import parse_qs, urlparse

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


def test_forgot_password_sends_reset_link(client, monkeypatch):
    captured: dict[str, str] = {}

    def fake_send(to_email: str, reset_url: str) -> None:
        captured["to"] = to_email
        captured["reset_url"] = reset_url

    monkeypatch.setattr("app.services.email.send_password_reset_link", fake_send)

    response = client.post(
        "/api/v1/auth/forgot-password",
        json={"email": PATIENT},
    )
    assert response.status_code == 200
    assert captured["to"] == PATIENT
    assert "/reset-password?token=" in captured["reset_url"]

    token = parse_qs(urlparse(captured["reset_url"]).query)["token"][0]
    old = client.post(
        "/api/v1/auth/login",
        json={"email": PATIENT, "password": "demo1234"},
    )
    assert old.status_code == 200

    reset = client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": "newpass123"},
    )
    assert reset.status_code == 200

    new = client.post(
        "/api/v1/auth/login",
        json={"email": PATIENT, "password": "newpass123"},
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


def test_change_password_success(client):
    headers = _login(client, PATIENT)
    response = client.post(
        "/api/v1/auth/change-password",
        headers=headers,
        json={"current_password": "demo1234", "new_password": "newpass123"},
    )
    assert response.status_code == 200
    assert "thành công" in response.json()["message"].lower()

    old = client.post(
        "/api/v1/auth/login",
        json={"email": PATIENT, "password": "demo1234"},
    )
    assert old.status_code == 401

    new = client.post(
        "/api/v1/auth/login",
        json={"email": PATIENT, "password": "newpass123"},
    )
    assert new.status_code == 200


def test_change_password_wrong_current(client):
    headers = _login(client, PATIENT)
    response = client.post(
        "/api/v1/auth/change-password",
        headers=headers,
        json={"current_password": "sai-mat-khau", "new_password": "newpass123"},
    )
    assert response.status_code == 401
    assert response.json()["code"] == "INVALID_CREDENTIALS"


def test_change_password_same_as_current(client):
    headers = _login(client, PATIENT)
    response = client.post(
        "/api/v1/auth/change-password",
        headers=headers,
        json={"current_password": "demo1234", "new_password": "demo1234"},
    )
    assert response.status_code == 400
    assert response.json()["code"] == "SAME_PASSWORD"


def test_change_password_requires_auth(client):
    response = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "demo1234", "new_password": "newpass123"},
    )
    assert response.status_code == 401


def test_patch_me_full_name_doctor(client):
    headers = _login(client, DOCTOR)
    response = client.patch(
        "/api/v1/auth/me",
        headers=headers,
        json={"full_name": "  BS. Minh Khoa  "},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["full_name"] == "BS. Minh Khoa"
    assert body["role"] == "doctor"

    me = client.get("/api/v1/auth/me", headers=headers)
    assert me.json()["full_name"] == "BS. Minh Khoa"

    patient_headers = _login(client, PATIENT)
    assigned = client.get("/api/v1/auth/me", headers=patient_headers).json()["assigned_doctor"]
    assert assigned["full_name"] == "BS. Minh Khoa"


def test_patch_me_full_name_blank_clears(client):
    headers = _login(client, DOCTOR)
    response = client.patch(
        "/api/v1/auth/me",
        headers=headers,
        json={"full_name": "   "},
    )
    assert response.status_code == 200
    assert response.json()["full_name"] is None


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
