"""Tính hạn sử dụng meal plan — ưu tiên cột starts_on/ends_on nếu đã apply."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import TYPE_CHECKING, Literal

from app.core.datetime_vn import vn_calendar_date, vn_today

if TYPE_CHECKING:
    from app.models.meal_plan import MealPlan

EXPIRING_THRESHOLD_DAYS = 2

PlanExpiryBucket = Literal["expiring", "expired", "ok", "none"]

EXPIRY_ELIGIBLE_STATUSES = frozenset({"approved", "edited"})


def history_end_date(row: MealPlan) -> date | None:
    """An unapplied draft belongs to its creation cycle, never to an invented applied week."""
    if row.ends_on is not None:
        return row.ends_on
    if row.starts_on is not None:
        return None
    created = row.created_at or row.reviewed_at
    if created is None:
        return None
    return vn_calendar_date(created) + timedelta(days=duration_days(len(row.days or [])) - 1)


def is_plan_historical(row: MealPlan, today: date | None = None) -> bool:
    end = history_end_date(row)
    return end is not None and end < (today or vn_today())


def duration_days(days_count: int | None) -> int:
    return max(1, days_count or 7)


def start_date(
    reviewed_at: datetime | None,
    created_at: datetime | None,
    starts_on: date | None = None,
) -> date | None:
    if starts_on is not None:
        return starts_on
    base = reviewed_at or created_at
    if base is None:
        return None
    return base.date()


def end_date(
    reviewed_at: datetime | None,
    created_at: datetime | None,
    days_count: int | None,
    starts_on: date | None = None,
    ends_on: date | None = None,
) -> date | None:
    if ends_on is not None:
        return ends_on
    start = start_date(reviewed_at, created_at, starts_on)
    if start is None:
        return None
    return start + timedelta(days=duration_days(days_count) - 1)


def days_left(
    reviewed_at: datetime | None,
    created_at: datetime | None,
    days_count: int | None,
    today: date | None = None,
    starts_on: date | None = None,
    ends_on: date | None = None,
) -> int | None:
    end = end_date(
        reviewed_at, created_at, days_count, starts_on=starts_on, ends_on=ends_on
    )
    if end is None:
        return None
    return (end - (today or vn_today())).days


def bucket(
    reviewed_at: datetime | None,
    created_at: datetime | None,
    days_count: int | None,
    today: date | None = None,
    starts_on: date | None = None,
    ends_on: date | None = None,
) -> PlanExpiryBucket:
    if starts_on is None and ends_on is None and reviewed_at is None and created_at is None:
        return "none"
    left = days_left(
        reviewed_at,
        created_at,
        days_count,
        today,
        starts_on=starts_on,
        ends_on=ends_on,
    )
    if left is None:
        return "none"
    if left < 0:
        return "expired"
    if left <= EXPIRING_THRESHOLD_DAYS:
        return "expiring"
    return "ok"


def plan_usage_for_row(
    status: str,
    starts_on: date | None,
    ends_on: date | None,
    today: date | None = None,
) -> Literal["none", "pending", "active", "upcoming", "finished"]:
    today = today or vn_today()
    if status not in EXPIRY_ELIGIBLE_STATUSES:
        return "none" if status == "rejected" else "pending"
    if starts_on is None or ends_on is None:
        return "none"
    if starts_on <= today <= ends_on:
        return "active"
    if today < starts_on:
        return "upcoming"
    return "finished"
