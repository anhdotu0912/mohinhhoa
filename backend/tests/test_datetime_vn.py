"""Unit tests for Asia/Ho_Chi_Minh calendar helpers."""

from __future__ import annotations

from datetime import UTC, date, datetime

from app.core.datetime_vn import (
    assume_utc,
    vn_calendar_date,
    vn_day_bounds_utc,
    vn_today,
)


def test_vn_calendar_date_utc_evening_is_next_vn_day():
    # 16:50 UTC = 23:50 VN same calendar date
    assert vn_calendar_date(datetime(2026, 8, 23, 16, 50, 0)) == date(2026, 8, 23)
    # 17:10 UTC = 00:10 VN the next calendar date
    assert vn_calendar_date(datetime(2026, 8, 23, 17, 10, 0)) == date(2026, 8, 24)


def test_vn_day_bounds_utc_covers_vn_midnight():
    start, end = vn_day_bounds_utc(day=date(2026, 8, 24))
    assert start == datetime(2026, 8, 23, 17, 0, 0)
    assert end == datetime(2026, 8, 24, 17, 0, 0)


def test_vn_today_follows_injected_now():
    assert vn_today(datetime(2026, 8, 23, 16, 50, tzinfo=UTC)) == date(2026, 8, 23)
    assert vn_today(datetime(2026, 8, 23, 17, 10, tzinfo=UTC)) == date(2026, 8, 24)
    assert vn_today(datetime(2026, 8, 23, 17, 10, 0)) == date(2026, 8, 24)


def test_assume_utc_treats_naive_as_utc():
    aware = assume_utc(datetime(2026, 8, 23, 17, 10, 0))
    assert aware.tzinfo is not None
    assert aware.utcoffset().total_seconds() == 0
