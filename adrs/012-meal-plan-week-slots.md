# ADR-012: Lịch trình thực đơn theo slot tuần kế hoạch

## Status
Accepted

## Context
ADR-011 đã tách generate/approve khỏi apply và lưu `starts_on`/`ends_on`. FE vẫn chọn ngày thủ công sau duyệt (default hôm nay), dễ overlap. Bác sĩ cần bảng “tuần này / tuần sau / trống” trên trang lịch sử để gán plan trước khi tạo nội dung.

## Decision

1. **Đơn vị thời gian:** “Tuần kế hoạch” = 7 ngày liên tiếp (`starts_on` … `starts_on+6`), **không** căn tuần lịch Thứ 2–CN.
2. **Slot suy ra (DTO), không persist:** `current` (active hoặc trống từ hôm nay), `next` (upcoming liền kề hoặc trống), `empty` (slot trống đầu tiên sau hàng đợi). Không thêm `week_index` hay enum `active` trên DB.
3. **Luồng UI:** Bác sĩ chọn slot trên `/doctor/history/{patientId}` → generate/review → auto-apply với `start_date` đã chốt. Trang generate chỉ tạo nội dung.
4. **Replace tuần này:** `start_date = today`, `replace_active: true` — cắt plan active cũ `ends_on = today - 1`.
5. **Replace tuần sau:** ghi đè cùng `starts_on`/`ends_on`; plan cũ unapply (`starts_on`/`ends_on = NULL`).
6. **Thêm tuần trống:** `start_date` = ngày sau plan xa nhất (hoặc `today` nếu chưa có applied). Validate `INVALID_SLOT_START` nếu lệch slot.
7. **API:** `GET /doctor/patients/{id}/meal-plan-schedule` trả slots + actions; `GET /doctor/patients/{id}/meal-plans` list theo BN.
8. **`plan_usage` list BN:** giữ `none|active|finished` (upcoming gộp `active`).

## Consequences

**Positive:** Tránh overlap mặc định; UX rõ tuần nào đang/chuẩn bị chạy; tái dùng ADR-011.

**Negative:** Lưới món theo tuần lịch có thể lệch thứ so với slot 7 ngày — chấp nhận cho prototype.

**Out of scope:** tuần ISO Mon–Sun, duration 3/14 ngày, `unapply` endpoint, `replaced_by_id`.

## Related
- ADR-011 (apply-time validity)
- `specs/03`, `specs/06`, `contracts/api-v1.md` §8–9
