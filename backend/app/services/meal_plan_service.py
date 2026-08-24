"""Meal plan orchestration: catalog + optional LLM, then persist."""

from __future__ import annotations

import re
import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.meal_plan import MealPlan
from app.models.profile import Profile
from app.models.user import User
from app.core.errors import APIError
from app.schemas.meal_plan import (
    DayPlan,
    FoodItem,
    Meal,
    MealPlanOutput,
    MealPlanRequestOut,
    MealPreviewMeal,
    MealPreviewOut,
)
from app.schemas.profile import PatientProfile
from app.services.notification import NotificationService

SLOT_LABELS: dict[str, str] = {
    "breakfast": "Bữa sáng",
    "lunch": "Bữa trưa",
    "dinner": "Bữa tối",
    "snack": "Bữa phụ",
}

DEFAULT_MEAL_SLOTS = ["breakfast", "lunch", "dinner"]


def _profile_from_row(row: Profile) -> PatientProfile:
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
        constraints_status=getattr(row, "constraints_status", None) or "confirmed",
    )


def get_profile_row(db: Session, user_id: str) -> PatientProfile | None:
    """Return stored profile or None when the user has no profile row."""
    row = db.query(Profile).filter(Profile.user_id == user_id).first()
    if row is None:
        return None
    return _profile_from_row(row)


def get_profile(db: Session, user_id: str) -> PatientProfile:
    profile = get_profile_row(db, user_id)
    if profile is None:
        return PatientProfile(user_id=user_id, target_kcal=1800)
    return profile


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
        adjustment_note=row.adjustment_note,
        starts_on=row.starts_on.isoformat() if row.starts_on else None,
        ends_on=row.ends_on.isoformat() if row.ends_on else None,
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


def persist_generated_plan(db: Session, user_id: str, plan: MealPlanOutput) -> MealPlanOutput:
    """Persist a generated plan and related interaction alerts (shared by HTTP + chat)."""
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise ValueError(f"User not found: {user_id}")

    if not plan.id:
        plan.id = str(uuid.uuid4())
    plan.user_id = user_id

    _persist_plan(db, user_id, plan)
    _persist_interaction_alerts(db, user, plan)
    db.commit()
    return plan


def _format_request_dt(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


def _request_out_from_profile(row: Profile | None) -> MealPlanRequestOut:
    if row is None:
        return MealPlanRequestOut()
    status = getattr(row, "meal_plan_request_status", None) or "none"
    if status not in ("none", "pending"):
        status = "none"
    return MealPlanRequestOut(
        status=status,  # type: ignore[arg-type]
        note=getattr(row, "meal_plan_request_note", None),
        requested_at=_format_request_dt(getattr(row, "meal_plan_requested_at", None)),
    )


def _ensure_profile_row(db: Session, user_id: str) -> Profile:
    row = db.query(Profile).filter(Profile.user_id == user_id).first()
    if row is None:
        row = Profile(user_id=user_id)
        db.add(row)
        db.flush()
    return row


def get_meal_plan_request(db: Session, user_id: str) -> MealPlanRequestOut:
    row = db.query(Profile).filter(Profile.user_id == user_id).first()
    return _request_out_from_profile(row)


def _latest_plan_row(db: Session, user_id: str) -> MealPlan | None:
    return (
        db.query(MealPlan)
        .filter(MealPlan.user_id == user_id)
        .order_by(MealPlan.created_at.desc())
        .first()
    )


def submit_meal_plan_request(db: Session, user: User, note: str = "") -> MealPlanRequestOut:
    latest = _latest_plan_row(db, user.id)
    if latest is not None and latest.status == "pending_review":
        raise APIError(
            400,
            "PLAN_ALREADY_PENDING",
            "Bạn đã có thực đơn đang chờ bác sĩ duyệt.",
        )

    row = _ensure_profile_row(db, user.id)
    current_status = getattr(row, "meal_plan_request_status", None) or "none"
    if current_status == "pending":
        db.commit()
        return _request_out_from_profile(row)

    cleaned_note = note.strip() or None
    row.meal_plan_request_status = "pending"
    row.meal_plan_request_note = cleaned_note
    row.meal_plan_requested_at = datetime.now(UTC)
    db.commit()
    db.refresh(row)
    return _request_out_from_profile(row)


def clear_meal_plan_request(db: Session, user_id: str) -> None:
    row = db.query(Profile).filter(Profile.user_id == user_id).first()
    if row is None:
        return
    if getattr(row, "meal_plan_request_status", None) != "pending":
        return
    row.meal_plan_request_status = "none"
    row.meal_plan_request_note = None
    row.meal_plan_requested_at = None
    db.flush()


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
    clear_meal_plan_request(db, user.id)
    return persist_generated_plan(db, user.id, plan)


def resolve_patient_plan_row(
    db: Session, user_id: str, today: date | None = None
) -> MealPlan | None:
    """Resolve plan for patient view: active → upcoming → latest."""
    from app.services.plan_apply import find_active_plan, find_upcoming_plan

    today = today or date.today()
    active = find_active_plan(db, user_id, today)
    if active is not None:
        return active
    upcoming = find_upcoming_plan(db, user_id, today)
    if upcoming is not None:
        return upcoming
    return (
        db.query(MealPlan)
        .filter(MealPlan.user_id == user_id)
        .order_by(MealPlan.created_at.desc())
        .first()
    )


def parse_meal_slots(message: str) -> list[str]:
    """Map Vietnamese meal phrases to plan slot keys."""
    msg = message.lower()
    slots: list[str] = []
    if re.search(r"bữa sáng|sáng nay|\bsáng\b", msg):
        slots.append("breakfast")
    if re.search(r"bữa trưa|trưa nay|\btrưa\b", msg):
        slots.append("lunch")
    if re.search(r"bữa tối|tối nay|\btối\b", msg):
        slots.append("dinner")
    if re.search(r"bữa phụ|\bsnack\b|\bphụ\b", msg):
        slots.append("snack")
    if slots:
        return slots
    return list(DEFAULT_MEAL_SLOTS)


def message_requests_plan_creation(message: str) -> bool:
    """True when user asks to create/generate a new plan (read-only chat redirects)."""
    msg = message.lower()
    return bool(
        re.search(
            r"lập thực đơn|tạo thực đơn|sinh thực đơn|lên kế hoạch ăn|"
            r"kế hoạch dinh dưỡng|7 ngày|tạo plan|generate",
            msg,
        )
    )


def _day_index_for_plan(row: MealPlan, plan: MealPlanOutput, today: date | None = None) -> int:
    today = today or date.today()
    if row.starts_on is not None:
        idx = (today - row.starts_on).days + 1
        if plan.days:
            return max(1, min(idx, len(plan.days)))
        return max(1, idx)
    return 1


def _day_plan_for_index(plan: MealPlanOutput, day_index: int) -> DayPlan | None:
    if not plan.days:
        return None
    match = next((d for d in plan.days if d.day_index == day_index), None)
    return match or plan.days[0]


def _meal_items(meal: Meal) -> list[FoodItem]:
    return list(meal.items or [])


def _collect_citations(plan: MealPlanOutput, meals: list[MealPreviewMeal]) -> list[str]:
    citations = list(plan.citations or [])
    for meal in meals:
        for item in meal.items:
            for cite in item.citations or []:
                if cite not in citations:
                    citations.append(cite)
    return citations


def build_meal_preview(
    db: Session,
    user_id: str,
    message: str,
    today: date | None = None,
) -> MealPreviewOut | None:
    """Build structured preview from existing patient plan (read-only)."""
    today = today or date.today()
    row = resolve_patient_plan_row(db, user_id, today)
    if row is None:
        return None

    plan = meal_plan_from_row(row)
    day_index = _day_index_for_plan(row, plan, today)
    day_plan = _day_plan_for_index(plan, day_index)
    if day_plan is None:
        return None

    requested_slots = parse_meal_slots(message)
    preview_meals: list[MealPreviewMeal] = []
    for slot in requested_slots:
        meal = next((m for m in day_plan.meals if m.slot == slot), None)
        if meal is None:
            preview_meals.append(
                MealPreviewMeal(
                    slot=slot,
                    label=SLOT_LABELS.get(slot, slot),
                    items=[],
                )
            )
            continue
        preview_meals.append(
            MealPreviewMeal(
                slot=slot,
                label=SLOT_LABELS.get(slot, slot),
                items=_meal_items(meal),
            )
        )

    preview_date = today.isoformat()
    if row.starts_on is not None:
        preview_date = (row.starts_on + timedelta(days=day_index - 1)).isoformat()

    return MealPreviewOut(
        date=preview_date,
        day_index=day_index,
        meal_plan_id=row.id,
        plan_status=row.status,
        meals=preview_meals,
    )


def format_meal_preview_message(
    preview: MealPreviewOut | None,
    message: str,
) -> str:
    """Human-readable summary for chat bubble."""
    if preview is None:
        return (
            "Bạn chưa có thực đơn trong hệ thống. "
            "Vui lòng liên hệ bác sĩ để được lập thực đơn, hoặc mở mục Thực đơn trên ứng dụng."
        )

    prefix = ""
    if message_requests_plan_creation(message):
        prefix = (
            "Thực đơn được bác sĩ lập và quản lý — chat không tự tạo thực đơn mới. "
            "Dưới đây là thực đơn hiện có của bạn:\n\n"
        )

    status_note = ""
    if preview.plan_status == "pending_review":
        status_note = (
            "⚠️ Thực đơn đang chờ bác sĩ duyệt — thông tin mang tính tham khảo.\n"
        )
    elif preview.plan_status == "rejected":
        status_note = "⚠️ Thực đơn này đã bị từ chối — vui lòng liên hệ bác sĩ.\n"

    meal_names = []
    for meal in preview.meals:
        if meal.items:
            names = ", ".join(item.name for item in meal.items[:3])
            meal_names.append(f"- {meal.label}: {names}")
        else:
            meal_names.append(f"- {meal.label}: (chưa có món)")

    body = (
        f"{prefix}"
        f"{status_note}"
        f"Thực đơn ngày {preview.date} (Ngày {preview.day_index}):\n"
        + "\n".join(meal_names)
    )
    return body.strip()
