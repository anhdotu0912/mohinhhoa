# Tasks — Tổng quan phân công

> Nguồn sự thật timeline: `/tasks/roadmap-14-days.md`  
> Backlog theo role: `be1-ai-core.md` · `be2-platform.md` · `fe-frontend.md`  
> Scope sản phẩm: `/CLAUDE.md`

---

## Team (3 người)

| Role | Codename | Trách nhiệm chính |
|---|---|---|
| **BE1** | AI Core | RAG/Qdrant, embeddings, LangGraph, MealPlanner, InteractionChecker, Guardrails, NutritionCalculator, KB data |
| **BE2** | Platform API | Auth/JWT, PostgreSQL models, REST routes, Alert persist, **Compliance Notification**, Dietitian APIs, wiring `run_agent` |
| **FE** | Frontend | 4 screens Next.js, Zustand stores, types đồng bộ contract, UX demo |

---

## Ranh giới module (không đụng trừ khi thống nhất trên contract PR)

```
BE1  → backend/app/agents/**, rag/**, guardrails/**,
       services/nutrition_calculator.py, data/**, tests/test_rag*.py,
       tests/test_meal_planner.py, tests/test_interaction_checker.py

BE2  → backend/app/api/**, models/**, schemas/**, db/**, core/**,
       services/notification.py, main.py (router include),
       tests/test_api.py, tests/test_compliance_notification.py

FE   → frontend/**
```

**Shared / jointly owned**
- `/contracts/agent-io-schema.md` — mọi Breaking change cần ACK 2/3 role
- `/specs/*`, `/adrs/*`, `/CLAUDE.md` — cập nhật khi đổi scope
- `docker-compose.yml` — BE2 lead, BE1 review Qdrant service

---

## Demo flow (North Star) — checklist chung

1. Patient register/login  
2. Onboarding hồ sơ  
3. Generate meal plan 7 ngày (citations)  
4. Xem alerts tương tác (nếu có)  
5. Dashboard: compliance notifications (reminder / follow-up / approved / check-in)  
6. Dietitian login → approve/edit/reject + trust badge  
7. Patient thấy `plan_approved`

**Không có bước Food Log.**

---

## Definition of Done (áp dụng mọi task trong folder này)

Xem `/CLAUDE.md` §12. Thêm: PR mô tả handoff (`Needs BE2 to wire X`, `FE blocked on Y`).
