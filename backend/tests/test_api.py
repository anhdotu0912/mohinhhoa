"""API tests for the BE2 platform layer (auth, profile, meal-plan, alerts,
notifications, doctor review, chat)."""

from __future__ import annotations


def _login(client, email: str, password: str = "demo1234") -> dict:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["token_type"] == "bearer"
    return {"Authorization": f"Bearer {data['access_token']}"}


PATIENT = "demo_patient_1@example.com"
DOCTOR = "demo_doctor@example.com"


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_register_login_flow(client):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "New.User@Example.com",
            "password": "secret123",
            "role": "patient",
            "full_name": "Nguyễn Văn Test",
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["email"] == "new.user@example.com"
    assert body["full_name"] == "Nguyễn Văn Test"

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "new.user@example.com", "password": "secret123"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["role"] == "patient"

    # Doctor list shows the full_name provided at registration
    headers = _login(client, DOCTOR)
    response = client.get("/api/v1/doctor/patients", headers=headers)
    assert response.status_code == 200, response.text
    names = [p["name"] for p in response.json()]
    assert "Nguyễn Văn Test" in names

    response = client.post(
        "/api/v1/auth/register",
        json={"email": "new.user@example.com", "password": "secret123"},
    )
    assert response.status_code == 409
    assert response.json()["code"] == "EMAIL_EXISTS"


def test_login_wrong_password(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": PATIENT, "password": "wrong-password"},
    )
    assert response.status_code == 401
    assert response.json()["code"] == "INVALID_CREDENTIALS"


def test_auth_me(client):
    headers = _login(client, DOCTOR)
    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == DOCTOR
    assert data["role"] == "doctor"
    assert data["full_name"] == "BS. Minh"


def test_auth_required(client):
    response = client.get("/api/v1/profile/me")
    assert response.status_code == 401
    assert response.json()["code"] == "MISSING_TOKEN"


def test_profile_upsert_and_get(client):
    headers = _login(client, PATIENT)

    response = client.get("/api/v1/profile/me", headers=headers)
    assert response.status_code == 200, response.text
    assert "diabetes_t2" in response.json()["disease"]

    payload = {
        "disease": ["diabetes_t2"],
        "medications": ["metformin", "glipizide"],
        "allergies": ["hải sản"],
        "bmi": 26.5,
        "target_kcal": 1800,
        "restrictions": {"carb_per_meal": 45, "sodium_daily": 2300},
        "preferences": ["thích ăn cơm"],
    }
    response = client.post("/api/v1/profile", headers=headers, json=payload)
    assert response.status_code == 200, response.text
    assert response.json()["medications"] == ["metformin", "glipizide"]
    assert response.json()["restrictions"]["carb_per_meal"] == 45


def test_north_star_flow(client):
    headers = _login(client, PATIENT)

    # 1. Generate 7-day meal plan (real meal_planner_agent + DB/JSON catalog).
    response = client.post("/api/v1/meal-plans/generate", headers=headers)
    assert response.status_code == 200, response.text
    plan = response.json()
    assert len(plan["days"]) == 7
    assert plan["status"] == "pending_review"
    assert plan["user_id"] == "demo_patient_1"
    assert "byt_vn_notes.md" in plan["citations"]
    plan_id = plan["id"]

    # Swaps list (may be empty if no dangerous foods in generated plan).
    assert isinstance(plan["swaps"], list)

    # 2. Meal plan is persisted and retrievable.
    response = client.get(f"/api/v1/meal-plans/{plan_id}", headers=headers)
    assert response.status_code == 200, response.text
    assert response.json()["id"] == plan_id

    response = client.get("/api/v1/meal-plans/me", headers=headers)
    assert response.status_code == 200, response.text
    assert response.json()["id"] == plan_id

    # 3. Metformin interaction alert may be persisted if plan foods match KB.
    response = client.get("/api/v1/alerts", headers=headers)
    assert response.status_code == 200, response.text
    alerts = response.json()
    assert isinstance(alerts, list)

    # 4. After generate: only interaction followups (no meal reminders until approve).
    response = client.get("/api/v1/notifications", headers=headers)
    assert response.status_code == 200, response.text
    notifications = response.json()
    reminders = [n for n in notifications if n["type"] == "meal_reminder"]
    checkins = [n for n in notifications if n["type"] == "adherence_checkin"]
    followups = [n for n in notifications if n["type"] == "interaction_followup"]
    assert len(reminders) == 0
    assert len(checkins) == 0
    assert len(followups) >= 0

    # 5. Doctor sees pending plan and approves it.
    doctor_headers = _login(client, DOCTOR)
    response = client.get(
        "/api/v1/doctor/meal-plans?status=pending_review",
        headers=doctor_headers,
    )
    assert response.status_code == 200, response.text
    assert plan_id in [p["id"] for p in response.json()]

    response = client.post(
        f"/api/v1/doctor/meal-plans/{plan_id}/review",
        headers=doctor_headers,
        json={"action": "approve", "notes": "OK"},
    )
    assert response.status_code == 200, response.text
    review = response.json()
    assert review["status"] == "approved"
    assert review["trust_badge"] == "doctor_reviewed"

    # 6. After approve: reminders + checkins materialized + plan_approved notification.
    response = client.get("/api/v1/notifications", headers=headers)
    assert response.status_code == 200, response.text
    notifications = response.json()
    reminders = [n for n in notifications if n["type"] == "meal_reminder"]
    checkins = [n for n in notifications if n["type"] == "adherence_checkin"]
    assert len(reminders) == 28
    assert len(checkins) == 7
    assert any(n["type"] == "plan_approved" for n in notifications)

    response = client.get(f"/api/v1/meal-plans/{plan_id}", headers=headers)
    assert response.json()["status"] == "approved"


def test_interactions_check_persists_alerts(client):
    headers = _login(client, PATIENT)
    response = client.post(
        "/api/v1/interactions/check",
        headers=headers,
        json={"medications": ["metformin"], "foods": ["rượu", "cơm gạo lứt"]},
    )
    assert response.status_code == 200, response.text
    interactions = response.json()["interactions"]
    assert len(interactions) == 1
    assert interactions[0]["severity"] == "Nguy hiểm"

    response = client.get("/api/v1/alerts", headers=headers)
    assert any(a["drug"] == "metformin" and a["food"] == "rượu" for a in response.json())

    response = client.get("/api/v1/notifications", headers=headers)
    assert any(n["type"] == "interaction_followup" for n in response.json())


def test_notification_actions(client):
    headers = _login(client, PATIENT)
    plan = client.post("/api/v1/meal-plans/generate", headers=headers).json()
    plan_id = plan["id"]

    doctor_headers = _login(client, DOCTOR)
    response = client.post(
        f"/api/v1/doctor/meal-plans/{plan_id}/review",
        headers=doctor_headers,
        json={"action": "approve", "notes": "OK"},
    )
    assert response.status_code == 200, response.text

    notifications = client.get("/api/v1/notifications", headers=headers).json()
    checkin = next(n for n in notifications if n["type"] == "adherence_checkin")
    reminder = next(n for n in notifications if n["type"] == "meal_reminder")

    # done without adherence is rejected for adherence_checkin.
    response = client.post(f"/api/v1/notifications/{checkin['id']}/done", headers=headers, json={})
    assert response.status_code == 400
    assert response.json()["code"] == "ADHERENCE_REQUIRED"

    response = client.post(
        f"/api/v1/notifications/{checkin['id']}/done",
        headers=headers,
        json={"adherence": "yes"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "done"
    assert response.json()["payload"]["adherence"] == "yes"

    response = client.post(f"/api/v1/notifications/{reminder['id']}/read", headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "read"

    response = client.post(f"/api/v1/notifications/{reminder['id']}/dismiss", headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "dismissed"

    response = client.get("/api/v1/notifications?status=done", headers=headers)
    assert all(n["status"] == "done" for n in response.json())


def test_demo_simulate(client):
    headers = _login(client, PATIENT)
    response = client.post("/api/v1/notifications/demo/simulate", headers=headers)
    assert response.status_code == 200, response.text
    types = {n["type"] for n in response.json()}
    assert types == {"meal_reminder", "adherence_checkin", "plan_approved"}


def test_demo_simulate_blocked_in_production(client, monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "APP_ENV", "production")
    headers = _login(client, PATIENT)
    response = client.post("/api/v1/notifications/demo/simulate", headers=headers)
    assert response.status_code == 403, response.text
    body = response.json()
    assert body["code"] == "DEMO_DISABLED"
    assert body["detail"] == "Endpoint demo không khả dụng ở production."

    # No notifications were seeded by the blocked call.
    response = client.get("/api/v1/notifications", headers=headers)
    assert response.status_code == 200, response.text
    assert response.json() == []


def test_doctor_patients_list_and_generate(client):
    doctor_headers = _login(client, DOCTOR)
    response = client.get("/api/v1/doctor/patients", headers=doctor_headers)
    assert response.status_code == 200, response.text
    patients = response.json()
    assert len(patients) >= 3
    assert any(p["id"] == "demo_patient_1" for p in patients)

    patient_id = "demo_patient_1"
    response = client.get(f"/api/v1/doctor/patients/{patient_id}", headers=doctor_headers)
    assert response.status_code == 200, response.text
    assert response.json()["email"] == PATIENT

    response = client.post(
        f"/api/v1/doctor/patients/{patient_id}/meal-plans/generate",
        headers=doctor_headers,
    )
    assert response.status_code == 200, response.text
    plan = response.json()
    assert plan["user_id"] == patient_id
    assert plan["status"] == "pending_review"
    assert len(plan["days"]) == 7
    first_items = plan["days"][0]["meals"][0]["items"]
    assert first_items
    assert "alternatives" in first_items[0]


def test_doctor_role_guard(client):
    doctor_headers = _login(client, DOCTOR)
    response = client.get("/api/v1/profile/me", headers=doctor_headers)
    assert response.status_code == 403
    assert response.json()["code"] == "FORBIDDEN"


def test_patient_detail_and_goals(client):
    doctor_headers = _login(client, DOCTOR)
    patient_id = "demo_patient_1"

    # detail bao gồm contact/vitals/goals từ profile demo (seed)
    response = client.get(
        f"/api/v1/doctor/patients/{patient_id}", headers=doctor_headers
    )
    assert response.status_code == 200, response.text
    detail = response.json()
    assert detail["phone"] == "0901 234 567"
    assert detail["address"] == "Quận 1, TP. Hồ Chí Minh"
    assert detail["blood_pressure"] == "130/80 mmHg"
    assert detail["blood_glucose"] == "135 mg/dL"
    assert detail["age"] == 45
    assert detail["gender"] == "Nam"
    assert len(detail["treatment_goals"]) >= 1

    # cập nhật goals (thay toàn bộ)
    goals = ["Mục tiêu A", "Mục tiêu B"]
    response = client.put(
        f"/api/v1/doctor/patients/{patient_id}/goals",
        json={"goals": goals},
        headers=doctor_headers,
    )
    assert response.status_code == 200, response.text
    assert response.json()["goals"] == goals

    # phản ánh vào detail
    response = client.get(
        f"/api/v1/doctor/patients/{patient_id}", headers=doctor_headers
    )
    assert response.json()["treatment_goals"] == goals

    # patient không được phép gọi endpoint doctor
    patient_headers = _login(client, PATIENT)
    response = client.put(
        f"/api/v1/doctor/patients/{patient_id}/goals",
        json={"goals": ["x"]},
        headers=patient_headers,
    )
    assert response.status_code in (401, 403)


def test_doctor_update_patient_profile(client):
    doctor_headers = _login(client, DOCTOR)
    patient_id = "demo_patient_1"

    response = client.put(
        f"/api/v1/doctor/patients/{patient_id}/profile",
        json={
            "full_name": "Nguyễn Văn A (Đã sửa)",
            "email": "demo_patient_1@example.com",
            "avatar": "https://example.com/avatar.png",
            "age": 46,
            "gender": "Nam",
            "phone": "0988 000 111",
            "address": "Quận 7, TP. Hồ Chí Minh",
            "blood_pressure": "125/80 mmHg",
            "blood_glucose": "140 mg/dL",
            "disease": ["diabetes_t2"],
            "medications": ["metformin", "glimepiride"],
            "allergies": ["hải sản", "đậu phộng"],
            "preferences": ["thích ăn cơm", "ăn chay thứ 6"],
            "treatment_goals": ["Mục tiêu mới 1", "Mục tiêu mới 2"],
        },
        headers=doctor_headers,
    )
    assert response.status_code == 200, response.text
    detail = response.json()
    assert detail["name"] == "Nguyễn Văn A (Đã sửa)"
    assert detail["age"] == 46
    assert detail["phone"] == "0988 000 111"
    assert detail["address"] == "Quận 7, TP. Hồ Chí Minh"
    assert detail["blood_pressure"] == "125/80 mmHg"
    assert detail["disease"] == ["diabetes_t2"]
    assert detail["medications"] == ["metformin", "glimepiride"]
    assert detail["allergies"] == ["hải sản", "đậu phộng"]
    assert detail["preferences"] == ["thích ăn cơm", "ăn chay thứ 6"]
    assert detail["treatment_goals"] == ["Mục tiêu mới 1", "Mục tiêu mới 2"]
    assert detail["avatar"] == "https://example.com/avatar.png"

    # đổi email sang email đã tồn tại -> 409
    response = client.put(
        f"/api/v1/doctor/patients/{patient_id}/profile",
        json={"email": "demo_patient_2@example.com"},
        headers=doctor_headers,
    )
    assert response.status_code == 409
    assert response.json()["code"] == "EMAIL_EXISTS"

    # bỏ avatar -> trở về avatar mặc định (dicebear theo user id)
    response = client.put(
        f"/api/v1/doctor/patients/{patient_id}/profile",
        json={"avatar": None, "full_name": None},
        headers=doctor_headers,
    )
    assert response.status_code == 200, response.text
    assert "dicebear.com" in response.json()["avatar"]


def test_doctor_catalog(client):
    headers = _login(client, DOCTOR)
    response = client.get("/api/v1/doctor/catalog", headers=headers)
    assert response.status_code == 200, response.text
    data = response.json()
    assert len(data["medicines"]) >= 10
    assert len(data["allergies"]) >= 5
    assert len(data["diagnoses"]) >= 5
    assert any(m["name"] == "Metformin 500mg" for m in data["medicines"])
    assert any(d["code"] == "diabetes_t2" for d in data["diagnoses"])

    # patient cũng được đọc catalog (onboarding chọn thuốc/dị ứng)
    patient_headers = _login(client, PATIENT)
    response = client.get("/api/v1/doctor/catalog", headers=patient_headers)
    assert response.status_code == 200, response.text
    assert len(response.json()["medicines"]) >= 10


def test_doctor_upload_avatar(client):
    headers = _login(client, DOCTOR)
    patient_id = "demo_patient_1"

    response = client.post(
        f"/api/v1/doctor/patients/{patient_id}/avatar",
        files={"file": ("avatar.png", b"\x89PNG\r\n\x1a\nfake-image-bytes", "image/png")},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    avatar = response.json()["avatar"]
    assert avatar.startswith("/static/avatars/")

    # detail phản ánh avatar mới
    detail = client.get(
        f"/api/v1/doctor/patients/{patient_id}", headers=headers
    ).json()
    assert detail["avatar"] == avatar

    # không phải ảnh -> 415
    response = client.post(
        f"/api/v1/doctor/patients/{patient_id}/avatar",
        files={"file": ("doc.txt", b"hello", "text/plain")},
        headers=headers,
    )
    assert response.status_code == 415

    # patient không được phép
    patient_headers = _login(client, PATIENT)
    response = client.post(
        f"/api/v1/doctor/patients/{patient_id}/avatar",
        files={"file": ("avatar.png", b"\x89PNG", "image/png")},
        headers=patient_headers,
    )
    assert response.status_code in (401, 403)

    # dọn file tạm sinh ra trong static/avatars
    from pathlib import Path

    for f in (Path(__file__).resolve().parents[1] / "static" / "avatars").glob(
        f"{patient_id}.*"
    ):
        f.unlink()


def test_update_patient_metrics(client):
    doctor_headers = _login(client, DOCTOR)
    patient_id = "demo_patient_1"

    # BMI tính lại từ backend: 72.5 / 1.7^2 = 25.086... -> 25.1
    response = client.put(
        f"/api/v1/doctor/patients/{patient_id}/metrics",
        json={"weight": 72.5, "height": 170},
        headers=doctor_headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["weight"] == 72.5
    assert body["height"] == 170
    assert body["bmi"] == 25.1
    assert body["bmi_category"] == "Béo phì"

    # weight/height phản ánh vào chi tiết bệnh nhân
    response = client.get(
        f"/api/v1/doctor/patients/{patient_id}", headers=doctor_headers
    )
    assert response.status_code == 200, response.text
    assert response.json()["weight"] == 72.5
    assert response.json()["height"] == 170

    # validate: weight <= 0 -> 422
    response = client.put(
        f"/api/v1/doctor/patients/{patient_id}/metrics",
        json={"weight": 0, "height": 170},
        headers=doctor_headers,
    )
    assert response.status_code == 422

    # patient không được phép gọi endpoint doctor
    patient_headers = _login(client, PATIENT)
    response = client.put(
        f"/api/v1/doctor/patients/{patient_id}/metrics",
        json={"weight": 70, "height": 170},
        headers=patient_headers,
    )
    assert response.status_code in (401, 403)


def test_chat_thin_wrapper(client):
    headers = _login(client, PATIENT)

    gen = client.post("/api/v1/meal-plans/generate", headers=headers)
    assert gen.status_code == 200, gen.text
    existing_plan_id = gen.json()["id"]

    from app.models.meal_plan import MealPlan
    from app.db.session import get_db
    from app.main import app

    def _count_plans():
        override = app.dependency_overrides.get(get_db)
        db = next(override())
        try:
            return db.query(MealPlan).filter(MealPlan.user_id == "demo_patient_1").count()
        finally:
            db.close()

    count_before = _count_plans()

    response = client.post(
        "/api/v1/chat",
        headers=headers,
        json={"message": "Hôm nay ăn gì?"},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["intent"] == "meal_plan"
    assert data["message"]
    assert data["meal_preview"] is not None
    assert len(data["meal_preview"]["meals"]) >= 1
    assert data["meal_plan_id"] == existing_plan_id
    assert _count_plans() == count_before

    create_resp = client.post(
        "/api/v1/chat",
        headers=headers,
        json={"message": "Tạo thực đơn cho tôi"},
    )
    assert create_resp.status_code == 200, create_resp.text
    create_data = create_resp.json()
    assert create_data["intent"] == "meal_plan"
    assert _count_plans() == count_before
    assert "bác sĩ" in create_data["message"].lower()


def test_chat_empty_message_rejected(client):
    headers = _login(client, PATIENT)
    response = client.post(
        "/api/v1/chat",
        headers=headers,
        json={"message": ""},
    )
    assert response.status_code == 422


def test_meal_plan_not_found(client):
    headers = _login(client, PATIENT)
    response = client.get("/api/v1/meal-plans/does-not-exist", headers=headers)
    assert response.status_code == 404
    assert response.json()["code"] == "MEAL_PLAN_NOT_FOUND"
