# Spec: Bác sĩ Duyệt Thực đơn (HITL)

## Status
Done — `approve`/`reject`/`edit` hoạt động đúng side-effect mô tả dưới đây. **Cập nhật 2026-08-18:** optimistic lock (rule 8, `409 PLAN_ALREADY_REVIEWED`) đã **Done**.

## 1. Mục tiêu (Why)
AI không được tự chẩn đoán hoặc tự quyết định thực đơn cuối cùng cho bệnh nhân (luật cứng `CLAUDE.md` Mục 7) — mọi plan phải qua con người có chuyên môn xác nhận trước khi bệnh nhân coi đó là "thực đơn chính thức". Đây là bước HITL bắt buộc của North Star demo.

## 2. User story
Là **bác sĩ**, tôi muốn xem danh sách thực đơn đang chờ duyệt, và với mỗi thực đơn tôi có thể chấp thuận nguyên trạng, từ chối kèm ghi chú, hoặc sửa trực tiếp nội dung trước khi chấp thuận, để đảm bảo mọi thực đơn bệnh nhân nhận được đều đã qua kiểm duyệt chuyên môn.

## 3. Business rules
1. **3 action duy nhất:** `approve | reject | edit` — không có action khác (không có "yêu cầu sửa lại" tách biệt khỏi `reject`; muốn sửa nội dung phải dùng `edit`, không dùng `reject` rồi tạo lại).
2. **`approve`:** `status → "approved"`, gắn `trust_badge="doctor_reviewed"`. Side-effect: tạo `Notification(type="plan_approved", status="sent")` gửi ngay cho patient. **Không** materialize `meal_reminder`/`adherence_checkin` tại bước duyệt — gọi `POST /doctor/meal-plans/{id}/apply` sau khi bác sĩ chọn ngày áp dụng (ADR-011).
3. **`reject`:** `status → "rejected"`, **không** gắn `trust_badge`. Side-effect: **huỷ (set `status="cancelled"`) toàn bộ notification tương lai đang ở trạng thái `pending`** có `related_ids.meal_plan_id` khớp plan này — không đụng tới notification đã `sent`/`read`/`done`, không đụng notification của plan khác. Đây là hành vi đúng để tránh bệnh nhân vẫn nhận nhắc nhở cho 1 plan đã bị từ chối.
4. **`edit`:** bắt buộc gửi `edited_plan` (full replace `days[]`/`swaps[]`/`citations[]`, **không có** API sửa từng món riêng lẻ — bác sĩ phải gửi lại toàn bộ cấu trúc plan). `status → "edited"`, gắn `trust_badge="doctor_reviewed"`. Tạo `plan_approved` notification; reminders khi `apply`.
5. Thiếu `edited_plan` khi `action="edit"` → `400 EDITED_PLAN_REQUIRED`.
6. `GET /doctor/meal-plans` mặc định chỉ trả `status="pending_review"` (hàng đợi cần xử lý); dùng `status=all` để xem toàn bộ lịch sử review.
7. **Guardrail liên quan:** khi review, bác sĩ có thể thấy `swaps[]` (món đã bị AI tự đổi do tương tác thuốc) — bác sĩ **không** có quyền qua API này để "đổi thuốc" của bệnh nhân, chỉ đổi được nội dung thực đơn (`edited_plan`). Đổi thuốc là quyết định y khoa riêng, nằm ngoài phạm vi hệ thống này.
8. **Optimistic lock (as-built 2026-08-18):** để tránh race condition 2 doctor cùng review 1 plan (xem Edge case), endpoint kiểm tra `status == "pending_review"` ngay trước khi áp dụng action (`routes_doctor.py`) — nếu plan không còn ở trạng thái chờ (đã bị doctor khác xử lý trước), trả `409 PLAN_ALREADY_REVIEWED` thay vì ghi đè âm thầm.
9. **Patient yêu cầu điều chỉnh (`specs/07`) tái sử dụng luồng này:** khi patient gọi `POST /meal-plans/{id}/request-adjustment` (Done) trên 1 plan đã `approved`, BE set lại `status="pending_review"` kèm `adjustment_note` — plan quay lại hàng đợi `GET /doctor/meal-plans` để doctor xử lý qua đúng endpoint `review` này (không cần API riêng cho trường hợp này).
10. **Gán lịch sau duyệt (ADR-012, cập nhật 2026-08-27):** sau `approve`/`edit`, bác sĩ chọn **Bắt đầu hôm nay** (`apply_mode=from_today`) hoặc **Xếp tiếp nối** (`apply_mode=after_current`) qua `POST .../apply`. Không còn chọn slot tuần này/tuần sau trên UI generate/review. Trang lịch sử hiển thị 3 chu kỳ 7 ngày (đã qua / đang áp dụng / xếp sẵn) chỉ để xem; gán thực đơn qua apply_mode.

## 4. Luồng chính (happy path)
1. Doctor mở hàng đợi duyệt → `GET /doctor/meal-plans` (default `pending_review`).
2. Doctor xem chi tiết 1 plan → `GET /meal-plans/{meal_plan_id}` (doctor xem được plan của bất kỳ patient nào, không giới hạn ownership).
3. Doctor chọn 1 trong 3 action → `POST /doctor/meal-plans/{meal_plan_id}/review`.
4. BE cập nhật `status`, side-effect notification tương ứng action (xem rule 2–4).
5. Patient thấy trạng thái mới khi mở lại `GET /meal-plans/me` hoặc nhận notification (nếu `approve`).

## 5. Edge cases
- **Race condition 2 doctor cùng review 1 plan (đã đóng, as-built 2026-08-18):** hệ thống "1 doctor thấy toàn bộ hàng đợi" (`specs/03` rule 1) — nếu 2 doctor cùng mở 1 plan `pending_review` và cùng bấm action gần như đồng thời, request thứ 2 (khi plan không còn `pending_review`) nhận `409 PLAN_ALREADY_REVIEWED` thay vì ghi đè âm thầm (rule 8), tránh trạng thái không nhất quán (ví dụ doctor A approve xong, doctor B reject ngay sau sẽ bị chặn).
- Doctor review 1 plan đã ở trạng thái `approved`/`rejected`/`edited` (không còn `pending_review`) → `409 PLAN_ALREADY_REVIEWED` (rule 8).
- `edited_plan` gửi thiếu field bắt buộc trong `DayPlan`/`FoodItem` (ví dụ thiếu `days_count=7`) → tuỳ mức validation Pydantic của `MealPlanOutput`, có thể `422` nếu field required không khớp type, nhưng **không có validation nghiệp vụ** kiểm tra đủ 7 ngày hay tổng dinh dưỡng hợp lý khi doctor tự `edit` — trách nhiệm đảm bảo tính hợp lý thuộc về doctor khi dùng `edit`.
- Doctor review plan của patient không tồn tại/plan không tồn tại → `404 MEAL_PLAN_NOT_FOUND`.

## 6. Ngoài phạm vi (Out of scope)
- Sửa từng món riêng lẻ qua API (chỉ có full-replace `edited_plan`).
- Duyệt theo lô (bulk approve nhiều plan 1 lần) — không có endpoint.
- Lịch sử review (ai đã review, sửa gì so với bản gốc) — chỉ lưu trạng thái cuối cùng, không lưu diff/audit trail.

## 7. Schema tham chiếu
- `ReviewRequest`, `MealPlanOutput.status`, `MealPlanOutput.trust_badge` — `contracts/api-v1.md` §9.
- `ReviewRequest.action` enum — bảng Enum tham chiếu cuối `contracts/api-v1.md`.

## 8. API liên quan
| Method | Path | Role |
|---|---|---|
| GET | `/doctor/meal-plans` | doctor |
| POST | `/doctor/meal-plans/{meal_plan_id}/review` | doctor |
| POST | `/doctor/demo/plan-expiry` | doctor (demo-only, chặn ở production) |

## 9. Liên quan
- `specs/05-meal-plan-generation.md` — nguồn plan cần duyệt.
- `specs/07-patient-meal-plan-view.md` — nơi patient gửi yêu cầu điều chỉnh, tái sử dụng luồng review này.
- `specs/11-compliance-notification-delivery.md` — cơ chế notification bị tạo/huỷ theo action.
- `adrs/006-hitl-guardrails-strategy.md`.
- `contracts/api-v1.md` §9.
