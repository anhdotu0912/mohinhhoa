# Roadmap: Đóng gap As-built → To-be

> Nguồn: mục 10 "Ranh giới hoàn thiện" trong `MO_TA_HE_THONG.md`. Sắp xếp theo mức độ chặn North Star demo.

---

## TASK-01: FE ↔ API wiring thật
**Mục tiêu:** Thay UI/mock stores bằng client API typed theo `contracts/api-v1.md`, JWT wiring đầy đủ.

**Sub-tasks:**
- [ ] Viết `frontend/lib/api.ts` — client REST typed, đọc base URL từ `NEXT_PUBLIC_API_BASE_URL`
- [ ] Wire JWT: lưu token sau login, gắn `Authorization` header cho mọi call
- [ ] Thay từng Zustand store mock (patient, doctor) bằng gọi API thật, giữ shape state không đổi để không vỡ UI
- [ ] Xoá mock-data không còn dùng sau khi wiring xong từng khu vực

**Definition of Done:**
- [ ] Không còn import từ `frontend/lib/mock-data` ở các trang đã wiring
- [ ] Test manual: login → onboarding → generate → alerts/notifications → doctor review → thấy trạng thái cập nhật, toàn bộ qua API thật
- [ ] Tuân thủ `contracts/api-v1.md` — không tự thêm field ngoài contract

---

## TASK-02: Tắt DEMO_MOCK, chạy pipeline AI thật ổn định
**Mục tiêu:** Đạt SLA generate <15s (p95) với `DEMO_MOCK=false`; interaction HTTP gọi agent thật.

**Sub-tasks:**
- [ ] Persist `MealPlan` từ output agent trước khi trả FE (fix gap `meal_plan_id` / 501)
- [ ] Wire `POST /interactions/check` → `interaction_checker_agent` khi `DEMO_MOCK=false` (bỏ 501)
- [ ] Chạy `DEMO_MOCK=false` local, đo latency thực tế nhiều lần
- [ ] Xử lý timeout/lỗi LLM provider (fallback message rõ ràng, không crash)
- [ ] Benchmark RAG retrieval quality trên KB thật

**Definition of Done:**
- [ ] p95 latency <15s ghi lại bằng số liệu đo thật
- [ ] Test `tests/test_meal_planner.py`, `tests/test_rag.py` pass với `DEMO_MOCK=false`
- [ ] Interaction check HTTP không còn 501 khi mock off
- [ ] Có fallback graceful khi LLM lỗi (không trả 500 trần trụi cho FE)

---

## TASK-03: Quyết định Vector DB — DONE
**Quyết định (2026-08-12):** **Giữ ChromaDB** cho prototype/MVP. ADR-001 status → Superseded (Qdrant không còn target bắt buộc).

**Sub-tasks:**
- [x] Review ADR-001 vs quy mô demo
- [x] Cập nhật ADR-001 + CLAUDE.md stack as-built
- [ ] (Post-demo optional) Revisit Qdrant/pgvector nếu scale

**Definition of Done:**
- [x] ADR-001 phản ánh quyết định cuối (không treo "target Qdrant")

---

## TASK-04: Hoàn thiện Guardrails
**Mục tiêu:** `guardrails/rules.py` từ placeholder thành logic đầy đủ, tách khỏi việc nằm rải rác trong graph node.

**Sub-tasks:**
- [ ] Liệt kê toàn bộ rule hiện đang nằm trong graph node (refuse logic) → chuyển vào `rules.py`
- [ ] Implement `source_check` enforce thật (chặn output không có citation) thay vì chỉ là quy ước
- [ ] Viết test riêng cho guardrails (input độc hại: hỏi đổi thuốc, hỏi ngoài phạm vi)

**Definition of Done:**
- [ ] `guardrails/rules.py` không còn là placeholder
- [ ] Test guardrail pass, cover được case "đổi thuốc" → refuse, case "số liệu không nguồn" → bị chặn

---

## TASK-05: Food Log Won't Have — nav ẩn (DONE phần demo)
**Quyết định:** Giữ Won't Have; **ẩn** mục Ghi nhận khỏi `frontend/lib/nav-config.ts`. Route `/patient/meals/log` + stub agent có thể còn để post-MVP — không hiện trong demo nav.

**Sub-tasks:**
- [x] Ẩn khỏi nav-config
- [ ] (Optional) Xoá hẳn page/store/stub nếu team muốn gọn repo

**Definition of Done:**
- [x] Food Log không xuất hiện trong nav demo
- [x] Ghi nhận trong CLAUDE §7 + tasks/README + spec 03/contracts

---

## TASK-06: Deploy production
**Mục tiêu:** Backend Railway + Frontend Vercel + healthcheck hoạt động.

**Sub-tasks:**
- [ ] Setup PostgreSQL production theo ADR-006, migrate schema từ SQLite
- [ ] Deploy backend lên Railway, set đầy đủ env (`DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`, LLM key...)
- [ ] Deploy frontend lên Vercel, set `NEXT_PUBLIC_API_BASE_URL` trỏ đúng backend Railway
- [ ] Verify `GET /health` từ ngoài, verify CORS không chặn frontend thật

**Definition of Done:**
- [ ] Demo E2E chạy được trên URL production, không phải chỉ local
- [x] `POST /notifications/demo/simulate` bị chặn hoặc guard rõ ràng ở production (không lộ endpoint demo) — guard `APP_ENV=production` → `403 DEMO_DISABLED` (2026-08-13)

---

## TASK-07: Đồng bộ docs với code — DONE (working tree)
**Đã làm (2026-08-12):** CLAUDE §3–4 as-built; `agent-io-schema` version `2026-08-12.asbuilt.1` khớp Pydantic; api-v1 review/chat/simulate; specs 02–04 ghi as-built; ADR 001/003/004/005; tasks README + role stubs; gap-closure cập nhật.

**Còn lại (team):**
- [ ] Commit bộ docs khi sẵn sàng (user trigger)
- [ ] Review các `[CẦN XÁC NHẬN]` còn sót trong specs 01/05/06
- [ ] (Optional) `AGENTS.md` pointer ngắn tới CLAUDE + MO_TA

**Definition of Done:**
- [x] specs/adrs/contracts/tasks tồn tại và khớp as-built chính
- [ ] Commit + lock SSOT sau review team
