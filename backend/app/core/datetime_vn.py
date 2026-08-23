"""Asia/Ho_Chi_Minh calendar helpers — shared by metrics, food-log, compliance.

Stored timestamps in this app are naive UTC (TIMESTAMP WITHOUT TIME ZONE).
Treat naive values as UTC when converting to a Vietnam calendar day.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta, timezone

VN_TZ = timezone(timedelta(hours=7))


def assume_utc(dt: datetime) -> datetime:
    """Treat naive datetime as UTC; return timezone-aware UTC."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def vn_now(now: datetime | None = None) -> datetime:
    if now is None:
        now = datetime.now(UTC)
    else:
        now = assume_utc(now)
    return now.astimezone(VN_TZ)


def vn_today(now: datetime | None = None) -> date:
    return vn_now(now).date()


def vn_calendar_date(dt: datetime) -> date:
    """Vietnam calendar date for a stored timestamp (naive = UTC)."""
    return assume_utc(dt).astimezone(VN_TZ).date()


def vn_day_bounds_utc(
    day: date | None = None,
    now: datetime | None = None,
) -> tuple[datetime, datetime]:
    """Naive UTC [start, end) covering one Asia/Ho_Chi_Minh calendar day.

    Matches stored TIMESTAMP WITHOUT TIME ZONE columns (UTC wall clock).
    Example: VN 2026-08-24 → [2026-08-23 17:00:00, 2026-08-24 17:00:00).
    """
    if day is None:
        day = vn_today(now)
    vn_start = datetime(day.year, day.month, day.day, tzinfo=VN_TZ)
    vn_end = vn_start + timedelta(days=1)
    return (
        vn_start.astimezone(UTC).replace(tzinfo=None),
        vn_end.astimezone(UTC).replace(tzinfo=None),
    )


def utc_now_naive() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)
