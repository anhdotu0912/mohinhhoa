# Queue — VinNutri (P-014)

**Cập nhật:** 2026-08-31  
**Mục đích:** Chỉ mục master cho việc **còn lại**. Mỗi dòng Open = một đơn vị spawn thành file task nhỏ (`tasks/Txx-*.md`) và làm **tuần tự, một file một lần**.

**Nguyên tắc vàng:** Khi đánh đổi giữa "thêm tính năng" vs "demo flow mượt" → luôn chọn demo flow mượt (`CLAUDE.md` §1).

**Tài liệu tham chiếu:** [`CLAUDE.md`](../CLAUDE.md) · [`AGENTS.md`](../AGENTS.md) · [`specs/`](../specs/) · [`contracts/`](../contracts/) · [`roadmap-mvp.md`](roadmap-mvp.md) (lịch sử as-built 22/08, có thể lệch code) · ownership theo role: [`be1-ai-core.md`](be1-ai-core.md) · [`be2-platform.md`](be2-platform.md) · [`fe-frontend.md`](fe-frontend.md)

---

## 1. Tình trạng chung

### 1.1 North Star demo flow

Luồng **bắt buộc chạy mượt** khi demo (6 bước — chi tiết [`README.md`](README.md)):

| # | Bước | Trạng thái as-built |
|---|---|---|
| 1 | Bác sĩ đăng nhập → thêm/nhận bệnh nhân | **Done** |
| 2 | Khai hồ sơ (bệnh lý, thuốc, dị ứng, calo) | **Done** |
| 3 | Sinh thực đơn 7 ngày (RAG + interaction check) | **Done** |
| 4 | Bác sĩ duyệt → **apply** tuần | **Done** |
| 5 | Bệnh nhân xem plan + nhận notification | **Done** (FE gap nhỏ: nút yêu cầu điều chỉnh — xem T04) |
| 6 | Chat Q&A (tương tác thuốc, RAG dinh dưỡng) | **Done** (chất lượng RAG/guardrails còn cải thiện — T01, T02, T03) |

**Khuyến nghị:** Chạy verify E2E trên UI thật trước demo (T09).

### 1.2 Spec 01–13

| Spec | Tên | Trạng thái | Ghi chú |
|---|---|---|---|
| 01 | Account & Auth | **Done** | Rate-limit, quên MK SMTP; FE có `(auth)/forgot-password`, `(auth)/reset-password` — cần verify đầy đủ (T07) |
| 02 | Patient profile / onboarding | **Done** | HITL `constraints_status` khi BN sửa kcal/ràng buộc |
| 03 | Doctor patient management | **Done** | Claim/chuyển bác sĩ 1–1 |
| 04 | Clinical constraints | **Done** | PUT constraints + approve HITL |
| 05 | Meal plan generation | **Done** | Agent thật qua HTTP generate |
| 06 | Meal plan review | **Done** | Optimistic lock 409 |
| 07 | Patient meal plan view | **Partial** | Xem/swaps Done; **FE thiếu** nút request-adjustment (T04); đi chợ/PDF Could Have — treo |
| 08 | Drug-food interaction | **Done** | KB ~28 cặp, `unmatched_pairs[]` |
| 09 | Food log | **Done (core)** | 3-slot manual ADR-009 |
| 10 | Doctor compliance view | **Done (core)** | API + UI chart |
| 11 | Compliance notification | **Done** | Event-driven materialize-ahead |
| 12 | Patient metrics | **Done** | Time-series ADR-013; intent `metrics_delta_advice` **Done** (v1.8 contract) |
| 13 | AI chat assistant | **Partial** | Core Done (SSE, guardrails wired, per-recommendation guardrails **Done** T01); hybrid RAG **chưa wire** (T02) |

### 1.3 Stack & UI as-built

| Lớp | Công nghệ |
|---|---|
| Backend | FastAPI, Postgres, JWT (`patient` / `doctor`) |
| AI | LangGraph, GPT-4o-mini, Gemini embedding, Qdrant |
| Frontend | Next.js 16, Tailwind, Zustand, `lib/api.ts` nối hầu hết endpoint |

**Giao diện:**
- **Bệnh nhân:** chat-home `/patient` + dock (Thực đơn & Nhật ký, Thông báo, Chỉ số). Route sidebar cũ đã gỡ.
- **Bác sĩ:** roster + chart + inbox (`/doctor`, `/doctor/patients`, `/doctor/inbox`). Dashboard vẫn **pha mock** một phần (T05).

### 1.4 Kiểm thử & nhánh (tham khảo)

- Backend: 197/197 pytest pass (xác nhận 2026-08-22); `next build` sạch.
- FE lint: ~47 lỗi hydration + 15 warning — không chặn build (T08).
- Nhánh dev gần đây: UI bác sĩ/trang chủ, phân quyền nhiều bác sĩ, chat-home redesign.

---

## 2. Cách dùng — spawn một task

1. Chọn **một** dòng có `Status: Open` trong bảng §3 (ưu tiên P1 trước).
2. Copy **Template file con** (§6) → tạo `tasks/Txx-<slug>.md`.
3. Đổi `Status` dòng đó trong bảng §3 thành `Spawned` và ghi link file con.
4. Làm xong → đánh dấu `Done` trên cả `queue.md` và file con; ghi ngày hoàn thành.
5. **Không** spawn nhiều task Open cùng lúc trừ khi team thống nhất.

**Quy ước đặt tên file con:** `tasks/T01-wire-interaction-guardrails.md`, `tasks/T04-fe-request-adjustment.md`, …

**Handoff rule:** Đổi schema Agent → [`contracts/agent-io-schema.md`](../contracts/agent-io-schema.md) trước. Đổi HTTP → [`contracts/api-v1.md`](../contracts/api-v1.md) trước.

---

## 3. Việc Open (backlog có thể spawn)

| ID | Việc | Priority | Owner | MoSCoW | Status | Spawn as |
|---|---|---|---|---|---|---|
| T01 | Wire `validate_interaction_output` / `sanitize_recommendation` vào runtime | P1 | BE1 | Should | **Done** (2026-08-31) | [`T01-wire-interaction-guardrails.md`](T01-wire-interaction-guardrails.md) |
| T02 | Chuyển `rag_qa_node` sang `retrieve_hybrid()` (BM25+dense RRF) | P1 | BE1 | Should | Open | `T02-hybrid-rag-chat.md` |
| T09 | Verify E2E North Star 6 bước trên UI thật | P1 | FE | Must | Open | `T09-verify-north-star-e2e.md` |
| T03 | Thay placeholder guideline RAG + re-index Qdrant | P2 | BE1 | Should | Open | `T03-guideline-corpus-rag.md` |
| T04 | Nút FE "Yêu cầu điều chỉnh" (`POST .../request-adjustment`) | P2 | FE | Should | Open | `T04-fe-request-adjustment.md` |
| T05 | Nối mock còn lại dashboard `/doctor` với API | P2 | FE | Could | Open | `T05-doctor-dashboard-api.md` |
| T06 | LLM dual-provider fallback OpenAI ↔ DeepSeek | P3 | BE1 | Should | Open | `T06-llm-dual-provider.md` |
| T07 | Xác nhận / hoàn thiện UI quên mật khẩu | P3 | FE | Should | Open | `T07-fe-forgot-password.md` |
| T08 | Dọn lint hydration + warning | P3 | FE | Could | Open | `T08-fe-lint-debt.md` |

**Thứ tự đề xuất:** T09 (baseline) → T02 → T04 → T03 → T05 → T07 → T08 → T06.

---

## 4. Chi tiết từng task Open

### T01 — Wire interaction guardrails runtime — **Done 2026-08-31**

| | |
|---|---|
| **Spec/ADR** | [`specs/13-ai-chat-assistant.md`](../specs/13-ai-chat-assistant.md), [`adrs/006-hitl-guardrails-strategy.md`](../adrs/006-hitl-guardrails-strategy.md) |
| **Files chạm** | [`backend/app/guardrails/rules.py`](../backend/app/guardrails/rules.py), [`backend/app/agents/`](../backend/app/agents/) (`interaction_check_node`, `apply_guardrails`) |
| **Không đụng** | `frontend/**`, `api/` |
| **Mô tả** | `validate_interaction_output` và `sanitize_recommendation` gắn vào runtime qua `enforce_interaction_recommendations` — chặn sớm từng `recommendation` trong `InteractionItem` trước khi ghép `answer`. |
| **DoD** | Hàm được gọi trên luồng interaction thật; test pass (`pytest tests/agents`, `tests/guardrails` nếu có); không regression guardrail đổi thuốc/liều. |

### T02 — Hybrid RAG cho chat

| | |
|---|---|
| **Spec/ADR** | [`specs/13`](../specs/13-ai-chat-assistant.md), [`adrs/001`](../adrs/001-vector-database-choice.md) |
| **Files chạm** | [`backend/app/rag/retriever.py`](../backend/app/rag/retriever.py) (`retrieve_hybrid()`), [`backend/app/agents/nodes/rag_tool.py`](../backend/app/agents/nodes/rag_tool.py) |
| **Không đụng** | `frontend/**`, indexer (trừ khi cần re-index sau T03) |
| **Mô tả** | `retrieve_hybrid()` (BM25 + dense RRF) đã implement; `rag_qa_node` vẫn dense-only. |
| **DoD** | Chat RAG dùng hybrid; test RAG/agents pass; citation guardrail vẫn hoạt động. |

### T03 — Corpus guideline RAG thật

| | |
|---|---|
| **Spec/ADR** | [`adrs/001`](../adrs/001-vector-database-choice.md), [`specs/13`](../specs/13-ai-chat-assistant.md) §3 |
| **Files chạm** | `backend/data/guidelines/{byt_vn_notes,ada_diabetes,diabetes,aha_cardiovascular,acr_gout}.md`; chạy `python -m app.rag.indexer` |
| **Không đụng** | `food_db_vn.json` (đã dọn — coi Done) |
| **Mô tả** | Các file guideline trên vẫn placeholder mock; `patient_faq.md` đã đủ. |
| **DoD** | Nội dung guideline thật (BYT/ADA/AHA…); re-index Qdrant; truy vấn mẫu trả citation có nghĩa. |

### T04 — FE nút yêu cầu điều chỉnh plan

| | |
|---|---|
| **Spec/ADR** | [`specs/07-patient-meal-plan-view.md`](../specs/07-patient-meal-plan-view.md), [`contracts/api-v1.md`](../contracts/api-v1.md) |
| **Files chạm** | Dock meal / chat card plan (`MealLogPanel`, generative cards), [`frontend/lib/api.ts`](../frontend/lib/api.ts) |
| **Không đụng** | Backend (API **Done**), agent logic |
| **Mô tả** | `POST /meal-plans/{meal_plan_id}/request-adjustment` — BE Done; FE chưa có UI. Chỉ hiện khi plan `approved`; sau gửi hiện "Đang chờ bác sĩ duyệt lại". |
| **DoD** | Nút gọi API đúng contract; trạng thái UI khớp `pending_review`; verify trên UI thật. |

### T05 — Doctor dashboard nối API

| | |
|---|---|
| **Spec/ADR** | [`tasks/fe-frontend.md`](fe-frontend.md), [`specs/10`](../specs/10-doctor-compliance-view.md) |
| **Files chạm** | [`frontend/app/doctor/page.tsx`](../frontend/app/doctor/page.tsx), mock fallbacks |
| **Không đụng** | Layout đã thiết kế (chỉ thay nguồn dữ liệu); backend agent |
| **Mô tả** | Dashboard pha trộn API thật + `MOCK_PATIENTS` / `THIS_WEEK_DATA` cho biểu đồ compliance. |
| **DoD** | Phần có endpoint dùng API; mock còn lại có nhãn demo rõ hoặc đã thay hết; North Star không gãy. |

### T06 — LLM dual-provider fallback

| | |
|---|---|
| **Spec/ADR** | [`adrs/004-llm-provider-and-fallback-strategy.md`](../adrs/004-llm-provider-and-fallback-strategy.md) |
| **Files chạm** | [`backend/app/core/llm.py`](../backend/app/core/llm.py) (hoặc module LLM tương đương), config |
| **Không đụng** | `frontend/**` |
| **Mô tả** | As-built single-provider qua `LLM_PROVIDER`. Thêm fallback OpenAI ↔ DeepSeek trước khi rơi rule-based; log provider thực tế. |
| **DoD** | Test fallback khi primary fail; không breaking contract agent; doc env vars. |

### T07 — UI quên mật khẩu

| | |
|---|---|
| **Spec/ADR** | [`specs/01-account-auth.md`](../specs/01-account-auth.md) |
| **Files chạm** | [`frontend/app/(auth)/forgot-password/`](../frontend/app/(auth)/forgot-password/), [`reset-password/`](../frontend/app/(auth)/reset-password/), [`frontend/lib/api.ts`](../frontend/lib/api.ts) |
| **Không đụng** | Backend auth (Done) |
| **Mô tả** | BE `POST /auth/forgot-password` + `POST /auth/reset-password` Done; FE đã có route — cần **xác nhận** luồng đầy đủ (link từ login, error states, redirect). |
| **DoD** | E2E forgot → email/token → reset → login; không field ngoài contract. |

### T08 — FE lint debt

| | |
|---|---|
| **Spec/ADR** | [`tasks/fe-frontend.md`](fe-frontend.md), roadmap B10 |
| **Files chạm** | Nhiều trang `doctor/`, `patient/`, `(auth)/` — **chia nhỏ theo thư mục**, không bulk-fix một commit |
| **Không đụng** | Backend |
| **Mô tả** | ~47 lỗi `react-hooks/set-state-in-effect` (hydration guard) + 15 warning. Script lint: `eslint .`. |
| **DoD** | Phạm vi file con (vd. chỉ `doctor/history/*`) về 0 lỗi mới; build vẫn pass. |

### T09 — Verify North Star E2E

| | |
|---|---|
| **Spec/ADR** | [`tasks/README.md`](README.md) § North Star |
| **Files chạm** | Không code (trừ khi phát hiện bug → spawn task riêng) |
| **Không đụng** | — |
| **Mô tả** | Chạy 6 bước trên UI thật (browser): BS login → thêm BN → hồ sơ → generate → duyệt + apply → BN xem/nhật ký/notification → chat. Ghi checklist pass/fail. |
| **DoD** | Checklist 6/6 pass hoặc danh sách bug cụ thể (mỗi bug → task mới, không sửa scope trong T09). |

---

## 5. Không spawn (Done / treo / cần quyết định)

### 5.1 Done — không tạo task trùng

- Auth rate-limit, HITL constraints (spec 04), optimistic lock review, `unmatched_pairs[]`, `secondary_intents[]`, preferences mở rộng, validate weight+height, idempotent `/notifications/demo/simulate`.
- Food Log (spec 09), Patient Metrics time-series (spec 12), Doctor Compliance View (spec 10).
- `profile_loader` DB thật, guardrails citation+safety wired, Gemini embedding, interaction agent thật 1 KB.
- Patient chat-home redesign, `metrics_delta_advice` intent (spec 12 §6 — **Done** v1.8, không spawn B4 cũ).
- `food_db_vn.json` RAG food đã dọn placeholder.
- Per-recommendation interaction guardrails (`validate_interaction_output` / `sanitize_recommendation`) — T01, 2026-08-31.

### 5.2 Treo — cần quyết định product trước khi spawn

| Mục | Lý do treo | Ref roadmap |
|---|---|---|
| Danh sách đi chợ + gợi ý điểm bán + Export PDF | Could Have; backend shopping-list chưa có | B7 |
| Alembic thay migration thủ công | Chỉ cần khi lên production thật | B8 |
| Doctor messages (`/doctor/messages`) | Mock hoàn toàn; chưa có spec/backend | B9 |
| Persist ghi chú lâm sàng (`notesMap`) | Chưa có API; cần BE2 thiết kế contract trước | `fe-frontend.md` |

### 5.3 Won't Have (MVP demo hiện tại)

- NLP parse tự do food log, nhận diện ảnh món ăn, push FCM/APNs, billing, multi-language, social.

---

## 6. Template file task con

Khi spawn, copy khối dưới vào `tasks/Txx-<slug>.md`:

```markdown
# Txx — [Tên ngắn]

**Queue ID:** Txx  
**Spawned from:** [queue.md](queue.md)  
**Status:** In Progress | Done  
**Owner:** BE1 | BE2 | FE  
**Priority:** P1 | P2 | P3

## Mục tiêu
[Một câu — kết quả mong muốn]

## Spec / ADR
- [specs/xx-....md](../specs/xx-....md)
- [adrs/xxx](../adrs/xxx) (nếu có)

## Files chạm
- `path/to/file`

## Không đụng
- `path/out/of/scope`

## Bước làm
1. ...
2. ...

## Definition of Done
- [ ] ...
- [ ] Test: `pytest ...` / verify UI / `npm run build`

## Ghi chú / Blocker
(Điền khi làm)
```

---

## 7. Liên quan

| File | Vai trò |
|---|---|
| [`queue.md`](queue.md) | **Chỉ mục spawn** — việc Open + trạng thái chung (file này) |
| [`roadmap-mvp.md`](roadmap-mvp.md) | Ánh xạ spec → MoSCoW + lịch sử audit 22/08 |
| [`be1-ai-core.md`](be1-ai-core.md) | Checklist chi tiết BE1 |
| [`be2-platform.md`](be2-platform.md) | Checklist chi tiết BE2 |
| [`fe-frontend.md`](fe-frontend.md) | Checklist chi tiết FE |
| [`test/README.md`](../test/README.md) | Kiểm thử toàn hệ thống spec 00–13 |
