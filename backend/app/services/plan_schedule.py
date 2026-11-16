"""Meal plan week schedule slots — ADR-012."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Literal

from sqlalchemy.orm import Session

from app.core.datetime_vn import vn_today
from app.models.meal_plan import MealPlan
from app.schemas.meal_plan import MealPlanOutput
from app.services import plan_expiry
from app.services.meal_plan_service import meal_plan_from_row
from app.services.plan_apply import (
    APPLY_ELIGIBLE_STATUSES,
    find_active_plan,
)

SlotKey = Literal["current", "next", "empty"]
SlotOccupancy = Literal["empty", "active", "upcoming", "past"]
SlotAction = Literal["add", "replace", "view"]

DEFAULT_DURATION = 7
UNASSIGNED_STATUSES = frozenset({"pending_review", "approved", "edited"})


def _duration_for_row(row: MealPlan | None) -> int:
    if row is None:
        return DEFAULT_DURATION
    return plan_expiry.duration_days(len(row.days or []))


def _window_end(start: date, duration: int = DEFAULT_DURATION) -> date:
    return start + timedelta(days=duration - 1)


def _applied_plans(db: Session, user_id: str) -> list[MealPlan]:
    return (
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


def _plan_at_start(plans: list[MealPlan], start: date) -> MealPlan | None:
    for row in plans:
        if row.starts_on == start:
            return row
    return None


def _best_overlapping_plan(
    plans: list[MealPlan],
    start: date,
    end: date,
    *,
    exclude_id: str | None = None,
) -> MealPlan | None:
    """Pick the applied plan covering most of a week window.

    Slots are anchored to today, so a plan applied yesterday as "tuần sau"
    can sit one day off the new grid and disappear from the table.
    """
    hits: list[tuple[int, MealPlan]] = []
    for row in plans:
        if row.id == exclude_id or row.starts_on is None or row.ends_on is None:
            continue
        lo = max(row.starts_on, start)
        hi = min(row.ends_on, end)
        if hi < lo:
            continue
        hits.append(((hi - lo).days + 1, row))
    if not hits:
        return None
    hits.sort(key=lambda item: (-item[0], item[1].starts_on or start))
    overlap, row = hits[0]
    if overlap < 4:
        return None
    return row


def _furthest_end(plans: list[MealPlan], today: date) -> date | None:
    future = [p for p in plans if p.ends_on >= today]
    if not future:
        return None
    return max(p.ends_on for p in future)


def _slot_actions(
    occupancy: SlotOccupancy,
    slot_key: SlotKey,
    *,
    has_plan: bool = False,
) -> list[SlotAction]:
    if occupancy == "empty":
        actions: list[SlotAction] = []
        if has_plan:
            actions.append("view")
        actions.append("add")
        return actions
    actions = ["view"]
    if slot_key in ("current", "next"):
        actions.append("replace")
    return actions


def build_schedule_slot(
    slot_key: SlotKey,
    starts_on: date,
    ends_on: date,
    occupancy: SlotOccupancy,
    plan_row: MealPlan | None,
) -> dict:
    plan_out: MealPlanOutput | None = None
    if plan_row is not None:
        plan_out = meal_plan_from_row(plan_row)
    return {
        "slot_key": slot_key,
        "starts_on": starts_on.isoformat(),
        "ends_on": ends_on.isoformat(),
        "occupancy": occupancy,
        "plan": plan_out.model_dump() if plan_out else None,
        "actions": _slot_actions(occupancy, slot_key, has_plan=plan_row is not None),
    }


def build_meal_plan_schedule(
    db: Session,
    user_id: str,
    today: date | None = None,
) -> dict:
    """Build week slots: current, next, optional queued upcoming, trailing empty."""
    today = today or vn_today()
    duration = DEFAULT_DURATION
    applied = _applied_plans(db, user_id)
    active = find_active_plan(db, user_id, today)

    slots: list[dict] = []
    used_starts: set[date] = set()

    # --- Current ---
    if active:
        slots.append(
            build_schedule_slot(
                "current",
                active.starts_on,
                active.ends_on,
                "active",
                active,
            )
        )
        used_starts.add(active.starts_on)
        anchor_end = active.ends_on
    else:
        cur_start = today
        cur_end = _window_end(cur_start, duration)
        slots.append(
            build_schedule_slot("current", cur_start, cur_end, "empty", None)
        )
        anchor_end = cur_end

    # --- Next ---
    next_start = anchor_end + timedelta(days=1)
    next_end = _window_end(next_start, duration)
    next_plan = _plan_at_start(applied, next_start)
    if next_plan is None:
        next_plan = _best_overlapping_plan(
            applied,
            next_start,
            next_end,
            exclude_id=active.id if active else None,
        )
    if next_plan and next_plan.id != (active.id if active else None):
        exact = next_plan.starts_on == next_start
        slots.append(
            build_schedule_slot(
                "next",
                next_plan.starts_on if exact else next_start,
                next_plan.ends_on if exact else next_end,
                "upcoming",
                next_plan,
            )
        )
        used_starts.add(next_plan.starts_on)
        anchor_end = next_plan.ends_on
    else:
        slots.append(
            build_schedule_slot("next", next_start, next_end, "empty", None)
        )
        anchor_end = next_end

    # --- Additional queued weeks (starts after next slot window) ---
    for row in applied:
        if row.starts_on in used_starts:
            continue
        if active and row.id == active.id:
            continue
        if row.starts_on <= anchor_end:
            continue
        occ: SlotOccupancy = "upcoming" if row.starts_on > today else "past"
        slots.append(
            build_schedule_slot(
                "empty",
                row.starts_on,
                row.ends_on,
                occ,
                row,
            )
        )
        used_starts.add(row.starts_on)
        anchor_end = max(anchor_end, row.ends_on)

    # --- Trailing empty for add ---
    empty_start = anchor_end + timedelta(days=1)
    empty_end = _window_end(empty_start, duration)
    if not any(
        s["starts_on"] == empty_start.isoformat() and s["occupancy"] == "empty"
        for s in slots
    ):
        slots.append(
            build_schedule_slot("empty", empty_start, empty_end, "empty", None)
        )

    # Applied plans whose window already ended were skipped above (starts
    # before current/next). Keep them for week navigation / history timeline.
    past_rows = [
        row
        for row in applied
        if row.starts_on not in used_starts
        and row.ends_on is not None
        and row.ends_on < today
    ]
    past_slots = [
        build_schedule_slot("empty", row.starts_on, row.ends_on, "past", row)
        for row in past_rows
    ]
    slots = past_slots + slots

    active_plan_id = active.id if active else None
    active_plan = meal_plan_from_row(active) if active else None

    unassigned_rows = (
        db.query(MealPlan)
        .filter(
            MealPlan.user_id == user_id,
            MealPlan.status.in_(UNASSIGNED_STATUSES),
            MealPlan.starts_on.is_(None),
            MealPlan.ends_on.is_(None),
        )
        .order_by(MealPlan.created_at.desc())
        .all()
    )
    unassigned_plans = [
        meal_plan_from_row(row).model_dump() for row in unassigned_rows
        if not plan_expiry.is_plan_historical(row, today)
    ]

    all_rows = (
        db.query(MealPlan)
        .filter(MealPlan.user_id == user_id)
        .order_by(MealPlan.created_at.desc())
        .all()
    )
    latest = all_rows[0] if all_rows else None
    history_plans = [
        meal_plan_from_row(row).model_dump() for row in all_rows
        if plan_expiry.is_plan_historical(row, today)
    ]

    return {
        "patient_id": user_id,
        "today": today.isoformat(),
        "active_plan_id": active_plan_id,
        "active_plan": active_plan.model_dump() if active_plan else None,
        "latest_plan": meal_plan_from_row(latest).model_dump() if latest else None,
        "unassigned_plans": unassigned_plans,
        "history_plans": history_plans,
        "slots": slots,
    }


def expected_start_for_slot(
    db: Session,
    user_id: str,
    slot_key: SlotKey,
    *,
    replace: bool = False,
    today: date | None = None,
    start_date: date | None = None,
) -> date:
    """Resolve canonical start_date for a slot action."""
    today = today or date.today()
    schedule = build_meal_plan_schedule(db, user_id, today)
    slots = schedule["slots"]

    if start_date is not None:
        matched = next(
            (
                s
                for s in slots
                if date.fromisoformat(s["starts_on"]) == start_date
                and (
                    s["slot_key"] == slot_key
                    or (
                        slot_key == "empty"
                        and s["occupancy"] == "empty"
                        and "add" in s["actions"]
                    )
                )
            ),
            None,
        )
        if matched is not None:
            if slot_key == "current" and replace and matched["occupancy"] == "active":
                return today
            return start_date

    slot = next((s for s in slots if s["slot_key"] == slot_key), None)
    if slot_key == "empty":
        # Prefer the trailing addable week, not a queued upcoming week that
        # also uses slot_key "empty".
        slot = next(
            (
                s
                for s in reversed(slots)
                if s["occupancy"] == "empty" and "add" in s["actions"]
            ),
            slot,
        )
    if slot is None:
        raise ValueError(f"Unknown slot {slot_key}")

    if slot_key == "current" and replace and slot["occupancy"] == "active":
        return today
    return date.fromisoformat(slot["starts_on"])


def allowed_starts_for_slot(
    db: Session,
    user_id: str,
    slot_key: SlotKey,
    *,
    replace_active: bool = False,
    today: date | None = None,
) -> set[date]:
    today = today or date.today()
    schedule = build_meal_plan_schedule(db, user_id, today)
    allowed: set[date] = set()
    for slot in schedule["slots"]:
        start = date.fromisoformat(slot["starts_on"])
        if slot["slot_key"] == slot_key:
            if slot_key == "empty" and slot["occupancy"] != "empty":
                continue
            allowed.add(start)
            if (
                slot_key == "current"
                and replace_active
                and slot["occupancy"] == "active"
            ):
                allowed.add(today)
        if (
            slot_key == "empty"
            and slot["occupancy"] == "empty"
            and "add" in slot["actions"]
        ):
            allowed.add(start)
    return allowed


def validate_slot_start(
    db: Session,
    user_id: str,
    start_date: date,
    slot_key: SlotKey | None,
    *,
    replace_active: bool = False,
    today: date | None = None,
) -> None:
    """Raise APIError-compatible check via caller if start_date mismatches slot."""
    from app.core.errors import APIError

    if slot_key is None:
        return

    today = today or date.today()
    allowed = allowed_starts_for_slot(
        db,
        user_id,
        slot_key,
        replace_active=replace_active,
        today=today,
    )
    if start_date in allowed:
        return

    expected = expected_start_for_slot(
        db,
        user_id,
        slot_key,
        replace=replace_active or slot_key in ("current", "next"),
        today=today,
        start_date=start_date,
    )
    raise APIError(
        400,
        "INVALID_SLOT_START",
        f"Ngày áp dụng phải là {expected.isoformat()} cho slot '{slot_key}'.",
    )
