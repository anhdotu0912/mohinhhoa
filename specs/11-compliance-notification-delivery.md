# Spec: Gửi Compliance Notification (Event-driven)

## Status
Done — kiến trúc event-driven materialize-ahead hoạt động đúng như mô tả; `/notifications/demo/simulate` chỉ seed dữ liệu mẫu (không phải cron/scheduler thật).

## 1. Mục tiêu (Why)
Bệnh nhân cần được nhắc đúng lúc (giờ ăn, sau khi có cảnh báo tương tác, khi plan được duyệt) để duy trì tuân thủ điều trị — nhưng hạ tầng demo (free-tier hosting) không có scheduler/cron ổn định, nên hệ thống phải tạo sẵn (materialize) notification tại thời điểm sự kiện xảy ra, không đợi 1 job nền quét định kỳ.

## 2. User story
Là **AI/hệ thống**, khi có 1 sự kiện đáng thông báo (plan được duyệt, phát hiện tương tác thuốc-thực phẩm, đến giờ ăn theo plan, cần hỏi tuân thủ) tôi cần tạo ngay notification tương ứng, để bệnh nhân nhận được nhắc nhở đúng lúc mà không cần hệ thống lịch nền.

## 3. Business rules
1. **Kiến trúc: event-driven, materialize-ahead, không cron.** Mỗi sự kiện nghiệp vụ (generate plan, approve plan, phát hiện interaction, review) trực tiếp gọi `NotificationService` để **tạo sẵn** các notification tương lai (ví dụ tạo trước cả `meal_reminder` cho 7 ngày × 4 slot ngay khi plan được duyệt), thay vì 1 cron job quét DB định kỳ để quyết định gửi gì.
2. **Bảng sự kiện → notification (as-built):**
   | Sự kiện | Notification được tạo |
   |---|---|
   | `POST /meal-plans/generate` thành công | (không tạo `meal_reminder` ngay — chờ tới khi được `approve`, xem dòng dưới) |
   | `POST /doctor/meal-plans/{id}/review` action=`approve` | `Notification(type="plan_approved", status="sent")` ngay lập tức + materialize trước các `meal_reminder`/`adherence_checkin` theo `SLOT_TIMES` cho các bữa sắp tới trong plan |
   | `POST /doctor/meal-plans/{id}/review` action=`reject` | Không tạo mới; **huỷ** (set `status="cancelled"`) mọi notification `pending` liên quan `meal_plan_id` đó |
   | `POST /doctor/meal-plans/{id}/review` action=`edit` | Không tạo/huỷ notification nào |
   | Phát hiện interaction (qua `POST /interactions/check` hoặc lúc generate plan, dùng KB rút gọn) | `Notification(type="interaction_followup")` nếu severity ∈ `{Nguy hiểm, Cần chú ý}` |
3. **Type hiện có (as-built, đúng 4):** `meal_reminder | interaction_followup | plan_approved | adherence_checkin`. **[Planned, quyết định 2026-08-15]** thêm type thứ 5 `manual_reminder` — dùng riêng cho nhắc nhở thủ công của bác sĩ (`specs/10-doctor-compliance-view.md`), không dùng lại 4 type cũ.
4. **Status hiện có:** `pending | sent | read | dismissed | done | cancelled`.
5. **`POST /notifications/demo/simulate`** — **chỉ seed 3 bản ghi mẫu cố định** (không phải bulk-flip toàn bộ `pending → sent`, không phải cron giả lập chạy liên tục) — mục đích thuần demo để có dữ liệu hiển thị nhanh khi trình bày. Bị **guard `DEMO_DISABLED`** khi `APP_ENV=production` — không gọi được ở môi trường production.
6. Patient tương tác notification qua action: `read` (đã đọc), `dismissed` (bỏ qua), `done` (hoàn thành — ví dụ xác nhận đã ăn theo kế hoạch, kèm `adherence` ∈ `{yes, partial, no}` cho type `adherence_checkin`).
7. **Chỉ `role=patient` gọi được `GET /notifications`** — bác sĩ hiện không có endpoint đọc notification của bệnh nhân trực tiếp (xem `specs/10-doctor-compliance-view.md` cho hướng tổng hợp riêng dành cho doctor, dùng aggregation, không phải đọc raw notification list).

## 4. Luồng chính (happy path)
1. Bác sĩ approve 1 plan (`specs/06`) → BE materialize trước notification cho các bữa ăn sắp tới trong 7 ngày của plan.
2. Tới giờ ăn (theo `SLOT_TIMES`), notification đã tồn tại sẵn ở trạng thái phù hợp (không cần cron bật đúng giờ mới tạo).
3. Patient mở app → `GET /notifications` → thấy danh sách, có thể `read`/`dismissed`/`done`.
4. Khi `done` với `adherence`, dữ liệu này trở thành input cho `specs/10-doctor-compliance-view.md` (aggregation).

## 5. Edge cases
- Plan bị `reject` sau khi đã có notification `sent`/`read`/`done` (bệnh nhân đã tương tác trước khi bị reject) — các bản ghi đó **giữ nguyên trạng thái cũ**, chỉ bản `pending` bị `cancelled` (rule 2 dòng reject, nhất quán `specs/06` §3 rule 3).
- Gọi `POST /notifications/demo/simulate` nhiều lần — **quyết định 2026-08-15: cần sửa lại cho hợp lý.** As-built hiện tại chưa rõ có tạo trùng lặp hay không khi gọi lại nhiều lần; hành vi mong đợi (Planned fix, BE2): mỗi lần gọi chỉ tạo bản ghi mẫu mới nếu **chưa có** bản ghi mẫu cùng loại đang `pending`/`sent` cho user đó, tránh nhân bản notification giả khi demo bấm nút nhiều lần.
- Gọi endpoint demo ở `APP_ENV=production` → `403 DEMO_DISABLED`.

## 6. Ngoài phạm vi (Out of scope)
- Push notification thật (FCM/APNs) — cố định Won't Have theo `CLAUDE.md` Mục 2 và Mục 92 brief.
- Cron/scheduler nền thật — cố định không dùng do hạn chế hosting free-tier (xem `adrs/007-compliance-notification-strategy.md`).
- Notification cho doctor (chỉ patient nhận notification qua cơ chế này).

## 7. Schema tham chiếu
- `Notification`, `NotificationActionRequest` — `contracts/api-v1.md` §7.
- Enum `Notification.type`/`Notification.status` — bảng Enum tham chiếu cuối `contracts/api-v1.md`.

## 8. API liên quan
| Method | Path | Role |
|---|---|---|
| GET | `/notifications` | patient |
| POST | `/notifications/{id}/read` | patient |
| POST | `/notifications/{id}/dismiss` | patient |
| POST | `/notifications/{id}/done` | patient |
| POST | `/notifications/demo/simulate` | patient (demo-only, chặn ở production) |

## 9. Liên quan
- `adrs/007-compliance-notification-strategy.md` — quyết định kiến trúc gốc.
- `specs/06-meal-plan-review.md` — nguồn sự kiện `approve`/`reject`.
- `specs/08-drug-food-interaction-check.md` — nguồn sự kiện `interaction_followup`.
- `specs/10-doctor-compliance-view.md` — nơi dữ liệu `adherence_checkin` được tổng hợp cho doctor.
- `contracts/api-v1.md` §7.
