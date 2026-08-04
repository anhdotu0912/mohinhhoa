# Spec: Compliance Notification

> Owner: **BE2 (Platform)** · Triggers từ Meal plan / Alerts: **BE1 + BE2** · UI: **FE**  
> Contract: `/contracts/agent-io-schema.md` → `ComplianceNotification`  
> ADR liên quan: `004-compliance-notification.md`

---

## 1. Mục tiêu

Nhắc bệnh nhân **tuân thủ thực đơn và lưu ý tương tác thuốc–thực phẩm** bằng **in-app notifications** (MVP), gắn với meal plan đã tạo / đã duyệt và các alert mức cao.

Thay thế vai trò “engagement hàng ngày” mà Food Log từng đảm nhiệm trong demo flow cũ — nhưng **không** yêu cầu user nhập món đã ăn.

## 2. Vì sao

Thực đơn tốt nhưng không được nhắc → compliance thấp. Trong 2 tuần prototype, in-app reminder + check-in đơn giản đủ để demo vòng đời: *có plan → được nhắc → xác nhận đã tuân thủ / tạm bỏ qua → BS thấy trạng thái*.

## 3. Phạm vi MVP

**In scope**
- Loại notification:
  - `meal_reminder` — nhắc bữa theo slot trong meal plan (sáng/trưa/tối)
  - `interaction_followup` — nhắc lại khi có alert `Nguy hiểm` / `Cần chú ý`
  - `plan_approved` — khi dietitian approve
  - `adherence_checkin` — hỏi nhanh cuối ngày: đã theo plan? (Yes / Partial / No)
- Tạo notification **event-driven** (khi tạo plan, khi approve, khi có alert) + có thể materialize sẵn lịch nhắc 7 ngày
- API: list / mark read / dismiss / mark done (cho check-in)
- Dashboard FE: inbox + badge chưa đọc
- Dietitian có thể xem tỷ lệ check-in đơn giản của patient (optional nice-to-have ngày 11–13)

**Out of scope**
- Push thật (FCM/APNs) — Could Have
- SMS/Email
- Worker/cron phức tạp (ưu tiên generate-ahead; cron optional nếu còn thời gian)
- Gamification / streak phức tạp
- Food Log gắn ảnh/text

## 4. User stories

1. Là bệnh nhân, sau khi có meal plan tôi muốn được nhắc giờ ăn (in-app) để dễ theo.
2. Là bệnh nhân vừa nhận cảnh báo warfarin–rau muống, tôi muốn có follow-up nhắc “hôm nay tránh / hỏi BS”.
3. Là bệnh nhân, khi BS duyệt thực đơn tôi muốn thấy thông báo “Plan đã được duyệt”.
4. Là bệnh nhân cuối ngày, tôi muốn trả lời nhanh mức tuân thủ (Yes/Partial/No).

## 5. Business rules

| ID | Rule |
|---|---|
| CN-01 | Không spam: tối đa 1 `meal_reminder` / meal slot / ngày; gộp nếu trùng. |
| CN-02 | `interaction_followup` chỉ tạo với severity `Nguy hiểm` hoặc `Cần chú ý`. |
| CN-03 | Status lifecycle: `pending` → `sent` → `read` \| `dismissed` \| `done`. |
| CN-04 | Nội dung nhắc **không** chứa tư vấn đổi thuốc; có thể deep-link tới alert/plan. |
| CN-05 | Khi meal plan bị reject → hủy (`cancelled`) các `meal_reminder` future của plan đó. |
| CN-06 | Timezone: mặc định `Asia/Ho_Chi_Minh` (config). |
| CN-07 | Demo mode: cho phép “simulate now” để hiện notification ngay trên Dashboard. |

## 6. Flow

```
MealPlan created (pending_review)
  └─ materialize meal_reminder cho 7 ngày (pending)

Dietitian approve
  └─ plan_approved notification (sent)
  └─ meal_reminder future giữ nguyên / activate

Interaction alert created (Nguy hiểm|Cần chú ý)
  └─ interaction_followup (sent)

End of day (hoặc generate sẵn)
  └─ adherence_checkin

FE Dashboard
  └─ list notifications + actions (read/dismiss/done)
```

## 7. Acceptance criteria

- [ ] Sau `POST meal-plan`, DB có series `meal_reminder` cho các slot
- [ ] Approve plan → có `plan_approved` hiện trên FE
- [ ] Alert nguy hiểm → có `interaction_followup`
- [ ] User mark `done` trên check-in lưu được payload `{ adherence: yes|partial|no }`
- [ ] Reject plan → future reminders cancelled
- [ ] `test_compliance_notification.py` pass (service + API)
- [ ] Schema khớp contract

## 8. Dependencies & handoff

| Từ | Đến | Artefact |
|---|---|---|
| BE2 | FE | `/api/v1/notifications` |
| MealPlanner / Dietitian routes | NotificationService | events hooks |
| Interaction alert create | NotificationService | `interaction_followup` |
