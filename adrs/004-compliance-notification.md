# ADR 004 — Compliance Notification Strategy

- **Status:** Accepted
- **Date:** 2026-08-04
- **Deciders:** BE2 (Platform), FE
- **Replaces in MVP scope:** Food Log engagement loop

## Context

MVP bỏ Food Log nhưng vẫn cần vòng “patient quay lại app” sau khi có meal plan. Cần nhắc tuân thủ + follow-up interaction + báo plan đã duyệt — trong 2 tuần, ít ops.

## Decision

1. **In-app notification center** là channel duy nhất cho MVP (chưa FCM).
2. **Event-driven + materialize-ahead**: khi tạo/duyệt meal plan / tạo alert → ghi sẵn rows `notifications` (kèm `scheduled_at`).
3. FE Dashboard poll hoặc fetch on focus; optional `demo_simulate=true` để hiện ngay khi pitch.

## Options considered

| Option | Pros | Cons |
|---|---|---|
| Push (FCM) | Real engagement | Setup mobile/web push, ngoài scope thời gian |
| Cron worker riêng | Đúng giờ gửi | Thêm process, deploy phức tạp |
| **Event + materialize** | Đủ demo, test dễ, ít moving parts | Không “realtime clock” trừ khi có job nhẹ |
| Chỉ email | Đơn giản | UX demo kém, phụ thuộc SMTP |

## Consequences

- Model `Notification` thuộc BE2; FE có `useNotificationStore`.
- LangGraph **không** chứa logic schedule.
- Plan B nếu cần đúng giờ: 1 cron tick/phút mark `pending→sent` khi `scheduled_at <= now` (vẫn một service).
- Post-MVP: map cùng schema sang FCM mà không đổi contract lõi.

## API surface (tóm tắt)

- `GET /api/v1/notifications`
- `POST /api/v1/notifications/{id}/read`
- `POST /api/v1/notifications/{id}/dismiss`
- `POST /api/v1/notifications/{id}/done` (adherence payload)
- `POST /api/v1/notifications/demo/simulate` (chỉ env demo)
