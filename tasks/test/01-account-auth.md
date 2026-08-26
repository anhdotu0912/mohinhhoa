# 01 — Account & Auth

| | |
|---|---|
| **Spec** | [`specs/01-account-auth.md`](../../specs/01-account-auth.md) |
| **Contract** | [`contracts/api-v1.md`](../../contracts/api-v1.md) §1 |
| **Owner** | BE2 + FE |
| **Môi trường** | docker-compose + UI; pytest tham chiếu SQLite |

**Tài khoản:** tạo mới qua `/register` hoặc demo `demo_patient_1@example.com` / `demo1234`.

**Surface UI:** `/login`, `/register`, `/forgot-password`, `/reset-password`, `/` (landing — liên hệ tĩnh).

---

## Happy path

| # | Việc | Bước | Kỳ vọng | Pass |
|---|---|---|---|:---:|
| 1 | Đăng ký patient | `/register` — email mới, mật khẩu, họ tên | `201`; redirect/login được; role `patient` | [ ] |
| 2 | Đăng nhập patient | `/login` | JWT; vào `/patient` hoặc onboarding | [ ] |
| 3 | Đăng nhập doctor | `demo_doctor@example.com` | Vào `/doctor` | [ ] |
| 4 | Auth me | Sau login, mở profile hoặc network `GET /auth/me` | Trả đúng email, role, full_name | [ ] |
| 5 | Doctor thêm BN | `/doctor/patients` → Thêm BN → register email mới | BN xuất hiện trong danh sách | [ ] |
| 6 | Upload avatar BN | `/patient/profile` → chọn ảnh ≤ 2MB | `POST /auth/me/avatar` thành công; ảnh hiển thị | [ ] |
| 7 | Doctor upload avatar hộ BN | Chart BN → upload | `POST /doctor/patients/{id}/avatar` | [ ] |

---

## Edge cases

| # | Việc | Bước | Kỳ vọng | Pass |
|---|---|---|---|:---:|
| 8 | Email trùng | Register lại email đã có | `409 EMAIL_EXISTS` | [ ] |
| 9 | Sai mật khẩu | Login password sai | `401 INVALID_CREDENTIALS` | [ ] |
| 10 | Register role doctor (public) | Register gửi `role: doctor` | Vẫn tạo **patient** (role bị ignore) | [ ] |
| 11 | Request không token | Gọi API cần auth không header | `401` | [ ] |
| 12 | Quên mật khẩu | `/forgot-password` email hợp lệ | Luôn `200` (không lộ email tồn tại); SMTP cấu hình thì gửi mail | [ ] |
| 13 | Reset token invalid | `/reset-password` token sai | Lỗi hợp lệ, không đổi mật khẩu | [ ] |
| 14 | Rate-limit login | 6 lần sai liên tiếp cùng email/IP | Lần 6+: `429 TOO_MANY_ATTEMPTS` | [ ] |

---

## Pytest đã có

- [`test_api.py`](../../backend/tests/test_api.py): register, login, auth_me, avatar
- [`test_auth_and_polish.py`](../../backend/tests/test_auth_and_polish.py): forgot/reset password

**Gap tự động:** rate-limit `429` HTTP; FE forgot-password end-to-end.

---

## Không phải bug / N/A

- Landing `/` form liên hệ — không có API.
- OAuth / refresh token — out of scope.
- Patient tự đổi email — chưa có endpoint.
