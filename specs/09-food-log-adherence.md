# Spec: Ghi nhận Ăn uống Thực tế & Tuân thủ (Food Log)

## Status
Done (core) — implement theo phạm vi tối thiểu ADR-009 (2026-08-17). Toàn bộ luồng dưới đây đã as-built (`routes_food_log.py`, `schemas/food_log.py`, `services/food_log_service.py`, `models/food_log.py`).

## 1. Mục tiêu (Why)
Meal plan chỉ là "kế hoạch" — hệ thống cần biết bệnh nhân **thực tế** đã ăn gì để (a) tính tuân thủ cho bác sĩ theo dõi, (b) phát hiện tương tác nguy hiểm nếu bệnh nhân ăn món ngoài kế hoạch trùng với thuốc đang dùng.

## 2. User story
Là **bệnh nhân**, tôi muốn ghi nhận nhanh mỗi bữa ăn là "đã ăn theo kế hoạch" hoặc "ăn khác + ghi chú", để bác sĩ của tôi biết tôi tuân thủ thực đơn đến đâu, và để hệ thống cảnh báo nếu tôi ăn nhầm món tương tác với thuốc.

## 3. Business rules (as-built)
1. **Phạm vi tối thiểu (theo ADR-009):** nhập tay có cấu trúc — mỗi bữa (theo slot) chọn 1 trong 2: `as_planned` (đã ăn theo kế hoạch) hoặc `custom` (ăn khác, kèm `note` free-text bắt buộc, validate bởi `FoodLogCreate.note_required_for_custom`). **Không** làm nhận diện ảnh món ăn, **không** làm NLP parse tự do thành danh sách món có định lượng dinh dưỡng — quá phức tạp cho quy mô demo, đã bị brief xếp Won't Have.
2. **Slot vocabulary:** 4 slot cố định `"morning" | "noon" | "evening" | "snack"` (Bữa sáng/Bữa trưa/Bữa tối/Bữa phụ). Ánh xạ meal plan: `morning≈breakfast`, `noon≈lunch`, `evening≈dinner`, `snack≈snack`. Khi đối chiếu tuân thủ (`specs/10`), gồm cả bữa phụ.
3. **Không có workflow duyệt** — `FoodLog.status` chỉ có `"logged"` (không có `pending`/`rejected` như meal plan), vì đây là ghi nhận thực tế đã xảy ra, không phải đề xuất cần bác sĩ chấp thuận.
4. **Liên kết Alert (as-built):** khi log `type="custom"` với `note` không rỗng, `_persist_food_log_alerts` (`services/food_log_service.py`) gọi `interaction_checker_agent.check_interactions` với `medications` từ `Profile` của patient và `foods=[note]` — nếu khớp KB tương tác, tạo `Alert` mới (dùng lại đúng service chung ở `specs/08-drug-food-interaction-check.md`, không viết lại logic matching riêng) + gọi `NotificationService.on_alert_created`. `alert_ids[]` được ghi lại trên `FoodLog`.
5. `FoodLog.user_id`/`meal_plan_id`/`id` đều kiểu `str` (UUID) — nhất quán convention toàn hệ thống.
6. **Mức ưu tiên: Should Have**, không nằm trên North Star demo flow (đăng nhập bác sĩ → generate → duyệt → bệnh nhân xem → chat hỏi lại — không cần Food Log để hoàn thành).
7. Nếu `meal_plan_id` được gửi kèm, BE kiểm tra plan đó thuộc đúng patient đang gọi API → không khớp trả `403 FORBIDDEN`.
8. **Ngày lịch = Asia/Ho_Chi_Minh (UTC+7)** — "hôm nay", filter `GET /food-log?date=`, và aggregation tuân thủ (`specs/10`) đều dùng ngày dương lịch Việt Nam, không dùng `date.today()` UTC của container. `logged_at` lưu UTC (naive trong DB) và serialize timezone-aware trên API.
9. **Một user / một ngày VN / một slot = một log** — `POST /food-log` upsert row hiện có (giữ `id`) thay vì tạo bản ghi trùng khi bệnh nhân bấm lại.

## 4. Luồng chính (happy path)
1. Patient mở trang ghi nhận bữa ăn (4 slot cố định: sáng/trưa/tối/phụ).
2. Với mỗi slot: chọn "Đã ăn theo kế hoạch" (→ `type="as_planned"`) hoặc "Ăn khác" (→ `type="custom"`, bắt buộc nhập `note`).
3. FE gọi `POST /food-log`.
4. BE persist `FoodLog`; nếu `custom` + khớp KB tương tác → tạo `Alert` liên kết (`alert_ids[]`).
5. Patient xem lại lịch sử log qua `GET /food-log` (filter theo `date`/`meal_plan_id`).
6. Dữ liệu log tổng hợp làm input cho `specs/13-ai-chat-assistant.md` (intent `food_log` đọc 3 log gần nhất) và gián tiếp cho `specs/10-doctor-compliance-view.md` (nguồn tuân thủ chính hiện tại vẫn là `Notification(type="adherence_checkin")`, không trực tiếp qua `FoodLog` — xem ADR-008).

## 5. Edge cases
- Intent `food_log` trong `/chat` map tới `food_log_node` — đọc 3 `FoodLog` gần nhất từ DB theo `user_id` và tóm tắt tuân thủ (fallback message cố định khi không có log nào), xem `specs/13`.
- `POST /food-log` với `type="custom"` và `note` rỗng → `422` validation error (`note_required_for_custom`).
- `GET /food-log?date=YYYY-MM-DD` lọc theo **ngày dương lịch Asia/Ho_Chi_Minh** của `logged_at` (cửa sổ UTC tương ứng, ví dụ 17:10 UTC ngày 23 = 00:10 VN ngày 24). `date.fromisoformat` không hợp lệ → bỏ qua filter ngày, không lỗi.
- `meal_plan_id` gửi kèm không thuộc về patient gọi API → `403 FORBIDDEN`.

## 6. Ngoài phạm vi (Out of scope)
- Nhận diện ảnh món ăn (Could Have riêng, khác hẳn phạm vi Food Log text).
- NLP parse câu tự do thành định lượng dinh dưỡng chi tiết.
- Đối chiếu tuân thủ tự động theo từng món cụ thể (chỉ tuân thủ ở mức "theo kế hoạch hay không" theo slot).
- Workflow duyệt/sửa food log đã ghi (không có `PUT`/`DELETE` — ghi 1 lần, không sửa lại).

## 7. Schema tham chiếu
- `FoodLogCreate`, `FoodLogOut` — `contracts/agent-io-schema.md` §3.
- `Alert` — `contracts/agent-io-schema.md` §4.

## 8. API liên quan
| Method | Path | Role |
|---|---|---|
| POST | `/food-log` | patient |
| GET | `/food-log` | patient |

## 9. Liên quan
- `adrs/009-food-log-scope-strategy.md` — quyết định phạm vi gốc.
- `specs/08-drug-food-interaction-check.md` — service dùng chung cho matching.
- `specs/10-doctor-compliance-view.md` — nơi tín hiệu tuân thủ được bác sĩ xem lại.
- `specs/13-ai-chat-assistant.md` — intent `food_log` đọc dữ liệu thật từ DB.
- `contracts/agent-io-schema.md` §3.
