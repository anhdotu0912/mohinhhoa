# Roadmap MVP — Ánh xạ Spec → Task → MoSCoW → Owner

**Cập nhật 2026-08-22:** rà soát as-built toàn diện — xác nhận phần lớn mục từng ghi `[Planned]`/Partial trong các đợt cập nhật trước (2026-08-15 đến 2026-08-19) **đã Done** trong code từ lâu, tài liệu chỉ chưa được đồng bộ theo. Bảng dưới đây phản ánh đúng trạng thái thật; backlog Planned chỉ còn các mục đã xác minh **không có trong code**.

**Cập nhật 2026-08-22 (đợt 2 — chạy full test suite):** cài dependencies + chạy toàn bộ `pytest` backend (197 tests) và `next build`/`eslint` frontend lần đầu sau nhiều đợt thay đổi. Phát hiện và sửa:
- 4 test backend lỗi thời (`test_north_star_flow`, `test_notification_actions`, 2 test trong `test_doctor_review.py`) viết cho flow approve 1 bước cũ — as-built hiện tại là 2 bước (approve → `POST .../apply` mới materialize reminders, theo ADR-011/012). Đã sửa test khớp flow thật + thêm test xác nhận optimistic lock (`409`) giữ nguyên reminders khi review lần 2 bị chặn.
- Bug thật trong `resolve_patient_plan_row()` (`services/meal_plan_service.py`): hàm không nhận tham số `today` nên luôn dùng `date.today()` thật khi chọn plan, dù `build_meal_preview()` được gọi với `today` giả lập (test) — có thể chọn sai plan khi có nhiều plan cho cùng patient. Đã sửa để `today` truyền xuyên suốt.
- `food_db_vn.json` (RAG cho chat, không phải meal plan) có tới 300/310 mục là placeholder rác giống hệt nhau ("Thực phẩm 210"...) — làm loãng kết quả truy vấn thật. Đã dọn sạch, giữ + bổ sung thành 26 mục thật có `category`/`tags`/`portion` (xem B5 dưới, đã resolved phần food).
- `data/guidelines/patient_faq.md` thiếu nội dung về BMI chuẩn châu Á và protein/biến chứng thận — đã bổ sung 2 mục mới (nội dung thật, không phải mock).
- Script `frontend/package.json` → `"lint": "next lint"` không còn hoạt động (Next 16 đã bỏ `next lint`) — mọi lần chạy lint từ khi lên Next 16 đều fail âm thầm nếu không ai gọi trực tiếp. Đã sửa sang `eslint .` + bump `eslint` `^8`→`^9` (yêu cầu bởi `eslint-config-next@16.3.0`) + xoá `.eslintrc.json` cũ (dead, đã có `eslint.config.mjs` flat config).
- Sau khi lint chạy được lần đầu: phát hiện 47 lỗi `react-hooks/set-state-in-effect` (pattern `useEffect(() => setHydrated(true), [])` lặp lại ở nhiều trang) + 15 warning (`no-unused-vars`, `exhaustive-deps`) toàn frontend — nợ kỹ thuật thật nhưng thuộc phạm vi "frontend đã thiết kế", **chưa sửa** trong đợt này theo nguyên tắc hạn chế đổi FE (xem B10).

Kết quả sau khi sửa: backend 197/197 pytest pass, frontend `next build` + `verify:nutrition` pass sạch.

**Cập nhật 2026-08-19 (giữ nguyên):** đơn giản hoá hạ tầng dữ liệu — dự án chỉ còn dùng **2 database: Postgres (RDBMS) + Qdrant (vector store)**. Đã gỡ SQLite (default/dev) và ChromaDB (fallback) khỏi code, `docker-compose.yml`, `.env.example` (xem ADR-001, ADR-005 update).

## Bảng ánh xạ

| # | Spec | Trạng thái as-built | MoSCoW | Owner |
|---|---|---|---|---|
| 1 | `specs/01-account-auth.md` | **Done** — đăng ký/đăng nhập, quên mật khẩu (SMTP), rate-limit login/register/forgot-password (`services/login_rate_limit.py`) | Must | BE2 |
| 2 | `specs/02-patient-profile-onboarding.md` | **Done** — upsert hồ sơ; mở rộng pattern `preferences` (5 pattern: bò/chay/hải sản/heo/gà); HITL `constraints_status` khi patient tự sửa `target_kcal`/`restrictions` | Must | BE1 (preferences) + BE2 (constraints_status) |
| 3 | `specs/03-doctor-patient-management.md` | **Done** — CRUD danh sách/thông tin bệnh nhân; validate `weight`+`height` đủ cặp ở `PUT .../metrics` (`400 METRICS_INCOMPLETE`) | Must | BE2 |
| 4 | `specs/04-clinical-constraints.md` | **Done** — `PUT /doctor/patients/{id}/constraints` + `constraints_status` + `POST .../constraints/approve` (workflow HITL đầy đủ) | Should | BE2 |
| 5 | `specs/05-meal-plan-generation.md` | **Done** — pipeline sinh plan; chat intent `meal_plan` read-only theo thiết kế (không phải gap thiếu persist) | Must | BE1 |
| 6 | `specs/06-meal-plan-review.md` | **Done** — approve/reject/edit + optimistic lock (`409 PLAN_ALREADY_REVIEWED`) | Must | BE2 |
| 7 | `specs/07-patient-meal-plan-view.md` | **Done** (Must/Should) — xem chi tiết/swaps, `POST /meal-plans/{id}/request-adjustment`; đi chợ/gợi ý khu vực vẫn Could Have (chưa có) | Must (xem) / Should (request-adjustment) / Could (đi chợ, chưa làm) | BE2 + FE |
| 8 | `specs/08-drug-food-interaction-check.md` | **Done** — 1 KB đầy đủ duy nhất cho cả 2 luồng (gắn plan + ad-hoc), `unmatched_pairs[]` | Must | BE1 |
| 9 | `specs/09-food-log-adherence.md` | **Done (core)** — structured manual entry (3-slot ADR-009), API mounted, alert linkage | Should | BE2 + FE |
| 10 | `specs/10-doctor-compliance-view.md` | **Done (core)** — `GET /doctor/patients/{id}/compliance` + `POST .../remind` (on-the-fly, ADR-008), type `manual_reminder`; FE nối API thật | Should | BE2 + FE |
| 11 | `specs/11-compliance-notification-delivery.md` | **Done** — event-driven materialize-ahead; `POST /notifications/demo/simulate` idempotent theo `existing_types`; type `manual_reminder` | Must | BE2 |
| 12 | `specs/12-patient-metrics-tracking.md` | **Done** — snapshot + time-series patient self-tracking (ADR-013) + validate `weight`+`height`; "lời khuyên khi chỉ số đổi" vẫn **Planned** (chưa có intent) | Should | BE2 (tracking) / BE1 (AI advice, Planned) |
| 13 | `specs/13-ai-chat-assistant.md` | **Done (core)** — guardrails citation+safety wired, `profile_loader` đọc DB thật, `food_log` đọc dữ liệu thật, `secondary_intents[]`, `/chat/stream` SSE; hybrid RAG + wiring `validate_interaction_output`/`sanitize_recommendation` vẫn **Planned** | Must | BE1 |

## Backlog thật còn lại (đã xác minh KHÔNG có trong code)

| # | Nội dung | Spec/ADR liên quan | MoSCoW | Owner |
|---|---|---|---|---|
| B1 | Wire `validate_interaction_output`/`sanitize_recommendation` (đã viết ở `guardrails/rules.py`, chưa có nơi gọi) vào `interaction_check_node`/`apply_guardrails` | `specs/13`, `adrs/006` | Should | BE1 |
| B2 | Chuyển `rag_qa_node` sang `retrieve_hybrid()` (BM25+dense RRF đã có trong `rag/retriever.py`, chat hiện vẫn dense-only) | `specs/13`, `adrs/001` | Should | BE1 |
| B3 | LLM dual-provider fallback OpenAI ↔ DeepSeek tự động thử provider phụ trước khi rơi về rule-based (as-built hiện tại chỉ single-provider qua `LLM_PROVIDER`) | `adrs/004` | Should | BE1 |
| B4 | Intent Agent mới "lời khuyên khi chỉ số cơ thể đổi" — cần thêm vào `VALID_INTENTS` + cơ chế so sánh snapshot trước/sau | `specs/12` §6 | Should | BE1 |
| B5 | Nâng cấp chất lượng corpus RAG guideline — `byt_vn_notes.md`, `ada_diabetes.md`, `diabetes.md`, `aha_cardiovascular.md`, `acr_gout.md` vẫn là placeholder lặp câu mock, không phải nội dung guideline thật (`patient_faq.md` đã có nội dung đầy đủ + 2 mục mới BMI/protein-thận bổ sung 2026-08-22). `data/food_db_vn.json` (phần food cho RAG) đã dọn sạch placeholder — **phần food coi như Done**, phần guideline còn lại vẫn Should | `adrs/001` | Should | BE1 |
| B6 | FE: nối `/patient` home dashboard (100% static/mock) và phần còn mock của `/doctor` dashboard với API thật; dọn `frontend/lib/plans-store.ts` (dead code, không còn import) | `tasks/fe-frontend.md` | Could | FE |
| B7 | Danh sách đi chợ (`GET /meal-plans/{id}/shopping-list`), gợi ý điểm bán, Export PDF thực đơn | `specs/07` §6 | Could | — |
| B8 | Adopt Alembic thay migration thủ công `_migrate_add_*` — chỉ cần khi chuẩn bị lên production thật, không gấp cho demo | `adrs/005` | Could | BE2 |
| B9 | `frontend/app/doctor/messages/**` — hoàn toàn mock, chưa có backend messaging feature nào (chưa từng có spec, cần quyết định có làm hay bỏ trước khi động vào) | `tasks/fe-frontend.md` | Could | — |
| B10 | FE lint debt — 47 lỗi `react-hooks/set-state-in-effect` (pattern hydration guard `useEffect(() => setHydrated(true), [])` lặp ở nhiều trang `doctor/`, `patient/`) + 15 warning `no-unused-vars`/`exhaustive-deps`, phát hiện sau khi sửa script `next lint`→`eslint .` (2026-08-22). Không chặn build/runtime, nhưng cần dọn theo đúng khuyến nghị React 19/Next 16 khi có dịp sửa các trang liên quan | `tasks/fe-frontend.md` | Could | FE |

## Thứ tự triển khai đề xuất

1. **P1 — Guardrails runtime bổ sung (B1):** chặn sớm hơn ở mức từng `recommendation` riêng lẻ trong `InteractionItem`, không chỉ ở mức `answer` tổng thể.
2. **P1 — Hybrid RAG cho chat (B2):** cải thiện chất lượng `rag_qa` bằng cách tận dụng code BM25+dense đã có sẵn nhưng chưa gọi.
3. **P2 — Chất lượng corpus RAG (B5):** thay nội dung placeholder trong `data/guidelines/*.md` bằng guideline thật — ảnh hưởng trực tiếp độ tin cậy khi demo RAG Q&A.
4. **P2 — FE dọn mock còn lại (B6):** `/patient` home, phần mock của `/doctor` dashboard, dọn dead code `plans-store.ts`.
5. **P3 — Kiến trúc mới (B3):** dual-provider LLM fallback OpenAI↔DeepSeek — cải thiện độ sẵn sàng nhưng không chặn demo North Star hiện tại.
6. **P3 — Could Have (B4, B7, B8, B9):** intent metrics-advice, danh sách đi chợ/export PDF, Alembic, doctor messages — không ưu tiên cho vòng demo hiện tại.

**Đã Done, không còn nằm trên backlog (2026-08-22):** rate-limit auth, HITL constraints đầy đủ (spec 04), optimistic lock review, `request-adjustment`, `unmatched_pairs[]`, `secondary_intents[]`, mở rộng `preferences`, validate `weight`+`height`, idempotent `/notifications/demo/simulate`, Food Log (spec 09), Patient Metrics time-series (spec 12, ADR-013), Doctor Compliance View (spec 10), `profile_loader` DB thật, guardrails citation+safety wired (ADR-006), Gemini embedding, `POST /interactions/check` dùng agent thật với 1 KB duy nhất.

## Liên quan
- `tasks/be1-ai-core.md`, `tasks/be2-platform.md`, `tasks/fe-frontend.md` — checklist chi tiết theo owner.
- `adrs/001-vector-database-choice.md`, `adrs/004-llm-provider-and-fallback-strategy.md`, `adrs/006-hitl-guardrails-strategy.md`, `adrs/007-compliance-notification-strategy.md`, `adrs/008-compliance-summary-aggregation-strategy.md`, `adrs/009-food-log-scope-strategy.md`.
