# Spec: Compliance Notification (Nhắc tuân thủ in-app)

## Status
**Partial (as-built)** — `NotificationService` materialize-ahead khi generate / approve / reject / alert. FE notifications UI còn mock/local ở nhiều chỗ. `demo/simulate` = **seed mẫu**, không flip toàn bộ pending.

## 1. Mục tiêu (Why)
Nhắc tuân thủ thực đơn in-app, không FCM trong MVP.

## 2. User story
Là **bệnh nhân**, tôi muốn nhận nhắc giờ ăn, check-in tuân thủ, và biết khi chuyên gia duyệt kế hoạch.

## 3. Business rules (ADR-004)
1. Event-driven, materialize-ahead — không cron MVP.
2. Service ngoài LangGraph.
3. Bảng sự kiện:

| Sự kiện | Notification |
|---|---|
| Meal plan generated | `meal_reminder` × slots × days (`pending`) + `adherence_checkin` × 7 |
| Plan approved | `plan_approved` (`sent`) |
| Plan rejected | `cancelled` reminder/checkin tương lai của plan |
| Alert Nguy hiểm / Cần chú ý | `interaction_followup` (`sent`) |

4. Types / status như contract.
5. **`POST /notifications/demo/simulate` (as-built):** insert 3 notification mẫu cho user (không bulk `pending→sent`). **Env guard đã implement (2026-08-13):** khi `APP_ENV=production` → `403 DEMO_DISABLED` (TASK-06 sub-item).

## 4. Luồng FE (to-be)
1. `/patient/notifications` fetch `GET /notifications`.
2. read / dismiss / done (+ `adherence` cho check-in).
3. Demo: gọi simulate để có data nhìn thấy nếu chưa generate plan.

## 5. Edge cases
- Reject sau khi một số reminder đã `sent` → chỉ cancel tương lai.
- Adherence `no` lặp → chỉ lưu payload (chưa escalate doctor).

## 6. Ngoài phạm vi
- FCM/APNs; cron production (post-demo optional tick `pending→sent`).

## 7. API
Xem `contracts/api-v1.md` § Notifications.

## 8. Liên quan
- ADR-004, gap-closure TASK-01 (FE wire), TASK-06 (guard simulate)
