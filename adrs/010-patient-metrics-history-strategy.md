# ADR-010: Có làm Time-series Chỉ số Cơ thể hay giữ Snapshot?

## Status
Accepted (giữ Snapshot, hoãn Time-series)

## Context
Chỉ số cơ thể (weight/height/bmi) hiện lưu **snapshot mới nhất duy nhất** trên `profiles.weight/height/bmi` (`backend/app/models/profile.py`) — mỗi lần patient tự cập nhật (`POST /profile`) hoặc doctor cập nhật (`PUT /doctor/patients/{id}/metrics`) đều **ghi đè** giá trị cũ, không có bảng lịch sử nhiều bản ghi theo thời gian. `bmi_category` (`Thiếu cân/Bình thường/Thừa cân nhẹ/Béo phì`, ngưỡng 18.5/23/25 — chuẩn BMI châu Á, không phải WHO 25/30) được tính lại mỗi lần từ snapshot, không lưu lịch sử category.

Use case "xem xu hướng dài hạn" / "biểu đồ cân nặng theo thời gian" (`specs/12-patient-metrics-tracking.md`) cần dữ liệu time-series (nhiều bản ghi theo ngày), mà schema hiện tại **không có**.

## Decision
**Hoãn (Deferred) việc xây bảng lịch sử time-series cho chỉ số cơ thể** trong vòng demo này. Giữ nguyên snapshot trên `profiles`. Lý do:
- Use case này **không nằm trên North Star flow** (đăng nhập bác sĩ → generate → duyệt → bệnh nhân xem → chat hỏi lại) — theo nguyên tắc vàng của CLAUDE.md, không đánh đổi effort của North Star để làm feature phụ.
- Thêm bảng `body_metrics_history` cần: model mới + migration + sửa 2 endpoint hiện tại (`POST /profile`, `PUT /doctor/patients/{id}/metrics`) để **insert thêm** một record lịch sử mỗi lần cập nhật (thay vì chỉ update snapshot) + 1 endpoint mới để đọc lịch sử — lượng việc không nhỏ so với lợi ích trong phạm vi demo 2 tuần.
- Đây được brief xác định đúng là điểm "phân tích xu hướng" — brief đã khuyến nghị hoãn nếu không nằm trên North Star, ADR này xác nhận và chính thức hoá khuyến nghị đó.

## Consequences
**Positive**
- Không tốn effort BE2 cho 1 bảng mới + migration trong lúc ưu tiên P0 (đóng gap `DEMO_MOCK`, guardrails thật) đang cần hơn (xem `tasks/roadmap-mvp.md`).
- Giữ contract `PatientProfile`/`MetricsUpdateRequest` đơn giản, không phải version-bump lớn giữa lúc các ADR khác (006, 007, 008) đang định hình lại nhiều phần khác của hệ thống.

**Negative**
- `specs/12-patient-metrics-tracking.md` phải ghi rõ "xem lại lịch sử cân nặng theo thời gian" là **Out of scope/Planned** cho vòng này — nếu UI đã thiết kế biểu đồ xu hướng (cần audit riêng phần FE liên quan khi có yêu cầu), sẽ tạm hiển thị dữ liệu giả định hoặc ẩn tính năng đó, tương tự cách `frontend/app/doctor/patients/compliance/page.tsx` đang mock biểu đồ.
- Nếu về sau nâng cấp, cần một migration "backfill" quyết định: có tái tạo lịch sử giả từ snapshot hiện tại hay bắt đầu record mới từ ngày triển khai — quyết định đó nằm ngoài phạm vi ADR này, để dành cho ADR mới khi tính năng được ưu tiên lại.

**Điều kiện revisit:**
- Khi "phân tích xu hướng chỉ số cơ thể" được nâng từ ngoài phạm vi lên Should/Must Have trong một vòng lập kế hoạch tiếp theo (không phải vòng demo 2 tuần hiện tại).
- Khi có yêu cầu lâm sàng cụ thể cần theo dõi xu hướng liên tục (ví dụ theo dõi bệnh nhân suy thận cần biểu đồ cân nặng do giữ nước) — lúc đó nên tách riêng 1 ADR mới định nghĩa schema `body_metrics_history` (fields, tần suất ghi nhận, ai được ghi — patient tự nhập hay chỉ doctor xác nhận).

**Alternatives đã cân nhắc**
- Làm time-series ngay bây giờ (thêm bảng, giữ mọi lần update làm 1 row mới): bị loại vì không nằm trên North Star, tốn effort BE2 không tương xứng lợi ích demo.
- Suy ra lịch sử gần đúng từ `updated_at` của `profiles` (chỉ có 1 giá trị mới nhất, không có gì để suy ra xu hướng): bị loại vì không đủ dữ liệu — `profiles.updated_at` bị ghi đè mỗi lần cập nhật, không giữ giá trị cũ.
