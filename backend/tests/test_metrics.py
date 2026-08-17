"""Tests for patient metrics history — ADR-013."""

from __future__ import annotations

from tests.test_api import DOCTOR, PATIENT, _login


def test_record_metrics_calculates_bmi_from_profile_height(client):
    headers = _login(client, PATIENT)
    response = client.post(
        "/api/v1/metrics",
        json={"weight": 71.0},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["weight"] == 71.0
    assert body["height"] == 170  # demo_patient_1 seed height
    assert body["bmi"] == 24.6
    assert body["recorded_by"] == "patient"


def test_record_metrics_requires_at_least_one_field(client):
    headers = _login(client, PATIENT)
    response = client.post(
        "/api/v1/metrics",
        json={},
        headers=headers,
    )
    assert response.status_code == 422


def test_metrics_history_ordered_asc(client):
    headers = _login(client, PATIENT)
    client.post("/api/v1/metrics", json={"weight": 72.0}, headers=headers)
    client.post("/api/v1/metrics", json={"weight": 71.5}, headers=headers)

    response = client.get("/api/v1/metrics/history?days=30", headers=headers)
    assert response.status_code == 200
    points = response.json()
    assert len(points) >= 2
    times = [p["recorded_at"] for p in points]
    assert times == sorted(times)


def test_doctor_metrics_creates_history_entry(client):
    doctor_headers = _login(client, DOCTOR)
    patient_id = "demo_patient_1"

    response = client.put(
        f"/api/v1/doctor/patients/{patient_id}/metrics",
        json={"weight": 70.0, "height": 168},
        headers=doctor_headers,
    )
    assert response.status_code == 200, response.text

    patient_headers = _login(client, PATIENT)
    history = client.get("/api/v1/metrics/history?days=30", headers=patient_headers)
    assert history.status_code == 200
    doctor_entries = [p for p in history.json() if p["recorded_by"] == "doctor"]
    assert len(doctor_entries) >= 1
    assert doctor_entries[-1]["weight"] == 70.0


def test_delete_metrics_entry_success(client):
    headers = _login(client, PATIENT)
    create = client.post(
        "/api/v1/metrics",
        json={"weight": 69.5, "blood_pressure": "120/80"},
        headers=headers,
    )
    assert create.status_code == 200, create.text
    entry_id = create.json()["id"]

    delete = client.delete(f"/api/v1/metrics/{entry_id}", headers=headers)
    assert delete.status_code == 204

    history = client.get("/api/v1/metrics/history?days=30", headers=headers)
    assert history.status_code == 200
    ids = [p["id"] for p in history.json()]
    assert entry_id not in ids


def test_delete_metrics_entry_not_found(client):
    headers = _login(client, PATIENT)
    response = client.delete("/api/v1/metrics/nonexistent-entry-id", headers=headers)
    assert response.status_code == 404
    body = response.json()
    assert body["code"] == "METRICS_NOT_FOUND"
