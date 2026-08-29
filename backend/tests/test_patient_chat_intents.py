"""Patient chat Phase 2 — weekly_compliance and doctor_note intents."""

from __future__ import annotations

from datetime import datetime

import pytest

from app.agents.graph import (
    doctor_note_node,
    reset_compiled_graph,
    run_agent,
    weekly_compliance_node,
)
from app.agents.nodes.intent_classifier import _classify_by_keywords
from app.core.security import hash_password
from app.models.notification import Notification
from app.models.user import User
from app.schemas.meal_plan import AgentRunInput
from app.services.compliance import ComplianceService


@pytest.mark.parametrize(
    "message,expected",
    [
        ("Tuân thủ tuần này của tôi thế nào?", "weekly_compliance"),
        ("Bác sĩ dặn gì?", "doctor_note"),
        ("Thực đơn tuần này của tôi", "meal_plan"),
        ("Hôm nay ăn gì?", "meal_plan"),
        ("Hôm nay đi chợ mua nguyên liệu gì?", "rag_qa"),
        ("Chỉ số sức khỏe của tôi thế nào?", "metrics_delta_advice"),
    ],
)
def test_intent_classifier_sample_phrases(message: str, expected: str):
    assert _classify_by_keywords(message) == expected


def test_intent_classifier_weekly_compliance_extra():
    assert _classify_by_keywords("Báo cáo tuân thủ gần đây") == "weekly_compliance"


def test_intent_classifier_doctor_note_extra():
    assert _classify_by_keywords("Lời nhắc bác sĩ gần đây") == "doctor_note"


def test_weekly_compliance_node_uses_service(db_session):
    from datetime import date

    user_id = "demo_patient_1"
    today = date.today()
    db_session.add(
        Notification(
            user_id=user_id,
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

    result = weekly_compliance_node(
        {"user_id": user_id, "db": db_session, "message": "Tuân thủ tuần này?"}
    )
    assert result["weekly_compliance"] is not None
    assert result["weekly_compliance"]["overall_adherence_pct"] == 100
    assert len(result["weekly_compliance"]["daily_series"]) == 7
    assert "100%" in result["answer"]


def test_weekly_compliance_node_matches_compliance_service(db_session):
    from datetime import date

    user_id = "demo_patient_compliance_match"
    today = date.today()
    db_session.add(
        Notification(
            user_id=user_id,
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

    service = ComplianceService(db_session).get_patient_compliance(user_id, days=7)
    result = weekly_compliance_node(
        {"user_id": user_id, "db": db_session, "message": "Tuân thủ tuần này?"}
    )

    assert result["weekly_compliance"]["overall_adherence_pct"] == service.overall_adherence_pct
    assert len(result["weekly_compliance"]["daily_series"]) == len(service.daily_series)
    for node_point, service_point in zip(
        result["weekly_compliance"]["daily_series"],
        service.daily_series,
        strict=True,
    ):
        assert node_point["date"] == service_point.date
        assert node_point["adherence_pct"] == service_point.adherence_pct


def _add_assigned_pair(db_session, *, patient_id: str, doctor_name: str = "BS. Lan", avatar: str | None = None):
    doctor_id = f"doc_for_{patient_id}"
    db_session.add(
        User(
            id=doctor_id,
            email=f"{doctor_id}@example.com",
            hashed_password=hash_password("demo1234"),
            role="doctor",
            full_name=doctor_name,
            avatar=avatar,
        )
    )
    db_session.add(
        User(
            id=patient_id,
            email=f"{patient_id}@example.com",
            hashed_password=hash_password("demo1234"),
            role="patient",
            assigned_doctor_id=doctor_id,
        )
    )
    db_session.commit()
    return doctor_id


def test_doctor_note_node_manual_reminder(db_session):
    user_id = "demo_patient_doctor_note_manual"
    _add_assigned_pair(
        db_session, patient_id=user_id, doctor_name="BS. Lan", avatar="/static/avatars/lan.jpg"
    )
    db_session.add(
        Notification(
            user_id=user_id,
            type="manual_reminder",
            title="Nhắc nhở tuân thủ từ bác sĩ",
            body="Hạn chế muối trong 2 tuần tới.",
            scheduled_at=datetime(2026, 8, 23, 8, 15),
            status="sent",
            related_ids={},
            payload={"from_doctor": True, "tags": ["Hạn chế muối"]},
        )
    )
    db_session.commit()

    result = doctor_note_node({"user_id": user_id, "db": db_session})
    assert result["doctor_note"] is not None
    assert result["doctor_note"]["doctor_name"] == "BS. Lan"
    assert result["doctor_note"]["doctor_avatar"] == "/static/avatars/lan.jpg"
    assert "Hạn chế muối" in result["doctor_note"]["note"]
    assert result["doctor_note"]["tags"] == ["Hạn chế muối"]
    assert len(result["doctor_note"]["notes"]) == 1
    assert result["doctor_note"]["notes"][0]["title"] == "Nhắc nhở tuân thủ từ bác sĩ"


def test_doctor_note_node_lists_reminders_newest_first(db_session):
    user_id = "demo_patient_doctor_note_list"
    _add_assigned_pair(db_session, patient_id=user_id, doctor_name="BS. Minh")
    db_session.add_all(
        [
            Notification(
                user_id=user_id,
                type="manual_reminder",
                title="Cũ",
                body="Uống thuốc đúng giờ.",
                scheduled_at=datetime(2026, 8, 20, 7, 0),
                status="sent",
            ),
            Notification(
                user_id=user_id,
                type="manual_reminder",
                title="Mới",
                body="Hạn chế muối tuần này.",
                scheduled_at=datetime(2026, 8, 23, 8, 0),
                status="sent",
            ),
        ]
    )
    db_session.commit()

    result = doctor_note_node({"user_id": user_id, "db": db_session})
    notes = result["doctor_note"]["notes"]
    assert [item["note"] for item in notes] == ["Hạn chế muối tuần này.", "Uống thuốc đúng giờ."]
    assert result["doctor_note"]["note"] == "Hạn chế muối tuần này."
    assert "2 lời dặn" in result["answer"]


def test_doctor_note_node_empty(db_session):
    user_id = "demo_patient_doctor_note_empty_assigned"
    _add_assigned_pair(db_session, patient_id=user_id)
    result = doctor_note_node({"user_id": user_id, "db": db_session})
    assert result["doctor_note"] is None
    assert "chưa có lời dặn" in result["answer"].lower()


def test_doctor_note_node_awaiting_assignment(db_session):
    user_id = "demo_patient_doctor_note_unassigned"
    db_session.add(
        User(
            id=user_id,
            email=f"{user_id}@example.com",
            hashed_password=hash_password("demo1234"),
            role="patient",
            assigned_doctor_id=None,
        )
    )
    db_session.commit()
    result = doctor_note_node({"user_id": user_id, "db": db_session})
    assert result["doctor_note"] is None
    assert "chờ bác sĩ nhận" in result["answer"].lower()


def test_run_agent_weekly_compliance_force_intent(db_session):
    reset_compiled_graph()
    output = run_agent(
        AgentRunInput(
            user_id="demo_patient_1",
            message="ignored",
            force_intent="weekly_compliance",
        ),
        db=db_session,
    )
    assert output.intent == "weekly_compliance"
    assert output.weekly_compliance is not None
    assert len(output.weekly_compliance.daily_series) == 7


def test_run_agent_doctor_note_force_intent(db_session):
    reset_compiled_graph()
    user_id = "demo_patient_doctor_note_run"
    _add_assigned_pair(db_session, patient_id=user_id, doctor_name="BS. Minh")
    db_session.add(
        Notification(
            user_id=user_id,
            type="manual_reminder",
            title="Nhắc nhở",
            body="Uống thuốc đúng giờ.",
            scheduled_at=datetime.now(),
            status="sent",
            related_ids={},
            payload={},
        )
    )
    db_session.commit()

    output = run_agent(
        AgentRunInput(
            user_id=user_id,
            message="ignored",
            force_intent="doctor_note",
        ),
        db=db_session,
    )
    assert output.intent == "doctor_note"
    assert output.doctor_note is not None
    assert "Uống thuốc" in output.doctor_note.note


def test_run_agent_metrics_delta_advice_force_intent(db_session):
    reset_compiled_graph()
    output = run_agent(
        AgentRunInput(
            user_id="demo_patient_metrics_advice",
            message="ignored",
            force_intent="metrics_delta_advice",
        ),
        db=db_session,
    )
    assert output.intent == "metrics_delta_advice"
    assert "chỉ số" in (output.message or "").lower()


def test_unknown_node_fatigue_and_symptom_empathy():
    from app.agents.graph import unknown_node

    state = {
        "user_id": "demo_patient_1",
        "message": "tôi mệt quá, giờ tôi phải làm sao",
        "profile": {"disease": ["Đái tháo đường Type 2"], "medications": ["Metformin"]},
        "intent": "unknown",
    }
    result = unknown_node(state)
    answer = result.get("answer", "")

    assert answer, "Answer must not be empty"
    # Verify key safety elements are present
    assert any(
        kw in answer.lower()
        for kw in ["nghỉ ngơi", "đường huyết", "an toàn", "dinh dưỡng", "trợ lý"]
    )


def test_unknown_node_generic_query():
    from app.agents.graph import unknown_node

    state = {
        "user_id": "demo_patient_1",
        "message": "thời tiết hôm nay đẹp không bạn ơi",
        "profile": {},
        "intent": "unknown",
    }
    result = unknown_node(state)
    answer = result.get("answer", "")

    assert answer, "Answer must not be empty"
    assert "dinh dưỡng" in answer.lower()

