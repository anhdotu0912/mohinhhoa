# 11 — Compliance notifications

| | |
|---|---|
| **Spec** | [`specs/11-compliance-notification-delivery.md`](../../specs/11-compliance-notification-delivery.md) |
| **Contract** | [`contracts/api-v1.md`](../../contracts/api-v1.md) §7 |
| **Owner** | BE2 + FE |
| **Môi trường** | docker-compose |

**Tài khoản:** `demo_patient_1@example.com`.

**Surface UI:** `/patient` dock **Thông báo** (`NotificationsPanel`).

---

## Happy path

| # | Việc | Bước | Kỳ vọng | Pass |
|---|---|---|---|:---:|
| 1 | List notifications | Mở dock Thông báo | `GET /notifications`; filter status/type hoạt động | [ ] |
| 2 | plan_approved | Sau doctor approve | Type `plan_approved`, status sent | [ ] |
| 3 | Sau apply | Sau doctor apply | `meal_reminder`, `adherence_checkin` xuất hiện | [ ] |
| 4 | Mark read | Bấm đọc 1 notification | `POST .../read` | [ ] |
| 5 | Dismiss | Bỏ qua | `POST .../dismiss` | [ ] |
| 6 | Done + adherence | Check-in tuân thủ | `POST .../done` với adherence yes/partial/no | [ ] |
| 7 | interaction_followup | Sau interaction nguy hiểm | Type `interaction_followup` (nếu có sự kiện) | [ ] |
| 8 | manual_reminder | Doctor gửi nhắc (checklist 10) | BN thấy `manual_reminder` | [ ] |

---

## Edge cases

| # | Việc | Bước | Kỳ vọng | Pass |
|---|---|---|---|:---:|
| 9 | Reject hủy pending | Plan reject sau generate | Notification pending gắn plan → cancelled | [ ] |
| 10 | plan_expiring/expired | Plan sắp hết / hết (lazy trên `GET /meal-plans/me`) | Materialize idempotent, không duplicate | [ ] |
| 11 | demo/simulate | Patient gọi simulate (dev only) | Seed mẫu; gọi lại cùng ngày không trùng type | [ ] |
| 12 | simulate production | `APP_ENV=production` | `403 DEMO_DISABLED` | [ ] |
| 13 | Doctor không list notif | Doctor gọi `GET /notifications` | Forbidden / không có quyền patient list | [ ] |
| 14 | Cross-patient | Patient A thao tác notif của B | Forbidden | [ ] |

---

## Pytest đã có

- [`test_compliance_notification.py`](../../backend/tests/test_compliance_notification.py)
- `test_notification_actions`, `test_demo_simulate` ([`test_api.py`](../../backend/tests/test_api.py))
- [`test_auth_and_polish.py`](../../backend/tests/test_auth_and_polish.py) (simulate idempotent)

**Gap tự động:** Timing "tới giờ ăn" — materialize-ahead, không cron thật.

---

## Không phải bug / N/A

- Push FCM/APNs — Won't Have.
- Cron scheduler nền — không dùng (ADR-007).
- **Approve alone không tạo meal_reminder** — phải apply (hay test sai).
