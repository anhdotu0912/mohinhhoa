# ADR-002: LangGraph cho Agent Orchestration

## Status
Accepted — đã implement.

## Context
Hệ thống cần route nhiều intent khác nhau (meal_plan, interaction_check, rag_qa, refuse, food_log, unknown) từ 1 entry point chat, đồng thời tái sử dụng cùng agent (MealPlanner, InteractionChecker) ở nhiều luồng khác nhau (chat trực tiếp và generate meal plan tự động).

## Decision
Dùng **LangGraph StateGraph** thay vì chain đơn giản (LangChain Chain tuyến tính) để orchestrate. Graph có conditional edges routing theo intent, entry chung qua node `profile_loader` → `intent_classifier`.

Facade duy nhất: `run_agent(AgentRunInput) → AgentRunOutput`, được gọi từ:
- `POST /chat` (luôn luôn)
- `POST /meal-plans/generate` khi `DEMO_MOCK=false`

## Consequences
- **Positive:** Dễ mở rộng thêm intent mới (thêm node + edge), tách biệt rõ routing logic khỏi agent logic, tái sử dụng agent giữa chat và generate.
- **Negative:** Thêm độ phức tạp so với gọi thẳng agent function — cần hiểu graph state để debug.
- **Alternatives considered:** Chain tuyến tính đơn giản hơn nhưng không xử lý tốt multi-intent routing có điều kiện — *[chi tiết so sánh không có trong tài liệu nguồn]*.
