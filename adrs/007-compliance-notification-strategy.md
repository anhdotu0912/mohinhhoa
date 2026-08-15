# ADR-007: Chiến lược Compliance Notification — Event-driven, Materialize-ahead

## Status
Accepted

## Context
Cần cơ chế nhắc nhở/tuân thủ (`meal_reminder`, `adherence_checkin`, `plan_approved`, `interaction_followup`) cho bệnh nhân, nhưng:
- Deploy target free-tier (Railway/Vercel) — **không đảm bảo có một process nền chạy liên tục** để làm cron scheduler (serverless/sleep-on-idle instance có thể bị đánh thức bất kỳ lúc nào, không giữ được state của một scheduler in-process).
- Team không muốn thêm dependency ngoài (Celery + Redis broker, hoặc APScheduler cần process luôn sống) trong 2 tuần prototype.
- North Star flow cần notification hiển thị **ngay** sau khi có event (generate plan / approve / reject / phát hiện alert nguy hiểm), không cần đợi 1 vòng cron.

## Decision
Dùng kiến trúc **event-driven, materialize-ahead**: khi một event nghiệp vụ xảy ra, hệ thống **tạo sẵn (materialize) toàn bộ** các bản ghi `Notification` liên quan trong cùng transaction/request, với `scheduled_at` đặt vào đúng thời điểm tương lai mong muốn — **không có cron nào "quét và tạo"**, chỉ có cron (nếu có trong tương lai) "quét và gửi/đẩy" các bản ghi đã tồn tại tới đúng hạn.

As-built (`backend/app/services/notification.py`, không có Celery/APScheduler/cron nào trong `backend/app`):

| Event | Trigger | Hành vi |
|---|---|---|
| Sinh meal plan (`generate_meal_plan`) | `POST /meal-plans/generate`, `POST /doctor/patients/{id}/meal-plans/generate` | `materialize_from_meal_plan()`: tạo **toàn bộ** `meal_reminder` cho mỗi slot/ngày (giờ cố định theo `SLOT_TIMES`: sáng 07:30, trưa 11:30, tối 18:00, phụ 15:30) + `adherence_checkin` mỗi ngày (21:00), status=`pending`, cho cả 7 ngày ngay lập tức |
| Duyệt plan | `POST /doctor/meal-plans/{id}/review` (action=approve) | `on_plan_approved()`: tạo 1 `Notification(type="plan_approved", status="sent")` ngay (không đặt `pending` vì sự kiện đã xảy ra tại thời điểm gọi) |
| Từ chối plan | `POST /doctor/meal-plans/{id}/review` (action=reject) | `on_plan_rejected()`: set `status="cancelled"` cho các `Notification` **đang `pending`** có `related_ids.meal_plan_id` khớp plan bị reject (không đụng tới notification đã `sent/read/done`, không đụng notification của plan khác) |
| Phát hiện alert thuốc-thực phẩm | Sau `check_interactions` (cả trong sinh plan lẫn `POST /interactions/check`) | `on_alert_created()`: chỉ tạo `Notification(type="interaction_followup", status="sent")` nếu `alert.severity` ∈ `{Nguy hiểm, Cần chú ý}` — severity `An toàn` **không** tạo notification |
| Demo seed | `POST /notifications/demo/simulate` | Tạo đúng **3 bản ghi cố định** (1 `meal_reminder pending`, 1 `adherence_checkin pending`, 1 `plan_approved sent`) cho **user hiện tại đang gọi API**, không dùng `NotificationService`, không dùng dữ liệu ngẫu nhiên |

Guard production: `settings.APP_ENV == "production"` → cả `POST /notifications/demo/simulate` và `POST /doctor/demo/plan-expiry` trả `403 DEMO_DISABLED`.

## Consequences
**Positive**
- Không cần scheduler/worker process nào — tương thích 100% với free-tier serverless.
- Notification hiện diện ngay trong DB tại thời điểm sinh plan → FE có thể hiển thị "lịch nhắc 7 ngày tới" ngay, không cần đợi.
- Reject có logic cancel chính xác theo `meal_plan_id`, tránh xoá nhầm notification của plan khác cùng user.

**Negative**
- Vì materialize hết 7 ngày cùng lúc, nếu doctor **reject** plan sau khi patient đã tương tác với vài notification `sent/read/done` trước đó của plan đó, các bản ghi này **không** bị cancel (chỉ cancel `pending`) — chấp nhận được vì các notification đã tương tác được xem là lịch sử, không cần thu hồi.
- Không có cơ chế "gửi" thật (push/SMS/email) — notification chỉ là bản ghi DB, hiển thị qua `GET /notifications` khi patient tự vào app (không có FCM/APNs, đúng phạm vi Won't Have của `CLAUDE.md`).
- Nếu về sau cần cron thật (ví dụ để tự động chuyển `pending` quá hạn → `sent` hoặc để gửi push), cần thêm 1 lựa chọn khác (worker riêng hoặc dịch vụ cron ngoài tương thích free-tier) — nằm ngoài phạm vi ADR này.

**Alternatives đã cân nhắc**
- Cron job in-process (APScheduler chạy nền cùng FastAPI): bị loại vì free-tier hosting có thể sleep/restart instance bất kỳ lúc nào, làm mất lịch scheduler in-memory và không đảm bảo job chạy đúng giờ.
- Celery + Redis: bị loại vì thêm 1 broker service phải vận hành, vượt quá scope 2 tuần.
- "Lazy materialize" (chỉ tạo notification tại đúng thời điểm cần hiển thị, tính toán on-the-fly): bị loại vì phức tạp hơn để track trạng thái `read/dismissed/done` — cần bản ghi cụ thể mới có ID để action (đọc/dismiss/done) tham chiếu tới.
