# Roadmap MVP — Ánh xạ Spec → Task → MoSCoW → Owner

**Cập nhật 2026-08-18:** đồng bộ as-built sau Food Log + Metrics (2026-08-17) và Doctor Compliance View Done.

**Cập nhật 2026-08-19:** đơn giản hoá hạ tầng dữ liệu — dự án chỉ còn dùng **2 database: Postgres (RDBMS) + Qdrant (vector store)**. Đã gỡ SQLite (default/dev) và ChromaDB (fallback) khỏi code, `docker-compose.yml`, `.env.example` (xem ADR-001, ADR-005 update).

**Nguyên tắc thứ tự triển khai:** Guardrails thật (`guardrails/rules.py`/`source_check.py`) + `profile_loader` đọc DB thật khi chat luôn ưu tiên cao nhất (P0) — đây là gap chặn trực tiếp North Star demo chạy "thật" và vi phạm luật cứng `CLAUDE.md` Mục 7 nếu bỏ qua. **Gap KB tương tác thuốc–thực phẩm (Alert dùng KB rút gọn) đã được team chấp nhận cho vòng demo này (2026-08-15) — hạ khỏi P0.** Mọi tính năng mới khác đứng sau theo P1/P2.

## Bảng ánh xạ

| # | Spec | Task cụ thể | MoSCoW | Owner | Status hiện tại |
|---|---|---|---|---|---|
| 1 | `specs/01-account-auth.md` | Đăng ký/đăng nhập đã hoạt động; **[Planned]** thêm rate-limit login + luồng quên mật khẩu (bắt buộc trước khảo sát người dùng thật) | Must | BE2 | Done (core) / Planned (rate-limit, forgot-password) |
| 2 | `specs/02-patient-profile-onboarding.md` | Upsert hồ sơ đã hoạt động; **[Planned]** mở rộng pattern `preferences`; **[Planned]** HITL cho patient tự sửa `target_kcal`/`restrictions` (`constraints_status`) | Must | BE1 (preferences) + BE2 (constraints_status) | Done (core) / Planned (2 mục trên) |
| 3 | `specs/03-doctor-patient-management.md` | CRUD danh sách/thông tin bệnh nhân đã hoạt động; dọn field `age` trùng khai báo; **[Planned]** validate `weight`+`height` bắt buộc đủ cặp ở `PUT .../metrics` | Must | BE2 | Done (core) / Planned (validation) |
| 4 | `specs/04-clinical-constraints.md` | `PUT /doctor/patients/{id}/constraints` Done (as-built 2026-08-16); **[Planned]** `constraints_status` + `POST .../constraints/approve` (workflow HITL) | Should | BE2 | Partial (PUT done) / Planned (approve) |
| 5 | `specs/05-meal-plan-generation.md` | Pipeline sinh plan đã hoạt động; **[Planned, đã quyết định]** đồng bộ persist meal plan sinh qua `/chat` | Must | BE1 (agent/pipeline) + BE2 (persist HTTP) | Partial |
| 6 | `specs/06-meal-plan-review.md` | Approve/reject/edit đã hoạt động; **[Planned, đã quyết định]** thêm optimistic lock (409 khi plan không còn `pending_review`) | Must | BE2 | Done (core) / Planned (lock) |
| 7 | `specs/07-patient-meal-plan-view.md` | Xem chi tiết/swaps đã hoạt động; **[Planned, đã quyết định]** `POST /meal-plans/{id}/request-adjustment` (cần bác sĩ duyệt lại); đi chợ/gợi ý khu vực Could Have | Must (xem) / Should (request-adjustment) / Could (đi chợ) | BE2 (API) + FE (hiển thị) | Partial |
| 8 | `specs/08-drug-food-interaction-check.md` | Gap KB đầy đủ vs rút gọn: **chấp nhận cho vòng này** (hạ khỏi P0); **[Planned, đã quyết định]** thêm `unmatched_pairs[]` | Must | BE1 | Done (core) / Planned (`unmatched_pairs[]`) |
| 9 | `specs/09-food-log-adherence.md` | Food Log structured manual entry (3-slot ADR-009), mount API + nối FE | Should | BE2 (API) + FE | Done (core) |
| 10 | `specs/10-doctor-compliance-view.md` | `GET /doctor/patients/{id}/compliance` + `POST .../remind` (on-the-fly, ADR-008); FE `/doctor/patients/compliance` nối API thật | Should | BE2 + FE | Done (core) |
| 11 | `specs/11-compliance-notification-delivery.md` | Event-driven materialize-ahead đã hoạt động; **[Planned, đã quyết định]** sửa `/notifications/demo/simulate` cho idempotent; thêm type `manual_reminder` | Must | BE2 | Done (core) / Planned (2 mục trên) |
| 12 | `specs/12-patient-metrics-tracking.md` | Snapshot Done; time-series patient self-tracking Done (ADR-013); validate `weight`+`height` Planned; AI advice Planned | Should | BE2 | Done (core tracking) / Planned (validation, AI) |
| 13 | `specs/13-ai-chat-assistant.md` | Guardrails citation+safety wired (`apply_guardrails`); `profile_loader` đọc DB thật Done; `POST /interactions/check` wire agent thật Done; **[Planned]** multi-intent qua `secondary_intents[]` | Must | BE1 | Partial |

## Backlog kiến trúc mới (không gắn 1 spec cụ thể, ảnh hưởng nhiều spec)

| # | Nội dung | ADR | MoSCoW | Owner |
|---|---|---|---|---|
| A1 | Migrate embedding: local MiniLM → **Gemini Embedding (`gemini-embedding-2`, gọi API)**, giữ MiniLM làm fallback offline, re-index toàn bộ vector store | `adrs/003-embedding-model-choice.md` | Should | BE1 |
| A2 | LLM dual-provider fallback: OpenAI ↔ DeepSeek tự động thử provider phụ trước khi rơi về rule-based | `adrs/004-llm-provider-and-fallback-strategy.md` | Should | BE1 |

## Thứ tự triển khai đề xuất (theo mức độ chặn demo)

1. **P1 — HITL ràng buộc lâm sàng (phần còn lại):** `constraints_status` trên `POST /profile` + `POST /doctor/patients/{id}/constraints/approve` — spec 02, spec 04 (`PUT .../constraints` đã Done).
2. **P1 — Optimistic lock review + request-adjustment:** spec 06 (lock) và spec 07 (`request-adjustment`, tái dùng luồng review) — nên làm cùng lúc vì request-adjustment phụ thuộc hành vi review.
3. **P1 — Đồng bộ persist meal plan qua chat** — spec 05.
4. **P2 — Guardrails bổ sung:** wire `validate_interaction_output`/`sanitize_recommendation` vào runtime flow — spec 13, ADR-006 (citation+safety đã wired qua `apply_guardrails`).
5. **P2 — Mở rộng pattern `preferences`** (spec 02), **`unmatched_pairs[]`** (spec 08), **validate `weight`+`height` đủ cặp** (spec 03/12), **idempotent `/notifications/demo/simulate`** (spec 11), **multi-intent `secondary_intents[]`** (spec 13), **chuyển `rag_qa_node` sang `retrieve_hybrid()`** (BM25+dense RRF đã có trong retriever).
6. **P2 — Rate-limit login + quên mật khẩu** (spec 01) — cần trước khi mở khảo sát người dùng thật, không cần cho demo nội bộ.
7. **P3 — Kiến trúc mới (A2):** dual-provider LLM fallback OpenAI↔DeepSeek — cải thiện chất lượng nhưng không chặn demo North Star hiện tại. (A1 embedding Gemini đã Done.)
8. **Done (2026-08-17+):** Food Log (spec 09), Patient Metrics time-series (spec 12, ADR-013), Doctor Compliance View (spec 10), `profile_loader` DB thật, guardrails citation+safety wired, Gemini embedding (A1), interaction check HTTP wire agent thật (spec 08).

## Liên quan
- `tasks/be1-ai-core.md`, `tasks/be2-platform.md`, `tasks/fe-frontend.md` — checklist chi tiết theo owner.
- `adrs/003-embedding-model-choice.md`, `adrs/004-llm-provider-and-fallback-strategy.md`, `adrs/006-hitl-guardrails-strategy.md`, `adrs/007-compliance-notification-strategy.md`, `adrs/008-compliance-summary-aggregation-strategy.md`, `adrs/009-food-log-scope-strategy.md`.
