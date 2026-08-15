# Roadmap MVP — Ánh xạ Spec → Task → MoSCoW → Owner

**Cập nhật 2026-08-15:** sau vòng review đầu, team đã chốt 15 điểm `[CẦN XÁC NHẬN]` + 2 quyết định kiến trúc mới (embedding, LLM provider) — bảng dưới đã cập nhật theo các quyết định này (xem chi tiết ở từng spec/ADR liên quan).

**Nguyên tắc thứ tự triển khai:** Guardrails thật (`guardrails/rules.py`/`source_check.py`) + `profile_loader` đọc DB thật khi chat luôn ưu tiên cao nhất (P0) — đây là gap chặn trực tiếp North Star demo chạy "thật" và vi phạm luật cứng `CLAUDE.md` Mục 7 nếu bỏ qua. **Gap KB tương tác thuốc–thực phẩm (Alert dùng KB rút gọn) đã được team chấp nhận cho vòng demo này (2026-08-15) — hạ khỏi P0.** Mọi tính năng mới khác đứng sau theo P1/P2.

## Bảng ánh xạ

| # | Spec | Task cụ thể | MoSCoW | Owner | Status hiện tại |
|---|---|---|---|---|---|
| 1 | `specs/01-account-auth.md` | Đăng ký/đăng nhập đã hoạt động; **[Planned]** thêm rate-limit login + luồng quên mật khẩu (bắt buộc trước khảo sát người dùng thật) | Must | BE2 | Done (core) / Planned (rate-limit, forgot-password) |
| 2 | `specs/02-patient-profile-onboarding.md` | Upsert hồ sơ đã hoạt động; **[Planned]** mở rộng pattern `preferences`; **[Planned]** HITL cho patient tự sửa `target_kcal`/`restrictions` (`constraints_status`) | Must | BE1 (preferences) + BE2 (constraints_status) | Done (core) / Planned (2 mục trên) |
| 3 | `specs/03-doctor-patient-management.md` | CRUD danh sách/thông tin bệnh nhân đã hoạt động; dọn field `age` trùng khai báo; **[Planned]** validate `weight`+`height` bắt buộc đủ cặp ở `PUT .../metrics` | Must | BE2 | Done (core) / Planned (validation) |
| 4 | `specs/04-clinical-constraints.md` | **[Planned]** Thêm `PUT /doctor/patients/{id}/constraints` (field mở rộng `salt/sugar/protein` đã chốt) + `POST .../constraints/approve` (workflow HITL đã chốt) | Should | BE2 | Planned |
| 5 | `specs/05-meal-plan-generation.md` | Pipeline sinh plan đã hoạt động; **[Planned, đã quyết định]** đồng bộ persist meal plan sinh qua `/chat` | Must | BE1 (agent/pipeline) + BE2 (persist HTTP) | Partial |
| 6 | `specs/06-meal-plan-review.md` | Approve/reject/edit đã hoạt động; **[Planned, đã quyết định]** thêm optimistic lock (409 khi plan không còn `pending_review`) | Must | BE2 | Done (core) / Planned (lock) |
| 7 | `specs/07-patient-meal-plan-view.md` | Xem chi tiết/swaps đã hoạt động; **[Planned, đã quyết định]** `POST /meal-plans/{id}/request-adjustment` (cần bác sĩ duyệt lại); đi chợ/gợi ý khu vực Could Have | Must (xem) / Should (request-adjustment) / Could (đi chợ) | BE2 (API) + FE (hiển thị) | Partial |
| 8 | `specs/08-drug-food-interaction-check.md` | Gap KB đầy đủ vs rút gọn: **chấp nhận cho vòng này** (hạ khỏi P0); **[Planned, đã quyết định]** thêm `unmatched_pairs[]`; wire agent thật cho `DEMO_MOCK=false` (hiện trả 501) vẫn cần cho gap-closure | Must | BE1 | Partial |
| 9 | `specs/09-food-log-adherence.md` | Giữ Won't Have — slot vocabulary đã chốt (3-slot theo UI, `morning/noon/evening`) để tránh thiết kế lại nếu nâng ưu tiên sau này; không code trong vòng này | Won't (vòng này) | BE1 (node stub) + BE2 (schema/model placeholder) | Planned/Deferred |
| 10 | `specs/10-doctor-compliance-view.md` | **[Planned]** `GET /doctor/patients/{id}/compliance` (on-the-fly, ngưỡng thấp = config `COMPLIANCE_LOW_THRESHOLD_PCT`) + `POST .../remind` (type mới `manual_reminder`, đã chốt) | Should | BE2 | Planned |
| 11 | `specs/11-compliance-notification-delivery.md` | Event-driven materialize-ahead đã hoạt động; **[Planned, đã quyết định]** sửa `/notifications/demo/simulate` cho idempotent; thêm type `manual_reminder` | Must | BE2 | Done (core) / Planned (2 mục trên) |
| 12 | `specs/12-patient-metrics-tracking.md` | Ghi nhận/xem snapshot đã hoạt động; **[Planned, đã quyết định]** validate `weight`+`height` đủ cặp; "lời khuyên khi chỉ số đổi" cần intent Agent mới; "xu hướng dài hạn" hoãn theo ADR-010 | Should (lời khuyên) / Won't (xu hướng, vòng này) | BE2 (metrics) + BE1 (intent mới) | Partial |
| 13 | `specs/13-ai-chat-assistant.md` | **P0 gap:** implement guardrails thật; `profile_loader` đọc DB thật khi `DEMO_MOCK=false`; **[Planned, đã quyết định]** multi-intent qua `secondary_intents[]` | Must | BE1 | Partial |

## Backlog kiến trúc mới (không gắn 1 spec cụ thể, ảnh hưởng nhiều spec)

| # | Nội dung | ADR | MoSCoW | Owner |
|---|---|---|---|---|
| A1 | Migrate embedding: local MiniLM → **Gemini Embedding (`gemini-embedding-2`, gọi API)**, giữ MiniLM làm fallback offline, re-index toàn bộ Chroma | `adrs/003-embedding-model-choice.md` | Should | BE1 |
| A2 | LLM dual-provider fallback: OpenAI ↔ DeepSeek tự động thử provider phụ trước khi rơi về rule-based | `adrs/004-llm-provider-and-fallback-strategy.md` | Should | BE1 |

## Thứ tự triển khai đề xuất (theo mức độ chặn demo)

1. **P0 — Guardrails thật:** implement `guardrails/rules.py` + `guardrails/source_check.py` — spec 13, ADR-006.
2. **P0 — `profile_loader` đọc DB thật** khi chat, không chỉ dùng demo hard-code — spec 13.
3. **P0 — Ổn định `DEMO_MOCK=false` cho interaction check:** wire `interaction_checker_agent` thật vào `POST /interactions/check` (hết 501) — spec 08. (Lưu ý: gap "Alert dùng KB rút gọn" đã tách riêng và **chấp nhận cho vòng này**, không nằm trong P0 nữa.)
4. **P1 — HITL ràng buộc lâm sàng:** `PUT/POST /doctor/patients/{id}/constraints[/approve]` + `constraints_status` trên `POST /profile` — spec 02, spec 04 (cần làm đồng thời vì phụ thuộc lẫn nhau).
5. **P1 — Doctor Compliance View:** `GET /doctor/patients/{id}/compliance` + `POST .../remind` (type `manual_reminder`) — spec 10, ADR-008.
6. **P1 — Optimistic lock review + request-adjustment:** spec 06 (lock) và spec 07 (`request-adjustment`, tái dùng luồng review) — nên làm cùng lúc vì request-adjustment phụ thuộc hành vi review.
7. **P1 — Đồng bộ persist meal plan qua chat** — spec 05.
8. **P2 — Mở rộng pattern `preferences`** (spec 02), **`unmatched_pairs[]`** (spec 08), **validate `weight`+`height` đủ cặp** (spec 03/12), **idempotent `/notifications/demo/simulate`** (spec 11), **multi-intent `secondary_intents[]`** (spec 13).
9. **P2 — Rate-limit login + quên mật khẩu** (spec 01) — cần trước khi mở khảo sát người dùng thật, không cần cho demo nội bộ.
10. **P3 — Kiến trúc mới (A1, A2):** migrate embedding sang Gemini API, thêm dual-provider LLM fallback — cải thiện chất lượng nhưng không chặn demo North Star hiện tại, làm sau khi các P0-P1-P2 ở trên ổn định.
11. **Won't Have (giữ nguyên, không code):** Food Log (spec 09, slot vocabulary đã chốt sẵn), xu hướng chỉ số dài hạn (spec 12 phần trend), danh sách đi chợ/gợi ý khu vực bán (spec 07).

## Liên quan
- `tasks/be1-ai-core.md`, `tasks/be2-platform.md`, `tasks/fe-frontend.md` — checklist chi tiết theo owner.
- `adrs/003-embedding-model-choice.md`, `adrs/004-llm-provider-and-fallback-strategy.md`, `adrs/006-hitl-guardrails-strategy.md`, `adrs/007-compliance-notification-strategy.md`, `adrs/008-compliance-summary-aggregation-strategy.md`, `adrs/009-food-log-scope-strategy.md`.
