# ADR-013: Time-series Chỉ số Cơ thể cho Patient Self-Tracking

## Status
Accepted (2026-08-17) — supersede phần "hoãn time-series" của ADR-010 cho use case bệnh nhân tự ghi nhận.

## Context
ADR-010 quyết định hoãn bảng lịch sử cho vòng demo gốc, giữ snapshot trên `profiles`. Team đã chốt nâng scope: bệnh nhân cần ghi nhận cân nặng/huyết áp/đường huyết theo thời gian và xem biểu đồ xu hướng trên trang `/patient/history` (UI đã thiết kế sẵn, trước đó mock).

## Decision
1. **Thêm bảng `body_metrics_history`** — patient `POST /metrics` upsert 1 row/ngày VN (lần sau merge vào cùng row); doctor metrics vẫn insert row mới mỗi lần gọi.
2. **Ai được ghi:** `recorded_by` ∈ `{patient, doctor}` — patient qua `POST /metrics`; doctor qua `PUT /doctor/patients/{id}/metrics` (insert thêm history entry sau khi cập nhật snapshot).
3. **Fields:** `weight`, `height`, `bmi`, `blood_pressure`, `blood_glucose`, `note`, `recorded_at`.
4. **Snapshot `profiles` vẫn giữ** — mỗi lần ghi history cũng cập nhật snapshot mới nhất trên `profiles` (tương thích ngược mọi nơi đọc `PatientProfile`).
5. **BMI:** endpoint patient `POST /metrics` tự tính `bmi` từ `weight` + `height` (height lấy từ payload hoặc `profiles.height` hiện tại). Không đổi cơ chế cũ `POST /profile` (patient tự khai `bmi` tay).
6. **Không backfill** dữ liệu cũ từ snapshot — history bắt đầu từ ngày triển khai.
7. **Tần suất (patient):** tối đa 1 entry/ngày lịch Asia/Ho_Chi_Minh — bấm "Ghi nhận" lần 2 trong ngày cập nhật entry đó (merge field). Doctor path không áp dụng giới hạn này.

## Consequences
**Positive**
- UI "Xu hướng cân nặng" trên `/patient/history` có thể nối API thật.
- Doctor và patient đều đóng góp vào cùng chuỗi dữ liệu.

**Negative**
- Thêm model + 2 endpoint mới + sửa doctor metrics endpoint.
- ADR-010 phần "hoãn time-series" bị supersede (chỉ cho patient self-tracking; intent AI "lời khuyên khi chỉ số đổi" vẫn Planned).

## Liên quan
- `specs/12-patient-metrics-tracking.md`
- `contracts/agent-io-schema.md` §BodyMetricsEntry
- `contracts/api-v1.md` §14 Patient Metrics History
