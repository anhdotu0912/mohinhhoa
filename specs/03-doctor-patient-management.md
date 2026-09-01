# Spec: Bác sĩ Quản lý Danh sách & Thông tin Bệnh nhân

## Status
Done — CRUD danh sách/thông tin chung; phân công bác sĩ ↔ bệnh nhân 1–1 (claim + chuyển có xác nhận) as-built 2026-08-28. Phần ràng buộc lâm sàng (`target_kcal`/`restrictions`) tách sang `specs/04-clinical-constraints.md`.

## 1. Mục tiêu (Why)
Bác sĩ cần 1 nơi duy nhất để thêm bệnh nhân mới (gắn ngay vào mình), xem hàng đợi bệnh nhân **của mình**, nhận bệnh nhân tự đăng ký / chưa phân công, chuyển bệnh nhân sang đồng nghiệp khi họ đồng ý, và cập nhật thông tin cơ bản mà không cần nhờ bệnh nhân tự làm.

## 2. User story
- Là **bác sĩ**, tôi muốn thêm bệnh nhân mới vào hệ thống và thấy họ trong danh sách của tôi ngay, để tôi chủ động quản lý hồ sơ.
- Là **bác sĩ**, tôi muốn thấy bệnh nhân tự đăng ký trên Hàng việc và bấm Nhận, để tôi chỉ quản lý người tôi nhận.
- Là **bác sĩ**, tôi muốn chuyển bệnh nhân sang bác sĩ khác và họ phải bấm Nhận, để việc bàn giao có xác nhận.
- Là **bệnh nhân**, tôi muốn dùng app ngay sau khi đăng ký và thấy trạng thái “đang chờ bác sĩ nhận” rồi tên bác sĩ sau khi được nhận.

## 3. Business rules
1. **Phân công 1–1** — `users.assigned_doctor_id` (nullable). `GET /doctor/patients` chỉ trả bệnh nhân gắn với bác sĩ đang đăng nhập. Mọi endpoint doctor theo `patient_id` hoặc meal-plan của bệnh nhân không thuộc mình → `404 PATIENT_NOT_FOUND` (không lộ sự tồn tại).
2. Thêm bệnh nhân hộ = `POST /doctor/patients` (auth doctor) — tạo user `role=patient`, `signup_channel=doctor`, gắn ngay `assigned_doctor_id`. **Không** dùng `POST /auth/register` cho luồng này (register công khai luôn để bệnh nhân tự đăng ký, không gắn bác sĩ). Sau khi có `user_id`, doctor gọi tiếp `PUT /doctor/patients/{id}/profile` để bổ sung chi tiết.
3. Bệnh nhân tự `POST /auth/register` → `assigned_doctor_id=null`, `signup_channel=self` → xuất hiện trên `GET /doctor/claim-queue` của **mọi** bác sĩ (`source=self_register`).
4. Dữ liệu cũ / seed demo: `demo_patient_1`–`4` gắn sẵn `demo_doctor`; `demo_patient_5` và patient legacy chưa gắn → `signup_channel=legacy`, hàng chờ (`source=unassigned_pool`).
5. `POST /doctor/patients/{id}/claim` — chỉ khi chưa gắn; ai gọi trước thì nhận; đã là chủ → 200 idempotent; đã thuộc người khác → `409 ALREADY_ASSIGNED`.
6. `POST /doctor/patients/{id}/transfer` — chỉ bác sĩ đang quản lý; tạo `patient_transfers` status `pending`; quyền **chưa** đổi. Một patient chỉ một pending — gửi mới huỷ pending cũ. Bác sĩ đích thấy item `kind=transfer` trên claim-queue. Bệnh nhân vẫn thấy tên bác sĩ cũ cho đến khi accept.
7. `POST /doctor/transfers/{id}/accept` — chỉ `to_doctor_id`; gán `assigned_doctor_id` sang caller, `accepted`; huỷ pending khác (nếu có).
8. Không có unclaim / trả về pool. Không có đồng quản lý. Bệnh nhân không tự chọn bác sĩ.
9. `PUT /doctor/patients/{id}/profile` validate `age` trong khoảng **0–130** (validation này **chỉ áp dụng ở endpoint doctor này**, **không** áp dụng khi patient tự đăng ký — `POST /auth/register` không có field `age`, `age` chỉ tồn tại trong `PatientProfile`/`DoctorPatientUpdate`).
10. `PUT /doctor/patients/{id}/profile` **không bao gồm** `target_kcal`/`restrictions` — 2 field này **chỉ** sửa được qua endpoint riêng ở `specs/04-clinical-constraints.md`.
11. `PUT /doctor/patients/{id}/metrics` (weight/height) — BE **tự tính lại `bmi`** và `bmi_category` (`Thiếu cân/Bình thường/Thừa cân nhẹ/Béo phì`, ngưỡng BMI châu Á 18.5/23/25). Request phải gửi **đầy đủ cả `weight` và `height`** trong cùng 1 lần gọi — thiếu 1 trong 2 → `400 METRICS_INCOMPLETE`.
12. `PUT /doctor/patients/{id}/goals` sửa mục tiêu sức khoẻ chung (tách biệt khỏi `target_kcal` — xem field cụ thể trong `contracts/api-v1.md` §8).
13. `GET /doctor/catalog` trả danh mục chuẩn hoá (bệnh lý/thuốc) để FE gợi ý autocomplete khi doctor nhập — không bắt buộc chọn từ danh mục, vẫn có thể nhập text tự do ở các field liên quan.
14. `POST /doctor/patients/{id}/avatar` upload ảnh đại diện hộ bệnh nhân — không giới hạn nghiệp vụ đặc biệt ngoài giới hạn kỹ thuật (kích thước/định dạng file, xem `contracts/api-v1.md`).
15. `GET /doctor/patients?plan_usage=` lọc theo trạng thái áp dụng thực đơn: `none` (chưa từng apply), `active` (đang/upcoming), `finished` (đã hết chu kỳ). Summary trả thêm `active_plan_id`, `plan_starts_on`, `plan_usage` (ADR-011). FE tab lọc trên `/doctor/patients` và `/doctor/history` (ADR-012).

## 4. Luồng chính (happy path)
1. Doctor đăng nhập, vào trang danh sách bệnh nhân → FE gọi `GET /doctor/patients` (chỉ người đã gắn).
2. Doctor bấm "Thêm bệnh nhân" → FE gọi `POST /doctor/patients` → bệnh nhân vào danh sách ngay.
3. Doctor bổ sung thông tin cơ bản → FE gọi `PUT /doctor/patients/{id}/profile`.
4. Doctor nhập chỉ số cơ thể → FE gọi `PUT /doctor/patients/{id}/metrics` → BE tự tính BMI.
5. Bệnh nhân tự đăng ký → mọi bác sĩ thấy việc Chờ nhận trên Hàng việc (`GET /doctor/claim-queue`). Bác sĩ bấm Nhận → `POST .../claim` → vào danh sách người đó; các bác sĩ khác mất việc / nhận sau → `409 ALREADY_ASSIGNED`.
6. Doctor chuyển bệnh nhân → `GET /doctor/colleagues` + `POST .../transfer`. Bác sĩ đích Nhận → `POST /doctor/transfers/{id}/accept`.
7. Doctor xem chi tiết 1 bệnh nhân của mình → FE gọi `GET /doctor/patients/{id}`.
8. (Tuỳ chọn) Doctor sửa ràng buộc lâm sàng → sang `specs/04-clinical-constraints.md`.

## 5. Edge cases
- Doctor thêm bệnh nhân bằng email đã tồn tại → `409 EMAIL_EXISTS` (dùng chung logic `specs/01`).
- `age` ngoài khoảng 0–130 ở `PUT /doctor/patients/{id}/profile` → `422 Validation Error`.
- Hai bác sĩ cùng claim một bệnh nhân chưa gắn → người sau `409 ALREADY_ASSIGNED`.
- Doctor gọi `GET /doctor/patients/{id}` với `id` không tồn tại, không phải patient, hoặc thuộc bác sĩ khác → `404 PATIENT_NOT_FOUND`.
- Chuyển cho chính mình → `400 INVALID_TRANSFER`. `to_doctor_id` không phải doctor → `404 DOCTOR_NOT_FOUND`.
- Accept transfer không phải đích / không còn pending → `404 TRANSFER_NOT_FOUND` hoặc `409 TRANSFER_NOT_PENDING`.
- Doctor sửa `PUT /doctor/patients/{id}/profile` nhưng gửi cả `target_kcal` trong body → field đó bị **Pydantic ignore**.

## 6. Ngoài phạm vi (Out of scope)
- Bệnh nhân tự chọn bác sĩ từ danh bạ.
- Unclaim / trả bệnh nhân về hàng chờ.
- Đồng quản lý nhiều bác sĩ trên một bệnh nhân.
- Role admin gán hộ.
- Xoá bệnh nhân khỏi hệ thống — endpoint `DELETE` vẫn chỉ bác sĩ đang quản lý mới gọi được.
- Ràng buộc lâm sàng (`target_kcal`/`restrictions`) — xem `specs/04`.

## 7. Schema tham chiếu
- `DoctorPatientSummary`, `DoctorPatientUpdate`, `MetricsUpdateRequest`, `GoalsUpdateRequest`, `ClaimQueueItem`, `DoctorColleague`, `TransferOut` — `contracts/api-v1.md` §8.

## 8. API liên quan
| Method | Path | Role |
|---|---|---|
| POST | `/auth/register` | Không cần auth — chỉ bệnh nhân tự đăng ký (không gắn) |
| GET | `/auth/me` | User đã đăng nhập — patient có `assigned_doctor` |
| POST | `/doctor/patients` | doctor — tạo hộ + gắn ngay |
| GET | `/doctor/patients` | doctor — chỉ bệnh nhân của mình |
| GET | `/doctor/patients/{patient_id}` | doctor (đang quản lý) |
| GET | `/doctor/claim-queue` | doctor |
| POST | `/doctor/patients/{patient_id}/claim` | doctor |
| GET | `/doctor/colleagues` | doctor |
| POST | `/doctor/patients/{patient_id}/transfer` | doctor (đang quản lý) |
| POST | `/doctor/transfers/{transfer_id}/accept` | doctor (đích) |
| PUT | `/doctor/patients/{patient_id}/profile` | doctor (đang quản lý) |
| PUT | `/doctor/patients/{patient_id}/metrics` | doctor (đang quản lý) |
| PUT | `/doctor/patients/{patient_id}/goals` | doctor (đang quản lý) |
| GET | `/doctor/catalog` | doctor |
| POST | `/doctor/patients/{patient_id}/avatar` | doctor (đang quản lý) |

## 9. Liên quan
- `specs/01-account-auth.md` — đăng ký công khai (patient tự tạo, không gắn).
- `specs/04-clinical-constraints.md` — phần ràng buộc lâm sàng tách riêng.
- `specs/12-patient-metrics-tracking.md` — chỉ số cơ thể (patient tự nhập vs doctor nhập hộ).
- `contracts/api-v1.md` §8 (Doctor Patient Management).
