# Ma trận coverage — spec ↔ pytest ↔ UI ↔ gap

Cập nhật khi thêm test hoặc màn hình mới. **FE = 0 test tự động** (chưa có Jest/Playwright trong repo).

Legend: **Pytest** = có test backend; **UI** = checklist tay trong `tasks/test/0x-*.md`; **Gap** = chưa có hoặc yếu.

---

## Tổng quan

- **Backend pytest:** ~24 file trong [`backend/tests/`](../../backend/tests/) — chạy SQLite in-memory, `PYTEST_RUNNING=1`, không LLM.
- **Frontend:** `npm run build`, `eslint`, `verify:nutrition` — không unit/E2E.
- **Eval:** [`eval/results/report.md`](../../eval/results/report.md) lỗi thời (76 tests) — không dùng làm SSOT.

---

## 01 — Account & Auth (`specs/01`)

- **Checklist:** [`01-account-auth.md`](01-account-auth.md)
- **UI:** `/login`, `/register`, `/forgot-password`, `/reset-password`
- **Pytest:** [`test_api.py`](../../backend/tests/test_api.py) (`test_register_login_flow`, `test_login_wrong_password`, `test_auth_me`, `test_auth_required`, avatar upload); [`test_auth_and_polish.py`](../../backend/tests/test_auth_and_polish.py) (forgot/reset password)
- **Gap:** Rate-limit `429 TOO_MANY_ATTEMPTS` (5 lần/15 phút) — ít/không có test HTTP; FE quên MK cần xác nhận tay trên UI

---

## 02 — Onboarding & Profile (`specs/02`)

- **Checklist:** [`02-onboarding-profile.md`](02-onboarding-profile.md)
- **UI:** `/patient/onboarding`, `/patient/profile`, `POST /profile`
- **Pytest:** `test_profile_upsert_and_get`; constraints pending khi BN sửa kcal trong [`test_constraints_and_adjustment.py`](../../backend/tests/test_constraints_and_adjustment.py)
- **Gap:** Onboarding UI nhiều bước — không có E2E; preferences 5 pattern chỉ test qua meal planner BE

---

## 03 — Doctor patient management (`specs/03`)

- **Checklist:** [`03-doctor-patients.md`](03-doctor-patients.md)
- **UI:** `/doctor/patients`, `/doctor/patients/{id}`, thêm BN
- **Pytest:** `test_doctor_patients_list_and_generate`, `test_patient_detail_and_goals`, `test_doctor_update_patient_profile`, `test_update_patient_metrics`, avatar, `test_doctor_delete_patient`
- **Gap:** Filter UI (`q`, `status`, `plan_usage`, `meal_plan_request`) — pytest có một phần, UI chưa verify đầy đủ

---

## 04 — Clinical constraints HITL (`specs/04`)

- **Checklist:** [`04-clinical-constraints.md`](04-clinical-constraints.md)
- **UI:** `/doctor/patients/{id}/constraints`, inbox filter `constraints`
- **Pytest:** [`test_constraints_and_adjustment.py`](../../backend/tests/test_constraints_and_adjustment.py) (pending on patient edit, approve, `NOTHING_TO_APPROVE`)
- **Gap:** Ghi chú lâm sàng trên UI — local state, không persist API

---

## 05 — Meal plan generation (`specs/05`)

- **Checklist:** [`05-meal-plan-generation.md`](05-meal-plan-generation.md)
- **UI:** `/doctor/patients/{id}/generate`, QueueDrawer
- **Pytest:** `test_north_star_flow` (generate 7 ngày); [`test_meal_planner.py`](../../backend/tests/test_meal_planner.py); [`test_meal_plan_request.py`](../../backend/tests/test_meal_plan_request.py)
- **Gap:** LLM live / latency; citation quality guideline placeholder; pytest không Postgres

---

## 06 — Review + apply tuần (`specs/06`, ADR-011/012)

- **Checklist:** [`06-meal-plan-review.md`](06-meal-plan-review.md)
- **UI:** `/doctor/reviews/{pid}/{planId}`, `/doctor/patients/{id}/history`, apply
- **Pytest:** [`test_doctor_review.py`](../../backend/tests/test_doctor_review.py); [`test_plan_apply.py`](../../backend/tests/test_plan_apply.py); [`test_plan_schedule.py`](../../backend/tests/test_plan_schedule.py); `test_north_star_flow` (approve → apply → reminders)
- **Gap:** UI date picker / slot_key; race 2 tab doctor — có `409` BE, cần tay 2 browser

---

## 07 — Patient meal plan view (`specs/07`)

- **Checklist:** [`07-patient-meal-plan.md`](07-patient-meal-plan.md)
- **UI:** `/patient` dock Thực đơn, card chat; `POST /meal-plans/request`
- **Pytest:** `GET /meal-plans/me`; [`test_meal_plan_request.py`](../../backend/tests/test_meal_plan_request.py); [`test_plan_expiry.py`](../../backend/tests/test_plan_expiry.py); [`test_meal_preview.py`](../../backend/tests/test_meal_preview.py)
- **Gap:** Nút **request-adjustment** trên FE chưa có (BE Done); đi chợ/PDF N/A

---

## 08 — Drug–food interaction (`specs/08`)

- **Checklist:** [`08-drug-food-interaction.md`](08-drug-food-interaction.md)
- **UI:** Chat, dock food log custom; không có màn riêng ad-hoc (có thể gọi API)
- **Pytest:** `test_interactions_check_persists_alerts`; [`test_interaction_checker.py`](../../backend/tests/test_interaction_checker.py); food log alert trong [`test_food_log.py`](../../backend/tests/test_food_log.py)
- **Gap:** `validate_interaction_output` chưa wire runtime (B1 roadmap)

---

## 09 — Food log (`specs/09`, ADR-009)

- **Checklist:** [`09-food-log.md`](09-food-log.md)
- **UI:** `/patient` dock **Thực đơn & Nhật ký** (`MealLogPanel`) — **không** dùng `/patient/meals` (đã gỡ)
- **Pytest:** [`test_food_log.py`](../../backend/tests/test_food_log.py); [`test_datetime_vn.py`](../../backend/tests/test_datetime_vn.py)
- **Gap:** UI slot 3 buổi; test UTC evening → ngày VN — cần tay lúc ~23:00 UTC+7

---

## 10 — Doctor compliance view (`specs/10`, ADR-008)

- **Checklist:** [`10-doctor-compliance.md`](10-doctor-compliance.md)
- **UI:** `/doctor/patients/{id}/compliance`, nút Gửi nhắc
- **Pytest:** [`test_doctor_compliance.py`](../../backend/tests/test_doctor_compliance.py) (aggregation, remind, food log trong compliance)
- **Gap:** Dashboard `/doctor` chart có thể mock; ngưỡng thấp **50%** dễ nhầm 60%

---

## 11 — Notifications (`specs/11`)

- **Checklist:** [`11-notifications.md`](11-notifications.md)
- **UI:** `/patient` dock **Thông báo**
- **Pytest:** [`test_compliance_notification.py`](../../backend/tests/test_compliance_notification.py); `test_notification_actions`, `test_demo_simulate` trong `test_api.py`
- **Gap:** Materialize sau **apply** (không phải approve) — dễ test sai kỳ vọng; không push FCM

---

## 12 — Patient metrics (`specs/12`, ADR-013)

- **Checklist:** [`12-metrics.md`](12-metrics.md)
- **UI:** `/patient` dock **Chỉ số sức khỏe**; BS chart overview
- **Pytest:** [`test_metrics.py`](../../backend/tests/test_metrics.py) (upsert ngày VN, delta_advice, doctor append)
- **Gap:** Overlay chart FE; doctor `PUT .../metrics` append vs patient upsert — cần tay

---

## 13 — AI chat assistant (`specs/13`)

- **Checklist:** [`13-chat.md`](13-chat.md)
- **UI:** `/patient` chat-home, SSE, session sidebar
- **Pytest:** [`test_chat_stream.py`](../../backend/tests/test_chat_stream.py); [`test_chat_history.py`](../../backend/tests/test_chat_history.py); [`test_patient_chat_intents.py`](../../backend/tests/test_patient_chat_intents.py); [`test_guardrails.py`](../../backend/tests/test_guardrails.py); [`test_rag.py`](../../backend/tests/test_rag.py); `test_chat_thin_wrapper`
- **Gap:** Hybrid RAG chưa wire; dual-provider LLM; SSE trên browser; transcript không vào agent (by design)

---

## Hàng chung — gap hệ thống

- **FE automated tests:** không có — mọi regression UI phụ thuộc checklist tay hoặc Playwright (Planned).
- **Postgres vs SQLite:** pytest không bắt hết lỗi migration/JSONB/timezone production.
- **LLM:** pytest stub — chat quality chỉ đánh giá tay hoặc eval [`eval/golden_dataset.json`](../../eval/golden_dataset.json).
