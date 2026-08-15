# Brief tạo lại toàn bộ tài liệu — specs/ · adrs/ · contracts/ · tasks/

> **Dành cho:** AI coding agent được giao viết lại toàn bộ tài liệu dự án VMEC-10 (P-014) từ đầu, thay thế hoàn toàn nội dung cũ trong 4 thư mục `specs/`, `adrs/`, `contracts/`, `tasks/`.
> **Việc cần làm:** Xoá nội dung cũ, tạo **30 file** liệt kê bên dưới, đúng tên, đúng thư mục, đúng format quy định ở Mục 1.
> **Trước khi viết bất kỳ file nào:** đọc kỹ Mục 0 (bối cảnh dự án) và Mục 2 (dữ kiện as-built) — nội dung file phải khớp với code thật đang chạy trong repo (`backend/app`, `frontend/lib`), không được bịa hành vi chưa tồn tại. Nếu mô tả 1 use case chưa có code → ghi rõ `Status: Planned` và mô tả *thiết kế đề xuất*, không ghi như đã hoạt động.
> **Sau khi viết xong toàn bộ:** đối chiếu chéo — mọi endpoint nhắc trong `specs/*` phải xuất hiện trong `contracts/api-v1.md`; mọi field/schema nhắc trong `specs/*` phải khớp `contracts/agent-io-schema.md`; mọi file spec phải có ít nhất 1 dòng trong `tasks/roadmap-mvp.md`.

---

## 0. Bối cảnh dự án (đưa vào phần đầu mỗi file liên quan khi cần)

**Tên dự án:** VMEC-10 — AI Agent trợ lý dinh dưỡng lâm sàng & lối sống theo bệnh lý (Hệ thống y tế X).

**Bài toán gốc:** Bệnh nhân mãn tính (tiểu đường, tăng huyết áp, gout...) khó tự lập thực đơn phù hợp, dễ vi phạm chỉ định do thiếu công cụ theo dõi.

**Giải pháp:** AI Agent dinh dưỡng — nhận hồ sơ & ràng buộc bệnh nhân, dùng RAG trên guideline dinh dưỡng Việt Nam + vector DB, sinh thực đơn, tính toán dinh dưỡng, kiểm tra tương tác thuốc–thực phẩm/dị ứng, sinh cảnh báo. **HITL bắt buộc**: mọi kế hoạch dinh dưỡng phải được bác sĩ/chuyên gia duyệt; AI không tự chẩn đoán bệnh, không tự ý khuyến nghị đổi thuốc/liều; mọi số liệu phải grounded + có citation.

**Tác nhân:**
- **Bác sĩ / Chuyên gia dinh dưỡng** (`role=doctor`)
- **Bệnh nhân** (`role=patient`)
- **AI** — tác nhân hệ thống (LangGraph Agent), không login
- **Chung** — đăng ký/đăng nhập/liên hệ, không phân role

**Tech stack (đã chốt, giữ nguyên khi viết ADR):** FastAPI (backend), Next.js 14+ App Router + TypeScript + Tailwind (frontend), LangGraph (agent orchestration), ChromaDB (dev)/Qdrant hoặc Pinecone (prod) cho vector store, SQLite (dev)/Postgres (prod), multilingual-e5-base (embedding), Railway/Vercel (deploy).

**Nguyên tắc vàng khi viết mọi tài liệu:**
1. Ưu tiên demo mượt trên North Star flow hơn là đầy đủ tính năng.
2. Mọi thay đổi schema/API phải sửa `contracts/*` trước, code sau (Handoff rule).
3. Không scope-creep — nếu 1 use case trong UML không nằm trên North Star flow, ghi rõ MoSCoW thấp (Should/Could/Won't), không âm thầm bỏ qua.

---

## 1. Format chuẩn cho từng loại file

### 1.1 `specs/*.md`
```
# Spec: <Tên chức năng>

## Status
<New | Planned | Partial | Done> — 1 câu tóm tắt hiện trạng thật so với code.

## 1. Mục tiêu (Why)
## 2. User story
Là **<actor>**, tôi muốn ..., để ...
## 3. Business rules
(đánh số, rule cứng có liên quan HITL/guardrail phải nêu rõ)
## 4. Luồng chính (happy path)
(các bước tuần tự, có thể trỏ endpoint cụ thể)
## 5. Edge cases
(đánh dấu [CẦN XÁC NHẬN] cho những điểm còn mơ hồ, không tự quyết)
## 6. Ngoài phạm vi (Out of scope)
## 7. Schema tham chiếu (nếu có)
## 8. API liên quan
| Method | Path | Role |
## 9. Liên quan
(trỏ ADR/contract/spec khác)
```

### 1.2 `adrs/*.md`
```
# ADR-0XX: <Tên quyết định>
## Status
Proposed | Accepted | Deferred | Rejected
## Context
## Decision
## Consequences
(Positive / Negative / Alternatives đã cân nhắc)
```

### 1.3 `contracts/*.md`
Theo đúng convention JSON code-block Request/Response như file cũ; có mục Enum tham chiếu dùng chung ở cuối; có dòng version + luật "sửa contract trước, code sau".

### 1.4 `tasks/*.md`
Theo checklist: Mục tiêu → Sub-tasks (checkbox) → Definition of Done → Owner.

---

## 2. Dữ kiện as-built PHẢI phản ánh đúng trong tài liệu mới

Đây là hành vi **thật** của code hiện tại (`backend/app/**`) — bắt buộc dùng làm nguồn sự thật khi viết spec/contract, không suy diễn khác:

- **Auth:** `POST /auth/register` (role patient|doctor, `full_name` optional — dùng được cho cả trường hợp doctor tạo hộ tài khoản patient), `POST /auth/login` trả JWT.
- **Profile:** 1 user – 1 profile (upsert), field bắt buộc `disease/medications/allergies/bmi/target_kcal`, field optional `restrictions{carb_per_meal,sodium_daily}`, `preferences[]`. `allergies` = hard filter, `preferences` = soft filter.
- **Meal plan generation:** luôn 7 ngày, `status` khởi tạo `pending_review`. Có 2 nhánh theo flag `DEMO_MOCK` (mặc định `true`): mock builder persist trực tiếp (đường demo ổn định) vs `run_agent` thật qua LangGraph (còn gap persist khi `DEMO_MOCK=false`). SLA <15s p95 chỉ áp dụng nhánh thật.
- **Interaction check:** `POST /interactions/check` — khi `DEMO_MOCK=true` dùng KB rút gọn (mock helper); khi `false` trả **501** (chưa wire agent thật). KB đầy đủ nằm ở `data/drug_food_interactions.json` (~28 cặp), dùng trong graph/meal planner. Severity 3 mức: `Nguy hiểm | Cần chú ý | An toàn`.
- **Doctor review:** action `approve | reject | edit` qua `POST /doctor/meal-plans/{id}/review`. Approve gắn `trust_badge=doctor_reviewed` + notification `plan_approved`. Reject huỷ toàn bộ notification tương lai của plan. Edit nhận `edited_plan` (full replace), không có API sửa từng món riêng lẻ.
- **Doctor patient update:** `PUT /doctor/patients/{id}/profile` — **hiện chưa có field `target_kcal`/`restrictions`** (chỉ patient tự sửa qua `/profile`). Đây là điểm cần thiết kế lại trong tài liệu mới nếu muốn bác sĩ toàn quyền chỉnh ràng buộc lâm sàng (khớp UML).
- **Notification:** kiến trúc **event-driven, materialize-ahead**, không cron (do free-tier hosting không có scheduler ổn định). Type hiện có: `meal_reminder | interaction_followup | plan_approved | adherence_checkin`. Status: `pending | sent | read | dismissed | done | cancelled`. `POST /notifications/demo/simulate` chỉ **seed vài bản ghi mẫu**, không bulk-flip; đã guard `DEMO_DISABLED` khi `APP_ENV=production`. **Hiện chỉ role `patient` gọi được `GET /notifications`** — bác sĩ chưa có endpoint đọc tổng hợp tuân thủ của bệnh nhân (gap thật, cần thiết kế mới nếu giữ use case "Xem tuân thủ" của bác sĩ).
- **Chat/RAG:** `POST /chat` → LangGraph `profile_loader → intent_classifier → route`. Intent hiện có: `meal_plan | interaction_check | food_log | rag_qa | refuse | unknown`. `food_log` là **stub node**, chưa xử lý thật. Guardrail cứng: số liệu trong `rag_qa` phải có citation, không có thì redact/từ chối phần đó thay vì bịa.
- **Guardrails:** `backend/app/guardrails/rules.py` và `source_check.py` **hiện là placeholder trống** (`"""Placeholder"""`) — mọi spec có nhắc "guardrail chặn X" phải ghi rõ đây là hành vi **thiết kế/kỳ vọng**, chưa phải as-built, để agent code sau biết đây là việc cần làm chứ không phải đã xong.
- **Chỉ số cơ thể:** chỉ lưu snapshot mới nhất (`weight/height/bmi/bmi_category`), **không có bảng lịch sử theo thời gian** — nếu muốn "phân tích xu hướng" cần quyết định trong ADR có làm hay hoãn.
- **Ngoài phạm vi cố định của cả dự án (đã quyết định trước, giữ nguyên trừ khi ADR mới đổi):** không hỗ trợ đa ngôn ngữ, không có push FCM/APNs, không phân công tự động doctor↔patient (1 doctor demo thấy toàn bộ hàng đợi).

---

## 3. Danh sách file cần tạo — `specs/` (13 file)

| # | File | Actor chính | Nội dung bắt buộc phải có |
|---|---|---|---|
| 1 | `01-account-auth.md` | Chung | Đăng ký (2 role), đăng nhập JWT, luồng liên hệ; rule trùng email → 409 |
| 2 | `02-patient-profile-onboarding.md` | Patient | Field bắt buộc/optional theo Mục 2; hard filter allergies vs soft filter preferences; điều kiện tiên quyết để generate plan |
| 3 | `03-doctor-patient-management.md` | Doctor | Thêm bệnh nhân (dùng lại `/auth/register`), sửa thông tin chung; validate email trùng, tuổi 0–130 |
| 4 | `04-clinical-constraints.md` | Doctor | **Thiết kế mới** — bác sĩ xem/sửa `restrictions` + `target_kcal`; ghi rõ hiện field này chưa có trên API doctor, cần bổ sung; ràng buộc mới áp dụng từ lần generate kế tiếp |
| 5 | `05-meal-plan-generation.md` | AI/Patient/Doctor | Luồng 7 ngày, 2 nhánh DEMO_MOCK, pipeline agent (RAG→draft→hard filter dị ứng→soft prefs→tính dinh dưỡng→check tương tác→swap nếu nguy hiểm→citation), luôn include use case 08 |
| 6 | `06-meal-plan-review.md` | Doctor | approve/reject/edit, trust_badge, side-effect notification theo action, race condition 2 doctor [CẦN XÁC NHẬN] |
| 7 | `07-patient-meal-plan-view.md` | Patient | Xem chi tiết, xem món thay thế (swaps[]), danh sách đi chợ (Could Have — ghi Planned), gợi ý khu vực bán (Could Have — ghi Planned) |
| 8 | `08-drug-food-interaction-check.md` | AI (dùng chung) | 2 luồng (gắn plan / ad-hoc), input/output, severity 3 mức, matching KB accent-insensitive, guardrail không đổi thuốc/liều — service dùng chung, mọi spec khác include tới đây thay vì viết lại logic |
| 9 | `09-food-log-adherence.md` | Patient | **Thiết kế mới hoặc Planned rõ ràng** — ghi nhận ăn uống thực tế, khai báo tuân thủ, cảnh báo vượt ngưỡng; ghi chú hiện `food_log` chỉ là stub node trong graph |
| 10 | `10-doctor-compliance-view.md` | Doctor | **Thiết kế mới** — biểu đồ tuân thủ, ngưỡng cảnh báo tuân thủ thấp, gửi nhắc nhở thủ công; ghi rõ hiện chưa có endpoint doctor đọc adherence tổng hợp |
| 11 | `11-compliance-notification-delivery.md` | AI/Patient | Bảng sự kiện → notification (generate/approve/reject/alert), nguyên tắc event-driven materialize-ahead, hành vi thật của `/demo/simulate` |
| 12 | `12-patient-metrics-tracking.md` | Patient/Doctor | Ghi nhận chỉ số, xem lại; "lời khuyên khi chỉ số đổi" (Should Have, cần intent Agent mới — ghi Planned); "xu hướng dài hạn" trỏ sang ADR quyết định có/không |
| 13 | `13-ai-chat-assistant.md` | Patient | Entry point `/chat`, intent routing đầy đủ, guardrail citation bắt buộc cho rag_qa, multi-intent ambiguous [CẦN XÁC NHẬN] |

---

## 4. Danh sách file cần tạo — `adrs/` (10 file)

| # | File | Quyết định cần ghi |
|---|---|---|
| 1 | `001-vector-database-choice.md` | Chroma (dev) vs Qdrant/Pinecone (prod) — lý do chi phí/độ phức tạp phù hợp prototype |
| 2 | `002-agent-orchestration-langgraph.md` | Vì sao LangGraph, cấu trúc node/state tổng quát của graph |
| 3 | `003-embedding-model-choice.md` | multilingual-e5-base — lý do phù hợp tiếng Việt, so với alternatives |
| 4 | `004-llm-provider-and-fallback-strategy.md` | Provider chính (DeepSeek/OpenAI theo `LLM_PROVIDER`), fallback rule-based khi thiếu API key |
| 5 | `005-database-choice.md` | SQLite dev / Postgres prod, chiến lược migrate |
| 6 | `006-hitl-guardrails-strategy.md` | Kiến trúc chặn: AI không tự chẩn đoán/đổi thuốc, mọi plan qua bác sĩ duyệt; vị trí guardrails trong pipeline (trước khi trả response) |
| 7 | `007-compliance-notification-strategy.md` | Event-driven materialize-ahead, không cron, lý do free-tier hosting; hành vi thật của endpoint demo/simulate |
| 8 | `008-compliance-summary-aggregation-strategy.md` | On-the-fly aggregate vs bảng tổng hợp riêng cho "Xem tuân thủ" của doctor — khuyến nghị on-the-fly cho quy mô demo, ghi rõ điều kiện revisit |
| 9 | `009-food-log-scope-strategy.md` | Phạm vi thật sự làm cho Food Log: nhập tay có cấu trúc, mức ưu tiên so với North Star, có bắt buộc cho demo lần này không |
| 10 | `010-patient-metrics-history-strategy.md` | Có làm time-series chỉ số cơ thể hay giữ snapshot — khuyến nghị hoãn nếu không nằm trên North Star, ghi rõ để tránh scope-creep về sau |

---

## 5. Danh sách file cần tạo — `contracts/` (2 file)

| # | File | Nội dung bắt buộc |
|---|---|---|
| 1 | `agent-io-schema.md` | Conventions chung (ISO-8601, UUID, error envelope, severity enum) → `PatientProfile` → `MealPlanOutput` (đủ `days[7]`, `swaps[]`, `citations[]`, `alternatives[]` trên FoodItem) → `FoodLogEntry` (Status theo quyết định ADR-009) → `Alert` → `AgentState`/`AgentRunInput`/`AgentRunOutput` (đúng field `message` không phải `reply`, đúng danh sách intent kể cả intent mới nếu ADR/spec 12 quyết định thêm) → `InteractionCheckOutput` → mục Versioning (luật sửa contract trước code sau) |
| 2 | `api-v1.md` | Tất cả endpoint suy ra từ 13 spec ở Mục 3, nhóm theo: Auth / Profile / Clinical Constraints / Meal Plans / Interactions / Alerts / Notifications / Doctor Patient Management / Doctor Review / Doctor Compliance / Chat / Food Log / Health — mỗi endpoint có Role + Request/Response JSON; cuối file có bảng Enum tham chiếu dùng chung (`MealPlan.status`, `Alert.severity`, `Notification.type`, `Notification.status`, `User.role`) |

---

## 6. Danh sách file cần tạo — `tasks/` (5 file)

| # | File | Nội dung bắt buộc |
|---|---|---|
| 1 | `README.md` | Tổng quan phân công 3 người (BE1 AI core / BE2 platform / FE), ranh giới module theo thư mục code thật (`agents/ rag/ guardrails/` = BE1; `api/ models/ services/` = BE2; `frontend/**` = FE), mô tả North Star demo flow end-to-end (đăng nhập bác sĩ → generate → duyệt → bệnh nhân xem → chat hỏi lại) |
| 2 | `roadmap-mvp.md` | Bảng ánh xạ 13 spec → task cụ thể → MoSCoW (Must/Should/Could/Won't) → Owner → Status; thứ tự triển khai đề xuất theo mức độ chặn demo (Guardrails thật + DEMO_MOCK=false luôn ưu tiên cao nhất trước mọi tính năng mới) |
| 3 | `be1-ai-core.md` | Ownership: `backend/app/agents/`, `backend/app/rag/`, `backend/app/guardrails/`, `backend/app/kb/`; checklist việc cần làm map tới spec 05/08/09/12/13 |
| 4 | `be2-platform.md` | Ownership: `backend/app/api/`, `backend/app/models/`, `backend/app/services/`, `backend/app/db/`; checklist map tới spec 01/03/04/06/10/11 |
| 5 | `fe-frontend.md` | Ownership: toàn bộ `frontend/**`; nguyên tắc luôn theo `contracts/api-v1.md` làm nguồn sự thật khi gọi API, không tự bịa field |

---

## 7. Thứ tự tạo file đề xuất cho agent

1. Đọc code thật trong repo để xác nhận lại Mục 2 vẫn đúng tại thời điểm viết (tránh lệch pha nếu code đã đổi từ lúc brief này được tạo).
2. Viết `adrs/*` trước — mọi quyết định kiến trúc (đặc biệt 006, 008, 009, 010) ảnh hưởng trực tiếp nội dung specs.
3. Viết `contracts/agent-io-schema.md` + `contracts/api-v1.md` — dựa trên ADR đã chốt + as-built Mục 2.
4. Viết 13 file `specs/*` — trỏ ngược lại đúng section trong 2 file contract.
5. Viết `tasks/*` cuối cùng — tổng hợp từ toàn bộ specs đã viết.
