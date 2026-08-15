# Spec: Sinh Thực đơn 7 ngày Cá nhân hoá

## Status
Partial — luồng `POST /meal-plans/generate` (persist trực tiếp qua `meal_planner_agent`) hoạt động ổn định và luôn chạy, **không** có nhánh rẽ theo `DEMO_MOCK` như brief gốc từng mô tả (đã sửa, xem §5). Luồng qua `/chat` (LangGraph `run_agent`) hoạt động nhưng **không persist** — xem gap ở §5.

## 1. Mục tiêu (Why)
Đây là chức năng lõi của North Star demo: biến hồ sơ bệnh nhân (bệnh lý, thuốc, dị ứng, mục tiêu calo) thành 1 thực đơn 7 ngày cụ thể, an toàn (không dị ứng, không tương tác thuốc nguy hiểm), có nguồn trích dẫn, sẵn sàng để bác sĩ duyệt.

## 2. User story
- Là **bệnh nhân**, tôi muốn nhận thực đơn 7 ngày phù hợp bệnh lý của mình chỉ bằng 1 lượt bấm, để tôi không phải tự tính toán dinh dưỡng.
- Là **bác sĩ**, tôi muốn hệ thống tự sinh sẵn 1 bản dự thảo thực đơn cho bệnh nhân, để tôi chỉ cần duyệt/chỉnh sửa thay vì soạn từ đầu.
- Là **AI**, tôi cần đảm bảo mọi món ăn sinh ra không vi phạm dị ứng, có nguồn trích dẫn dinh dưỡng, và các tương tác thuốc–thực phẩm nguy hiểm đã được xử lý (swap) trước khi trả kết quả.

## 3. Business rules
1. **Luôn sinh đúng 7 ngày** (`days_count=7`, không có tuỳ chọn khác qua API public).
2. **`status` khởi tạo luôn `"pending_review"`** — mọi plan mới đều cần bác sĩ duyệt trước khi coi là chính thức (HITL bắt buộc, xem `adrs/006-hitl-guardrails-strategy.md`). AI **không tự động approve** plan của chính nó.
3. **Pipeline xử lý** (`meal_planner_agent.generate_meal_plan`), theo đúng thứ tự:
   1. Load catalog món ăn tĩnh (`data/food_catalog_demo.json`, ~310 món — **không** dùng ChromaDB/RAG ở bước này, khác với luồng `rag_qa` trong chat, xem §5 mismatch).
   2. **Hard filter dị ứng** — loại tuyệt đối món khớp `profile.allergies` (`_is_allergic`), áp dụng cả trên catalog gốc và trên `alternatives[]` sinh sau đó.
   3. **Soft filter preferences** — chỉ áp dụng đúng pattern `"không ăn thịt bò"` đã cài cứng (xem `specs/02` §5 rule 4); preferences khác chỉ lưu, không lọc.
   4. Rotate/chọn món theo 7 ngày × 4 slot (`breakfast/lunch/dinner/snack`), tính tổng dinh dưỡng mỗi ngày (`totals`), so với `target_kcal`/`restrictions` để tạo `warnings[]` nếu vượt ngưỡng. **[Planned]** khi `restrictions.salt_daily_g`/`sugar_daily_g`/`protein_daily_g` được thêm (`specs/04`), áp dụng cùng cơ chế cảnh báo này.
   5. **Kiểm tra tương tác thuốc–thực phẩm** dùng KB đầy đủ (28 cặp, `data/drug_food_interactions.json`) theo `profile.medications` — nếu phát hiện cặp `Nguy hiểm`, thực hiện **swap** món đó sang món thay thế an toàn, ghi vào `swaps[]` kèm `reason`.
   6. Sinh `citations[]` cấp plan (theo `disease` → chọn guideline: `byt_vn_notes.md`/`ada_diabetes.md`/`aha_cardiovascular.md`/`acr_gout.md`) và `citations[]` cấp từng `FoodItem` (`food_catalog_demo#<id>`).
4. **Guardrail cứng:** mọi số liệu dinh dưỡng trả về phải có nguồn trích dẫn (`CLAUDE.md` Mục 7) — không được bịa số liệu không có trong `food_catalog_demo.json`.
5. **Guardrail cứng:** AI không tự ý đổi thuốc/liều lượng — khi phát hiện tương tác nguy hiểm, AI chỉ **swap món ăn**, không bao giờ đề xuất đổi/ngừng thuốc (redirect bác sĩ nếu bệnh nhân hỏi trực tiếp về thuốc, xem `specs/13-ai-chat-assistant.md`).
6. **2 code path khác nhau, cùng dùng `meal_planner_agent` core logic nhưng khác về persist:**
   - `POST /meal-plans/generate` (patient) và `POST /doctor/patients/{id}/meal-plans/generate` (doctor) → **luôn persist** vào bảng `meal_plans`, trả `meal_plan_id` dùng lại được qua `GET /meal-plans/{id}`.
   - `POST /chat` với intent `meal_plan` (qua LangGraph `meal_plan_node`) → **không persist** — xem Edge case bên dưới.
7. `DEMO_MOCK` (mặc định `true`) hiện tại **không ảnh hưởng** tới `POST /meal-plans/generate` — endpoint này luôn chạy `meal_planner_agent` thật (rule-based hoặc LLM tuỳ `LLM_PROVIDER` có key hay không), không có nhánh "mock builder" riêng nào được gọi trong code path này (`services/meal_plan_demo.py::build_mock_meal_plan` tồn tại nhưng là dead code, không được import ở `routes_meal_plan.py`). `DEMO_MOCK` chỉ ảnh hưởng tới `POST /interactions/check` (xem `specs/08`).

## 4. Luồng chính (happy path)
1. Patient đã có `PatientProfile` (`specs/02`) → gọi `POST /meal-plans/generate` (body optional: `notes`, `priorities`).
2. BE chạy pipeline §3, persist `MealPlan` với `status="pending_review"`.
3. BE tự tạo `Alert` (nếu có tương tác phát hiện — dùng KB rút gọn, xem `specs/08` §5 gap) và `Notification` liên quan.
4. FE hiển thị "Đang chờ bác sĩ duyệt" — patient xem chi tiết plan qua `GET /meal-plans/me` (`specs/07-patient-meal-plan-view.md`).
5. Bác sĩ duyệt plan (`specs/06-meal-plan-review.md`).
6. (Biến thể) Doctor có thể tự generate hộ patient qua `POST /doctor/patients/{patient_id}/meal-plans/generate` — cùng pipeline, cùng persist.

## 5. Edge cases
- **Gap đã có quyết định — meal plan qua `/chat` sẽ được đồng bộ persist (2026-08-15, Planned):** khi patient hỏi AI qua chat (ví dụ "lập thực đơn cho tôi") và intent được phân loại `meal_plan`, `meal_plan_node` trong LangGraph graph hiện tạo `MealPlanOutput` đầy đủ và trả `meal_plan_id` trong `AgentRunOutput`, nhưng **không ghi vào bảng `meal_plans`** — nếu dùng `meal_plan_id` này gọi `GET /meal-plans/{id}` sẽ nhận `404`. **Quyết định: cần đồng bộ** — `meal_plan_node` phải persist plan vào DB giống `POST /meal-plans/generate`, để `meal_plan_id` trả từ `/chat` luôn dùng lại được. Đây là task Planned cho BE1 (sửa node) + BE2 (đảm bảo tái sử dụng đúng service persist hiện có), xem `tasks/roadmap-mvp.md`.
- Patient generate nhiều lần liên tiếp → mỗi lần tạo 1 `MealPlan` mới, `GET /meal-plans/me` chỉ trả **bản mới nhất** (`ORDER BY created_at DESC LIMIT 1`) — các plan cũ vẫn còn trong DB (xem được qua `GET /meal-plans/{id}` nếu biết ID) nhưng không có API "list toàn bộ lịch sử" cho patient.
- Patient chưa có `PatientProfile` (chưa qua onboarding) → generate vẫn chạy được với profile default (`target_kcal=1800`, mọi list rỗng) — không có validation chặn, chỉ kết quả kém cá nhân hoá (nhất quán `specs/02` §3 rule 5).
- SLA: brief gốc ghi "<15s p95 chỉ áp dụng nhánh thật (LLM)" — nhánh rule-based (khi không có `OPENAI_API_KEY`/`LLM_PROVIDER` không set) chạy nhanh hơn nhiều (không gọi network); nhánh LLM phụ thuộc độ trễ API ngoài, chưa có test đo p95 chính thức trong repo — coi ngưỡng 15s là mục tiêu thiết kế, không phải số đã verify bằng benchmark.

## 6. Ngoài phạm vi (Out of scope)
- Sinh nhiều biến thể (A/B variants) — field `variant_group_id/variant_index/total_variants` đã có trong schema nhưng chưa endpoint nào dùng (xem `contracts/agent-io-schema.md` §2).
- Tuỳ chỉnh số ngày plan qua API (luôn cố định 7 ngày).
- RAG/ChromaDB cho việc chọn món — meal planner dùng catalog tĩnh, không phải vector search (khác với `rag_qa` trong chat).

## 7. Schema tham chiếu
- `MealPlanOutput`, `DayPlan`, `Meal`, `FoodItem`, `Swap` — `contracts/agent-io-schema.md` §2.
- `PatientProfile` — `contracts/agent-io-schema.md` §1.

## 8. API liên quan
| Method | Path | Role |
|---|---|---|
| POST | `/meal-plans/generate` | patient |
| GET | `/meal-plans/me` | patient |
| GET | `/meal-plans/{meal_plan_id}` | patient (chỉ plan của mình) / doctor (bất kỳ) |
| POST | `/doctor/patients/{patient_id}/meal-plans/generate` | doctor |

## 9. Liên quan
- `specs/08-drug-food-interaction-check.md` — logic swap dùng chung ở bước 3.5.
- `specs/06-meal-plan-review.md` — bước duyệt tiếp theo.
- `specs/07-patient-meal-plan-view.md` — patient xem kết quả.
- `specs/13-ai-chat-assistant.md` — code path `/chat` với intent `meal_plan`.
- `adrs/006-hitl-guardrails-strategy.md`, `adrs/002-agent-orchestration-langgraph.md`.
- `contracts/api-v1.md` §4.
