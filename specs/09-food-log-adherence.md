# Spec: Ghi nhận Ăn uống Thực tế & Tuân thủ (Food Log)

## Status
Done (core) — implement theo phạm vi tối thiểu ADR-009 (2026-08-17).

## 1. Mục tiêu (Why)
Meal plan chỉ là "kế hoạch" — hệ thống cần biết bệnh nhân **thực tế** đã ăn gì để (a) tính tuân thủ cho bác sĩ theo dõi, (b) phát hiện tương tác nguy hiểm nếu bệnh nhân ăn món ngoài kế hoạch trùng với thuốc đang dùng.

## 2. User story
Là **bệnh nhân**, tôi muốn ghi nhận nhanh mỗi bữa ăn là "đã ăn theo kế hoạch" hoặc "ăn khác + ghi chú", để bác sĩ của tôi biết tôi tuân thủ thực đơn đến đâu, và để hệ thống cảnh báo nếu tôi ăn nhầm món tương tác với thuốc.

## 3. Business rules (thiết kế đề xuất — chưa implement)
1. **Phạm vi tối thiểu (theo ADR-009):** nhập tay có cấu trúc — mỗi bữa (theo slot) chọn 1 trong 2: `as_planned` (đã ăn theo kế hoạch) hoặc `custom` (ăn khác, kèm `note` free-text bắt buộc). **Không** làm nhận diện ảnh món ăn, **không** làm NLP parse tự do thành danh sách món có định lượng dinh dưỡng — quá phức tạp cho quy mô demo, đã bị brief xếp Won't Have.
2. **Slot vocabulary — ĐÃ QUYẾT ĐỊNH (2026-08-15): dùng theo UI hiện có.** Giữ đúng 3 slot cố định `"morning" | "noon" | "evening"` (Bữa sáng/Bữa trưa/Bữa tối) — **không** mở rộng thêm slot thứ 4 để khớp meal plan. Hệ quả chấp nhận: food log không ghi nhận riêng cho "bữa phụ/snack" (Out of scope có chủ đích, không phải gap). Khi đối chiếu tuân thủ (`specs/10`), dùng ánh xạ gần đúng `morning≈breakfast`, `noon≈lunch`, `evening≈dinner`.
3. **Không cần workflow duyệt** — `FoodLogEntry.status` chỉ có `logged`/`adjusted` (không có `pending`/`rejected` như meal plan), vì đây là ghi nhận thực tế đã xảy ra, không phải đề xuất cần bác sĩ chấp thuận.
4. **Liên kết Alert (đề xuất):** khi log `type="custom"` với `note` khớp (matching text) 1 thực phẩm trong `data/drug_food_interactions.json` mà bệnh nhân đang dùng thuốc tương ứng → hệ thống tạo `Alert` mới, dùng lại service chung ở `specs/08-drug-food-interaction-check.md` (không viết lại logic matching riêng cho food log).
5. `profile_id`/`user_id` trong `FoodLogEntry` phải dùng kiểu `str` (UUID), **không** dùng `int` như `schemas/food_log.py` hiện tại đang định nghĩa — sửa lại cho khớp convention toàn hệ thống trước khi implement (ghi rõ trong ADR-009 Negative).
6. **Mức ưu tiên: Should Have**, không nằm trên North Star demo flow (đăng nhập bác sĩ → generate → duyệt → bệnh nhân xem → chat hỏi lại — không cần Food Log để hoàn thành).

## 4. Luồng chính (happy path — thiết kế đề xuất, chưa hoạt động)
1. Patient mở trang ghi nhận bữa ăn (3 slot cố định: sáng/trưa/tối).
2. Với mỗi slot: chọn "Đã ăn theo kế hoạch" (→ `type="as_planned"`) hoặc "Ăn khác" (→ `type="custom"`, bắt buộc nhập `note`).
3. **[Planned]** FE gọi `POST /food-log`.
4. BE persist `FoodLogEntry`; nếu `custom` + khớp KB tương tác → tạo `Alert` liên kết (`alert_ids[]`).
5. Patient xem lại lịch sử log qua **[Planned]** `GET /food-log`.
6. Dữ liệu log tổng hợp làm input cho `specs/10-doctor-compliance-view.md` (thông qua tín hiệu `Notification(type="adherence_checkin")`, không trực tiếp qua `FoodLogEntry` — xem ADR-008: nguồn tuân thủ chính hiện tại là notification checkin, không phải food log thô).

## 5. Edge cases
- Intent `food_log` trong `/chat` map tới `food_log_node` — đọc log gần nhất từ DB và tóm tắt tuân thủ (fallback message cũ khi không có DB context).
- `POST /food-log` với `type="custom"` và `note` rỗng → `422` validation error.
- `GET /food-log?date=YYYY-MM-DD` lọc theo ngày `logged_at` (timezone server).

## 6. Ngoài phạm vi (Out of scope)
- Nhận diện ảnh món ăn (Could Have riêng, khác hẳn phạm vi Food Log text).
- NLP parse câu tự do thành định lượng dinh dưỡng chi tiết.
- Đối chiếu tuân thủ tự động theo từng món cụ thể (chỉ tuân thủ ở mức "theo kế hoạch hay không" theo slot).

## 7. Schema tham chiếu
- `FoodLogEntry` (Planned) — `contracts/agent-io-schema.md` §3.
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
- `specs/13-ai-chat-assistant.md` — intent `food_log` hiện là stub.
- `contracts/agent-io-schema.md` §3.
