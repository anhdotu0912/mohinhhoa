"""Apply meal plan validity window — set starts_on/ends_on after HITL approval."""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.models.meal_plan import MealPlan
from app.schemas.meal_plan import MealPlanOutput
from app.services import plan_expiry
from app.services.meal_plan_service import meal_plan_from_row
from app.services.notification import NotificationService

APPLY_ELIGIBLE_STATUSES = frozenset({"approved", "edited"})
OVERLAP_STATUSES = frozenset({"approved", "edited", "pending_review"})


def _ranges_overlap(a_start: date, a_end: date, b_start: date, b_end: date) -> bool:
    return a_start <= b_end and b_start <= a_end


def _overlap_days(a_start: date, a_end: date, b_start: date, b_end: date) -> int:
    lo = max(a_start, b_start)
    hi = min(a_end, b_end)
    if hi < lo:
        return 0
    return (hi - lo).days + 1


def _clear_or_trim_overlap(other: MealPlan, start_date: date, ends_on: date) -> None:
    """Free a week window: unapply a mostly-overlapping plan, else trim the edge."""
    if other.starts_on is None or other.ends_on is None:
        return
    overlap = _overlap_days(start_date, ends_on, other.starts_on, other.ends_on)
    other_len = (other.ends_on - other.starts_on).days + 1
    if overlap >= 4 or overlap >= max(1, other_len - 1):
        other.starts_on = None
        other.ends_on = None
        return
    if other.starts_on < start_date:
        other.ends_on = start_date - timedelta(days=1)
    else:
        other.starts_on = ends_on + timedelta(days=1)
    if other.starts_on is None or other.ends_on is None or other.ends_on < other.starts_on:
        other.starts_on = None
        other.ends_on = None


def _stamp_day_dates(row: MealPlan, starts_on: date) -> None:
    days = list(row.days or [])
    for day in days:
        idx = int(day.get("day_index", 1))
        day["date"] = (starts_on + timedelta(days=idx - 1)).isoformat()
    row.days = days


def find_active_plan(
    db: Session, user_id: str, today: date | None = None
) -> MealPlan | None:
    """Plan đang hiệu lực hôm nay (approved/edited, đã apply)."""
    today = today or date.today()
    rows = (
        db.query(MealPlan)
        .filter(
            MealPlan.user_id == user_id,
            MealPlan.status.in_(APPLY_ELIGIBLE_STATUSES),
            MealPlan.starts_on.isnot(None),
            MealPlan.ends_on.isnot(None),
            MealPlan.starts_on <= today,
            MealPlan.ends_on >= today,
        )
        .order_by(MealPlan.starts_on.desc(), MealPlan.created_at.desc())
        .all()
    )
    return rows[0] if rows else None


def find_upcoming_plan(
    db: Session, user_id: str, today: date | None = None
) -> MealPlan | None:
    today = today or date.today()
    return (
        db.query(MealPlan)
        .filter(
            MealPlan.user_id == user_id,
            MealPlan.status.in_(APPLY_ELIGIBLE_STATUSES),
            MealPlan.starts_on.isnot(None),
            MealPlan.ends_on.isnot(None),
            MealPlan.starts_on > today,
        )
        .order_by(MealPlan.starts_on.asc())
        .first()
    )


def find_overlapping_plans(
    db: Session,
    user_id: str,
    starts_on: date,
    ends_on: date,
    exclude_id: str | None = None,
) -> list[MealPlan]:
    query = db.query(MealPlan).filter(
        MealPlan.user_id == user_id,
        MealPlan.status.in_(OVERLAP_STATUSES),
        MealPlan.starts_on.isnot(None),
        MealPlan.ends_on.isnot(None),
        MealPlan.starts_on <= ends_on,
        MealPlan.ends_on >= starts_on,
    )
    if exclude_id:
        query = query.filter(MealPlan.id != exclude_id)
    return query.all()


def patient_plan_usage(
    db: Session, user_id: str, today: date | None = None
) -> str:
    """none | active | finished — upcoming gộp vào active cho list filter."""
    today = today or date.today()
    applied = (
        db.query(MealPlan)
        .filter(
            MealPlan.user_id == user_id,
            MealPlan.status.in_(APPLY_ELIGIBLE_STATUSES),
            MealPlan.starts_on.isnot(None),
            MealPlan.ends_on.isnot(None),
        )
        .all()
    )
    if not applied:
        return "none"

    for row in applied:
        if row.ends_on >= today:
            return "active"
    return "finished"


def reconcile_overlapping_applied_plans(
    db: Session,
    user_id: str | None = None,
    today: date | None = None,
) -> int:
    """Unapply extra plans that overlap another applied week (ADR-012: 1 plan / tuần).

    Keeps the canonical active plan covering today, then any remaining
    non-overlapping history/upcoming windows. Returns how many plans were unapplied.
    """
    today = today or date.today()
    query = db.query(MealPlan).filter(
        MealPlan.status.in_(APPLY_ELIGIBLE_STATUSES),
        MealPlan.starts_on.isnot(None),
        MealPlan.ends_on.isnot(None),
    )
    if user_id:
        query = query.filter(MealPlan.user_id == user_id)
    rows = query.order_by(
        MealPlan.user_id.asc(),
        MealPlan.starts_on.desc(),
        MealPlan.created_at.desc(),
    ).all()

    by_user: dict[str, list[MealPlan]] = {}
    for row in rows:
        by_user.setdefault(row.user_id, []).append(row)

    unapplied = 0
    for uid, plans in by_user.items():
        kept: list[MealPlan] = []
        active = find_active_plan(db, uid, today)
        if active is not None:
            kept.append(active)

        rest = sorted(
            (p for p in plans if active is None or p.id != active.id),
            key=lambda p: (
                p.starts_on.isoformat() if p.starts_on else "",
                p.created_at.isoformat() if p.created_at else "",
            ),
        )
        for plan in rest:
            if plan.starts_on is None or plan.ends_on is None:
                continue
            overlaps_kept = any(
                k.starts_on is not None
                and k.ends_on is not None
                and _ranges_overlap(plan.starts_on, plan.ends_on, k.starts_on, k.ends_on)
                for k in kept
            )
            if overlaps_kept:
                plan.starts_on = None
                plan.ends_on = None
                unapplied += 1
            else:
                kept.append(plan)
    return unapplied


def apply_meal_plan(
    db: Session,
    plan_row: MealPlan,
    start_date: date,
    *,
    replace_active: bool = False,
    today: date | None = None,
) -> MealPlanOutput:
    """Gán cửa sổ 7 ngày cho plan đã duyệt."""
    today = today or date.today()
    if plan_row.status not in APPLY_ELIGIBLE_STATUSES:
        raise APIError(
            400,
            "PLAN_NOT_APPLYABLE",
            "Chỉ áp dụng được thực đơn đã duyệt (approved/edited).",
        )
    if start_date < today:
        raise APIError(
            400,
            "START_DATE_IN_PAST",
            "Ngày bắt đầu không được ở quá khứ.",
        )

    duration = plan_expiry.duration_days(len(plan_row.days or []))
    ends_on = start_date + timedelta(days=duration - 1)

    active = find_active_plan(db, plan_row.user_id, today)
    overlaps = find_overlapping_plans(
        db, plan_row.user_id, start_date, ends_on, exclude_id=plan_row.id
    )

    active_overlaps = (
        active is not None
        and active.id != plan_row.id
        and active.starts_on is not None
        and active.ends_on is not None
        and _ranges_overlap(start_date, ends_on, active.starts_on, active.ends_on)
    )
    if active_overlaps:
        if not replace_active:
            raise APIError(
                409,
                "PLAN_DATE_OVERLAP",
                "Khoảng ngày trùng với thực đơn đang áp dụng. "
                "Dùng Thay thế trên tuần đó, hoặc gán vào tuần trống khác.",
            )
        if start_date <= active.starts_on:
            raise APIError(
                400,
                "INVALID_REPLACE_DATE",
                "Ngày áp dụng mới phải sau ngày bắt đầu thực đơn hiện tại.",
            )
        active.ends_on = start_date - timedelta(days=1)
        overlaps = [p for p in overlaps if p.id != active.id]

    # Ghost / misaligned weeks (grid slides with today) must not 409 an empty
    # slot the doctor just chose. Only the active-today plan is protected above.
    for other in overlaps:
        _clear_or_trim_overlap(other, start_date, ends_on)

    plan_row.starts_on = start_date
    plan_row.ends_on = ends_on
    _stamp_day_dates(plan_row, start_date)

    plan_out = meal_plan_from_row(plan_row)
    NotificationService(db).on_plan_applied(plan_out, start_date)
    db.flush()
    return plan_out
