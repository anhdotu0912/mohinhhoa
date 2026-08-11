"""Meal plan orchestration: mock path (DEMO_MOCK) or BE1 run_agent facade."""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import APIError
from app.models.alert import Alert
from app.models.meal_plan import MealPlan
from app.models.profile import Profile
from app.models.user import User
from app.schemas.meal_plan import AgentRunInput, InteractionCheckInput, MealPlanOutput
from app.schemas.profile import PatientProfile
from app.services.meal_plan_demo import build_mock_meal_plan, check_interactions
from app.services.notification import NotificationService


def get_profile(db: Session, user_id: str) -> PatientProfile:
    row = db.query(Profile).filter(Profile.user_id == user_id).first()
    if row is None:
        return PatientProfile(user_id=user_id, target_kcal=1800)
    return PatientProfile(
        id=row.id,
        user_id=row.user_id,
        disease=row.disease or [],
        medications=row.medications or [],
        allergies=row.allergies or [],
        bmi=row.bmi,
        target_kcal=row.target_kcal or 1800,
        restrictions=row.restrictions or {},
        preferences=row.preferences or [],
    )


def _persist_plan(db: Session, user_id: str, plan: MealPlanOutput) -> MealPlan:
    row = MealPlan(
        id=plan.id,
        variant_group_id=plan.variant_group_id,
        variant_index=plan.variant_index,
        total_variants=plan.total_variants,
        user_id=user_id,
        profile_snapshot=plan.profile_snapshot,
        days=[day.model_dump() for day in plan.days],
        swaps=[swap.model_dump() for swap in plan.swaps],
        citations=plan.citations,
        status=plan.status,
    )
    db.add(row)
    db.flush()
    return row


def meal_plan_from_row(row: MealPlan) -> MealPlanOutput:
    return MealPlanOutput(
        id=row.id,
        variant_group_id=row.variant_group_id,
        variant_index=row.variant_index,
        total_variants=row.total_variants,
        user_id=row.user_id,
        profile_snapshot=row.profile_snapshot or {},
        days=row.days or [],
        swaps=row.swaps or [],
        citations=row.citations or [],
        status=row.status,
    )


def _plan_foods(plan: MealPlanOutput) -> list[str]:
    return [
        item.name
        for day in plan.days
        for meal in day.meals
        for item in meal.items
    ]


def _persist_interaction_alerts(db: Session, user: User, plan: MealPlanOutput) -> None:
    profile = get_profile(db, user.id)
    result = check_interactions(
        InteractionCheckInput(medications=profile.medications, foods=_plan_foods(plan))
    )
    notifications = NotificationService(db)
    for item in result.interactions:
        alert = Alert(
            user_id=user.id,
            drug=item.drug,
            food=item.food,
            mechanism=item.mechanism,
            severity=item.severity,
            recommendation=item.recommendation,
            sources=item.sources,
            meal_plan_id=plan.id,
        )
        db.add(alert)
        db.flush()
        notifications.on_alert_created(alert)


def generate_meal_plan(db: Session, user: User) -> MealPlanOutput:
    """Generate + persist a meal plan. Returns the persisted plan."""
    profile = get_profile(db, user.id)

    if settings.DEMO_MOCK:
        plan = build_mock_meal_plan(profile)
        plan.id = str(uuid.uuid4())
        plan.user_id = user.id
        _persist_plan(db, user.id, plan)
        _persist_interaction_alerts(db, user, plan)
        NotificationService(db).materialize_from_meal_plan(plan)
        db.commit()
        return plan

    from app.agents.graph import run_agent

    output = run_agent(
        AgentRunInput(
            user_id=user.id,
            message="Tạo thực đơn 7 ngày cho tôi",
            force_intent="meal_plan",
        )
    )
    if not output.meal_plan_id:
        raise APIError(
            501,
            "MEAL_PLAN_NOT_READY",
            "MealPlannerAgent chưa sẵn sàng. Bật DEMO_MOCK hoặc chờ BE1 hoàn thiện.",
        )
    row = db.get(MealPlan, output.meal_plan_id)
    if row is None:
        raise APIError(500, "MEAL_PLAN_NOT_FOUND", "Không tìm thấy meal plan do agent trả về.")
    return meal_plan_from_row(row)
