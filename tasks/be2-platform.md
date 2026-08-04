# BE2 — Platform API backlog

> Modules: `api/`, `models/`, `schemas/`, `db/`, `core/`, `services/notification.py`, `main.py`  
> Specs: `compliance-notification.md` (+ consume meal/interaction outputs)  
> ADRs: `001` (compose Qdrant), `004`

---

## Trách nhiệm

- Auth JWT 2 role (`patient`, `dietitian`)
- PostgreSQL models + migrations/session
- REST: profile, meal-plans, chat, interactions/alerts, dietitian review, **notifications**
- Compliance Notification service (materialize, status transitions, demo simulate)
- Wire `run_agent` facade của BE1 vào routes (không nhúng logic prompt)
- Deploy Railway + docker-compose (api, postgres, qdrant)
- `tests/test_api.py`, `tests/test_compliance_notification.py`

## Không làm (trừ khi được nhờ rõ)

- Prompt engineering / retriever tuning
- FE styling
- Tự invent schema lệch contract

---

## Checklist theo milestone

### M1 — Foundation (ngày 1–7)
- [ ] `docker-compose`: postgres + qdrant + api
- [ ] Models: `User`, `Profile`, `MealPlan`, `Alert`, `Notification`
- [ ] Schemas Pydantic khớp contract
- [ ] `POST/GET` auth, profile, meal-plans/generate+get, chat
- [ ] Seed user patient + dietitian
- [ ] CORS cho FE local + Vercel preview

### M2 — Alerts & Dietitian API (ngày 8–10)
- [ ] Persist alerts từ interaction output
- [ ] `GET /alerts`
- [ ] `GET /dietitian/meal-plans`
- [ ] Review endpoint stub sẵn sàng ngày 11

### M3 — Compliance Notification (ngày 11)
- [ ] `NotificationService.materialize_from_meal_plan`
- [ ] Hooks: approve → `plan_approved`; reject → cancel future; alert → `interaction_followup`
- [ ] Routes read/dismiss/done + demo simulate
- [ ] Tests service + API
- [ ] Dietitian review full (approve/edit/reject) + `trust_badge`

### M4 — Ship (ngày 12–14)
- [ ] Deploy + env production
- [ ] Healthcheck, logging
- [ ] Reset/seed script cho demo day
- [ ] Không expose Food Log routes

---

## Handoff artifacts phải giao FE

| Artefact | Khi |
|---|---|
| Swagger ổn định auth/profile/meal-plan | Ngày 7 |
| Alerts API | Ngày 10 |
| Notifications API + sample payloads | Ngày 11 sáng |
| Demo accounts | Ngày 13 |

## Handoff nhận từ BE1

- `run_agent(...)` callable
- Sample meal plan + interaction JSON
- Env keys: LLM, embedding, Qdrant

## Commands

```bash
cd backend
uvicorn app.main:app --reload
pytest tests/test_api.py tests/test_compliance_notification.py -q
```
