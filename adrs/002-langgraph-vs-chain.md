# ADR 002 — LangGraph vs Simple Chain

- **Status:** Accepted
- **Date:** 2026-08-04
- **Deciders:** BE1 (AI Core)

## Context

Pipeline AI cần: load profile → phân loại intent → RAG → meal plan hoặc interaction check → guardrails/source check. Có nhánh điều kiện (vd. intent `meal_plan` vs `interaction` vs `chitchat_refuse`).

## Decision

Dùng **LangGraph** làm orchestration chính, với state TypedDict/Pydantic rõ ràng.

## Options considered

| Option | Pros | Cons |
|---|---|---|
| Pure LangChain LCEL chain | Nhanh dựng | Khó nhánh, khó quan sát state, refactor đau |
| Custom Python functions | Đơn giản tuyệt đối | Mất chuẩn agent, khó mở rộng |
| **LangGraph** | State machine rõ, nhánh/conditional edge, khớp skill team | Learning curve; rủi ro over-engineer |

## Graph tối thiểu (MVP)

```
START → profile_loader → intent_classifier
      → (meal_plan | interaction_check | rag_qa | refuse)
      → source_check / guardrails
      → END
```

MealPlanner và InteractionChecker là **nodes/agents** trong cùng graph hoặc subgraph gọi được từ node.

## Consequences

- Mọi node phải khớp `/contracts/agent-io-schema.md`.
- Plan B nếu delay ngày 3–4: implement linear functions cùng interface, bọc LangGraph sau — **không đổi contract**.
- BE2 gọi graph qua facade service (`run_agent(input)`) — không import lung tung từng node.

## Out of graph

Compliance Notification **không** chạy trong LangGraph (là platform service/event của BE2). Agent chỉ emit dữ liệu kích hoạt (plan created, interactions found).
