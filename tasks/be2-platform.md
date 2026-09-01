# BE2 — Platform API

## Mục tiêu
Đảm bảo mọi endpoint HTTP đúng contract (`contracts/api-v1.md`), persist đúng model/schema, và duy trì North Star flow ổn định.

## Ownership
`backend/app/api/`, `backend/app/models/`, `backend/app/schemas/`, `backend/app/services/`, `backend/app/db/`, `backend/app/core/`.

**Không đụng:** logic prompt/RAG/agent nội bộ (`backend/app/agents/`, `backend/app/rag/`, `backend/app/guardrails/`), `frontend/**`.

## Sub-tasks (checkbox)

### Done — Vá lỗi nhỏ đã phát hiện khi audit (→ `specs/01`, `specs/03`)
- [x] Dọn field `age` khai báo trùng 2 lần trong `schemas/doctor.py` (nay mỗi schema chỉ khai báo `age` một lần).

### Done — Auth: rate-limit + quên mật khẩu (→ `specs/01-account-auth.md`)
- [x] Rate-limit `POST /auth/login`/`register`/`forgot-password` (`services/login_rate_limit.py`, `429 TOO_MANY_ATTEMPTS`).
- [x] `POST /auth/forgot-password` (SMTP, luôn trả 200 để không lộ thông tin email tồn tại; `503 EMAIL_NOT_CONFIGURED`/`500 EMAIL_SEND_FAILED`) + `POST /auth/reset-password`.

### Done — Clinical Constraints + HITL (→ `specs/02`, `specs/04-clinical-constraints.md`)
- [x] Mở rộng `Restrictions` schema thêm `salt_daily_g`/`sugar_daily_g` (song song field cũ; `protein_daily_g` đã bị loại khỏi scope).
- [x] `constraints_status` (`"confirmed"|"pending_doctor_review"`) trên `PatientProfile`; `POST /profile` lưu `proposed_*` khi patient đổi `target_kcal`/`restrictions`/`treatment_goals` (không ghi đè cột hiệu lực).
- [x] `PUT /doctor/patients/{patient_id}/constraints` (partial update, ghi hiệu lực ngay, hủy đề xuất); FE đã nối `api.updateDoctorConstraints`.
- [x] `POST /doctor/patients/{patient_id}/constraints/approve` (chép `proposed_*` → cột hiệu lực).
- [x] `GET /doctor/patients/{patient_id}` trả kèm `target_kcal`/`constraints_status`/`proposed_*`; FE hiển thị badge "Chờ bác sĩ xác nhận".

### Done — Doctor Compliance View (→ `specs/10-doctor-compliance-view.md`, ADR-008)
- [x] `GET /doctor/patients/{patient_id}/compliance` — on-the-fly aggregate từ `Notification(type="adherence_checkin")` + `Alert`, mặc định 14 ngày.
- [x] `COMPLIANCE_LOW_THRESHOLD_PCT` trong `backend/app/core/config.py` (default `50`).
- [x] `POST /doctor/patients/{patient_id}/compliance/remind` — tạo `Notification(type="manual_reminder")`.
- [x] FE `/doctor/patients/compliance` nối API thật (`getPatientCompliance`, `remindPatientCompliance`).

### Done — Optimistic lock review + request-adjustment (→ `specs/06`, `specs/07`)
- [x] `POST /doctor/meal-plans/{id}/review`: kiểm tra `status=="pending_review"` trước khi áp dụng action; nếu không còn ở trạng thái chờ → `409 PLAN_ALREADY_REVIEWED`.
- [x] `POST /meal-plans/{meal_plan_id}/request-adjustment` (patient, chỉ trên plan `approved`) — set lại `status="pending_review"` + lưu `adjustment_note`; lỗi `400 PLAN_NOT_APPROVED` nếu plan chưa `approved`.

### Done — Validation & idempotency nhỏ (→ nhiều spec)
- [x] `PUT /doctor/patients/{id}/metrics`: bắt buộc gửi đủ `weight`+`height`, thiếu 1 trong 2 → `400 METRICS_INCOMPLETE` (`specs/03`, `specs/12`).
- [x] `POST /interactions/check`: `unmatched_pairs[]` cho cặp không tìm thấy dữ liệu KB (`specs/08`).
- [x] `POST /notifications/demo/simulate`: idempotent — chỉ tạo sample có `type` chưa tồn tại hôm nay cho user đó (`specs/11`).

### Done — Food Log (→ `specs/09-food-log-adherence.md`, ADR-009)
- [x] `routes_food_log.py`, `models/food_log.py`, mount trong `main.py`.
- [x] Alert linkage qua `food_log_id`; slot 3-giá-trị `morning|noon|evening`.

### Done — Patient Metrics History (→ `specs/12`, ADR-013)
- [x] Bảng `body_metrics_history`, `POST/GET /metrics`, `DELETE /metrics/{id}`, doctor metrics ghi thêm history.

### P2 (Could, không gấp) — Alembic (→ `adrs/005-database-choice.md`)
- [ ] Thay chiến lược migration thủ công `_migrate_add_*` bằng Alembic — chỉ cần khi chuẩn bị lên production thật, không gấp cho demo hiện tại.

## Definition of Done
- [ ] Test liên quan pass (`pytest tests/api`, `tests/services`).
- [ ] Mọi endpoint mới có mặt trong `contracts/api-v1.md` trước khi merge code.
- [ ] Không lint error, migration (nếu có) idempotent theo pattern `db/init_db.py` hiện tại.

## Owner
BE2 (Platform).
