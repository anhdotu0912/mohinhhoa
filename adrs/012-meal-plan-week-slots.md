# ADR-012: Lịch trình thực đơn theo slot tuần kế hoạch

## Status
Accepted (superseded phần slot-gating apply — cập nhật 2026-08-27)

## Context
ADR-011 đã tách generate/approve khỏi apply và lưu `starts_on`/`ends_on`. FE v1 chọn slot tuần này/tuần sau trước generate → gây nhầm với chờ duyệt/đã dùng/hết hạn và lệch lưới trượt mỗi ngày.

## Decision

1. **Đơn vị thời gian:** “Chu kỳ 7 ngày” = `starts_on` … `starts_on+6`, **không** căn tuần lịch Thứ 2–CN.
2. **Schedule API (DTO):** vẫn trả slots `current|next|empty` + `unassigned_plans` để **hiển thị** lịch 3 cột (đã qua / đang áp dụng / xếp sẵn). Không nhét plan chưa xếp vào ô trống.
3. **Apply (mới):** `POST .../apply` nhận `apply_mode`:
   - `from_today` → `start_date=today`, tự `replace_active` nếu có plan active (cắt `ends_on` cũ = hôm qua).
   - `after_current` → `start_date = max(ends_on) + 1` trên các plan applied còn hiệu lực; `400 NO_CHAIN_PLAN` nếu chưa có.
4. **Luồng UI:** Generate chỉ tạo nội dung (`pending_review`). Sau duyệt, bác sĩ chọn apply_mode. Gia hạn = apply lại cùng plan với `after_current` (còn hạn) hoặc `from_today` (đã hết).
5. **Legacy:** `start_date` + `slot_key` vẫn chấp nhận cho client/tests cũ; FE mới không gửi `slot_key`.
6. **`plan_usage` list BN:** giữ `none|active|finished` (upcoming gộp `active`).

## Consequences

**Positive:** Một quyết định rõ (hôm nay vs tiếp nối); tách HITL khỏi lịch; tái dùng ADR-011.

**Negative:** Lịch 3 cột vẫn trượt theo ngày — chấp nhận prototype.

**Out of scope:** tuần ISO Mon–Sun, duration 3/14 ngày, clone plan khi gia hạn.

## Related
- ADR-011 (apply-time validity)
- `specs/03`, `specs/06`, `contracts/api-v1.md` §8–9
