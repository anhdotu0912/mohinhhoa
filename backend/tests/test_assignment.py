"""Doctor ↔ patient assignment: claim queue, isolation, transfer."""

from __future__ import annotations

import pytest

pytestmark = pytest.mark.no_auto_claim

DOCTOR = "demo_doctor@example.com"
DOCTOR_2 = "demo_doctor_2@example.com"
PATIENT = "demo_patient_1@example.com"


def _login(client, email: str, password: str = "demo1234") -> dict:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_unassigned_patients_are_in_claim_queue_not_roster(client):
    headers = _login(client, DOCTOR)
    roster = client.get("/api/v1/doctor/patients", headers=headers)
    assert roster.status_code == 200
    assert roster.json() == []

    queue = client.get("/api/v1/doctor/claim-queue", headers=headers)
    assert queue.status_code == 200, queue.text
    ids = {item["patient_id"] for item in queue.json()}
    assert "demo_patient_1" in ids
    sources = {item["patient_id"]: item["source"] for item in queue.json()}
    assert sources["demo_patient_1"] == "unassigned_pool"


def test_self_register_goes_to_claim_queue(client):
    created = client.post(
        "/api/v1/auth/register",
        json={
            "email": "self.signup@example.com",
            "password": "secret123",
            "full_name": "Tự Đăng Ký",
        },
    )
    assert created.status_code == 201
    patient_id = created.json()["id"]

    headers = _login(client, DOCTOR)
    roster_ids = [p["id"] for p in client.get("/api/v1/doctor/patients", headers=headers).json()]
    assert patient_id not in roster_ids

    queue = client.get("/api/v1/doctor/claim-queue", headers=headers).json()
    match = next(item for item in queue if item["patient_id"] == patient_id)
    assert match["kind"] == "unassigned"
    assert match["source"] == "self_register"

    me = client.get(
        "/api/v1/auth/me",
        headers=_login(client, "self.signup@example.com", "secret123"),
    )
    assert me.status_code == 200
    assert me.json()["assigned_doctor"] is None


def test_doctor_create_patient_assigns_immediately(client):
    headers = _login(client, DOCTOR)
    created = client.post(
        "/api/v1/doctor/patients",
        headers=headers,
        json={
            "email": "ward.patient@example.com",
            "password": "secret123",
            "full_name": "Bệnh Nhân Hộ",
        },
    )
    assert created.status_code == 201, created.text
    patient_id = created.json()["id"]
    assert created.json()["name"] == "Bệnh Nhân Hộ"

    roster_ids = [p["id"] for p in client.get("/api/v1/doctor/patients", headers=headers).json()]
    assert patient_id in roster_ids

    queue_ids = [
        item["patient_id"]
        for item in client.get("/api/v1/doctor/claim-queue", headers=headers).json()
    ]
    assert patient_id not in queue_ids

    other = _login(client, DOCTOR_2)
    other_ids = [p["id"] for p in client.get("/api/v1/doctor/patients", headers=other).json()]
    assert patient_id not in other_ids
    hidden = client.get(f"/api/v1/doctor/patients/{patient_id}", headers=other)
    assert hidden.status_code == 404
    assert hidden.json()["code"] == "PATIENT_NOT_FOUND"


def test_claim_is_exclusive_and_idempotent(client):
    a = _login(client, DOCTOR)
    b = _login(client, DOCTOR_2)

    first = client.post("/api/v1/doctor/patients/demo_patient_1/claim", headers=a)
    assert first.status_code == 200, first.text
    again = client.post("/api/v1/doctor/patients/demo_patient_1/claim", headers=a)
    assert again.status_code == 200

    conflict = client.post("/api/v1/doctor/patients/demo_patient_1/claim", headers=b)
    assert conflict.status_code == 409
    assert conflict.json()["code"] == "ALREADY_ASSIGNED"

    me = client.get("/api/v1/auth/me", headers=_login(client, PATIENT))
    assert me.json()["assigned_doctor"]["id"] == "demo_doctor"
    assert me.json()["assigned_doctor"]["full_name"] == "BS. Minh"


def test_transfer_requires_accept_before_ownership_moves(client):
    a = _login(client, DOCTOR)
    b = _login(client, DOCTOR_2)
    assert client.post("/api/v1/doctor/patients/demo_patient_1/claim", headers=a).status_code == 200

    colleagues = client.get("/api/v1/doctor/colleagues", headers=a)
    assert colleagues.status_code == 200
    assert any(c["id"] == "demo_doctor_2" for c in colleagues.json())
    assert all(c["id"] != "demo_doctor" for c in colleagues.json())

    xfer = client.post(
        "/api/v1/doctor/patients/demo_patient_1/transfer",
        headers=a,
        json={"to_doctor_id": "demo_doctor_2"},
    )
    assert xfer.status_code == 200, xfer.text
    transfer_id = xfer.json()["id"]
    assert xfer.json()["status"] == "pending"

    # Ownership unchanged until accept
    assert client.get("/api/v1/doctor/patients/demo_patient_1", headers=a).status_code == 200
    assert client.get("/api/v1/doctor/patients/demo_patient_1", headers=b).status_code == 404
    me = client.get("/api/v1/auth/me", headers=_login(client, PATIENT))
    assert me.json()["assigned_doctor"]["id"] == "demo_doctor"

    detail = client.get("/api/v1/doctor/patients/demo_patient_1", headers=a).json()
    assert detail["pending_transfer"]["id"] == transfer_id
    assert detail["pending_transfer"]["to_doctor_id"] == "demo_doctor_2"

    queue_b = client.get("/api/v1/doctor/claim-queue", headers=b).json()
    match = next(item for item in queue_b if item["kind"] == "transfer")
    assert match["patient_id"] == "demo_patient_1"
    assert match["transfer_id"] == transfer_id
    assert match["from_doctor_name"] == "BS. Minh"

    accepted = client.post(
        f"/api/v1/doctor/transfers/{transfer_id}/accept",
        headers=b,
    )
    assert accepted.status_code == 200, accepted.text
    assert client.get("/api/v1/doctor/patients/demo_patient_1", headers=a).status_code == 404
    assert client.get("/api/v1/doctor/patients/demo_patient_1", headers=b).status_code == 200

    me = client.get("/api/v1/auth/me", headers=_login(client, PATIENT))
    assert me.json()["assigned_doctor"]["id"] == "demo_doctor_2"
    assert me.json()["assigned_doctor"]["full_name"] == "BS. Lan"


def test_cannot_transfer_to_self(client):
    a = _login(client, DOCTOR)
    assert client.post("/api/v1/doctor/patients/demo_patient_1/claim", headers=a).status_code == 200
    response = client.post(
        "/api/v1/doctor/patients/demo_patient_1/transfer",
        headers=a,
        json={"to_doctor_id": "demo_doctor"},
    )
    assert response.status_code == 400
    assert response.json()["code"] == "INVALID_TRANSFER"
