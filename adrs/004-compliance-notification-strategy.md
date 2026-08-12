# ADR-004: Compliance Notification — chiến lược Event-driven In-app

## Status
Accepted — đã implement.

## Context
Cần nhắc bệnh nhân tuân thủ thực đơn (giờ ăn, check-in) mà không có hạ tầng push service (FCM/APNs) và không thể chạy background scheduler/cron liên tục do giới hạn **free-tier hosting**.

## Decision
Chọn chiến lược **in-app only, event-driven, materialize-ahead**: khi một sự kiện gốc xảy ra (plan generated, plan approved/rejected, alert nguy hiểm), toàn bộ notification liên quan trong tương lai được **tạo trước hàng loạt** ngay lúc đó (thay vì cron kiểm tra định kỳ để tạo notification "đến giờ").

`NotificationService` được thiết kế **độc lập ngoài LangGraph** — không phải một node trong Agent graph, vì đây là side-effect thuần túy theo sự kiện, không cần LLM reasoning.

Endpoint demo `POST /api/v1/notifications/demo/simulate` (**as-built**): **insert vài notification mẫu** (meal_reminder / adherence_checkin / plan_approved) cho user hiện tại — **không** bulk-update mọi row `pending → sent`. Dùng để có dữ liệu nhìn thấy ngay khi pitch khi chưa materialize từ plan thật.

## Consequences
- **Positive:** Không cần scheduler/push; pitch vẫn có noti trong UI.
- **Negative:** `pending` từ meal plan thật không tự `sent` theo đồng hồ nếu không có cron nhẹ — gap post-demo.
- **Negative:** `demo/simulate` chưa guard theo env production — cần chặn ở TASK-06 deploy.
- **Docs lệch cũ:** một số bản ghi “simulate = flip pending→sent” — **sai so với code**; lấy mô tả as-built ở đây và `specs/04`.
- **Alternatives:** Push FCM/APNs — hoãn Should/Could.
