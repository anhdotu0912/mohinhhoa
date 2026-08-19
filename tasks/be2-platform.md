# BE2 — Platform API

## Mục tiêu
Đảm bảo mọi endpoint HTTP đúng contract (`contracts/api-v1.md`), persist đúng model/schema, và lấp các gap Planned còn lại (Clinical Constraints approve flow, optimistic lock, request-adjustment) mà không phá vỡ North Star flow hiện tại.

## Ownership
`backend/app/api/`, `backend/app/models/`, `backend/app/schemas/`, `backend/app/services/`, `backend/app/db/`, `backend/app/core/`.

**Không đụng:** logic prompt/RAG/agent nội bộ (`backend/app/agents/`, `backend/app/rag/`, `backend/app/guardrails/`), `frontend/**`.

## Sub-tasks (checkbox)

### Must — Vá lỗi nhỏ đã phát hiện khi audit (→ `specs/01`, `specs/03`)
- [ ] Dọn field `age` khai báo trùng 2 lần trong `schemas/doctor.py::DoctorPatientSummary` (code smell, không gây lỗi runtime nhưng nên sửa).

### P2 — Auth: rate-limit + quên mật khẩu (→ `specs/01-account-auth.md`, quyết định 2026-08-15)
- [ ] Thêm rate-limit `POST /auth/login` (đề xuất 5 lần/15 phút theo email+IP, `429 TOO_MANY_ATTEMPTS`) — bắt buộc trước khi mở khảo sát người dùng thật.
- [ ] Thêm `POST /auth/forgot-password` + `POST /auth/reset-password` (token gửi email, `forgot-password` luôn trả 200 để không lộ thông tin email tồn tại).

### P1 — Clinical Constraints + HITL (→ `specs/02`, `specs/04-clinical-constraints.md`, quyết định 2026-08-15)
- [ ] Mở rộng `Restrictions` schema thêm `salt_daily_g`/`sugar_daily_g`/`protein_daily_g` (song song field cũ, không xoá).
- [ ] Thêm `constraints_status` (`"confirmed"|"pending_doctor_review"`) vào `PatientProfile`; `POST /profile` set `"pending_doctor_review"` khi patient đổi `target_kcal`/`restrictions`.
- [x] Thêm `PUT /doctor/patients/{patient_id}/constraints` (partial update target_kcal/salt/sugar) — as-built 2026-08-16; FE đã nối `api.updateDoctorConstraints`.
- [ ] Thêm `POST /doctor/patients/{patient_id}/constraints/approve` (chỉ đổi status, không đổi giá trị).
- [ ] Đảm bảo `GET /doctor/patients/{patient_id}` trả kèm `target_kcal`/`restrictions`/`constraints_status` để FE hiển thị badge "chờ xác nhận".

### Done — Doctor Compliance View (→ `specs/10-doctor-compliance-view.md`, ADR-008)
- [x] Thêm `GET /doctor/patients/{patient_id}/compliance` — on-the-fly aggregate từ `Notification(type="adherence_checkin")` + `Alert`, mặc định 14 ngày.
- [x] Thêm `COMPLIANCE_LOW_THRESHOLD_PCT` vào `backend/app/core/config.py` (default `50`).
- [x] Thêm `POST /doctor/patients/{patient_id}/compliance/remind` — tạo `Notification(type="manual_reminder")`.
- [x] FE `/doctor/patients/compliance` nối API thật (`getPatientCompliance`, `remindPatientCompliance`).

### P1 — Optimistic lock review + request-adjustment (→ `specs/06`, `specs/07`, quyết định 2026-08-15)
- [ ] `POST /doctor/meal-plans/{id}/review`: kiểm tra `status=="pending_review"` trước khi áp dụng action; nếu không còn ở trạng thái chờ → `409 PLAN_ALREADY_REVIEWED`.
- [ ] Thêm `POST /meal-plans/{meal_plan_id}/request-adjustment` (patient, chỉ trên plan `approved`) — set lại `status="pending_review"` + lưu `adjustment_note`; lỗi `400 PLAN_NOT_APPROVED` nếu plan chưa `approved`.

### P1 — Đồng bộ persist meal plan qua chat (→ `specs/05-meal-plan-generation.md`, quyết định 2026-08-15)
- [ ] Expose lại service persist meal plan hiện có (dùng trong `POST /meal-plans/generate`) để BE1 gọi từ `meal_plan_node`, tránh viết logic persist trùng lặp.

### P2 — Validation & idempotency nhỏ (nhiều spec, quyết định 2026-08-15)
- [ ] `PUT /doctor/patients/{id}/metrics`: bắt buộc gửi đủ `weight`+`height`, thiếu 1 trong 2 → `400 METRICS_INCOMPLETE` (`specs/03`, `specs/12`).
- [ ] `POST /interactions/check`: thêm `unmatched_pairs[]` cho cặp không tìm thấy dữ liệu KB (`specs/08`).
- [ ] `POST /notifications/demo/simulate`: sửa lại cho idempotent — chỉ tạo mới nếu chưa có bản ghi mẫu cùng loại đang `pending`/`sent` (`specs/11`).

### Done — Food Log (→ `specs/09-food-log-adherence.md`, ADR-009)
- [x] Implement `routes_food_log.py`, `models/food_log.py`, mount trong `main.py`.
- [x] Alert linkage qua `food_log_id`; slot 3-giá-trị `morning|noon|evening`.

### Done — Patient Metrics History (→ `specs/12`, ADR-013)
- [x] Bảng `body_metrics_history`, `POST/GET /metrics`, doctor metrics ghi thêm history.

## Definition of Done
- [ ] Test liên quan pass (`pytest tests/api`, `tests/services`).
- [ ] Mọi endpoint mới có mặt trong `contracts/api-v1.md` trước khi merge code.
- [ ] Không lint error, migration (nếu có) idempotent theo pattern `db/init_db.py` hiện tại.

## Owner
BE2 (Platform).
