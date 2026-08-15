# ADR-009: Phạm vi thật của Food Log

## Status
Deferred (cho vòng demo hiện tại) — kiến trúc/schema Accepted để BE1/BE2 không tự sáng tạo khác nhau khi implement sau này.

## Context
`CLAUDE.md` liệt kê **Food Log (text/search/NLP)** là **Won't Have** trong MVP hiện tại; `AGENTS.md` nhắc lại "Không implement Food Log trong MVP (nav đã ẩn)". Tuy vậy:
- Route/schema stub đã tồn tại: `backend/app/schemas/food_log.py` (`FoodLogCreate`, `FoodLogOut` — đã định nghĩa field thật), `backend/app/api/v1/routes_food_log.py` và `backend/app/models/food_log.py` chỉ có `"""Placeholder"""`, **không mount** trong `main.py`.
- Agent graph đã có intent `food_log` và node `food_log_node` — nhưng là **stub cứng**: luôn trả `"Tính năng ghi nhận bữa ăn chưa khả dụng trong phiên bản này."`, không đọc/viết gì.
- FE đã có UI mock hoàn chỉnh cho việc này: `frontend/app/patient/meals/log/page.tsx` — 3 slot cố định "Bữa sáng/Bữa trưa/Bữa tối" (**không có "Bữa phụ/snack"**, khác 4 slot của meal plan `breakfast/lunch/dinner/snack`), mỗi slot chọn "Đã ăn theo kế hoạch" hoặc "Ăn khác" (kèm ghi chú tự do), có nút Lưu — nhưng state chỉ là React local state, không gọi API nào, không có store riêng (`frontend/lib/meal-logs-store.ts` tồn tại nhưng cần audit riêng khi implement — nằm ngoài phạm vi ADR này).
- Route ẩn khỏi nav theo đúng luật (`frontend/lib/nav-config.ts` có comment rõ: `// Food Log Won't Have MVP — route /patient/meals/log có thể còn nhưng không hiện nav`).

Cần một quyết định rõ để BE1 (agent side) và BE2 (API/DB side) không tự thiết kế khác nhau nếu/khi feature này được nâng lên Should Have.

## Decision
**Giữ Won't Have cho vòng demo hiện tại** (không chặn North Star flow) — nhưng **chốt trước thiết kế phạm vi tối thiểu** để tránh scope creep lộn xộn nếu triển khai sau này:

1. **Phạm vi khi implement (không phải bây giờ):** nhập tay có cấu trúc (structured manual entry) theo đúng UI đã có sẵn — chọn "đúng kế hoạch" hoặc "khác + ghi chú tự do", theo từng slot bữa ăn trong ngày. **Không** làm nhận diện ảnh món ăn (Could Have riêng, `CLAUDE.md`), **không** làm NLP parse tự do thành danh sách món ăn có định lượng dinh dưỡng (quá phức tạp cho quy mô này).
2. **Slot vocabulary — ĐÃ QUYẾT ĐỊNH (2026-08-15):** giữ đúng theo UI hiện có — **3 slot cố định** `"morning" | "noon" | "evening"` (sáng/trưa/tối), **không** mở rộng thêm slot thứ 4 để khớp 4-slot của meal plan (`breakfast/lunch/dinner/snack`). Hệ quả chấp nhận được: food log **không** ghi nhận riêng cho "bữa phụ/snack" — coi đây là giới hạn có chủ đích (Out of scope), không phải gap cần vá. Khi đối chiếu tuân thủ theo `specs/10-doctor-compliance-view.md`, chỉ đối chiếu được 3 bữa chính, ánh xạ gần đúng `morning≈breakfast`, `noon≈lunch`, `evening≈dinner`.
3. **`FoodLogEntry.status`:** không cần workflow duyệt (approve/reject) như meal plan — chỉ cần 2 trạng thái: `logged` (đã ghi nhận) và `adjusted` (bệnh nhân sửa lại sau khi đã log). Không cần trạng thái `pending`/`rejected` vì đây là ghi nhận thực tế, không phải đề xuất cần duyệt.
4. **Liên kết Alert:** khi log món ăn "khác" (custom) trùng khớp với 1 cặp tương tác thuốc–thực phẩm trong KB (`data/drug_food_interactions.json`), hệ thống nên tạo `Alert` mới (dùng lại service dùng chung ở `specs/08-drug-food-interaction-check.md`) — thiết kế đề xuất, chưa implement.
5. **Mức ưu tiên:** **Should Have**, không bắt buộc cho North Star demo (đăng nhập bác sĩ → generate → duyệt → bệnh nhân xem → chat hỏi lại — không cần Food Log để hoàn thành luồng này).

## Consequences
**Positive**
- BE1/BE2 có cùng 1 điểm tham chiếu thiết kế nếu triển khai sau, tránh việc mỗi người tự đoán khác nhau.
- Không tốn effort trong 2 tuần cho 1 feature Won't Have — giữ đúng nguyên tắc vàng của CLAUDE.md.

**Negative**
- `schemas/food_log.py` hiện có (`FoodLogCreate.profile_id: int`) dùng kiểu `int` cho `profile_id`, không khớp convention `str` (UUID) của toàn hệ thống (`User.id`, `Profile.id` đều `String(36)`) — nếu implement theo schema hiện tại sẽ tạo type mismatch, cần sửa lại `profile_id: str` khi thực sự code (ghi chú cho BE2, không sửa trong phạm vi ADR).

**Alternatives đã cân nhắc**
- Nâng lên Must Have ngay để khớp UML đầy đủ: bị loại — vi phạm nguyên tắc vàng "demo mượt hơn đầy đủ tính năng"; North Star không cần Food Log.
- Xoá hẳn code stub (route/model/node) để "sạch": bị loại — giữ lại stub có chủ đích để không phải thiết kế lại từ đầu khi cần, và để FE UI đã thiết kế không bị mất chỗ neo (route vẫn tồn tại, chỉ ẩn nav).
