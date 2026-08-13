# BE2 — Platform API (ownership rút gọn)

> Modules: `api/`, `models/`, `schemas/`, `db/`, `core/`, `services/notification.py`, `meal_plan_service.py`  
> Specs: `01`, `04`, `05` · ADRs: `004`, `005`, `006`  
> Backlog: [`roadmap-gap-closure.md`](roadmap-gap-closure.md)

## Trách nhiệm

- Auth JWT, seed demo accounts
- REST routes mounted trong `main.py`
- Persist MealPlan / Alert / Notification; doctor review
- `DEMO_MOCK` orchestration trong `meal_plan_service` / interaction route
- Wire `run_agent` từ chat / generate (khi mock off)
- Postgres khi deploy (ADR-006)

## Không làm

- Prompt/RAG internals, FE components

## Focus hiện tại

- TASK-02: persist plan khi agent trả về; bỏ 501 interaction khi sẵn sàng
- TASK-06: deploy + guard `demo/simulate`
- Đồng bộ `contracts/api-v1.md` với Swagger khi đổi field
