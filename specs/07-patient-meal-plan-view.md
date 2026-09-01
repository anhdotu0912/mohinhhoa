# Spec: Bệnh nhân Xem Thực đơn

## Status
Done (Must/Should Have) — xem chi tiết, xem món thay thế (`swaps[]`/`alternatives[]`), và yêu cầu điều chỉnh plan (§3 rule 6) đều as-built. Danh sách đi chợ và gợi ý khu vực bán vẫn Planned (Could Have, xem §6).

## 1. Mục tiêu (Why)
Sau khi thực đơn được sinh (và lý tưởng là đã được bác sĩ duyệt), bệnh nhân cần xem chi tiết từng ngày/từng bữa, hiểu vì sao 1 món bị đổi (swap do tương tác thuốc), và biết món nào có thể thay thế nếu không thích/không có sẵn.

## 2. User story
Là **bệnh nhân**, tôi muốn xem chi tiết thực đơn 7 ngày của mình (từng bữa, dinh dưỡng, món thay thế, lý do các món bị đổi), để tôi biết chính xác nên ăn gì và vì sao.

## 3. Business rules
1. Patient chỉ xem được **plan của chính mình** qua `GET /meal-plans/{meal_plan_id}` — nếu `id` thuộc plan của user khác → `403 FORBIDDEN` (khác doctor, xem được plan bất kỳ patient).
2. `GET /meal-plans/me` ưu tiên plan **đang áp dụng hôm nay** (ADR-011); không có thì plan **upcoming** đã apply; cuối cùng fallback bản mới nhất theo `created_at`.
3. Hiển thị `status` rõ ràng cho patient biết plan đã được duyệt hay chưa (`pending_review`/`approved`/`rejected`/`edited`) — đặc biệt quan trọng để patient không nhầm 1 plan `pending_review` là "chính thức" trước khi bác sĩ duyệt (nguyên tắc HITL, `specs/06`).
4. `FoodItem.alternatives[]` đã được lọc an toàn từ trước (không dị ứng, không phạm preference cứng, không tương tác nguy hiểm) — patient chọn món thay thế trong danh sách này **không cần gọi thêm API kiểm tra an toàn**, vì đã lọc sẵn ở bước generate (`specs/05` §3.3).
5. `swaps[]` hiển thị lý do cụ thể (`reason`, ví dụ "Tương tác thuốc (warfarin + rau muống)...") — patient cần thấy rõ vì sao món gốc bị đổi, tăng minh bạch/niềm tin vào AI.
6. **Yêu cầu điều chỉnh plan (as-built):** patient có thể gửi yêu cầu điều chỉnh trên 1 plan đã `approved` (ví dụ không ăn được món cụ thể nào đó), nhưng **yêu cầu này cần được bác sĩ duyệt lại**, không tự động áp dụng/regenerate. Qua `POST /meal-plans/{meal_plan_id}/request-adjustment` (`routes_meal_plan.py`), plan quay lại `status="pending_review"` kèm `adjustment_note`, tái sử dụng đúng luồng review đã có (`specs/06-meal-plan-review.md`) — không cần bác sĩ dùng API/luồng riêng nào khác.

## 4. Luồng chính (happy path)
1. Patient mở trang "Thực đơn của tôi" → FE gọi `GET /meal-plans/me`.
2. FE hiển thị 7 ngày, mỗi ngày 4 bữa, mỗi món kèm dinh dưỡng + citation.
3. Patient bấm vào 1 món → xem `alternatives[]` nếu muốn đổi (chỉ là xem, **không có API "chọn món thay thế" để ghi nhận patient đã đổi** — nếu muốn ghi nhận thực tế patient ăn món nào, đó là phạm vi Food Log, xem `specs/09`).
4. Patient xem `swaps[]` ở cấp ngày để hiểu món nào đã bị AI đổi và lý do.

## 5. Edge cases
- Patient chưa từng generate plan nào → `GET /meal-plans/me` trả `404 NO_MEAL_PLAN`.
- Plan đang ở trạng thái `rejected` — patient vẫn xem được nội dung (API không chặn xem plan `rejected`), FE cần tự hiển thị rõ trạng thái để tránh patient hiểu nhầm đây là thực đơn nên theo.
- Patient gọi `request-adjustment` trên plan đang `pending_review`/`rejected`/`edited` (chưa/không phải `approved`) → `400 PLAN_NOT_APPROVED` (chỉ cho phép yêu cầu điều chỉnh trên plan đã duyệt, vì plan chưa duyệt vốn đã đang chờ bác sĩ xem, không cần thêm hành động này).
- Patient gửi nhiều yêu cầu điều chỉnh liên tiếp trước khi bác sĩ kịp xử lý → không có hàng đợi nhiều yêu cầu, mỗi lần gọi ghi đè `adjustment_note` cũ (nhất quán với cách `MealPlan` chỉ giữ 1 trạng thái hiện tại, không phải danh sách yêu cầu).

## 6. Ngoài phạm vi (Out of scope)
- **Danh sách đi chợ** (tự tổng hợp nguyên liệu cần mua từ 7 ngày thực đơn) — **Status: Planned**, thuộc Could Have theo `CLAUDE.md` Mục 2, không có endpoint/schema nào as-built. Thiết kế đề xuất (chưa chốt): 1 endpoint mới `GET /meal-plans/{id}/shopping-list` tổng hợp `FoodItem.name` + ước lượng số lượng theo `portion`, nhưng chưa được ưu tiên cho vòng demo này.
- **Gợi ý khu vực bán** (chỉ điểm cửa hàng/chợ gần vị trí bệnh nhân) — **Status: Planned**, Could Have, cần tích hợp bản đồ/vị trí bên ngoài phạm vi hiện tại của hệ thống — không có thiết kế cụ thể nào được đề xuất trong tài liệu này do phụ thuộc dịch vụ bên thứ 3 chưa được chốt.
- Export PDF thực đơn — Could Have theo `CLAUDE.md`, chưa có endpoint.

## 7. Schema tham chiếu
- `MealPlanOutput`, `DayPlan`, `Meal`, `FoodItem.alternatives[]`, `Swap` — `contracts/agent-io-schema.md` §2.

## 8. API liên quan
| Method | Path | Role |
|---|---|---|
| GET | `/meal-plans/me` | patient |
| GET | `/meal-plans/{meal_plan_id}` | patient (chỉ plan của mình) |
| POST | `/meal-plans/{meal_plan_id}/request-adjustment` | patient (chỉ plan của mình) |

## 9. Liên quan
- `specs/05-meal-plan-generation.md` — nguồn dữ liệu hiển thị.
- `specs/06-meal-plan-review.md` — ý nghĩa của `status`; nơi bác sĩ xử lý yêu cầu điều chỉnh.
- `specs/09-food-log-adherence.md` — nơi ghi nhận thực tế patient ăn gì (khác với chỉ "xem" ở spec này).
- `contracts/api-v1.md` §4.
