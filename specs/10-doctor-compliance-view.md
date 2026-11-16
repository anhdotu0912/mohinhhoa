# Spec: Bác sĩ Xem Tuân thủ Bệnh nhân

## Status
Done (core) — `GET/POST /doctor/patients/{id}/compliance*` as-built; FE nối API thật tại `frontend/app/doctor/patients/compliance/page.tsx`. `GET /notifications` vẫn chỉ role `patient`.

## 1. Mục tiêu (Why)
Bác sĩ cần 1 cái nhìn tổng hợp về việc bệnh nhân có tuân thủ thực đơn/nhắc nhở hay không, để chủ động can thiệp (gửi nhắc nhở, điều chỉnh ràng buộc) trước khi vấn đề lâm sàng trở nên nghiêm trọng — thay vì đợi tái khám.

## 2. User story
Là **bác sĩ**, tôi muốn xem biểu đồ tuân thủ theo thời gian và danh sách sự kiện cảnh báo của 1 bệnh nhân cụ thể, và có thể gửi nhắc nhở thủ công nếu thấy tuân thủ thấp, để tôi can thiệp kịp thời.

## 3. Business rules (as-built, theo ADR-008)
1. **On-the-fly aggregation** — không có bảng tổng hợp riêng (`compliance_summary`), tính trực tiếp mỗi lần bác sĩ mở trang (`services/compliance.py::ComplianceService`), từ 2 nguồn có sẵn:
   - `Notification` (`type="adherence_checkin"`, `status="done"`, `payload.adherence` ∈ `{yes, partial, no}`) → nguồn chính tính "% tuân thủ" mỗi ngày (`yes=100%`, `partial=50%`, `no=0%`; ngày không có checkin `done` = không tính vào trung bình).
   - `Alert` (`severity ∈ {Nguy hiểm, Cần chú ý}`, theo `user_id`, trong khoảng ngày) → nguồn cho timeline sự kiện cảnh báo.
2. `GET /doctor/patients/{patient_id}/compliance` — query mặc định 14 ngày gần nhất (`days` param), trả `PatientComplianceOut` `{daily_series: [...], events: [...]}` — không cache, không lưu lịch sử tính toán.
3. **Ngưỡng cảnh báo tuân thủ thấp:** giá trị số cụ thể **vẫn là quyết định lâm sàng/sản phẩm**, chưa chốt số trong tài liệu này (ví dụ "tuân thủ trung bình <50% trong 7 ngày gần nhất → cảnh báo đỏ" chỉ là ví dụ minh hoạ, không phải giá trị chính thức áp cứng ở BE hiện tại). Ngưỡng nên là **1 giá trị cấu hình được** trong `backend/app/core/config.py` khi được chốt, không hard-code trong logic aggregation.
4. **`POST /doctor/patients/{patient_id}/compliance/remind` (as-built):** cho phép bác sĩ gửi 1 nhắc nhở thủ công. Dùng type riêng `"manual_reminder"` (không dùng lại `meal_reminder`/`adherence_checkin`) qua `NotificationService.create_manual_reminder` — tạo `Notification(type="manual_reminder", status="sent")`. `manual_reminder` đã có trong enum `Notification.type` ở `contracts/api-v1.md`.
5. Dữ liệu food log thực tế (`specs/09`, Should Have, đã Done) **vẫn không** phải nguồn chính cho aggregation tuân thủ ở vòng demo này — tín hiệu tuân thủ hiện tại chỉ dựa vào `adherence_checkin` (patient tự khai qua notification action), chưa nối `FoodLog` vào `ComplianceService`.

## 4. Luồng chính (happy path)
1. Bác sĩ mở trang chi tiết bệnh nhân → tab "Tuân thủ".
2. FE gọi `GET /doctor/patients/{patient_id}/compliance`.
3. BE aggregate on-the-fly từ `Notification`+`Alert`, trả về series theo ngày + timeline sự kiện.
4. Nếu bác sĩ thấy tuân thủ thấp → bấm "Gửi nhắc nhở" → `POST /doctor/patients/{patient_id}/compliance/remind`.

## 5. Edge cases
- **Tổng quan bác sĩ (2026-11-16):** dashboard ưu tiên hàng việc, tách theo dõi bệnh nhân khỏi các việc cần duyệt/phản hồi. Chỉ dùng dữ liệu API, không thay bằng dữ liệu demo khi trống/lỗi. Tuân thủ gộp theo ngày ISO thực tế, tuần lịch thứ Hai–Chủ nhật theo ngày Việt Nam; thiếu ghi nhận là `null`, không đổi thành 0. Trung bình tuần tính trên các cặp bệnh nhân–ngày có ghi nhận và nêu số bệnh nhân có dữ liệu. Ngày tương lai không tính; không gán ngưỡng “đạt/kém” hay các chỉ số kcal/muối từ tỷ lệ tuân thủ. Lỗi từng nguồn hiển thị rõ, không giả lập số 0. Các nút dẫn đến đúng hồ sơ, cuộc trao đổi và màn hình duyệt; dashboard không duyệt tự động hay giả lập dữ liệu.
- Bệnh nhân chưa từng có `adherence_checkin` nào (chưa từng tương tác notification) → `daily_series` toàn bộ "không có dữ liệu" cho khoảng ngày yêu cầu, không phải lỗi.
- Số lượng `Notification`/`Alert` tăng lớn (nhiều tháng lịch sử) → on-the-fly aggregation có thể chậm dần (xem điều kiện revisit ADR-008: >500 patient hoạt động đồng thời hoặc vài nghìn bản ghi/patient).
- FE hiện hiển thị biểu đồ 14 ngày cố định qua default `days=14`; BE cho phép truyền `days` khác qua query param nếu cần, nhưng FE chưa có UI đổi khoảng ngày.

## 6. Ngoài phạm vi (Out of scope)
- Bảng tổng hợp riêng (materialized summary) — hoãn theo ADR-008, chỉ revisit khi vượt ngưỡng quy mô.
- Export báo cáo tuân thủ theo kỳ (PDF) — Could Have, chưa thiết kế.
- Tuân thủ theo từng món ăn cụ thể (chỉ ở mức % theo ngày, không phải theo món).

## 7. Schema tham chiếu
- `Notification`, `NotificationActionRequest.adherence` — `contracts/api-v1.md` §7.
- `Alert` — `contracts/agent-io-schema.md` §4.
- `PatientComplianceOut` `{daily_series, events}` — `contracts/api-v1.md` §10.

## 8. API liên quan
| Method | Path | Role |
|---|---|---|
| GET | `/doctor/patients/{patient_id}/compliance` | doctor |
| POST | `/doctor/patients/{patient_id}/compliance/remind` | doctor |

## 9. Liên quan
- `adrs/008-compliance-summary-aggregation-strategy.md` — quyết định kiến trúc gốc.
- `specs/11-compliance-notification-delivery.md` — nguồn `Notification`/`adherence_checkin` dùng để tổng hợp.
- `specs/09-food-log-adherence.md` — lý do food log không phải nguồn chính hiện tại.
- `contracts/api-v1.md` §10.
