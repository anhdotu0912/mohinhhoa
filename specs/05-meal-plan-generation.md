# Spec: Sinh Thực đơn 7 ngày Cá nhân hoá

## Status
Done — luồng `POST /meal-plans/generate` (persist trực tiếp qua `meal_planner_agent`) hoạt động ổn định và luôn chạy, **không** có nhánh rẽ theo `DEMO_MOCK` như brief gốc từng mô tả (xem §5). Luồng qua `/chat` (LangGraph `run_agent`) hoạt động nhưng **không persist** — đây là **thiết kế có chủ đích** (read-only preview trong chat), không phải gap, xem §5.

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
   1. Load catalog món ăn **hybrid** (2026-08-15 as-built): ưu tiên Postgres (`recipes` + `food_compositions`, seed từ `data/clean/recipes.sample.json` và `data/clean/foods.sample.json`) cho món đã chế biến (thịt/hải sản/đậu/rau/canh/trái cây/sữa); bổ sung curated JSON (`backend/app/kb/food_catalog_demo.json`) cho tinh bột/trứng/đồ uống khi DB có data; fallback toàn bộ JSON khi DB rỗng (test/local). **Không** dùng ChromaDB/RAG ở bước này.
   2. **Hard filter dị ứng** — loại tuyệt đối món khớp `profile.allergies` (`_is_allergic`), áp dụng cả trên catalog gốc và trên `alternatives[]` sinh sau đó.
   3. **Soft filter preferences** — chỉ áp dụng đúng pattern `"không ăn thịt bò"` đã cài cứng (xem `specs/02` §5 rule 4); preferences khác chỉ lưu, không lọc.
   4. Chọn món theo ngân sách lâm sàng (`target_kcal`, `carb_per_meal`, `sodium_daily`, và `salt_daily_g`/`sugar_daily_g` khi doctor đã set — `specs/04`): scale phần ăn (×0.4–×1.75), bỏ canh khi natri chật, top-up đạm nếu thiếu kcal; sau swap tương tác thuốc chạy thêm repair loop. `warnings[]` chỉ còn khi ràng buộc **không khả thi** với catalog (ví dụ natri 500mg/ngày).
   5. **Kiểm tra tương tác thuốc–thực phẩm** dùng KB đầy đủ (28 cặp, `data/drug_food_interactions.json`) theo `profile.medications` — nếu phát hiện cặp `Nguy hiểm`, thực hiện **swap** món đó sang món thay thế an toàn, ghi vào `swaps[]` kèm `reason`.
   6. Sinh `citations[]` cấp plan (theo `disease` → chọn guideline: `byt_vn_notes.md`/`ada_diabetes.md`/`aha_cardiovascular.md`/`acr_gout.md`) và `citations[]` cấp từng `FoodItem` (`recipes_dm2#<id>`, `foods_vn#<id>`, hoặc `food_catalog_demo#<id>` khi dùng supplement JSON).
4. **Guardrail cứng:** mọi số liệu dinh dưỡng trả về phải có nguồn trích dẫn (`CLAUDE.md` Mục 7) — không được bịa số liệu không có trong catalog đã load (DB hoặc JSON).
5. **Guardrail cứng:** AI không tự ý đổi thuốc/liều lượng — khi phát hiện tương tác nguy hiểm, AI chỉ **swap món ăn**, không bao giờ đề xuất đổi/ngừng thuốc (redirect bác sĩ nếu bệnh nhân hỏi trực tiếp về thuốc, xem `specs/13-ai-chat-assistant.md`).
6. **2 code path khác nhau, cùng dùng `meal_planner_agent` core logic nhưng khác về persist:**
   - `POST /meal-plans/generate` (patient) và `POST /doctor/patients/{id}/meal-plans/generate` (doctor) → **luôn persist** vào bảng `meal_plans`, trả `meal_plan_id` dùng lại được qua `GET /meal-plans/{id}`.
   - `POST /chat` với intent `meal_plan` (qua LangGraph `meal_plan_node`) → **không persist** — xem Edge case bên dưới.
7. **Không còn cờ `DEMO_MOCK`** trong codebase (đã bỏ hoàn toàn) — `POST /meal-plans/generate` và `POST /interactions/check` (xem `specs/08`) đều luôn chạy agent thật (`meal_planner_agent`/`interaction_checker_agent`, rule-based hoặc LLM tuỳ `LLM_PROVIDER` có key hay không). Không có nhánh "mock builder" nào được gọi trong các code path này.

## 4. Luồng chính (happy path)
1. Patient đã có `PatientProfile` (`specs/02`) → gọi `POST /meal-plans/generate` (body optional: `notes`, `priorities`).
2. BE chạy pipeline §3, persist `MealPlan` với `status="pending_review"`.
3. BE tự tạo `Alert` (nếu có tương tác phát hiện — dùng KB rút gọn, xem `specs/08` §5 gap) và `Notification` liên quan.
4. FE hiển thị "Đang chờ bác sĩ duyệt" — patient xem chi tiết plan qua `GET /meal-plans/me` (`specs/07-patient-meal-plan-view.md`).
5. Bác sĩ duyệt plan (`specs/06-meal-plan-review.md`).
6. (Biến thể) Doctor có thể tự generate hộ patient qua `POST /doctor/patients/{patient_id}/meal-plans/generate` — cùng pipeline, cùng persist.

## 5. Edge cases
- **`meal_plan` qua `/chat` là read-only theo thiết kế (không phải gap):** khi patient hỏi AI qua chat (ví dụ "lập thực đơn cho tôi") và intent được phân loại `meal_plan`, `meal_plan_node` trong LangGraph graph tạo `MealPlanOutput` đầy đủ để **hiển thị ngay trong hội thoại** (preview nhanh, không cần rời màn hình chat), nhưng **không ghi vào bảng `meal_plans`** — `meal_plan_id` trả trong `AgentRunOutput` (nếu có) không dùng lại được qua `GET /meal-plans/{id}` (`404`). Muốn có 1 plan chính thức, patient dùng `POST /meal-plans/generate` (rule 6) — 2 code path dùng chung `meal_planner_agent` nhưng có chủ đích khác nhau về persist, tránh chat tạo ra nhiều bản draft rác trong DB mỗi lần patient hỏi thử. Xem `adrs/002-agent-orchestration-langgraph.md`.
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
