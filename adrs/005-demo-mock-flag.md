# ADR-005: Flag `DEMO_MOCK` cho Meal Plan Generation

## Status
Accepted — đã implement, đang là mặc định (`true`).

## Context
Dự án chạy trong khung prototype 2 tuần với mục tiêu North Star là **một demo end-to-end mượt**, ưu tiên hơn việc mọi tính năng đều chạy bằng AI thật. Gọi LangGraph + RAG + LLM thật có độ trễ và rủi ro (LLM lỗi, rate-limit, output không ổn định) — không phù hợp khi pitch trực tiếp.

## Decision
Thêm biến môi trường `DEMO_MOCK` (mặc định `true`):
- `true` → `POST /meal-plans/generate` dùng `build_mock_meal_plan` + persist + alerts/notifications; `POST /interactions/check` dùng helper mock (KB rút gọn trong `meal_plan_demo`).
- `false` → generate gọi `run_agent(force_intent=meal_plan)` (còn gap persist plan — TASK-02); interaction HTTP hiện trả **501** (chưa wire `InteractionCheckerAgent`).

## Consequences
- **Positive:** Pitch ổn định, không phụ thuộc LLM.
- **Negative:** Hai “KB interaction” (mock 2 cặp vs agent ~28 cặp) — dễ nhầm khi đọc spec/test.
- **Ràng buộc:** MVP “hoàn thiện” cần `DEMO_MOCK=false` generate ổn định + interaction HTTP gọi agent thật — `tasks/roadmap-gap-closure.md` TASK-02.
