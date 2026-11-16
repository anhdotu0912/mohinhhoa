"""Tests for read-only meal preview from chat."""

from __future__ import annotations

from datetime import date

from app.agents.graph import reset_compiled_graph, run_agent
from app.models.meal_plan import MealPlan
from app.schemas.meal_plan import AgentRunInput
from app.services.meal_plan_service import (
    build_meal_preview,
    parse_meal_slots,
    persist_generated_plan,
    resolve_patient_plan_row,
)
from app.services.plan_apply import apply_meal_plan


def _seed_plan(db_session, user_id: str = "demo_patient_1"):
    from app.agents.meal_planner_agent import generate_meal_plan as build_plan
    from app.db.init_db import seed_demo_accounts
    from app.models.user import User
    from app.services.meal_plan_service import get_profile

    if db_session.query(User).filter(User.id == user_id).first() is None:
        seed_demo_accounts(db_session)
        db_session.commit()

    profile = get_profile(db_session, user_id)
    plan = build_plan(profile, db=db_session)
    return persist_generated_plan(db_session, user_id, plan)


class TestParseMealSlots:
    def test_default_three_meals(self):
        assert parse_meal_slots("Hôm nay ăn gì?") == ["breakfast", "lunch", "dinner"]

    def test_lunch_only(self):
        assert parse_meal_slots("Trưa nay ăn gì?") == ["lunch"]

    def test_dinner_only(self):
        assert parse_meal_slots("Tối nay nên ăn gì?") == ["dinner"]

    def test_breakfast_only(self):
        assert parse_meal_slots("Bữa sáng nay ăn gì?") == ["breakfast"]


class TestBuildMealPreview:
    def test_no_plan_returns_none(self, db_session):
        preview = build_meal_preview(db_session, "unknown_user_xyz", "Hôm nay ăn gì?")
        assert preview is None

    def test_preview_with_plan_day_one(self, db_session):
        _seed_plan(db_session)
        preview = build_meal_preview(db_session, "demo_patient_1", "Hôm nay ăn gì?")
        assert preview is not None
        assert preview.day_index == 1
        assert len(preview.meals) == 3
        assert preview.meal_plan_id

    def test_preview_lunch_slot_only(self, db_session):
        _seed_plan(db_session)
        preview = build_meal_preview(db_session, "demo_patient_1", "Trưa nay ăn gì?")
        assert preview is not None
        assert len(preview.meals) == 1
        assert preview.meals[0].slot == "lunch"

    def test_day_index_from_starts_on(self, db_session):
        plan = _seed_plan(db_session)
        row = db_session.query(MealPlan).filter(MealPlan.id == plan.id).first()
        assert row is not None
        row.status = "approved"
        db_session.commit()

        starts_on = date(2026, 8, 14)
        simulated_today = date(2026, 8, 16)
        apply_meal_plan(
            db_session,
            row,
            start_date=starts_on,
            replace_active=True,
            today=starts_on,
        )
        db_session.commit()

        preview = build_meal_preview(
            db_session,
            "demo_patient_1",
            "Hôm nay ăn gì?",
            today=simulated_today,
        )
        assert preview is not None
        assert preview.day_index == 3
        assert preview.date == simulated_today.isoformat()


class TestResolvePatientPlanRow:
    def test_returns_latest_plan(self, db_session):
        _seed_plan(db_session)
        row = resolve_patient_plan_row(db_session, "demo_patient_1")
        assert row is not None
        assert row.user_id == "demo_patient_1"


class TestChatMealPlanReadonly:
    def setup_method(self):
        reset_compiled_graph()

    def test_run_agent_meal_plan_readonly(self, db_session):
        _seed_plan(db_session)
        output = run_agent(
            AgentRunInput(
                user_id="demo_patient_1",
                message="Cho tôi xem thực đơn",
                force_intent="meal_plan",
            ),
            db=db_session,
        )
        assert output.intent == "meal_plan"
        assert output.meal_preview is not None
        assert len(output.meal_preview.meals) >= 1
        assert output.meal_plan_id == output.meal_preview.meal_plan_id
        assert "thực đơn" in output.message.lower()
