# ADR-011: Cửa sổ áp dụng thực đơn (Apply-time Validity)

## Status
Accepted

## Context
Meal plan hiện không lưu `starts_on`/`ends_on`. Hạn dùng suy từ `reviewed_at`/`created_at` + `len(days)` (`services/plan_expiry.py`). Generate và duyệt không tách bạch với “áp dụng lịch”; reminder materialize neo `date.today()` lúc approve. Bệnh nhân có thể có nhiều plan approved chồng ngày; “active” chỉ là suy luận FE.

Yêu cầu sản phẩm: **tạo thực đơn trước**, bác sĩ **chọn ngày áp dụng sau** khi plan đã duyệt; có thể **thay plan đang chạy** bằng plan khác; lọc danh sách BN theo usage.

## Decision

1. Thêm `starts_on`, `ends_on` (`DATE`, nullable) trên `meal_plans`. `NULL` = chưa áp dụng.
2. **Generate không nhận ngày.** HITL `status` giữ nguyên (`pending_review|approved|rejected|edited`).
3. **Apply** (`POST /doctor/meal-plans/{id}/apply`) — chỉ plan `approved|edited`: gán `starts_on` (bác sĩ chọn), `ends_on = starts_on + 6`, stamp `days[].date`, materialize reminder theo ngày áp dụng.
4. **Active** = `approved|edited` + đã apply + `starts_on ≤ today ≤ ends_on`. **Upcoming** = đã apply + `today < starts_on`. Không persist enum `active`/`expired`.
5. **Replace:** apply plan mới khi đang có active → cắt `old.ends_on = new.starts_on - 1` (giữ lịch sử). `replace_active: true` (mặc định UI thay thế).
6. Overlap với plan khác (không phải plan đang bị replace): **409 PLAN_DATE_OVERLAP**.
7. Approve **không** gán ngày, **không** materialize meal reminders (chỉ notification `plan_approved`).
8. Backfill plan `approved|edited` cũ: `starts_on = date(reviewed_at or created_at)`, `ends_on = starts_on + duration - 1`.

## Consequences

**Positive:** Tách generate vs lịch áp dụng; tránh overlap; patient `/me` và doctor list dựa plan thật sự active.

**Negative:** Plan đã duyệt nhưng chưa apply không có reminder — cần UX “Áp dụng” rõ trên chi tiết BN.

**Out of scope vòng này:** chọn ngày lúc generate; duration 3/14 ngày; `unapply` endpoint riêng.
