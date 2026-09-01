"""Tests for chat escalation HITL (patient → doctor inbox thread)."""

from __future__ import annotations

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


def _create_session(client, headers: dict) -> str:
    created = client.post("/api/v1/chat/sessions", headers=headers, json={})
    assert created.status_code == 201, created.text
    return created.json()["id"]


def _seed_turn(
    client,
    headers: dict,
    session_id: str,
    *,
    intent: str = "unknown",
    citations: list | None = None,
    question: str = "Xoài ăn được không?",
    answer: str = "Tôi không chắc chắn về câu hỏi này.",
    unmatched: list | None = None,
    correction_reason: str | None = None,
    guardrail: bool = False,
) -> tuple[str, str]:
    user_id = "user-msg-1"
    ai_id = "ai-msg-1"
    payload = {
        "messages": [
            {"id": user_id, "sender": "user", "text": question},
            {
                "id": ai_id,
                "sender": "ai",
                "text": answer,
                "intent": intent,
                "citations": citations or [],
                "guardrail_triggered": guardrail,
                "correction_reason": correction_reason,
                "unmatched_pairs": unmatched or [],
            },
        ]
    }
    saved = client.put(
        f"/api/v1/chat/sessions/{session_id}/messages",
        headers=headers,
        json=payload,
    )
    assert saved.status_code == 200, saved.text
    return user_id, ai_id


def test_create_escalation_and_doctor_thread(client):
    patient_headers = _login(client, PATIENT)
    doctor_headers = _login(client, DOCTOR)
    session_id = _create_session(client, patient_headers)
    _, ai_id = _seed_turn(client, patient_headers, session_id)

    created = client.post(
        "/api/v1/chat/escalations",
        headers=patient_headers,
        json={
            "session_id": session_id,
            "ai_message_id": ai_id,
            "note": "Nhờ bác sĩ xem giúp",
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["reason"] == "unknown"
    assert body["status"] == "waiting_doctor"
    assert body["notification_id"]
    esc_id = body["id"]

    notifs = client.get("/api/v1/notifications", headers=patient_headers)
    assert notifs.status_code == 200
    types = [n["type"] for n in notifs.json()]
    assert "escalation_sent" in types
    sent = next(n for n in notifs.json() if n["type"] == "escalation_sent")
    assert sent["related_ids"]["escalation_id"] == esc_id

    listed = client.get("/api/v1/doctor/escalations", headers=doctor_headers)
    assert listed.status_code == 200, listed.text
    assert any(item["id"] == esc_id for item in listed.json())

    reply = client.post(
        f"/api/v1/doctor/escalations/{esc_id}/messages",
        headers=doctor_headers,
        json={"body": "Nên ăn xoài chín, khẩu phần nhỏ sau bữa."},
    )
    assert reply.status_code == 200, reply.text
    assert reply.json()["status"] == "waiting_patient"
    assert any(m["sender"] == "doctor" for m in reply.json()["messages"])

    notifs2 = client.get("/api/v1/notifications", headers=patient_headers)
    assert any(n["type"] == "escalation_reply" for n in notifs2.json())

    follow = client.post(
        f"/api/v1/chat/escalations/{esc_id}/messages",
        headers=patient_headers,
        json={"body": "Vậy buổi sáng ăn được không?"},
    )
    assert follow.status_code == 200, follow.text
    assert follow.json()["status"] == "waiting_doctor"

    resolved = client.post(
        f"/api/v1/doctor/escalations/{esc_id}/resolve",
        headers=doctor_headers,
    )
    assert resolved.status_code == 200, resolved.text
    assert resolved.json()["status"] == "resolved"

    open_list = client.get("/api/v1/doctor/escalations", headers=doctor_headers)
    assert all(item["id"] != esc_id for item in open_list.json())


def test_join_open_thread_instead_of_second_job(client):
    patient_headers = _login(client, PATIENT)
    session_id = _create_session(client, patient_headers)
    _, ai_id = _seed_turn(client, patient_headers, session_id)

    first = client.post(
        "/api/v1/chat/escalations",
        headers=patient_headers,
        json={"session_id": session_id, "ai_message_id": ai_id, "note": "Lần 1"},
    )
    assert first.status_code == 201, first.text

    client.put(
        f"/api/v1/chat/sessions/{session_id}/messages",
        headers=patient_headers,
        json={
            "messages": [
                {"id": "user-msg-1", "sender": "user", "text": "Xoài ăn được không?"},
                {
                    "id": "ai-msg-1",
                    "sender": "ai",
                    "text": "Tôi không chắc.",
                    "intent": "unknown",
                },
                {"id": "user-msg-2", "sender": "user", "text": "Còn sầu riêng thì sao?"},
                {
                    "id": "ai-msg-2",
                    "sender": "ai",
                    "text": "Tôi không tìm thấy nguồn tham khảo phù hợp",
                    "intent": "rag_qa",
                    "citations": [],
                    "guardrail_triggered": True,
                    "correction_reason": "missing_citations",
                },
            ]
        },
    )
    second = client.post(
        "/api/v1/chat/escalations",
        headers=patient_headers,
        json={"session_id": session_id, "ai_message_id": "ai-msg-2", "note": "Lần 2"},
    )
    assert second.status_code == 201, second.text
    assert second.json()["id"] == first.json()["id"]
    kinds = [m["kind"] for m in second.json()["messages"]]
    assert "context" in kinds


def test_refuse_missing_citations_and_unmatched(client):
    patient_headers = _login(client, PATIENT)
    session_id = _create_session(client, patient_headers)

    _, ai_id = _seed_turn(
        client,
        patient_headers,
        session_id,
        intent="refuse",
        question="Tăng liều metformin giúp tôi",
        answer="Xin lỗi, tôi không thể hỗ trợ yêu cầu này.",
    )
    created = client.post(
        "/api/v1/chat/escalations",
        headers=patient_headers,
        json={"session_id": session_id, "ai_message_id": ai_id},
    )
    assert created.status_code == 201, created.text
    assert created.json()["reason"] == "refuse"


def test_not_eligible_for_confident_rag(client):
    patient_headers = _login(client, PATIENT)
    session_id = _create_session(client, patient_headers)
    _, ai_id = _seed_turn(
        client,
        patient_headers,
        session_id,
        intent="rag_qa",
        citations=["byt_vn_notes.md"],
        question="Rau muống có tốt không?",
        answer="Người bệnh ĐTĐ nên ăn rau xanh.",
    )
    created = client.post(
        "/api/v1/chat/escalations",
        headers=patient_headers,
        json={"session_id": session_id, "ai_message_id": ai_id},
    )
    assert created.status_code == 400, created.text
    assert created.json()["code"] == "ESCALATION_NOT_ELIGIBLE"


def test_emergency_is_not_eligible(client):
    patient_headers = _login(client, PATIENT)
    session_id = _create_session(client, patient_headers)
    _, ai_id = _seed_turn(
        client,
        patient_headers,
        session_id,
        intent="unknown",
        question="Tôi đói cồn cào, tay run lẩy bẩy, vã mồ hôi lạnh",
        answer="Áp dụng quy tắc 15-15",
    )
    created = client.post(
        "/api/v1/chat/escalations",
        headers=patient_headers,
        json={"session_id": session_id, "ai_message_id": ai_id},
    )
    assert created.status_code == 400
    assert created.json()["code"] == "ESCALATION_NOT_ELIGIBLE"


def test_unassigned_patient_cannot_escalate(client):
    patient_headers = _login(client, "demo_patient_5@example.com")
    session_id = _create_session(client, patient_headers)
    _, ai_id = _seed_turn(client, patient_headers, session_id)
    created = client.post(
        "/api/v1/chat/escalations",
        headers=patient_headers,
        json={"session_id": session_id, "ai_message_id": ai_id},
    )
    assert created.status_code == 400
    assert created.json()["code"] == "NO_ASSIGNED_DOCTOR"
