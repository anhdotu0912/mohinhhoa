"""API tests for the BE2 platform layer (auth, profile, meal-plan, alerts,
notifications, dietitian review, chat)."""

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
DIETITIAN = "demo_dietitian@example.com"


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_register_login_flow(client):
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "New.User@Example.com", "password": "secret123", "role": "patient"},
    )
    assert response.status_code == 201, response.text
    assert response.json()["email"] == "new.user@example.com"

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "new.user@example.com", "password": "secret123"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["role"] == "patient"

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

    # 1. Generate 7-day meal plan (DEMO_MOCK).
    response = client.post("/api/v1/meal-plans/generate", headers=headers)
    assert response.status_code == 200, response.text
    plan = response.json()
    assert len(plan["days"]) == 7
    assert plan["status"] == "pending_review"
    assert plan["user_id"] == "demo_patient_1"
    assert plan["citations"] == ["demo_mock"]
    plan_id = plan["id"]

    # Swap shape uses contract alias "from".
    assert plan["swaps"][0]["from"] == "rượu nếp"

    # 2. Meal plan is persisted and retrievable.
    response = client.get(f"/api/v1/meal-plans/{plan_id}", headers=headers)
    assert response.status_code == 200, response.text
    assert response.json()["id"] == plan_id

    response = client.get("/api/v1/meal-plans/me", headers=headers)
    assert response.status_code == 200, response.text
    assert response.json()["id"] == plan_id

    # 3. Metformin × rượu alert is persisted (Nguy hiểm).
    response = client.get("/api/v1/alerts", headers=headers)
    assert response.status_code == 200, response.text
    alerts = response.json()
    assert any(a["severity"] == "Nguy hiểm" and a["drug"] == "metformin" for a in alerts)

    # 4. Notifications materialized: 7×4 reminders + 7 checkins + followup.
    response = client.get("/api/v1/notifications", headers=headers)
    assert response.status_code == 200, response.text
    notifications = response.json()
    reminders = [n for n in notifications if n["type"] == "meal_reminder"]
    checkins = [n for n in notifications if n["type"] == "adherence_checkin"]
    followups = [n for n in notifications if n["type"] == "interaction_followup"]
    assert len(reminders) == 28
    assert len(checkins) == 7
    assert len(followups) >= 1

    # 5. Dietitian sees pending plan and approves it.
    dietitian_headers = _login(client, DIETITIAN)
    response = client.get(
        "/api/v1/dietitian/meal-plans?status=pending_review",
        headers=dietitian_headers,
    )
    assert response.status_code == 200, response.text
    assert plan_id in [p["id"] for p in response.json()]

    response = client.post(
        f"/api/v1/dietitian/meal-plans/{plan_id}/review",
        headers=dietitian_headers,
        json={"action": "approve", "notes": "OK"},
    )
    assert response.status_code == 200, response.text
    review = response.json()
    assert review["status"] == "approved"
    assert review["trust_badge"] == "dietitian_reviewed"

    # 6. Patient sees plan_approved notification + approved status.
    response = client.get("/api/v1/notifications", headers=headers)
    assert any(n["type"] == "plan_approved" for n in response.json())

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
    client.post("/api/v1/meal-plans/generate", headers=headers)

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


def test_dietitian_role_guard(client):
    dietitian_headers = _login(client, DIETITIAN)
    response = client.get("/api/v1/profile/me", headers=dietitian_headers)
    assert response.status_code == 403
    assert response.json()["code"] == "FORBIDDEN"


def test_chat_thin_wrapper(client):
    headers = _login(client, PATIENT)
    response = client.post(
        "/api/v1/chat",
        headers=headers,
        json={"message": "Tạo thực đơn cho tôi"},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["intent"] == "meal_plan"
    assert data["message"]


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
