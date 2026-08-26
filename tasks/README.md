# Tasks — VMEC-10 (P-014)

Tổng quan phân công & North Star demo flow. Backlog chi tiết theo MoSCoW: [`roadmap-mvp.md`](roadmap-mvp.md). Ownership rút gọn theo role: [`be1-ai-core.md`](be1-ai-core.md) · [`be2-platform.md`](be2-platform.md) · [`fe-frontend.md`](fe-frontend.md). **Kiểm thử toàn hệ thống:** [`test/README.md`](test/README.md) (checklist spec 00–13, coverage, template bug).

## Phân công 3 người

| Role | Ranh giới module (thư mục code thật) | Không đụng (trừ khi thống nhất) |
|---|---|---|
| **BE1 — AI Core** | `backend/app/agents/`, `backend/app/rag/`, `backend/app/guardrails/`, `backend/data/` (KB thuốc-thực phẩm, catalog món ăn, guideline) | `backend/app/api/`, `backend/app/models/`, `frontend/**` |
| **BE2 — Platform** | `backend/app/api/`, `backend/app/models/`, `backend/app/schemas/`, `backend/app/services/`, `backend/app/db/`, `backend/app/core/` | Logic prompt/RAG/agent nội bộ, `frontend/**` |
| **FE — Frontend** | `frontend/**` | Backend agent logic, DB migrations |

**Handoff rule (không đổi so với `CLAUDE.md`):** đổi schema Agent (`AgentState`/`AgentRunInput`/`AgentRunOutput`/`MealPlanOutput`/...) → sửa `contracts/agent-io-schema.md` trước; đổi HTTP FE↔BE → sửa `contracts/api-v1.md` trước. BE1 ↔ BE2 giao tiếp qua contract + Pydantic schema, không qua code trực tiếp giữa 2 module.

## North Star demo flow (end-to-end)

1. **Bác sĩ đăng nhập** (`specs/01-account-auth.md`) → thêm bệnh nhân mới nếu cần (`specs/03-doctor-patient-management.md`).
2. **Bệnh nhân (hoặc bác sĩ hộ) khai hồ sơ** (`specs/02-patient-profile-onboarding.md`) — bệnh lý, thuốc, dị ứng, mục tiêu calo.
3. **Sinh thực đơn 7 ngày** (`specs/05-meal-plan-generation.md`) — pipeline lọc dị ứng → soft preference → tính dinh dưỡng → kiểm tra tương tác thuốc-thực phẩm (`specs/08-drug-food-interaction-check.md`) → swap nếu nguy hiểm → citation.
4. **Bác sĩ duyệt** (`specs/06-meal-plan-review.md`) — approve/reject/edit, side-effect notification.
5. **Bệnh nhân xem thực đơn đã duyệt** (`specs/07-patient-meal-plan-view.md`) + nhận Compliance Notification theo lịch (`specs/11-compliance-notification-delivery.md`).
6. **Bệnh nhân hỏi lại qua chat** (`specs/13-ai-chat-assistant.md`) — ví dụ hỏi lại về tương tác thuốc hoặc kiến thức dinh dưỡng (RAG).

Đây là luồng **duy nhất** phải chạy mượt không crash khi demo (`CLAUDE.md` Mục 11 — Success Metrics). Mọi tính năng khác (Food Log, Doctor Compliance View, Clinical Constraints UI...) là bổ trợ — theo nguyên tắc vàng, ưu tiên giữ luồng này mượt hơn là thêm tính năng mới.

## Ghi chú quan trọng khi bắt đầu bất kỳ task nào

- Đọc `CLAUDE.md` + `AGENTS.md` trước — đặc biệt luật cứng Mục 7 (guardrails, citation, không đổi thuốc).
- Đọc spec liên quan trong `specs/` — mỗi spec có mục `Status` cho biết đây là hành vi **đã có** (Done/Partial) hay **thiết kế đề xuất chưa code** (Planned).
- Sửa `contracts/*.md` trước khi đổi schema/endpoint thật.
- **Food Log đã implement (Should Have, Done core 2026-08-17)** — structured manual entry 3-slot theo `adrs/009-food-log-scope-strategy.md`, `specs/09-food-log-adherence.md`; UI modal trong `/patient/meals`, API `POST/GET /food-log`.
