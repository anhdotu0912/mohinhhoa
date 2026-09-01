"""Hard caps on meal plan pipeline — 1 draft + 1 applied active + 1 upcoming."""

from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.models.alert import Alert
from app.models.meal_plan import MealPlan
from app.models.notification import Notification
from app.models.user import User
from app.services.plan_apply import (
    APPLY_ELIGIBLE_STATUSES,
    find_active_plan,
    find_upcoming_plan,
    reconcile_overlapping_applied_plans,
)

UNASSIGNED_DRAFT = frozenset({"pending_review"})
UNASSIGNED_APPROVED = frozenset({"approved", "edited"})


def _unassigned_query(db: Session, user_id: str, statuses: frozenset[str]):
    return (
        db.query(MealPlan)
        .filter(
            MealPlan.user_id == user_id,
            MealPlan.status.in_(statuses),
            MealPlan.starts_on.is_(None),
            MealPlan.ends_on.is_(None),
        )
        .order_by(MealPlan.created_at.desc())
    )


def assert_can_generate_meal_plan(db: Session, user_id: str) -> None:
    """At most one pending draft and one approved-but-unscheduled plan per patient."""
    if _unassigned_query(db, user_id, UNASSIGNED_DRAFT).first() is not None:
        raise APIError(
            409,
            "PLAN_ALREADY_PENDING",
            "Bệnh nhân đã có thực đơn chờ duyệt. Hãy duyệt hoặc xóa trước khi tạo mới.",
        )
    if _unassigned_query(db, user_id, UNASSIGNED_APPROVED).first() is not None:
        raise APIError(
            409,
            "PLAN_UNASSIGNED_APPROVED",
            "Đã có thực đơn đã duyệt chưa áp dụng. Hãy áp dụng hoặc xóa trước khi tạo mới.",
        )


def assert_can_apply_mode(
    db: Session,
    user_id: str,
    plan_id: str,
    apply_mode: str | None,
    *,
    today: date | None = None,
) -> None:
    """At most one upcoming window; after_current blocked when one exists."""
    if apply_mode != "after_current":
        return
    today = today or date.today()
    upcoming = find_upcoming_plan(db, user_id, today)
    if upcoming is None or upcoming.id == plan_id:
        return
    raise APIError(
        409,
        "UPCOMING_EXISTS",
        "Đã có thực đơn xếp sẵn cho chu kỳ tiếp theo. Xóa hoặc gia hạn thực đơn đó trước.",
    )


def delete_meal_plan_cascade(db: Session, plan: MealPlan) -> None:
    """Remove plan and related alerts/notifications."""
    plan_id = plan.id
    db.query(Alert).filter(Alert.meal_plan_id == plan_id).delete(
        synchronize_session=False
    )
    notifs = db.query(Notification).filter(Notification.user_id == plan.user_id).all()
    for notif in notifs:
        rel = notif.related_ids or {}
        if isinstance(rel, dict) and rel.get("meal_plan_id") == plan_id:
            db.delete(notif)
    db.delete(plan)


def cleanup_patient_meal_plans(
    db: Session,
    user_id: str,
    *,
    today: date | None = None,
    keep_past: int = 1,
) -> dict[str, int]:
    """Trim extras: 1 pending, 1 unassigned approved, 1 active, 1 upcoming, N past."""
    today = today or date.today()
    stats = {
        "deleted_pending": 0,
        "deleted_unassigned": 0,
        "deleted_rejected": 0,
        "deleted_past": 0,
        "deleted_overlap": 0,
        "unapplied": 0,
    }

    pending = _unassigned_query(db, user_id, UNASSIGNED_DRAFT).all()
    for row in pending[1:]:
        delete_meal_plan_cascade(db, row)
        stats["deleted_pending"] += 1

    approved = _unassigned_query(db, user_id, UNASSIGNED_APPROVED).all()
    for row in approved[1:]:
        delete_meal_plan_cascade(db, row)
        stats["deleted_unassigned"] += 1

    rejected = (
        db.query(MealPlan)
        .filter(MealPlan.user_id == user_id, MealPlan.status == "rejected")
        .order_by(MealPlan.created_at.desc())
        .all()
    )
    for row in rejected:
        delete_meal_plan_cascade(db, row)
        stats["deleted_rejected"] += 1

    db.flush()
    stats["unapplied"] = reconcile_overlapping_applied_plans(
        db, user_id=user_id, today=today
    )

    applied = (
        db.query(MealPlan)
        .filter(
            MealPlan.user_id == user_id,
            MealPlan.status.in_(APPLY_ELIGIBLE_STATUSES),
            MealPlan.starts_on.isnot(None),
            MealPlan.ends_on.isnot(None),
        )
        .order_by(MealPlan.starts_on.asc())
        .all()
    )

    active = find_active_plan(db, user_id, today)
    upcoming = find_upcoming_plan(db, user_id, today)
    keep_ids = {p.id for p in (active, upcoming) if p is not None}

    past = [p for p in applied if p.ends_on is not None and p.ends_on < today]
    past.sort(key=lambda p: p.ends_on or today, reverse=True)
    for row in past[keep_past:]:
        delete_meal_plan_cascade(db, row)
        stats["deleted_past"] += 1

    for row in applied:
        if row.id in keep_ids:
            continue
        if row.ends_on is not None and row.ends_on < today:
            continue
        if active and row.id == active.id:
            continue
        if upcoming and row.id == upcoming.id:
            continue
        delete_meal_plan_cascade(db, row)
        stats["deleted_overlap"] += 1

    return stats


def cleanup_all_patient_meal_plans(
    db: Session,
    *,
    today: date | None = None,
    keep_past: int = 1,
) -> dict[str, int | list[dict[str, int]]]:
    """Run cleanup for every patient user."""
    today = today or date.today()
    totals = {
        "patients": 0,
        "deleted_pending": 0,
        "deleted_unassigned": 0,
        "deleted_rejected": 0,
        "deleted_past": 0,
        "deleted_overlap": 0,
        "unapplied": 0,
        "by_patient": [],
    }
    patients = db.query(User).filter(User.role == "patient").all()
    for patient in patients:
        stats = cleanup_patient_meal_plans(
            db, patient.id, today=today, keep_past=keep_past
        )
        if any(stats.values()):
            totals["by_patient"].append({"patient_id": patient.id, **stats})
        totals["patients"] += 1
        for key in stats:
            totals[key] += stats[key]
    return totals
