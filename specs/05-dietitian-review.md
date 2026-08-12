# Spec: Dietitian Review (Duyệt kế hoạch)

## Status
**Partial** — API approve/reject/edit + notifications side effects có trên BE. Body: `{ action, notes, edited_plan }` (xem api-v1). FE reviews còn local store cho đến TASK-01.

## 1. Mục tiêu (Why)
Đảm bảo mọi thực đơn AI sinh ra được chuyên gia dinh dưỡng/bác sĩ kiểm duyệt trước khi bệnh nhân tin dùng chính thức — đây là guardrail "human-in-the-loop" cốt lõi của hệ thống.

## 2. User story
Là **dietitian**, tôi muốn xem hàng đợi thực đơn chờ duyệt kèm citation và alert liên quan, để approve/edit/reject trước khi bệnh nhân sử dụng.

## 3. Business rules
1. Chỉ role `dietitian` được truy cập route review (`require_roles("dietitian")`).
2. 3 hành động khả dụng qua `action`:
   - **approve** → `status=approved`, gắn `trust_badge=dietitian_reviewed`, tạo notification `plan_approved`.
   - **reject** → `status=rejected`, huỷ (`cancelled`) toàn bộ notification tương lai của plan đó.
   - **edit** → cập nhật `days/swaps/citations`, `status=edited`, vẫn gắn trust badge.
3. Sau khi review, bệnh nhân phải thấy trạng thái + trust badge cập nhật khi refresh (không cần realtime/push).
4. Dietitian chỉ được xem/duyệt plan của bệnh nhân thuộc phạm vi quản lý của mình — *[CẦN XÁC NHẬN: MVP có phân bệnh nhân theo dietitian cụ thể, hay 1 dietitian thấy toàn bộ hàng đợi?]*

## 4. Luồng chính (happy path)
1. Dietitian login → vào `/doctor/reviews`.
2. `GET /dietitian/meal-plans?status=pending_review`.
3. Xem chi tiết plan + citations + alert liên quan.
4. `POST .../review` với `action` = approve/edit/reject.
5. Bệnh nhân refresh → thấy trạng thái + trust badge mới.

## 5. Edge cases
- Edit một plan đã có `Alert` severity "Nguy hiểm" nhưng dietitian không sửa món đó → *[CẦN XÁC NHẬN: có bắt buộc resolve alert trước khi approve không, hay cho phép approve kèm cảnh báo còn tồn tại?]*
- Reject một plan đã có `meal_reminder` ở trạng thái `sent` (do demo simulate) → chỉ huỷ phần tương lai, giữ nguyên phần đã gửi.
- Hai dietitian cùng thao tác review 1 plan gần như đồng thời (race condition) → *[CẦN XÁC NHẬN: có cần optimistic locking không? MVP có thể chấp nhận rủi ro thấp vì demo 1 dietitian.]*

## 6. Ngoài phạm vi (Out of scope)
- Không có luồng phản hồi 2 chiều dạng comment thread giữa dietitian và bệnh nhân (Messages hiện là mock local).
- Không có phân công tự động dietitian theo bệnh nhân.

## 7. API liên quan
| Method | Path | Role |
|---|---|---|
| GET | `/api/v1/dietitian/meal-plans` | dietitian |
| POST | `/api/v1/dietitian/meal-plans/{id}/review` | dietitian |

## 8. Liên quan
- Trạng thái MealPlan: `pending_review → approved \| rejected \| edited`
- Spec liên quan: `04-compliance-notification.md` (huỷ/tạo notification theo action)
