# Spec: Bác sĩ Xem Tuân thủ Bệnh nhân

## Status
Planned — **chưa có endpoint nào as-built** cho bác sĩ đọc tuân thủ tổng hợp. `GET /notifications` hiện chỉ role `patient` gọi được (`require_roles("patient")`). FE đã có UI mock hoàn chỉnh (`frontend/app/doctor/patients/compliance/page.tsx`) nhưng 100% dữ liệu hard-code, chưa gọi API nào.

## 1. Mục tiêu (Why)
Bác sĩ cần 1 cái nhìn tổng hợp về việc bệnh nhân có tuân thủ thực đơn/nhắc nhở hay không, để chủ động can thiệp (gửi nhắc nhở, điều chỉnh ràng buộc) trước khi vấn đề lâm sàng trở nên nghiêm trọng — thay vì đợi tái khám.

## 2. User story
Là **bác sĩ**, tôi muốn xem biểu đồ tuân thủ theo thời gian và danh sách sự kiện cảnh báo của 1 bệnh nhân cụ thể, và có thể gửi nhắc nhở thủ công nếu thấy tuân thủ thấp, để tôi can thiệp kịp thời.

## 3. Business rules (thiết kế đề xuất — theo ADR-008)
1. **On-the-fly aggregation** — không có bảng tổng hợp riêng (`compliance_summary`), tính trực tiếp mỗi lần bác sĩ mở trang, từ 2 nguồn có sẵn:
   - `Notification` (`type="adherence_checkin"`, `status="done"`, `payload.adherence` ∈ `{yes, partial, no}`) → nguồn chính tính "% tuân thủ" mỗi ngày (`yes=100%`, `partial=50%`, `no=0%`; ngày không có checkin `done` = không tính vào trung bình).
   - `Alert` (`severity ∈ {Nguy hiểm, Cần chú ý}`, theo `user_id`, trong khoảng ngày) → nguồn cho timeline sự kiện cảnh báo.
2. **[Planned]** `GET /doctor/patients/{patient_id}/compliance` — query mặc định 14 ngày gần nhất (khớp UI mock hiện có), trả `{daily_series: [...], events: [...]}` — không cache, không lưu lịch sử tính toán.
3. **Ngưỡng cảnh báo tuân thủ thấp (quyết định 2026-08-15):** giá trị số cụ thể **vẫn là quyết định lâm sàng/sản phẩm**, chưa chốt số trong tài liệu này (ví dụ "tuân thủ trung bình <50% trong 7 ngày gần nhất → cảnh báo đỏ" chỉ là ví dụ minh hoạ, không phải giá trị chính thức). Thiết kế kỹ thuật đã chốt: ngưỡng phải là **1 giá trị cấu hình được** (`COMPLIANCE_LOW_THRESHOLD_PCT` trong `backend/app/core/config.py`, default đề xuất `50`) — không hard-code trong logic aggregation, để team lâm sàng/sản phẩm điều chỉnh mà không cần sửa code.
4. **[Planned]** `POST /doctor/patients/{patient_id}/compliance/remind` — cho phép bác sĩ gửi 1 nhắc nhở thủ công. **Quyết định 2026-08-15: thêm type mới `"manual_reminder"`** (không dùng lại `meal_reminder`/`adherence_checkin`) — tạo `Notification(type="manual_reminder", status="sent")`, cần thêm giá trị này vào enum `Notification.type` ở cả `contracts/api-v1.md` và mọi nơi validate type.
5. Dữ liệu food log thực tế (`specs/09`, Won't Have) **không** phải nguồn chính cho tuân thủ ở vòng demo này — vì Food Log Won't Have, tín hiệu tuân thủ hiện tại chỉ dựa vào `adherence_checkin` (patient tự khai qua notification action), không có dữ liệu "ăn gì thực tế" chi tiết.

## 4. Luồng chính (happy path — thiết kế đề xuất)
1. Bác sĩ mở trang chi tiết bệnh nhân → tab "Tuân thủ".
2. FE gọi `GET /doctor/patients/{patient_id}/compliance`.
3. BE aggregate on-the-fly từ `Notification`+`Alert`, trả về series theo ngày + timeline sự kiện.
4. Nếu bác sĩ thấy tuân thủ thấp → bấm "Gửi nhắc nhở" → `POST /doctor/patients/{patient_id}/compliance/remind`.

## 5. Edge cases
- Bệnh nhân chưa từng có `adherence_checkin` nào (chưa từng tương tác notification) → `daily_series` toàn bộ "không có dữ liệu" cho khoảng ngày yêu cầu, không phải lỗi.
- Số lượng `Notification`/`Alert` tăng lớn (nhiều tháng lịch sử) → on-the-fly aggregation có thể chậm dần (xem điều kiện revisit ADR-008: >500 patient hoạt động đồng thời hoặc vài nghìn bản ghi/patient).
- [CẦN XÁC NHẬN] UI mock hiện tại hiển thị biểu đồ 14 ngày cố định — cần xác nhận khoảng ngày này có nên cho bác sĩ tuỳ chọn (7/30/90 ngày) hay giữ cố định 14 ngày cho vòng demo.

## 6. Ngoài phạm vi (Out of scope)
- Bảng tổng hợp riêng (materialized summary) — hoãn theo ADR-008, chỉ revisit khi vượt ngưỡng quy mô.
- Export báo cáo tuân thủ theo kỳ (PDF) — Could Have, chưa thiết kế.
- Tuân thủ theo từng món ăn cụ thể (chỉ ở mức % theo ngày, không phải theo món).

## 7. Schema tham chiếu
- `Notification`, `NotificationActionRequest.adherence` — `contracts/api-v1.md` §7.
- `Alert` — `contracts/agent-io-schema.md` §4.
- Response `{daily_series, events}` — đề xuất, xem `contracts/api-v1.md` §10 (Doctor Compliance `[Planned]`).

## 8. API liên quan
| Method | Path | Role |
|---|---|---|
| GET | `/doctor/patients/{patient_id}/compliance` | doctor **[Planned]** |
| POST | `/doctor/patients/{patient_id}/compliance/remind` | doctor **[Planned]** |

## 9. Liên quan
- `adrs/008-compliance-summary-aggregation-strategy.md` — quyết định kiến trúc gốc.
- `specs/11-compliance-notification-delivery.md` — nguồn `Notification`/`adherence_checkin` dùng để tổng hợp.
- `specs/09-food-log-adherence.md` — lý do food log không phải nguồn chính hiện tại.
- `contracts/api-v1.md` §10.
