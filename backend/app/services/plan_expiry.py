"""Tính hạn sử dụng của meal plan đã duyệt — phục vụ cảnh báo bác sĩ.

Nguyên tắc (không có cột start/end trong DB):
- Thực đơn bắt đầu có hiệu lực từ ngày được duyệt (`reviewed_at`),
  fallback ngày tạo (`created_at`).
- Thời lượng = số ngày trong `days` (mặc định 7).
- `days_left` = (ngày kết thúc − hôm nay).days.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Literal

# Còn <= số ngày này thì coi là "sắp ăn xong"
EXPIRING_THRESHOLD_DAYS = 2

PlanExpiryBucket = Literal["expiring", "expired", "ok", "none"]

# Trạng thái plan được tính hạn dùng và gửi notification hết hạn
EXPIRY_ELIGIBLE_STATUSES = frozenset({"approved", "edited"})


def duration_days(days_count: int | None) -> int:
    """Số ngày thực đơn có hiệu lực (mặc định 7)."""
    return max(1, days_count or 7)


def start_date(
    reviewed_at: datetime | None, created_at: datetime | None
) -> date | None:
    """Ngày bắt đầu có hiệu lực: ngày duyệt nếu có, ngược lại ngày tạo."""
    base = reviewed_at or created_at
    if base is None:
        return None
    return base.date()


def end_date(
    reviewed_at: datetime | None,
    created_at: datetime | None,
    days_count: int | None,
) -> date | None:
    """Ngày cuối cùng thực đơn còn hiệu lực (ngày bắt đầu + duration − 1)."""
    start = start_date(reviewed_at, created_at)
    if start is None:
        return None
    return start + timedelta(days=duration_days(days_count) - 1)


def days_left(
    reviewed_at: datetime | None,
    created_at: datetime | None,
    days_count: int | None,
    today: date | None = None,
) -> int | None:
    """Số ngày còn lại; None nếu không xác định được mốc bắt đầu."""
    end = end_date(reviewed_at, created_at, days_count)
    if end is None:
        return None
    return (end - (today or date.today())).days


def bucket(
    reviewed_at: datetime | None,
    created_at: datetime | None,
    days_count: int | None,
    today: date | None = None,
) -> PlanExpiryBucket:
    """Phân loại trạng thái hạn của thực đơn:
    - ``expiring``: còn 1..2 ngày (sắp ăn xong)
    - ``expired``: đã hết hạn (không còn thực đơn)
    - ``ok``: còn nhiều ngày
    - ``none``: không xác định được (chưa có mốc bắt đầu)
    """
    left = days_left(reviewed_at, created_at, days_count, today)
    if left is None:
        return "none"
    if left <= 0:
        return "expired"
    if left <= EXPIRING_THRESHOLD_DAYS:
        return "expiring"
    return "ok"
