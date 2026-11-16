"""Patients edit their own account together with their profile."""

import pytest

from tests.test_api import DOCTOR, PATIENT, _login


def test_patient_saves_identity_and_profile_and_keeps_login(client):
    headers = _login(client, PATIENT)
    saved = client.post("/api/v1/profile", headers=headers, json={
        "full_name": "  Tên mới của bệnh nhân  ", "email": "  PATIENT.NEW@example.com ",
        "age": 35, "gender": "Nữ", "phone": "0901234567", "address": "Hà Nội",
        "disease": ["diabetes_t2"], "target_kcal": 2100,
    })
    assert saved.status_code == 200, saved.text
    assert saved.json()["age"] == 35
    assert saved.json()["phone"] == "0901234567"
    assert saved.json()["target_kcal"] != 2100
    assert saved.json()["proposed_target_kcal"] == 2100
    me = client.get("/api/v1/auth/me", headers=headers).json()
    assert me["full_name"] == "Tên mới của bệnh nhân"
    assert me["email"] == "patient.new@example.com"
    assert me["role"] == "patient"
    _login(client, "patient.new@example.com")
    old = client.post("/api/v1/auth/login", json={"email": PATIENT, "password": "demo1234"})
    assert old.status_code == 401
    doctor = _login(client, DOCTOR)
    visible = client.get(f"/api/v1/doctor/patients/{me['id']}", headers=doctor).json()
    assert visible["name"] == me["full_name"]
    assert visible["email"] == me["email"]


def test_duplicate_email_does_not_partially_save_account_or_profile(client):
    headers = _login(client, PATIENT)
    client.post("/api/v1/profile", headers=headers, json={"age": 40, "phone": "old-phone"})
    before = client.get("/api/v1/auth/me", headers=headers).json()
    response = client.post("/api/v1/profile", headers=headers, json={
        "full_name": "Must not save", "email": "demo_patient_2@example.com",
        "age": 99, "phone": "new-phone",
    })
    assert response.status_code == 409
    assert response.json()["code"] == "EMAIL_EXISTS"
    after = client.get("/api/v1/auth/me", headers=headers).json()
    assert after["full_name"] == before["full_name"]
    assert after["email"] == before["email"]
    profile = client.get("/api/v1/profile/me", headers=headers).json()
    assert profile["age"] == 40 and profile["phone"] == "old-phone"


def test_omitted_identity_keeps_current_account(client):
    headers = _login(client, PATIENT)
    before = client.get("/api/v1/auth/me", headers=headers).json()
    assert client.post("/api/v1/profile", headers=headers, json={"age": 42}).status_code == 200
    after = client.get("/api/v1/auth/me", headers=headers).json()
    assert (before["full_name"], before["email"]) == (after["full_name"], after["email"])


@pytest.mark.parametrize("email", [None, "", "bad-email", "name@@example.com", "x y@example.com"])
def test_invalid_email_rejected_before_updates(client, email):
    headers = _login(client, PATIENT)
    response = client.post("/api/v1/profile", headers=headers, json={"email": email, "full_name": "Must not save"})
    assert response.status_code == 422
    assert client.get("/api/v1/auth/me", headers=headers).json()["email"] == PATIENT


def test_only_authenticated_patient_can_change_own_identity(client):
    patient = _login(client, PATIENT)
    second = _login(client, "demo_patient_2@example.com")
    before = client.get("/api/v1/auth/me", headers=second).json()
    response = client.post("/api/v1/profile", headers=patient, json={
        "full_name": "Self only", "user_id": before["id"], "role": "doctor",
    })
    assert response.status_code == 200
    own = client.get("/api/v1/auth/me", headers=patient).json()
    assert own["full_name"] == "Self only" and own["role"] == "patient"
    assert client.get("/api/v1/auth/me", headers=second).json() == before
    doctor = _login(client, DOCTOR)
    assert client.post("/api/v1/profile", headers=doctor, json={"full_name": "Forbidden"}).status_code == 403
    assert client.post("/api/v1/profile", json={"full_name": "Forbidden"}).status_code == 401
