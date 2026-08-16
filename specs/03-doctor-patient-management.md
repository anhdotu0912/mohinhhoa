# Spec: Bác sĩ Quản lý Danh sách & Thông tin Bệnh nhân

## Status
Done — CRUD danh sách/thông tin chung hoạt động; phần ràng buộc lâm sàng (`target_kcal`/`restrictions`) tách sang `specs/04-clinical-constraints.md` (Planned).

## 1. Mục tiêu (Why)
Bác sĩ demo cần 1 nơi duy nhất để thêm bệnh nhân mới, xem toàn bộ hàng đợi bệnh nhân của mình, và cập nhật thông tin cơ bản (tên, tuổi, chỉ số cơ thể, mục tiêu sức khoẻ) mà không cần nhờ bệnh nhân tự làm.

## 2. User story
Là **bác sĩ**, tôi muốn thêm bệnh nhân mới vào hệ thống, xem danh sách bệnh nhân đang quản lý, và sửa thông tin cơ bản/chỉ số cơ thể của họ, để tôi chủ động quản lý hồ sơ mà không phụ thuộc bệnh nhân tự nhập.

## 3. Business rules
1. **Không phân công tự động doctor↔patient** — hiện tại **1 doctor demo thấy toàn bộ hàng đợi bệnh nhân** trong hệ thống (không có bảng `doctor_patient_assignment`). `GET /doctor/patients` trả tất cả user có `role=patient`. Đây là giới hạn cố định của dự án (xem `CLAUDE.md`), không phải bug.
2. Thêm bệnh nhân mới = gọi lại `POST /auth/register` với `role="patient"` (xem `specs/01-account-auth.md`) — **không có** endpoint riêng `POST /doctor/patients`. Sau khi có `user_id`, doctor gọi tiếp `PUT /doctor/patients/{id}/profile` để bổ sung chi tiết.
3. `PUT /doctor/patients/{id}/profile` validate `age` trong khoảng **0–130** (validation này **chỉ áp dụng ở endpoint doctor này**, **không** áp dụng khi patient tự đăng ký — `POST /auth/register` không có field `age`, `age` chỉ tồn tại trong `PatientProfile`/`DoctorPatientUpdate`).
4. `PUT /doctor/patients/{id}/profile` **không bao gồm** `target_kcal`/`restrictions` — 2 field này **chỉ** sửa được qua endpoint riêng ở `specs/04-clinical-constraints.md`. Đây là chủ ý tách bạch: thông tin hành chính/nhân trắc (spec này) vs ràng buộc điều trị (spec 04).
5. `PUT /doctor/patients/{id}/metrics` (weight/height) — BE **tự tính lại `bmi`** và `bmi_category` (`Thiếu cân/Bình thường/Thừa cân nhẹ/Béo phì`, ngưỡng BMI châu Á 18.5/23/25), khác với `POST /profile` (patient tự nhập `bmi` tay, không tự tính) — 2 endpoint có hành vi tính BMI **khác nhau có chủ đích**, cần lưu ý khi so sánh dữ liệu. **[Planned, quyết định 2026-08-15]** request phải gửi **đầy đủ cả `weight` và `height`** trong cùng 1 lần gọi (không cho cập nhật riêng lẻ 1 trong 2) — thiếu 1 trong 2 → `400 METRICS_INCOMPLETE`.
6. `PUT /doctor/patients/{id}/goals` sửa mục tiêu sức khoẻ chung (tách biệt khỏi `target_kcal` — xem field cụ thể trong `contracts/api-v1.md` §8).
7. `GET /doctor/catalog` trả danh mục chuẩn hoá (bệnh lý/thuốc) để FE gợi ý autocomplete khi doctor nhập — không bắt buộc chọn từ danh mục, vẫn có thể nhập text tự do ở các field liên quan.
8. `POST /doctor/patients/{id}/avatar` upload ảnh đại diện hộ bệnh nhân — không giới hạn nghiệp vụ đặc biệt ngoài giới hạn kỹ thuật (kích thước/định dạng file, xem `contracts/api-v1.md`).
9. `GET /doctor/patients?plan_usage=` lọc theo trạng thái áp dụng thực đơn: `none` (chưa từng apply), `active` (đang/upcoming), `finished` (đã hết chu kỳ). Summary trả thêm `active_plan_id`, `plan_starts_on`, `plan_usage` (ADR-011). FE tab lọc trên `/doctor/patients` và `/doctor/history` (ADR-012).

## 4. Luồng chính (happy path)
1. Doctor đăng nhập, vào trang danh sách bệnh nhân → FE gọi `GET /doctor/patients`.
2. Doctor bấm "Thêm bệnh nhân" → FE gọi `POST /auth/register` (`role="patient"`).
3. Doctor bổ sung thông tin cơ bản → FE gọi `PUT /doctor/patients/{id}/profile` (tên, tuổi, giới tính, bệnh lý, thuốc, dị ứng — trừ `target_kcal`/`restrictions`).
4. Doctor nhập chỉ số cơ thể → FE gọi `PUT /doctor/patients/{id}/metrics` → BE tự tính BMI.
5. Doctor xem chi tiết 1 bệnh nhân → FE gọi `GET /doctor/patients/{id}`.
6. (Tuỳ chọn) Doctor sửa ràng buộc lâm sàng → sang `specs/04-clinical-constraints.md`.

## 5. Edge cases
- Doctor thêm bệnh nhân bằng email đã tồn tại → `409 EMAIL_EXISTS` (dùng chung logic `specs/01`).
- `age` ngoài khoảng 0–130 ở `PUT /doctor/patients/{id}/profile` → `422 Validation Error`.
- [CẦN XÁC NHẬN] Vì không có phân công doctor↔patient, nếu demo có 2 doctor cùng lúc, cả 2 đều thấy và sửa được toàn bộ bệnh nhân — có thể gây race condition khi 2 doctor cùng sửa 1 hồ sơ (liên quan race condition duyệt plan, xem `specs/06-meal-plan-review.md` §5). Chấp nhận cho demo 1 doctor hay cần giới hạn quyền theo nhóm bệnh nhân trước khi có ≥2 doctor dùng thật?
- Doctor gọi `GET /doctor/patients/{id}` với `id` không tồn tại hoặc không phải `role=patient` → `404 PATIENT_NOT_FOUND`.
- Doctor sửa `PUT /doctor/patients/{id}/profile` nhưng gửi cả `target_kcal` trong body → field đó bị **Pydantic ignore** (không có trong schema `DoctorPatientUpdate`), không lỗi nhưng cũng không có tác dụng — cần lưu ý FE không gửi nhầm field này tưởng là có hiệu lực.

## 6. Ngoài phạm vi (Out of scope)
- Phân công/điều phối doctor↔patient tự động — cố định "1 doctor thấy toàn bộ" theo `CLAUDE.md`.
- Xoá bệnh nhân khỏi hệ thống (không có endpoint xoá user).
- Ràng buộc lâm sàng (`target_kcal`/`restrictions`) — xem `specs/04`.

## 7. Schema tham chiếu
- `DoctorPatientSummary`, `DoctorPatientDetail`, `DoctorPatientUpdate`, `MetricsUpdateRequest`, `GoalsUpdateRequest` — `contracts/api-v1.md` §8.
- Lưu ý: `DoctorPatientSummary` có khai báo trùng field `age` 2 lần trong `schemas/doctor.py` (không gây lỗi runtime vì Pydantic lấy khai báo sau, nhưng là code smell cần dọn khi có thời gian — không thuộc phạm vi tài liệu này để sửa).

## 8. API liên quan
| Method | Path | Role |
|---|---|---|
| POST | `/auth/register` | Không cần auth (dùng lại từ spec 01) |
| GET | `/doctor/patients` | doctor |
| GET | `/doctor/patients/{patient_id}` | doctor |
| PUT | `/doctor/patients/{patient_id}/profile` | doctor |
| PUT | `/doctor/patients/{patient_id}/metrics` | doctor |
| PUT | `/doctor/patients/{patient_id}/goals` | doctor |
| GET | `/doctor/catalog` | doctor |
| POST | `/doctor/patients/{patient_id}/avatar` | doctor |

## 9. Liên quan
- `specs/01-account-auth.md` — đăng ký dùng chung.
- `specs/04-clinical-constraints.md` — phần ràng buộc lâm sàng tách riêng.
- `specs/12-patient-metrics-tracking.md` — chỉ số cơ thể (patient tự nhập vs doctor nhập hộ).
- `contracts/api-v1.md` §8 (Doctor Patient Management).
