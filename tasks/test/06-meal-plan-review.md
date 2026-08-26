# 06 — Meal plan review & apply tuần

| | |
|---|---|
| **Spec** | [`specs/06-meal-plan-review.md`](../../specs/06-meal-plan-review.md) + ADR-011/012 |
| **Contract** | [`contracts/api-v1.md`](../../contracts/api-v1.md) §9 |
| **Owner** | BE2 + FE |
| **Môi trường** | docker-compose + UI |

**Tài khoản:** `demo_doctor@example.com`; plan `pending_review` từ checklist 05.

**Surface UI:** `/doctor/reviews/{patientId}/{planId}`, `/doctor/inbox`, `/doctor/patients/{id}/history`.

---

## Happy path — Review

| # | Việc | Bước | Kỳ vọng | Pass |
|---|---|---|---|:---:|
| 1 | Hàng đợi duyệt | `/doctor/inbox` hoặc `GET /doctor/meal-plans` | Plan pending hiện | [ ] |
| 2 | Approve | Review page → Duyệt | `status=approved`; `trust_badge=doctor_reviewed`; notification `plan_approved` | [ ] |
| 3 | Chưa có reminder sau approve | BN notifications ngay sau duyệt | **Không** meal_reminder / adherence_checkin | [ ] |
| 4 | Reject (plan khác) | Reject + ghi chú | `status=rejected`; hủy notification `pending` gắn plan | [ ] |
| 5 | Edit full-replace | Sửa plan → action edit + `edited_plan` | `status=edited`; trust_badge set | [ ] |

---

## Happy path — Apply (ADR-011/012)

| # | Việc | Bước | Kỳ vọng | Pass |
|---|---|---|---|:---:|
| 6 | Apply tuần | Sau approve → Áp dụng (`start_date`, `replace_active`) | `starts_on`/`ends_on`; plan active | [ ] |
| 7 | Materialize reminders | BN notifications sau apply | Có `meal_reminder` và `adherence_checkin` (≤ giới hạn slot) | [ ] |
| 8 | Lịch tuần doctor | `/doctor/patients/{id}/history` | Schedule active + upcoming slots | [ ] |
| 9 | Replace plan active | Apply plan mới `replace_active: true` | Plan cũ `ends_on = start_date - 1` | [ ] |
| 10 | BN xem plan apply | Dock thực đơn / `GET /meal-plans/me` | Plan đang áp dụng hiển thị | [ ] |

---

## Edge cases

| # | Việc | Bước | Kỳ vọng | Pass |
|---|---|---|---|:---:|
| 11 | Review lần 2 | Approve lại plan đã approved | `409 PLAN_ALREADY_REVIEWED` | [ ] |
| 12 | Edit thiếu body | action=edit không gửi edited_plan | `400 EDITED_PLAN_REQUIRED` | [ ] |
| 13 | Apply plan pending | Apply trước approve | Rejected theo API | [ ] |
| 14 | Overlap không replace | Apply chồng plan active không replace | `409` / reject theo API | [ ] |
| 15 | Patient không review | Login patient gọi review | Forbidden | [ ] |
| 16 | Request-adjustment (API) | Patient `POST .../request-adjustment` trên plan approved | Plan về `pending_review` + adjustment_note | [ ] |

---

## Pytest đã có

- [`test_doctor_review.py`](../../backend/tests/test_doctor_review.py)
- [`test_plan_apply.py`](../../backend/tests/test_plan_apply.py)
- [`test_plan_schedule.py`](../../backend/tests/test_plan_schedule.py)
- `test_north_star_flow` (approve → apply)

**Gap tự động:** UI slot_key/history; FE chưa nút request-adjustment.

---

## Không phải bug / N/A

- Duyệt 1 bước = có nhắc — **sai**; phải apply.
- Bulk approve nhiều plan — không có API.
- PUT sửa từng món — không có; chỉ full-replace edit.
