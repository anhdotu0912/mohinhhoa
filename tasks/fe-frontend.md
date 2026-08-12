# FE — Frontend (ownership rút gọn)

> Modules: `frontend/**`  
> Specs: toàn bộ UX North Star · Contract HTTP: `contracts/api-v1.md`  
> Backlog: [`roadmap-gap-closure.md`](roadmap-gap-closure.md) TASK-01, TASK-05

## Trách nhiệm

- Shell bệnh nhân `/patient/*` và bác sĩ `/doctor/*` (role API `dietitian`)
- Auth UI → JWT thật (TASK-01)
- `lib/api.ts` + types theo api-v1 (thiếu → backlog)
- Onboarding, meals, notifications, dietitian review nối API
- **Ẩn Food Log** khỏi nav (Won't Have)

## Không làm

- Agent/RAG logic, DB migrations

## Focus hiện tại

- TASK-01: thay mock stores bằng API + JWT
- Messages / assistant: mock chấp nhận được cho đến khi wire chat
- Không hiện `/patient/meals/log` trong `nav-config`
