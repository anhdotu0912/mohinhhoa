# ADR-008: Chiến lược tổng hợp Compliance Summary cho Doctor

## Status
Accepted

## Context
Use case "bác sĩ xem tuân thủ tổng hợp của bệnh nhân" (UML/`specs/10-doctor-compliance-view.md`) **chưa có endpoint nào** as-built — `GET /notifications` hiện chỉ cho role `patient` (`require_roles("patient")`, `routes_notifications.py:36`). FE đã có sẵn UI mock hoàn chỉnh (`frontend/app/doctor/patients/compliance/page.tsx`) — biểu đồ đường 14 ngày (SVG hard-code) + timeline sự kiện (dữ liệu hard-code theo `patient_id` mẫu), hoàn toàn chưa gọi API nào.

Cần quyết định kiến trúc lưu trữ cho dữ liệu tổng hợp: tính **on-the-fly** mỗi lần doctor xem, hay build một **bảng tổng hợp riêng** (materialized summary table) được cập nhật dần theo event.

Input để tính tuân thủ đã tồn tại rải rác:
- `Notification` (`type="adherence_checkin"`, `status="done"`, `payload.adherence` ∈ `{yes, partial, no}`) — nguồn chính cho "% tuân thủ".
- `Alert` (`severity`, `created_at`, theo `user_id`) — nguồn cho cảnh báo tương tác thuốc-thực phẩm trong timeline.
- Không có bảng `FoodLog` thật (xem `adrs/009-food-log-scope-strategy.md`) nên chưa có dữ liệu "ăn gì thực tế" chi tiết, chỉ có tín hiệu tuân thủ dạng yes/partial/no theo ngày.

## Decision
**On-the-fly aggregation** (theo khuyến nghị của brief) cho quy mô demo hiện tại — **không** tạo bảng tổng hợp riêng (`compliance_summary` hay tương tự). Endpoint mới (Planned) `GET /doctor/patients/{id}/compliance` sẽ:
1. Query `Notification` của `patient_id` với `type="adherence_checkin"` trong khoảng ngày yêu cầu (mặc định 14 ngày gần nhất, khớp UI mock) → tính % tuân thủ mỗi ngày theo quy tắc `yes=100%, partial=50%, no=0%`, ngày không có checkin `done` = không có dữ liệu (không tính vào trung bình, hoặc hiển thị "chưa ghi nhận" — quyết định UI cụ thể để FE quyết, không phải phạm vi backend).
2. Query `Alert` của `patient_id` trong cùng khoảng ngày, severity ∈ `{Nguy hiểm, Cần chú ý}` → build timeline sự kiện cảnh báo.
3. Trả về 1 response tổng hợp `{daily_series: [...], events: [...]}` tại thời điểm gọi — không cache, không lưu kết quả tính toán.

## Consequences
**Positive**
- Không cần thêm bảng DB mới, không cần job đồng bộ nền để cập nhật bảng tổng hợp → giảm rủi ro lệch dữ liệu (summary table cũ so với dữ liệu gốc).
- Đơn giản để implement trong phạm vi 2 tuần — chỉ cần 1 query aggregation, không cần event listener cập nhật summary.
- Đúng quy mô demo: số lượng patient/notification hiện tại (vài chục bản ghi mỗi patient) không đủ lớn để on-the-fly aggregation trở thành bottleneck.

**Negative**
- Nếu số lượng `Notification`/`Alert` tăng lớn (nhiều patient × nhiều tháng), mỗi lần doctor mở trang compliance sẽ quét toàn bộ bản ghi trong khoảng ngày — tốn CPU/DB read lặp lại cho cùng 1 kết quả nếu doctor xem nhiều lần.
- Không có snapshot lịch sử "trạng thái tuân thủ tại thời điểm X" — nếu về sau cần báo cáo theo kỳ (tháng/quý) cố định, phải tính lại từ đầu mỗi lần.

**Điều kiện revisit (khi nào cần đổi sang bảng tổng hợp riêng):**
- Khi số lượng patient hoạt động đồng thời > ~500 hoặc lịch sử notification/patient vượt quá vài nghìn bản ghi, khiến on-the-fly aggregation vượt SLA UI (>1-2s).
- Khi cần báo cáo định kỳ cố định (export PDF theo tháng — hiện là Could Have) mà không muốn tính lại từ dữ liệu thô mỗi lần.
- Khi đó, cân nhắc: (a) bảng `compliance_daily_summary` cập nhật qua hook trong `NotificationService.mark()` mỗi khi có `action=done`, hoặc (b) batch job định kỳ tính lại (nhưng lại vướng giới hạn free-tier scheduler như ADR-007 đã nêu).

**Alternatives đã cân nhắc**
- Bảng tổng hợp riêng ngay từ đầu: bị loại cho vòng demo này vì thêm độ phức tạp (cần đồng bộ 2 nguồn dữ liệu, cần migration, cần xử lý trường hợp lệch dữ liệu) không tương xứng với quy mô demo (1 doctor, vài patient mẫu).
- Cache kết quả aggregation (Redis/in-memory TTL): chưa cần thiết ở quy mô hiện tại; có thể thêm sau nếu on-the-fly chậm, không cần đổi kiến trúc lưu trữ.

## As-built (2026-08-17)

- `GET /api/v1/doctor/patients/{patient_id}/compliance?days=14` — on-the-fly aggregate từ `Notification(type="adherence_checkin")` + `Alert` (`routes_doctor.py`, `services/compliance.py`).
- `POST /api/v1/doctor/patients/{patient_id}/compliance/remind` — tạo `Notification(type="manual_reminder")`.
- `COMPLIANCE_LOW_THRESHOLD_PCT` trong `config.py` (default `50`).
- FE `/doctor/patients/compliance` nối API thật (`getPatientCompliance`, `remindPatientCompliance`). Dashboard `/doctor` vẫn dùng mock chart cho compliance summary.
