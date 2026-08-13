# Spec: Sinh thực đơn 7 ngày (Meal Plan Generation)

## Status
**Partial (as-built)** — HTTP generate + persist ổn định với `DEMO_MOCK=true`. Nhánh `DEMO_MOCK=false` còn gap persist plan từ `run_agent` (xem gap-closure TASK-02). FE chưa wiring API đầy đủ.

## 1. Mục tiêu (Why)
Sinh thực đơn 7 ngày cá nhân hoá theo bệnh lý, thuốc, dị ứng, mục tiêu kcal — có trích dẫn nguồn (citation), có kiểm tra tương tác thuốc–thực phẩm, và ở trạng thái chờ chuyên gia duyệt trước khi bệnh nhân dùng chính thức.

## 2. User story
Là **bệnh nhân** (hoặc **doctor** generate hộ), tôi muốn nhận thực đơn 7 ngày phù hợp với hồ sơ bệnh lý của mình, để có kế hoạch ăn uống an toàn và đúng mục tiêu dinh dưỡng.

## 3. Business rules
1. Actor được phép generate: `patient` (tự generate) hoặc doctor qua UI `/doctor/patients/{id}/generate` (khi FE nối API — hiện UI có thể local mock).
2. Plan mới tạo luôn có `status = pending_review`.
3. Hai nhánh theo `DEMO_MOCK` (ADR-005):
   - **`true` (mặc định, as-built path demo):** `build_mock_meal_plan` → persist DB → interaction mock trên món plan → alerts + `materialize_from_meal_plan`.
   - **`false` (to-be ổn định):** `run_agent(force_intent=meal_plan)` → MealPlannerAgent + RAG; **hiện** service kỳ vọng `meal_plan_id` đã persist — còn brittleness/501 (TASK-02).
4. Pipeline agent thật (BE1): RAG → draft 7 ngày → hard filter allergies → soft prefs/restrictions → NutritionCalculator (±10% target / warnings) → InteractionChecker (Nguy hiểm → swap + `swaps[]`) → citations.
5. Sau persist (nhánh mock / khi nhánh thật ổn): tạo Alert; materialize `meal_reminder` + `adherence_checkin`; follow-up cho severity Nguy hiểm/Cần chú ý.
6. SLA <15s (p95) chỉ áp dụng nhánh agent thật.
7. Số liệu dinh dưỡng phải có citation (guardrails `source_check` vẫn placeholder — TASK-04).

## 4. Luồng chính (happy path — demo hiện tại)
1. `POST /api/v1/meal-plans/generate` với JWT patient.
2. Load profile (thiếu profile → default `target_kcal=1800`).
3. `DEMO_MOCK=true` → mock plan + persist + side effects.
4. Response `MealPlanOutput` `pending_review`.

## 5. Edge cases
- Chưa có Profile → default profile (spec 01); to-be có thể hard-fail sau khi chốt.
- Generate khi đã có `pending_review` → as-built **cho phép** tạo plan mới (không chặn).
- `DEMO_MOCK=false` chưa sẵn sàng demo pitch → giữ mock.

## 6. Ngoài phạm vi
- Food Log, shopping list, PDF, auto re-generate khi profile đổi.

## 7. API
| Method | Path | Role |
|---|---|---|
| POST | `/api/v1/meal-plans/generate` | patient |
| GET | `/api/v1/meal-plans/me` | patient |
| GET | `/api/v1/meal-plans/{id}` | auth |

## 8. Liên quan
- Contracts: `agent-io-schema.md` §1.2, `api-v1.md`
- ADR: `002`, `005`
