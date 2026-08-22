# Spec: Đăng ký, Đăng nhập & Liên hệ

## Status
Done — đăng ký/đăng nhập, quên mật khẩu gửi SMTP, và rate-limit login/register/forgot-password đều as-built (`services/login_rate_limit.py`). Luồng liên hệ chưa có API, xem §6.

## 1. Mục tiêu (Why)
Mọi actor (bác sĩ, bệnh nhân) cần một danh tính xác thực để hệ thống phân quyền đúng (patient chỉ thấy dữ liệu của mình, doctor thấy hàng đợi bệnh nhân) và để bác sĩ có thể tạo tài khoản hộ bệnh nhân khi onboarding tại phòng khám.

## 2. User story
- Là **bệnh nhân**, tôi muốn tự đăng ký tài khoản bằng email/mật khẩu, để tôi có thể đăng nhập và dùng app.
- Là **bác sĩ**, tôi muốn tạo tài khoản hộ cho bệnh nhân mới (dùng chung API đăng ký, chỉ đổi `role`), để không cần bệnh nhân tự làm thao tác kỹ thuật này.
- Là **Chung** (chưa đăng nhập), tôi muốn đăng nhập bằng email/mật khẩu để nhận JWT dùng cho các request tiếp theo.

## 3. Business rules
1. Email là khoá duy nhất toàn hệ thống (không phân biệt theo `role`) — trùng email ở `POST /auth/register` trả `409 EMAIL_EXISTS`, không phân biệt email đó thuộc role nào.
2. `role` ∈ `{"patient","doctor"}`, default `"patient"` nếu không gửi. Không có role thứ 3 nào được API chấp nhận (kể cả nếu DB có role cũ `dietitian` — bị migrate tự động sang `doctor` khi khởi động server, xem `db/init_db.py::_migrate_legacy_dietitian`).
3. `full_name` optional ở bước đăng ký — cho phép doctor tạo tài khoản hộ patient chỉ với email tạm, chưa cần biết họ tên đầy đủ ngay (bổ sung sau qua `PUT /doctor/patients/{id}/profile`, xem `specs/03-doctor-patient-management.md`).
4. Mật khẩu hash bằng bcrypt (`passlib.CryptContext`), không lưu plaintext, không log ra ngoài.
5. JWT payload gồm `sub=user_id`, `role`, `iat`, `exp` (mặc định 1440 phút = 24h, `JWT_EXPIRE_MINUTES`). Không có refresh token — hết hạn phải đăng nhập lại.
6. Đăng ký/đăng nhập **không** cần thông tin bệnh lý (`PatientProfile` tách biệt hoàn toàn, tạo sau qua `POST /profile` — xem `specs/02-patient-profile-onboarding.md`).

## 4. Luồng chính (happy path)

**Patient tự đăng ký:**
1. FE gọi `POST /auth/register` với `role="patient"`.
2. FE gọi `POST /auth/login` → nhận `access_token`.
3. FE lưu token, redirect sang onboarding hồ sơ (`specs/02`).

**Doctor tạo hộ tài khoản patient:**
1. Doctor đã đăng nhập (có token riêng của doctor).
2. FE (màn hình "Thêm bệnh nhân") gọi `POST /auth/register` với `role="patient"`, `full_name` (nếu có) — **không cần** token của doctor cho request này (endpoint không yêu cầu auth), chỉ cần biết email/password tạm cho bệnh nhân.
3. Doctor tiếp tục bổ sung thông tin lâm sàng qua `PUT /doctor/patients/{id}/profile` (`specs/03`).

## 5. Edge cases
- Đăng ký với email đã tồn tại (dù role khác) → `409 EMAIL_EXISTS`.
- Đăng nhập sai email/mật khẩu → `401 INVALID_CREDENTIALS` (không phân biệt "email không tồn tại" vs "sai mật khẩu" — tránh lộ thông tin tồn tại email).
- Token hết hạn hoặc sai chữ ký → `401 INVALID_TOKEN` ở bất kỳ endpoint cần auth.
- Token hợp lệ nhưng `user_id` đã bị xoá khỏi DB (không có API xoá user as-built, chỉ là edge case lý thuyết) → `401 USER_NOT_FOUND`.
- **As-built (2026-08-18, xác nhận lại 2026-08-22):** 2 hạng mục dưới đây — bắt buộc trước khi mở khảo sát người dùng thật (≥5 responses, `CLAUDE.md` Mục 11) — đã implement:
  1. **Rate-limit `POST /auth/login`/`register`/`forgot-password`** (`services/login_rate_limit.py`, dùng trong `routes_auth.py`) — tối đa 5 lần thử sai/15 phút theo `email`+IP, vượt ngưỡng trả `429 TOO_MANY_ATTEMPTS`.
  2. **Luồng quên mật khẩu** — `POST /auth/forgot-password` tạo mật khẩu tạm, gửi qua SMTP tới email đã đăng ký, rồi mới ghi đè hash. Response luôn `200` nếu SMTP đã cấu hình, bất kể email có tồn tại hay không, để không lộ thông tin email đã đăng ký. Thiếu SMTP → `503 EMAIL_NOT_CONFIGURED`; gửi thất bại → `500 EMAIL_SEND_FAILED` (mật khẩu cũ giữ nguyên). `POST /auth/reset-password` vẫn còn (token) nhưng không còn là luồng chính.

## 6. Ngoài phạm vi (Out of scope)
- **Luồng liên hệ (contact):** không có endpoint backend nào cho "liên hệ hỗ trợ". Nếu FE có trang liên hệ, đó là trang tĩnh không gọi API — **Status: Planned/Out of scope**, không nằm trong North Star demo.
- Đa ngôn ngữ (chỉ tiếng Việt) — Won't Have theo `CLAUDE.md`.
- OAuth/SSO (Google/Facebook login) — không có, chỉ email/password.
- Đổi mật khẩu, đổi email tự-phục vụ cho patient (doctor đổi được email hộ patient qua `PUT /doctor/patients/{id}/profile`, patient tự đổi email của mình thì chưa có endpoint).

## 7. Schema tham chiếu
- `RegisterRequest`/`RegisterResponse`/`LoginRequest`/`TokenResponse` — xem `backend/app/schemas/auth.py`; chi tiết field trong `contracts/api-v1.md` §1.
- `User.role` enum — xem bảng Enum tham chiếu cuối `contracts/api-v1.md`.

## 8. API liên quan
| Method | Path | Role |
|---|---|---|
| POST | `/auth/register` | Không cần auth |
| POST | `/auth/login` | Không cần auth |
| POST | `/auth/forgot-password` | Không cần auth |
| POST | `/auth/reset-password` | Không cần auth |

## 9. Liên quan
- `specs/02-patient-profile-onboarding.md` — bước tiếp theo sau đăng ký patient.
- `specs/03-doctor-patient-management.md` — doctor dùng lại `/auth/register` để thêm bệnh nhân.
- `contracts/api-v1.md` §1 (Auth).
