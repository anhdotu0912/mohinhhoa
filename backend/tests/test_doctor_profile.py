"""Tests for Doctor Profile & Clinical Stats endpoints (contract §8 / §14)."""

from __future__ import annotations

DOCTOR = "demo_doctor@example.com"
PATIENT = "demo_patient_1@example.com"


def _login(client, email: str, password: str = "demo1234") -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_doctor_profile_get_and_put(client):
    headers = _login(client, DOCTOR)

    # Initial GET
    res = client.get("/api/v1/doctor/profile", headers=headers)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["role"] == "doctor"
    assert data["email"] == DOCTOR
    assert "profile" in data
    assert "stats" in data
    assert isinstance(data["stats"]["total_patients"], int)
    assert isinstance(data["stats"]["approved_plans"], int)

    # PUT update
    update_payload = {
        "full_name": "BS. CKI Nguyễn Văn Bình",
        "title": "BS. CKI",
        "specialties": ["Dinh dưỡng lâm sàng", "Nội tiết & Đái tháo đường"],
        "license_number": "CCHN-012345/BYT",
        "workplace": "Khoa Dinh dưỡng & Tiết chế — Bệnh viện Vinmec",
        "years_of_experience": 12,
        "bio": "Chuyên gia dinh dưỡng lâm sàng với hơn 10 năm kinh nghiệm.",
        "phone": "0912345678",
        "accepting_patients": True,
        "consultation_hours": "08:00 - 17:00 (Thứ 2 - Thứ 6)",
        "emergency_contact": "Khoa Cấp cứu / Trực ban Dinh dưỡng",
    }
    put_res = client.put("/api/v1/doctor/profile", json=update_payload, headers=headers)
    assert put_res.status_code == 200, put_res.text
    updated = put_res.json()
    assert updated["full_name"] == "BS. CKI Nguyễn Văn Bình"
    assert updated["profile"]["title"] == "BS. CKI"
    assert updated["profile"]["specialties"] == ["Dinh dưỡng lâm sàng", "Nội tiết & Đái tháo đường"]
    assert updated["profile"]["license_number"] == "CCHN-012345/BYT"
    assert updated["profile"]["workplace"] == "Khoa Dinh dưỡng & Tiết chế — Bệnh viện Vinmec"
    assert updated["profile"]["years_of_experience"] == 12
    assert updated["profile"]["bio"] == "Chuyên gia dinh dưỡng lâm sàng với hơn 10 năm kinh nghiệm."
    assert updated["profile"]["phone"] == "0912345678"
    assert updated["profile"]["accepting_patients"] is True
    assert updated["profile"]["consultation_hours"] == "08:00 - 17:00 (Thứ 2 - Thứ 6)"

    # Check persistence via GET
    get_res = client.get("/api/v1/doctor/profile", headers=headers)
    assert get_res.status_code == 200
    persisted = get_res.json()
    assert persisted["full_name"] == "BS. CKI Nguyễn Văn Bình"
    assert persisted["profile"]["title"] == "BS. CKI"
    assert persisted["profile"]["license_number"] == "CCHN-012345/BYT"


def test_doctor_profile_patient_forbidden(client):
    patient_headers = _login(client, PATIENT)

    get_res = client.get("/api/v1/doctor/profile", headers=patient_headers)
    assert get_res.status_code == 403

    put_res = client.put(
        "/api/v1/doctor/profile",
        json={"title": "BS. Giả mạo"},
        headers=patient_headers,
    )
    assert put_res.status_code == 403


def test_doctor_profile_partial_update(client):
    headers = _login(client, DOCTOR)

    # Update only accepting_patients toggle
    res = client.put(
        "/api/v1/doctor/profile",
        json={"accepting_patients": False},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["profile"]["accepting_patients"] is False

    # Check that previous title remains
    get_res = client.get("/api/v1/doctor/profile", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["profile"]["accepting_patients"] is False
