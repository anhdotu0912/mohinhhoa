# Tasks — Tổng quan phân công

> **Backlog hiện tại (SSOT):** [`roadmap-gap-closure.md`](roadmap-gap-closure.md)  
> Ownership rút gọn: `be1-ai-core.md` · `be2-platform.md` · `fe-frontend.md`  
> Scope sản phẩm: `/CLAUDE.md` · Kiến trúc: `/docs/MO_TA_HE_THONG.md`  
> Contracts: `/contracts/agent-io-schema.md` + `/contracts/api-v1.md`

> `roadmap-14-days.md` (timeline ngày 1–14) đã **superseded** bởi gap-closure. Không khôi phục trừ khi team cần lịch sử.

---

## Team (3 người)

| Role | Codename | Trách nhiệm chính |
|---|---|---|
| **BE1** | AI Core | Chroma RAG, embeddings MiniLM, LangGraph, MealPlanner, InteractionChecker, Guardrails, NutritionCalculator, KB data |
| **BE2** | Platform API | Auth/JWT, SQLAlchemy models, REST routes, Alert/Notification, Dietitian APIs, wiring `run_agent` / `DEMO_MOCK` |
| **FE** | Frontend | Shell `/patient/*` + `/doctor/*`, Zustand, `lib/api.ts` (backlog), UX North Star |

---

## Ranh giới module

```
BE1  → backend/app/agents/**, rag/**, guardrails/**,
       services/nutrition_calculator.py, data/**,
       tests/test_rag*.py, test_meal_planner.py, test_interaction_checker.py

BE2  → backend/app/api/**, models/**, schemas/**, db/**, core/**,
       services/notification.py, meal_plan_service.py, meal_plan_demo.py,
       main.py, tests/test_api.py, test_compliance_notification.py

FE   → frontend/**
```

**Shared:** contracts (breaking cần ACK), specs, adrs, CLAUDE.md, docker-compose.yml

---

## Demo flow (North Star)

1. Patient login  
2. Onboarding hồ sơ  
3. Generate meal plan 7 ngày  
4. Alerts tương tác  
5. Compliance notifications  
6. Dietitian approve/edit/reject  
7. Patient thấy `plan_approved`  

**Không có bước Food Log** (nav Ghi nhận đã ẩn).
