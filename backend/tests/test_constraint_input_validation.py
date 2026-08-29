"""API + schema validation for clinical constraint numeric ranges and goals."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas.clinical_limits import (
    CARB_PER_MEAL_MAX,
    SALT_DAILY_MAX,
    SODIUM_DAILY_MAX,
    SUGAR_DAILY_MAX,
    TARGET_KCAL_MAX,
    TARGET_KCAL_MIN,
    TREATMENT_GOAL_MAX_LEN,
    TREATMENT_GOALS_MAX_COUNT,
)
from app.schemas.doctor import DoctorConstraintsUpdate
from app.schemas.profile import ProfileUpsert, Restrictions

PATIENT = "demo_patient_1@example.com"
DOCTOR = "demo_doctor@example.com"


def _login(client, email: str, password: str = "demo1234") -> dict:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _patient_id(client, headers: dict) -> str:
    return client.get("/api/v1/auth/me", headers=headers).json()["id"]


DOCTOR_OUT_OF_RANGE = [
    ("target_kcal", TARGET_KCAL_MIN - 1),
    ("target_kcal", TARGET_KCAL_MAX + 1),
    ("carb_per_meal", -1),
    ("carb_per_meal", CARB_PER_MEAL_MAX + 1),
    ("sodium_daily", -1),
    ("sodium_daily", SODIUM_DAILY_MAX + 1),
    ("salt_daily_g", -0.5),
    ("salt_daily_g", SALT_DAILY_MAX + 0.5),
    ("sugar_daily_g", -1),
    ("sugar_daily_g", SUGAR_DAILY_MAX + 1),
]

DOCTOR_BOUNDARIES = [
    ("target_kcal", TARGET_KCAL_MIN),
    ("target_kcal", TARGET_KCAL_MAX),
    ("carb_per_meal", 0),
    ("carb_per_meal", CARB_PER_MEAL_MAX),
    ("sodium_daily", 0),
    ("sodium_daily", SODIUM_DAILY_MAX),
    ("salt_daily_g", 0),
    ("salt_daily_g", SALT_DAILY_MAX),
    ("sugar_daily_g", 0),
    ("sugar_daily_g", SUGAR_DAILY_MAX),
]


@pytest.mark.parametrize("field,value", DOCTOR_OUT_OF_RANGE)
def test_doctor_constraints_out_of_range_422(client, field, value):
    patient_headers = _login(client, PATIENT)
    doctor_headers = _login(client, DOCTOR)
    patient_id = _patient_id(client, patient_headers)
    response = client.put(
        f"/api/v1/doctor/patients/{patient_id}/constraints",
        headers=doctor_headers,
        json={field: value},
    )
    assert response.status_code == 422, response.text


@pytest.mark.parametrize("field,value", DOCTOR_BOUNDARIES)
def test_doctor_constraints_boundary_ok(client, field, value):
    patient_headers = _login(client, PATIENT)
    doctor_headers = _login(client, DOCTOR)
    patient_id = _patient_id(client, patient_headers)
    response = client.put(
        f"/api/v1/doctor/patients/{patient_id}/constraints",
        headers=doctor_headers,
        json={field: value},
    )
    assert response.status_code == 200, response.text
    assert response.json()[field] == value


def test_doctor_constraints_goal_too_short_422(client):
    patient_headers = _login(client, PATIENT)
    doctor_headers = _login(client, DOCTOR)
    patient_id = _patient_id(client, patient_headers)
    response = client.put(
        f"/api/v1/doctor/patients/{patient_id}/constraints",
        headers=doctor_headers,
        json={"treatment_goals": ["ab"]},
    )
    assert response.status_code == 422, response.text


def test_doctor_constraints_too_many_goals_422(client):
    patient_headers = _login(client, PATIENT)
    doctor_headers = _login(client, DOCTOR)
    patient_id = _patient_id(client, patient_headers)
    goals = [f"Mục tiêu hợp lệ số {i}" for i in range(TREATMENT_GOALS_MAX_COUNT + 1)]
    response = client.put(
        f"/api/v1/doctor/patients/{patient_id}/constraints",
        headers=doctor_headers,
        json={"treatment_goals": goals},
    )
    assert response.status_code == 422, response.text


def test_patient_profile_kcal_out_of_range_422(client):
    headers = _login(client, PATIENT)
    profile = client.get("/api/v1/profile/me", headers=headers).json()
    too_low = client.post(
        "/api/v1/profile",
        headers=headers,
        json={**profile, "target_kcal": TARGET_KCAL_MIN - 1},
    )
    assert too_low.status_code == 422, too_low.text
    too_high = client.post(
        "/api/v1/profile",
        headers=headers,
        json={**profile, "target_kcal": TARGET_KCAL_MAX + 1},
    )
    assert too_high.status_code == 422, too_high.text


@pytest.mark.parametrize(
    "field,value",
    [
        ("carb_per_meal", CARB_PER_MEAL_MAX + 1),
        ("sodium_daily", SODIUM_DAILY_MAX + 1),
        ("salt_daily_g", SALT_DAILY_MAX + 1),
        ("sugar_daily_g", SUGAR_DAILY_MAX + 1),
    ],
)
def test_patient_profile_restriction_out_of_range_422(client, field, value):
    headers = _login(client, PATIENT)
    profile = client.get("/api/v1/profile/me", headers=headers).json()
    restrictions = {**(profile.get("restrictions") or {}), field: value}
    response = client.post(
        "/api/v1/profile",
        headers=headers,
        json={**profile, "restrictions": restrictions},
    )
    assert response.status_code == 422, response.text


def test_patient_profile_goal_too_long_422(client):
    headers = _login(client, PATIENT)
    profile = client.get("/api/v1/profile/me", headers=headers).json()
    response = client.post(
        "/api/v1/profile",
        headers=headers,
        json={**profile, "treatment_goals": ["x" * (TREATMENT_GOAL_MAX_LEN + 1)]},
    )
    assert response.status_code == 422, response.text


def test_schema_rejects_out_of_range_without_http():
    with pytest.raises(ValidationError):
        DoctorConstraintsUpdate(target_kcal=799)
    with pytest.raises(ValidationError):
        Restrictions(carb_per_meal=201)
    with pytest.raises(ValidationError):
        ProfileUpsert(target_kcal=4001)
    with pytest.raises(ValidationError):
        ProfileUpsert(treatment_goals=["ab"])


def test_schema_accepts_omitted_clinical_fields():
    payload = ProfileUpsert(disease=["diabetes_t2"], preferences=["thích ăn cơm"])
    assert payload.target_kcal is None
    assert payload.restrictions is None
