# ADR-002: Agent Orchestration bằng LangGraph

## Status
Accepted

## Context
VMEC-10 cần một orchestration layer cho AI agent xử lý nhiều loại yêu cầu của bệnh nhân (lập thực đơn, hỏi tương tác thuốc–thực phẩm, hỏi RAG Q&A, ghi nhận ăn uống, từ chối các yêu cầu ngoài phạm vi) qua một entry point chat duy nhất (`POST /chat`). Cần:
- Một state machine rõ ràng để dễ thêm node mới (ví dụ node mới cho intent `metrics_advice` — xem `adrs/010-patient-metrics-history-strategy.md`).
- Khả năng route theo intent được phân loại từ tin nhắn tự nhiên.
- Một facade function đơn giản cho BE2 gọi, không cần biết chi tiết bên trong graph (đúng luật boundary BE1/BE2 trong `CLAUDE.md` Mục 5).

## Decision
Dùng **LangGraph** (`StateGraph`) làm engine orchestration. Cấu trúc as-built tại `backend/app/agents/graph.py`:

```
profile_loader → intent_classifier → route_intent (conditional) → {
  rag_qa            (app/agents/nodes/rag_tool.py)
  meal_plan         (meal_plan_node → meal_planner_agent)
  interaction_check (interaction_check_node → interaction_checker_agent)
  food_log          (food_log_node — stub, xem adrs/009)
  refuse            (refuse_node — từ chối yêu cầu đổi thuốc/chẩn đoán)
  unknown           (unknown_node — gợi ý lại các chức năng)
} → END
```

- **State:** `AgentState` (TypedDict, `backend/app/agents/state.py`) — không dùng Pydantic model cho state nội bộ (khác với input/output HTTP dùng Pydantic) để tránh overhead validate mỗi lần cập nhật state qua các node.
- **Facade:** `run_agent(AgentRunInput) -> AgentRunOutput` (`graph.py`) — compile graph một lần (singleton `_compiled_graph`), BE2 (`routes_chat.py`) chỉ gọi facade này, không import node lẻ.
- **Intent hợp lệ:** `meal_plan | interaction_check | food_log | rag_qa | refuse | unknown` (đúng `VALID_INTENTS` trong `nodes/intent_classifier.py`).
- **Bypass classifier:** `AgentRunInput.force_intent` cho phép ép intent trực tiếp (dùng cho test/debug) — hiện **không** expose qua `ChatRequest` HTTP (chỉ có field `message`), nên patient/doctor không tự set được qua API public.
- **Lỗi:** mọi exception trong node được bắt tại facade `run_agent`, trả `AgentRunOutput(intent="unknown", message="Đã xảy ra lỗi...", guardrail_triggered=False)` — không để lỗi 500 lan tới HTTP layer (route `POST /chat` vẫn có try/except riêng bọc ngoài để bắt lỗi ngoài phạm vi facade, trả `503 AGENT_ERROR`).

## Consequences
**Positive**
- Thêm intent/node mới không phá vỡ graph cũ (chỉ cần thêm `add_node` + 1 nhánh trong `route_intent`).
- Tách biệt rõ giữa "phân loại" (intent_classifier) và "xử lý" (node theo intent) — dễ test độc lập.
- Facade pattern giữ đúng boundary BE1 (nội bộ agent) / BE2 (API, DB) theo `CLAUDE.md`.

**Negative**
- `profile_loader` hiện dùng `_DEMO_PROFILES` hard-code theo `user_id` demo (`demo_patient_1/2/3`) hoặc fallback profile mặc định — **chưa** query DB thật qua BE2 khi chạy qua `/chat`. Nghĩa là hồ sơ bệnh nhân thật (đã lưu qua `POST /profile`) không được `meal_plan`/`interaction_check` node trong luồng chat sử dụng, trừ khi `user_id` trùng đúng 1 trong 3 tài khoản demo. Đây là gap cần đóng trước khi demo với tài khoản patient tự đăng ký (xem `tasks/be1-ai-core.md`).
- `meal_plan_node` (chat) gọi `meal_planner_agent()` và trả `meal_plan_id` trong `AgentRunOutput`, nhưng **không persist** kế hoạch vào DB (khác với `POST /meal-plans/generate` — xem `specs/05-meal-plan-generation.md`, Edge cases). `meal_plan_id` trả về qua chat hiện không thể `GET /meal-plans/{id}` sau đó.

**Alternatives đã cân nhắc**
- Tự viết state machine thủ công (if/elif theo intent): bị loại vì khó mở rộng, khó test node độc lập, không có sẵn cơ chế conditional edge/observability như LangGraph.
- CrewAI / AutoGen (multi-agent framework nặng hơn): bị loại vì overkill cho quy mô 6 node, tăng thời gian học cho team 2 tuần.
