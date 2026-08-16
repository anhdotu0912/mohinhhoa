"""Tính hạn sử dụng meal plan — ưu tiên cột starts_on/ends_on nếu đã apply."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Literal

EXPIRING_THRESHOLD_DAYS = 2

PlanExpiryBucket = Literal["expiring", "expired", "ok", "none"]

EXPIRY_ELIGIBLE_STATUSES = frozenset({"approved", "edited"})


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
    return (end - (today or date.today())).days


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
    if left <= 0:
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
    today = today or date.today()
    if status not in EXPIRY_ELIGIBLE_STATUSES:
        return "none" if status == "rejected" else "pending"
    if starts_on is None or ends_on is None:
        return "none"
    if starts_on <= today <= ends_on:
        return "active"
    if today < starts_on:
        return "upcoming"
    return "finished"
