"""Regression: colloquial daily meal questions must read today's applied plan."""

from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest
from app.agents.graph import run_agent
from app.agents.streaming import stream_agent_events
from app.models.meal_plan import MealPlan
from app.schemas.meal_plan import AgentRunInput

TODAY = date(2026, 11, 16)


@pytest.mark.parametrize("streaming", [False, True])
@pytest.mark.parametrize(
    "plan_state,expected_text",
    [
        ("active", "Ức gà ngày 3"),
        ("none", "Tạo thực đơn của tôi"),
        ("pending_review", "đang chờ bác sĩ duyệt"),
        ("unscheduled", "chưa được áp dụng vào lịch"),
        ("upcoming", "bắt đầu từ ngày 18/11/2026"),
        ("expired", "Tạo thực đơn của tôi"),
        ("rejected", "đã bị từ chối"),
    ],
)
def test_daily_meal_chat_uses_only_current_applied_plan(
    db_session, monkeypatch, streaming, plan_state, expected_text
):
    user_id = str(uuid.uuid4())
    monkeypatch.setattr("app.core.datetime_vn.vn_today", lambda: TODAY)
    monkeypatch.setattr("app.agents.streaming.time.sleep", lambda _: None)

    def unexpected_rag_or_llm(*args, **kwargs):
        pytest.fail("Daily meal lookups must not classify with LLM or search guidelines")

    monkeypatch.setattr(
        "app.agents.nodes.intent_classifier._classify_by_llm", unexpected_rag_or_llm
    )
    monkeypatch.setattr(
        "app.agents.nodes.rag_tool._build_rag_context", unexpected_rag_or_llm
    )
    monkeypatch.setattr(
        "app.agents.streaming.retrieve_rag_context", unexpected_rag_or_llm
    )

    if plan_state != "none":
        status = plan_state if plan_state in {"pending_review", "rejected"} else "approved"
        starts_on = {
            "active": TODAY - timedelta(days=2),
            "upcoming": TODAY + timedelta(days=2),
            "expired": TODAY - timedelta(days=8),
        }.get(plan_state)
        db_session.add(
            MealPlan(
                user_id=user_id,
                status=status,
                starts_on=starts_on,
                ends_on=starts_on + timedelta(days=6) if starts_on else None,
                citations=["test_food_catalog"],
                days=[
                    {
                        "day_index": day,
                        "meals": [
                            {"slot": slot, "items": [{"name": f"Ức gà ngày {day}"}]}
                            for slot in ("breakfast", "lunch", "dinner")
                        ],
                    }
                    for day in range(1, 8)
                ],
            )
        )
        db_session.commit()

    count_before = db_session.query(MealPlan).filter_by(user_id=user_id).count()
    request = AgentRunInput(user_id=user_id, message="hôm nay tôi ăn j")
    if streaming:
        events = list(stream_agent_events(request, db=db_session))
        assert not any(event["type"] == "error" for event in events)
        assert not any(
            event.get("node") in {"rag_qa", "rag_qa_compose"} for event in events
        )
        output = next(event["data"] for event in events if event["type"] == "done")
    else:
        output = run_agent(request, db=db_session).model_dump(mode="json")

    assert output["intent"] == "meal_plan"
    assert expected_text in output["message"]
    assert output["citation_chunks"] == []
    assert "Lưu ý an toàn theo hồ sơ" not in output["message"]
    if plan_state == "active":
        assert output["meal_preview"]["date"] == TODAY.isoformat()
        assert output["meal_preview"]["day_index"] == 3
        assert len(output["meal_preview"]["meals"]) == 3
    else:
        assert output["meal_preview"] is None
        assert output["meal_plan_id"] is None
        assert output["citations"] == []
    assert db_session.query(MealPlan).filter_by(user_id=user_id).count() == count_before
