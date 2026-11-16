"""Tests for POST /chat/stream SSE endpoint and stream_agent_events."""

from __future__ import annotations

import json
from unittest.mock import patch

from app.agents.streaming import stream_agent_events
from app.schemas.meal_plan import AgentRunInput


def _login(client, email: str, password: str = "demo1234") -> dict:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    return {"Authorization": f"Bearer {data['access_token']}"}


def _parse_sse_body(text: str) -> list[dict]:
    events: list[dict] = []
    for block in text.split("\n\n"):
        line = block.strip()
        if not line.startswith("data:"):
            continue
        payload = line[5:].strip()
        if payload:
            events.append(json.loads(payload))
    return events


def _seed_plan(db_session, user_id: str = "demo_patient_1"):
    from app.agents.meal_planner_agent import generate_meal_plan as build_plan
    from app.db.init_db import seed_demo_accounts
    from app.models.user import User
    from app.services.meal_plan_service import get_profile, persist_generated_plan

    if db_session.query(User).filter(User.id == user_id).first() is None:
        seed_demo_accounts(db_session)
        db_session.commit()

    profile = get_profile(db_session, user_id)
    plan = build_plan(profile, db=db_session)
    return persist_generated_plan(db_session, user_id, plan)


class TestStreamAgentEventsUnit:
    @patch("app.agents.streaming.time.sleep")
    def test_rag_qa_no_llm_key_yields_tokens_and_done(self, _sleep, db_session):
        from app.db.init_db import seed_demo_accounts

        seed_demo_accounts(db_session)
        db_session.commit()

        events = list(
            stream_agent_events(
                AgentRunInput(
                    user_id="demo_patient_1",
                    message="Carbohydrate nên ăn bao nhiêu?",
                    force_intent="rag_qa",
                ),
                db=db_session,
            )
        )

        types = [e["type"] for e in events]
        assert "status" in types
        assert "intent" in types
        assert types.count("intent") == 1
        assert "token" in types
        assert types[-1] == "done" or "error" in types
        done = next(e for e in events if e["type"] == "done")
        assert done["data"]["intent"] == "rag_qa"
        assert done["data"]["message"]

    @patch("app.agents.streaming.time.sleep")
    def test_correction_on_unsafe_answer(self, _sleep, db_session):
        from app.db.init_db import seed_demo_accounts

        seed_demo_accounts(db_session)
        db_session.commit()

        def _unsafe_unknown(state):
            return {
                "answer": "Bạn nên đổi thuốc ngay lập tức.",
                "citations": [],
            }

        with patch.dict(
            "app.agents.streaming._INTENT_NODE_HANDLERS",
            {"unknown": _unsafe_unknown},
        ):
            events = list(
                stream_agent_events(
                    AgentRunInput(
                        user_id="demo_patient_1",
                        message="test unsafe",
                        force_intent="unknown",
                    ),
                    db=db_session,
                )
            )

        correction = next((e for e in events if e["type"] == "correction"), None)
        assert correction is not None
        assert correction["reason"] == "unsafe_recommendation"
        assert "bác sĩ" in correction["message"].lower()

        done = next(e for e in events if e["type"] == "done")
        assert done["data"]["message"] == correction["message"]
        assert done["data"]["guardrail_triggered"] is True


class TestChatStreamHTTP:
    @patch("app.agents.streaming.time.sleep")
    def test_chat_stream_meal_plan_sse_sequence(self, _sleep, client, db_session):
        headers = _login(client, "demo_patient_1@example.com")

        gen = client.post("/api/v1/meal-plans/generate", headers=headers)
        assert gen.status_code == 200, gen.text

        with client.stream(
            "POST",
            "/api/v1/chat/stream",
            headers=headers,
            json={"message": "Hôm nay ăn gì?"},
        ) as response:
            assert response.status_code == 200
            assert "text/event-stream" in response.headers.get("content-type", "")
            body = response.read().decode("utf-8")

        events = _parse_sse_body(body)
        types = [e["type"] for e in events]

        assert "status" in types
        assert "intent" in types
        assert any(e["type"] == "intent" and e["intent"] == "meal_plan" for e in events)
        assert "token" in types
        assert "done" in types

        done = next(e for e in events if e["type"] == "done")
        assert done["data"]["meal_preview"] is None
        assert "đang chờ bác sĩ duyệt" in done["data"]["message"]
        assert done["data"]["intent"] == "meal_plan"

    @patch("app.agents.streaming.time.sleep")
    def test_chat_stream_rag_qa_via_http(self, _sleep, client):
        headers = _login(client, "demo_patient_1@example.com")

        with client.stream(
            "POST",
            "/api/v1/chat/stream",
            headers=headers,
            json={"message": "Bệnh tiểu đường nên hạn chế đường không?"},
        ) as response:
            assert response.status_code == 200
            body = response.read().decode("utf-8")

        events = _parse_sse_body(body)
        assert any(e["type"] == "done" for e in events)
        done = next(e for e in events if e["type"] == "done")
        assert done["data"]["message"]

    @patch("app.agents.streaming.time.sleep")
    def test_chat_stream_weekly_compliance_done_payload(self, _sleep, client, db_session):
        from datetime import date, datetime

        from app.models.notification import Notification

        headers = _login(client, "demo_patient_1@example.com")
        today = date.today()
        db_session.add(
            Notification(
                user_id="demo_patient_1",
                type="adherence_checkin",
                title="Check-in",
                body="Test",
                scheduled_at=datetime.combine(today, datetime.min.time().replace(hour=21)),
                status="done",
                related_ids={"meal_plan_id": "plan_test"},
                payload={"adherence": "yes"},
            )
        )
        db_session.commit()

        with client.stream(
            "POST",
            "/api/v1/chat/stream",
            headers=headers,
            json={"message": "Tuân thủ tuần này của tôi thế nào?"},
        ) as response:
            assert response.status_code == 200
            body = response.read().decode("utf-8")

        events = _parse_sse_body(body)
        done = next(e for e in events if e["type"] == "done")
        assert done["data"]["intent"] == "weekly_compliance"
        assert done["data"]["weekly_compliance"] is not None
        assert len(done["data"]["weekly_compliance"]["daily_series"]) == 7

    @patch("app.agents.streaming.time.sleep")
    def test_chat_stream_doctor_note_done_payload(self, _sleep, client, db_session):
        from datetime import datetime

        from app.models.notification import Notification

        headers = _login(client, "demo_patient_1@example.com")
        db_session.add(
            Notification(
                user_id="demo_patient_1",
                type="manual_reminder",
                title="Nhắc nhở",
                body="Uống thuốc đúng giờ trước bữa sáng.",
                scheduled_at=datetime.now(),
                status="sent",
                related_ids={},
                payload={"tags": ["Uống thuốc"]},
            )
        )
        db_session.commit()

        with client.stream(
            "POST",
            "/api/v1/chat/stream",
            headers=headers,
            json={"message": "Bác sĩ dặn gì?"},
        ) as response:
            assert response.status_code == 200
            body = response.read().decode("utf-8")

        events = _parse_sse_body(body)
        done = next(e for e in events if e["type"] == "done")
        assert done["data"]["intent"] == "doctor_note"
        assert done["data"]["doctor_note"] is not None
        assert "Uống thuốc" in done["data"]["doctor_note"]["note"]
        assert done["data"]["doctor_note"]["doctor_name"] == "BS. Minh"
        assert len(done["data"]["doctor_note"]["notes"]) == 1
