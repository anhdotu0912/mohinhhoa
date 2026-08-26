# 02 — Onboarding & Profile

| | |
|---|---|
| **Spec** | [`specs/02-patient-profile-onboarding.md`](../../specs/02-patient-profile-onboarding.md) |
| **Contract** | [`contracts/api-v1.md`](../../contracts/api-v1.md) §2 |
| **Owner** | BE2 + FE |
| **Môi trường** | docker-compose + UI |

**Tài khoản:** patient mới (register) hoặc `demo_patient_1@example.com`.

**Surface UI:** `/patient/onboarding` (3 bước), `/patient/profile`, `POST /profile`.

---

## Happy path

| # | Việc | Bước | Kỳ vọng | Pass |
|---|---|---|---|:---:|
| 1 | Onboarding sau register | Login patient mới → redirect onboarding | Form nhiều bước; không crash | [ ] |
| 2 | Lưu hồ sơ | Điền disease, medications, allergies, mục tiêu → submit | `POST /profile` → redirect `/patient` | [ ] |
| 3 | Đọc hồ sơ | `GET /profile/me` (network hoặc profile page) | Khớp dữ liệu vừa nhập | [ ] |
| 4 | Preferences pattern | Nhập preference kiểu "không ăn thịt bò" / "ăn chay" | Lưu trong `preferences[]` | [ ] |
| 5 | Sửa hồ sơ sau onboarding | `/patient/profile` — SĐT, địa chỉ, treatment_goals | Cập nhật thành công | [ ] |

---

## Edge cases

| # | Việc | Bước | Kỳ vọng | Pass |
|---|---|---|---|:---:|
| 6 | BN sửa target_kcal | Profile/onboarding đổi calo hoặc restrictions | `constraints_status=pending_doctor_review`; giá trị **vẫn dùng ngay** | [ ] |
| 7 | Thiếu disease/medications | Lưu hồ sơ tối thiểu | Cho phép lưu; generate sau có thể kém an toàn (cảnh báo, không chặn profile) | [ ] |
| 8 | Doctor xem hồ sơ BN | `/doctor/patients/{id}` | Hiển thị disease, thuốc, allergies, goals | [ ] |

---

## Pytest đã có

- `test_profile_upsert_and_get` ([`test_api.py`](../../backend/tests/test_api.py))
- `test_constraints_status_pending_on_patient_edit` ([`test_constraints_and_adjustment.py`](../../backend/tests/test_constraints_and_adjustment.py))

**Gap tự động:** UI onboarding 3 bước; 5 preference pattern qua generate thực tế.

---

## Không phải bug / N/A

- `target_kcal` / `restrictions` doctor chỉ sửa qua tab **Ràng buộc** (`PUT .../constraints`), không qua `PUT .../profile` doctor.
