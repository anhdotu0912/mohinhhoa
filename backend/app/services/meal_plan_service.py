"""Meal plan orchestration: catalog + optional LLM, then persist."""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.meal_plan import MealPlan
from app.models.profile import Profile
from app.models.user import User
from app.schemas.meal_plan import MealPlanOutput
from app.schemas.profile import PatientProfile
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
        weight=row.weight,
        height=row.height,
        age=row.age,
        gender=row.gender,
        phone=row.phone,
        address=row.address,
        blood_pressure=row.blood_pressure,
        blood_glucose=row.blood_glucose,
        target_kcal=row.target_kcal or 1800,
        restrictions=row.restrictions or {},
        preferences=row.preferences or [],
        treatment_goals=row.treatment_goals or [],
    )


def _persist_plan(db: Session, user_id: str, plan: MealPlanOutput) -> MealPlan:
    row = MealPlan(
        id=plan.id,
        variant_group_id=plan.variant_group_id,
        variant_index=plan.variant_index,
        total_variants=plan.total_variants,
        user_id=user_id,
        profile_snapshot=plan.profile_snapshot,
        days=[day.model_dump(mode="json") for day in plan.days],
        swaps=[swap.model_dump(mode="json", by_alias=True) for swap in plan.swaps],
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
        created_at=row.created_at.isoformat() if row.created_at else None,
    )


def _plan_foods(plan: MealPlanOutput) -> list[str]:
    return [
        item.name
        for day in plan.days
        for meal in day.meals
        for item in meal.items
    ]


def _persist_interaction_alerts(db: Session, user: User, plan: MealPlanOutput) -> None:
    from app.agents.interaction_checker_agent import check_interactions

    profile = get_profile(db, user.id)
    result = check_interactions(
        medications=profile.medications,
        foods=_plan_foods(plan),
        db=db,
    )
    notifications = NotificationService(db)
    for item in result:
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


def generate_meal_plan(
    db: Session,
    user: User,
    notes: str = "",
    priorities: list[str] | None = None,
) -> MealPlanOutput:
    """Generate + persist a meal plan from catalog (+ LLM when API key is set)."""
    from app.agents.meal_planner_agent import generate_meal_plan as build_plan

    profile = get_profile(db, user.id)
    plan = build_plan(profile, notes=notes, priorities=priorities or [], db=db)
    plan.id = str(uuid.uuid4())
    plan.user_id = user.id
    _persist_plan(db, user.id, plan)
    _persist_interaction_alerts(db, user, plan)
    db.commit()
    return plan
