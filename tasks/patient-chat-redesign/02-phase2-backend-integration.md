# Giai đoạn 2 — Tái sử dụng & Nâng cấp Backend

> Đọc [`00-overview.md`](00-overview.md) và [`01-phase1-ui-shell-mockdata.md`](01-phase1-ui-shell-mockdata.md) trước. Mục tiêu: loại bỏ toàn bộ mock/keyword-match tạm của Giai đoạn 1, thay bằng dữ liệu thật — **tối đa tái dùng** code/service đã có, chỉ thêm mới phần thật sự thiếu. Áp dụng đúng handoff rule của repo: **sửa `contracts/agent-io-schema.md` / `contracts/api-v1.md` trước, code sau.**

Ranh giới role (theo `CLAUDE.md` mục 5 / `tasks/README.md`): `backend/app/agents/`, `backend/app/rag/`, `backend/app/guardrails/`, `backend/data/` → **BE1**; `backend/app/api/`, `backend/app/models/`, `backend/app/schemas/`, `backend/app/services/`, `backend/app/db/`, `backend/app/core/` → **BE2**; `frontend/**` → **FE**. Các task dưới đây gắn nhãn owner gợi ý.

## T2.0 — Audit: xác nhận phần đã tái dùng thật ở Giai đoạn 1

**Owner: FE** (kiểm tra chéo, không cần code mới)

Xác nhận các panel sau ở Giai đoạn 1 đã nối **API thật** (không mock) — nếu chưa, hoàn tất trước khi làm các bước tiếp theo:
- `MealLogPanel` (T1.12) → `api.getMyMealPlan()`, `api.listFoodLogs()`, `api.createFoodLog()` (qua `FoodLogModal`).
- `NotificationsPanel`/`NotificationDetailModal` (T1.13) → `api.listNotifications()`, `api.markNotificationRead/Dismiss/Done()`.
- `HealthMetricsPanel`/`RecordMetricsFormPanel` (T1.14) → `api.getMetricsHistory()`, `api.recordMetrics()`.
- `MealSuggestionCard` (T1.8) → dữ liệu `mealPreview` thật từ `AgentRunOutput`/`ChatStreamEvent` (không mock).

Chỉ 3 card sau còn dùng mock/keyword-match tạm (`frontend/lib/patient-chat-mock-intents.ts`, T1.7): `IngredientMapCard`, `WeeklyComplianceCard`, `DoctorNoteCard`. Đây là trọng tâm của Giai đoạn 2.

## T2.1 — Quyết định thiết kế dữ liệu cho 3 intent mới (làm trước khi sửa contract)

**Owner: BE1 + FE (thảo luận), chốt trước khi code**

1. **`grocery_list` (đi chợ):**
   - Nguồn dữ liệu: suy ra từ `MealPlanOutput` hiện tại của bệnh nhân (7 ngày, hoặc riêng ngày hôm nay/tuần này) — lấy `FoodItem.name` duy nhất từ toàn bộ `days[].meals[].items[]`, group theo tên món/nguyên liệu.
   - **Không có** bản đồ/API địa điểm mua sắm thật trong dự án — giữ phần "điểm bán gần nhất" là **danh sách tĩnh cấu hình** (ví dụ hardcode 2–3 địa điểm mẫu theo khu vực chung, hoặc lấy từ `profile.address` chỉ để hiển thị tên khu vực, không định vị thật) — không giả vờ đây là dữ liệu thật, ghi rõ trong response/UI đây là gợi ý chung.
   - Trả về: danh sách tên nguyên liệu (thật, từ meal plan) + danh sách địa điểm gợi ý (tĩnh).
2. **`weekly_compliance` (tuân thủ tuần — góc nhìn patient tự xem):**
   - Tái dùng logic tổng hợp đã có cho doctor (`adrs/008-compliance-summary-aggregation-strategy.md`, endpoint `GET /doctor/patients/{id}/compliance` — `contracts/api-v1.md` §10) nhưng chạy cho **chính patient đang đăng nhập** (`patient_id = current_user.id`), không cần quyền doctor.
   - Khuyến nghị: tách phần tính toán hiện tại (nằm trong route handler `routes_doctor.py`, dựa trên `adherence_checkin` notifications + `Alert`) thành 1 hàm dùng chung trong `backend/app/services/compliance_service.py` (tạo mới nếu chưa có file service riêng, hoặc thêm hàm vào service compliance hiện có nếu đã tồn tại — kiểm tra `backend/app/services/` trước khi tạo file trùng), ký hiệu đề xuất: `compute_patient_compliance(db, patient_id, days) -> PatientComplianceOut`. Cả route doctor và node agent mới đều gọi hàm này — tránh trùng logic.
3. **`doctor_note` (lời nhắc bác sĩ):**
   - Nguồn dữ liệu: `Notification` gần nhất có `type="manual_reminder"` gửi cho patient này (tạo qua `POST /doctor/patients/{id}/compliance/remind`, `contracts/api-v1.md` §10) **hoặc** `adjustment_note`/ghi chú gần nhất gắn với meal plan đang active nếu `manual_reminder` chưa có bản ghi nào.
   - Nếu patient chưa từng nhận `manual_reminder` nào và không có `adjustment_note`: trả lời text thân thiện "Bạn chưa có ghi chú nào từ bác sĩ gần đây." — **không** bịa nội dung.
   - Field `doctorName`/`department`/`avatarUrl` hiển thị trên card: dự án hiện chưa có field "khoa/chuyên môn bác sĩ" hay avatar bác sĩ trong `User`/`PatientProfile` model — kiểm tra `backend/app/models/user.py` trước; nếu chưa có, dùng giá trị mặc định tĩnh ("Bác sĩ điều trị") thay vì bịa tên/khoa cụ thể, để không vi phạm luật cứng "không hallucinate" (`CLAUDE.md` mục 7 áp dụng tinh thần cho toàn bộ dữ liệu hiển thị, không riêng RAG).

**Done when:** thống nhất bằng 1 đoạn note ngắn trong PR/commit message hoặc comment ở đầu file contract mô tả 3 quyết định trên, để BE2/FE cùng tham chiếu khi code.

## T2.2 — Cập nhật `contracts/agent-io-schema.md` trước khi code

**Owner: BE1**

- Mục "Danh sách intent hợp lệ (`VALID_INTENTS`...)" ở `contracts/agent-io-schema.md` §5.2 (dòng ~239-243): thêm 3 giá trị mới vào enum liệt kê: `grocery_list | weekly_compliance | doctor_note`, giữ nguyên 6 giá trị cũ.
- Thêm field mới (optional, default `null`/`[]`, tương thích ngược) vào `AgentRunOutput` (§5.2), ví dụ:
  ```json
  {
    "grocery_list": { "ingredients": ["cá hồi", "bông cải xanh"], "suggested_places": [{"name": "Co.opmart", "distance_label": "gần bạn"}] },
    "weekly_compliance": { "overall_adherence_pct": 92, "daily_series": [{"date": "2026-08-15", "adherence_pct": 80}, ...] },
    "doctor_note": { "doctor_name": "Bác sĩ điều trị", "note": "...", "created_at": "...", "tags": ["Hạn chế muối"] }
  }
  ```
  Chỉ field tương ứng intent hiện tại được populate, còn lại `null` — theo đúng pattern `meal_preview` đã có.
- Cập nhật `AgentState` nội bộ (§5.3) nếu cần state field trung gian (ví dụ `"grocery_list": null`, tương tự các field khác đã liệt kê).
- Bump version/ghi chú thay đổi theo mục "7. Versioning" cuối file.

## T2.3 — Cập nhật `contracts/api-v1.md`

**Owner: BE2**

- Mục §11 Chat: cập nhật bảng sự kiện SSE (`type: "intent"`) — payload `intent` hiện liệt kê cứng `"rag_qa | meal_plan | interaction_check | refuse | unknown"` (dòng ~498) → thêm 3 giá trị mới, đồng bộ với `contracts/agent-io-schema.md`.
- Ghi chú rõ 3 field mới trong `AgentRunOutput` ở ví dụ response (tham chiếu từ §5.2 file kia, không lặp lại toàn bộ).
- (Tuỳ chọn, nếu cần patient tự gọi trực tiếp không qua chat) — có thể **không cần** thêm endpoint REST riêng cho `weekly_compliance` nếu quyết định chỉ phục vụ qua chat; chỉ thêm nếu `HealthMetricsPanel` (đã dùng dữ liệu thật ở Giai đoạn 1 qua cách tính riêng — xem T2.7) cần 1 nguồn chuẩn hoá dùng chung.

## T2.4 — `backend/app/agents/nodes/intent_classifier.py`: thêm 3 intent

**Owner: BE1**

- `VALID_INTENTS`: thêm `"grocery_list"`, `"weekly_compliance"`, `"doctor_note"`.
- `_INTENT_PATTERNS`: thêm pattern tiếng Việt tương ứng (tái dùng gần đúng regex đã dùng ở FE mock — `frontend/lib/patient-chat-mock-intents.ts` T1.7 — để hành vi nhất quán giữa fallback keyword và mock cũ):
  ```python
  "grocery_list": [r"đi chợ", r"mua (nguyên liệu|thực phẩm|đồ ăn)", r"siêu thị", r"chợ gần"],
  "weekly_compliance": [r"tuân thủ.*tuần", r"tuần này.*tuân thủ", r"báo cáo tuân thủ"],
  "doctor_note": [r"bác sĩ dặn", r"lời nhắc bác sĩ", r"ghi chú bác sĩ", r"bác sĩ có dặn"],
  ```
- Cập nhật prompt LLM classification trong `_classify_by_llm` (thêm 3 mô tả intent mới vào danh sách trong prompt) để LLM path cũng nhận diện đúng, không chỉ fallback keyword.

## T2.5 — `backend/app/agents/graph.py`: 3 node mới + wiring

**Owner: BE1**

1. `grocery_list_node(state)`:
   - Đọc `db`, `user_id` từ state (theo pattern `meal_plan_node`/`food_log_node` đã có).
   - Lấy meal plan hiện tại của patient (tái dùng `resolve_patient_plan_row`/`meal_plan_from_row` từ `app/services/meal_plan_service.py` — đã dùng trong `meal_plan_node`).
   - Trích xuất danh sách nguyên liệu duy nhất từ `days[].meals[].items[].name`.
   - Trả `answer` dạng text thân thiện + field state mới `grocery_list` (dict) để `run_agent()` map vào `AgentRunOutput.grocery_list`.
2. `weekly_compliance_node(state)`:
   - Gọi `compute_patient_compliance(db, user_id, days=7)` (hàm dùng chung tạo ở T2.1.2).
   - Trả `answer` tóm tắt (ví dụ "Bạn đang duy trì phong độ rất tốt với tỉ lệ tuân thủ {pct}%.") + field state `weekly_compliance`.
3. `doctor_note_node(state)`:
   - Query `Notification` gần nhất `type="manual_reminder"` cho `user_id` (order by `created_at desc`), fallback theo T2.1.3.
   - Trả `answer` + field state `doctor_note`.
4. Thêm 3 node vào `build_graph()`: `graph.add_node(...)`, thêm case vào `route_intent()` (mở rộng `Literal[...]` return type), map trong `graph.add_conditional_edges("intent_classifier", route_intent, {...})`, thêm `graph.add_edge(<node>, "apply_guardrails")` cho từng node mới — theo đúng pattern các node hiện có (`meal_plan`, `interaction_check`, `food_log`).
5. Trong `run_agent()`: đọc 3 field state mới, map vào `AgentRunOutput` (cần thêm field vào Pydantic schema — xem T2.6).

## T2.6 — Schema Pydantic mới

**Owner: BE1** (file `backend/app/schemas/meal_plan.py` hoặc file schema chat riêng nếu đã tách)

- Thêm 3 model mới: `GroceryListOut` (`ingredients: list[str]`, `suggested_places: list[GroceryPlaceOut]`), `WeeklyComplianceOut` (tái dùng cấu trúc gần giống `PatientComplianceOut` đã có ở `backend/app/schemas/*` cho doctor — cân nhắc dùng lại chính schema đó thay vì tạo bản trùng), `DoctorNoteOut` (`doctor_name: str`, `note: str`, `created_at: datetime`, `tags: list[str] = []`).
- Thêm 3 field optional (`= None`) vào `AgentRunOutput`: `grocery_list: GroceryListOut | None`, `weekly_compliance: WeeklyComplianceOut | None`, `doctor_note: DoctorNoteOut | None`.
- Đảm bảo `ChatStreamEvent`/hàm build SSE `done` event (xem `backend/app/agents/streaming.py` hoặc route `/chat/stream`) serialize đủ field mới — kiểm tra chỗ hiện đang build `AgentRunOutput` cho SSE `done` event dùng `.model_dump()` nên tự động có field mới, chỉ cần xác nhận không có `exclude`/`include` cứng bỏ sót field.

## T2.7 — `backend/app/services/compliance_service.py` (hàm dùng chung)

**Owner: BE2** (vì đây là service layer, nhưng phối hợp chặt với BE1 do node agent cũng gọi hàm này)

- Nếu logic tính compliance hiện đang nằm trực tiếp trong `backend/app/api/v1/routes_doctor.py` (endpoint `GET /doctor/patients/{id}/compliance`), tách phần tính toán (không phải phần auth/role check) ra hàm `compute_patient_compliance(db, patient_id: str, days: int) -> PatientComplianceOut` trong service module riêng.
- Route doctor gọi lại hàm này sau khi tách (không đổi response, chỉ refactor nội bộ — test cũ (`pytest`) phải vẫn pass y nguyên).
- `weekly_compliance_node` (T2.5) gọi cùng hàm với `patient_id = state["user_id"]`.
- **Không** thêm bất kỳ authorization mới nào cho patient tự xem compliance của chính mình — patient luôn được phép xem dữ liệu của chính họ (đã đúng theo model auth hiện tại, chỉ cần đảm bảo không vô tình cho phép xem compliance của người khác qua tham số).

## T2.8 — Frontend: tiêu thụ dữ liệu thật, xoá mock trigger

**Owner: FE**

- Trong `app/patient/page.tsx` (đã restyle ở T1.5): xoá điều kiện gọi `detectMockCardIntent()` (T1.7) trước `api.chatStream`; luôn gọi API thật.
- Cập nhật union type `Message` (hiện đang thêm field `mockCard` tạm ở T1.7) → đổi thành field thật đọc từ `event.data.grocery_list` / `.weekly_compliance` / `.doctor_note` (tương tự cách `mealPreview` đang được đọc từ `response.meal_preview`).
- `IngredientMapCard`, `WeeklyComplianceCard`, `DoctorNoteCard` (T1.9–T1.11): đổi props nhận trực tiếp từ response thật thay vì mock data hardcode — cập nhật interface props khớp với schema mới ở T2.6 (đổi tên field nếu BE dùng snake_case, FE convention hiện tại giữ đúng field name từ API như các type khác trong `lib/types.ts`).
- Cập nhật `frontend/lib/types.ts`: thêm `GroceryListOut`, `WeeklyComplianceOut`, `DoctorNoteOut`, mở rộng `AgentRunOutput` với 3 field optional mới — đồng bộ với `contracts/agent-io-schema.md` sau khi BE cập nhật.
- Xoá/rename file `frontend/lib/patient-chat-mock-intents.ts` — chuyển hẳn qua `03-phase3-cleanup.md` T3.6 nếu muốn xoá dứt điểm sau khi xác nhận ổn định qua vài lần test tay (có thể giữ file này thêm 1 nhịp làm fallback phòng khi backend lỗi, nhưng phải note rõ lý do giữ lại nếu chọn hướng này).

## T2.9 — `HealthMetricsPanel`: đồng bộ nguồn "vòng tròn tuân thủ"

**Owner: FE + BE2**

- Ở Giai đoạn 1 (T1.14), vòng tròn % tuân thủ trong `HealthMetricsPanel` tạm tính bằng `weeklyAdherence()` (client-side, từ `listFoodLogs`) — sau khi có `weekly_compliance` intent thật (T2.5–T2.7) với field `overall_adherence_pct` chuẩn hoá từ backend, **đổi sang dùng cùng 1 nguồn** để tránh 2 cách tính lệch nhau giữa `HealthMetricsPanel` và card `weekly-compliance-dock` trong chat.
- Cách gọi: có thể gọi ngầm `api.chat("Tuân thủ tuần này của tôi")` với `force_intent`-style riêng (không nên, vì force_intent không public — xem `contracts/agent-io-schema.md` §5.1) — **khuyến nghị thay vào đó**: thêm 1 REST endpoint nhẹ patient-facing tái dùng `compute_patient_compliance()` (T2.7), ví dụ `GET /compliance/me?days=7`, để cả `HealthMetricsPanel` và bất kỳ nơi khác cần số này gọi trực tiếp không phải qua chat. Nếu chọn hướng này: cập nhật `contracts/api-v1.md` thêm mục "Patient Compliance" tương tự §10 nhưng role `patient`, thêm hàm `api.getMyCompliance(days)` trong `frontend/lib/api.ts`.

## T2.10 — Hoàn thiện liên kết chi tiết thông báo ↔ thực đơn / doctor note

**Owner: FE**

- `NotificationDetailModal` (T1.13): với `type === "plan_approved"`, nút "Xem thực đơn tuần mới" đọc `related_ids.meal_plan_id` (đã có field `related_ids: Record<string, unknown>` trong `NotificationOut`) → `router.push(`/patient/meals?plan_id=${id}`)`.
- Card `doctor-note` trong chat và panel thông báo nên dẫn cùng 1 nguồn dữ liệu (`manual_reminder` mới nhất) — nếu bệnh nhân bấm vào 1 notification `manual_reminder` trong `NotificationsPanel`, `NotificationDetailModal` nên hiển thị đúng nội dung giống với `DoctorNoteCard` sẽ trả lời khi hỏi "bác sĩ dặn gì" (nhất quán dữ liệu, tránh 2 nơi hiển thị 2 nội dung khác nhau).

## T2.11 — Test

**Owner: BE1 (unit test agent) + BE2 (test service/route) + FE (test tay theo checklist)**

- `backend/tests/`: thêm test cho `grocery_list_node`, `weekly_compliance_node`/`compute_patient_compliance`, `doctor_note_node` (theo pattern test hiện có cho `meal_plan_node`/`food_log_node`, xem `backend/tests/test_meal_planner.py` hoặc test agent tương tự).
- Test `intent_classifier` với câu mẫu cho 3 intent mới (đảm bảo không đè intent cũ, ví dụ câu chứa cả "thực đơn" và "đi chợ" phải ra đúng thứ tự ưu tiên hợp lý — kiểm tra `_detect_intents_by_keywords` không bị match nhầm 2 intent cùng lúc gây `secondary_intents` sai).
- Chạy `pytest backend/tests/` toàn bộ — đảm bảo không phá test cũ (đặc biệt test liên quan `route_intent`, `AgentRunOutput` schema validation).
- Lặp lại checklist QA T1.16 của Giai đoạn 1, lần này xác nhận 3 card mới dùng dữ liệu thật (không còn phụ thuộc `patient-chat-mock-intents.ts`).

## T2.12 — Regression check North Star flow

**Owner: FE + BE (phối hợp)**

Chạy lại đúng luồng demo ở `tasks/roadmap-mvp.md` mục "North Star demo flow" từ đầu đến cuối (đăng nhập bác sĩ → thêm bệnh nhân → khai hồ sơ → sinh thực đơn 7 ngày → bác sĩ duyệt → bệnh nhân xem thực đơn đã duyệt + nhận Compliance Notification → bệnh nhân hỏi lại qua chat) để đảm bảo các thay đổi Giai đoạn 2 không phá vỡ luồng lõi này.
