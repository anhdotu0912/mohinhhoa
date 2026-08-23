"""Tests for patient chat history API — contract api-v1 §11 Chat Sessions."""

from __future__ import annotations

from tests.test_api import DOCTOR, PATIENT, _login


def _create_session(client, headers, title: str = "Cuộc trò chuyện mới"):
    response = client.post(
        "/api/v1/chat/sessions",
        json={"title": title},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_create_and_list_sessions(client):
    headers = _login(client, PATIENT)
    created = _create_session(client, headers, title="Hôm nay ăn gì?")

    listed = client.get("/api/v1/chat/sessions", headers=headers)
    assert listed.status_code == 200
    body = listed.json()
    assert len(body) >= 1
    match = next(s for s in body if s["id"] == created["id"])
    assert match["title"] == "Hôm nay ăn gì?"
    assert match["message_count"] == 0
    assert match["pinned"] is False


def test_get_patch_delete_session(client):
    headers = _login(client, PATIENT)
    created = _create_session(client, headers)

    fetched = client.get(f"/api/v1/chat/sessions/{created['id']}", headers=headers)
    assert fetched.status_code == 200
    assert fetched.json()["messages"] == []

    patched = client.patch(
        f"/api/v1/chat/sessions/{created['id']}",
        json={"title": "Đổi tên", "pinned": True},
        headers=headers,
    )
    assert patched.status_code == 200
    body = patched.json()
    assert body["title"] == "Đổi tên"
    assert body["pinned"] is True

    deleted = client.delete(f"/api/v1/chat/sessions/{created['id']}", headers=headers)
    assert deleted.status_code == 204

    missing = client.get(f"/api/v1/chat/sessions/{created['id']}", headers=headers)
    assert missing.status_code == 404
    assert missing.json()["code"] == "SESSION_NOT_FOUND"


def test_replace_messages_with_meal_preview(client):
    headers = _login(client, PATIENT)
    created = _create_session(client, headers)

    messages = [
        {"id": "user-1", "sender": "user", "text": "Hôm nay tôi nên ăn gì?"},
        {
            "id": "ai-1",
            "sender": "ai",
            "text": "Dựa trên hồ sơ của bạn...",
            "intent": "meal_plan",
            "citations": ["dinh_duong_dai_thao_duong.md"],
            "meal_preview": {
                "date": "2026-08-23",
                "day_index": 0,
                "meal_plan_id": "plan-demo",
                "plan_status": "approved",
                "meals": [
                    {
                        "slot": "breakfast",
                        "label": "Bữa sáng",
                        "items": [
                            {
                                "name": "Yến mạch",
                                "portion": "1 bát",
                                "kcal": 380,
                                "macros": {
                                    "carb_g": 45,
                                    "protein_g": 14,
                                    "fat_g": 12,
                                    "sodium_mg": 80,
                                },
                                "citations": ["dinh_duong_dai_thao_duong.md"],
                            }
                        ],
                    }
                ],
            },
        },
    ]

    saved = client.put(
        f"/api/v1/chat/sessions/{created['id']}/messages",
        json={"messages": messages},
        headers=headers,
    )
    assert saved.status_code == 200, saved.text
    body = saved.json()
    assert len(body["messages"]) == 2
    ai_msg = body["messages"][1]
    assert ai_msg["intent"] == "meal_plan"
    assert ai_msg["meal_preview"]["meal_plan_id"] == "plan-demo"

    listed = client.get("/api/v1/chat/sessions", headers=headers)
    match = next(s for s in listed.json() if s["id"] == created["id"])
    assert match["message_count"] == 2


def test_delete_all_sessions(client):
    headers = _login(client, PATIENT)
    _create_session(client, headers, title="Session A")
    _create_session(client, headers, title="Session B")

    cleared = client.delete("/api/v1/chat/sessions", headers=headers)
    assert cleared.status_code == 204

    listed = client.get("/api/v1/chat/sessions", headers=headers)
    assert listed.status_code == 200
    assert listed.json() == []


def test_session_isolation_between_patients(client):
    headers1 = _login(client, PATIENT)
    headers2 = _login(client, "demo_patient_2@example.com")

    created = _create_session(client, headers1, title="Private session")

    forbidden = client.get(f"/api/v1/chat/sessions/{created['id']}", headers=headers2)
    assert forbidden.status_code == 404
    assert forbidden.json()["code"] == "SESSION_NOT_FOUND"


def test_doctor_cannot_access_chat_sessions(client):
    headers = _login(client, DOCTOR)
    response = client.get("/api/v1/chat/sessions", headers=headers)
    assert response.status_code == 403
