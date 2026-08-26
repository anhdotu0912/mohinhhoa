# 03 — Doctor patient management

| | |
|---|---|
| **Spec** | [`specs/03-doctor-patient-management.md`](../../specs/03-doctor-patient-management.md) |
| **Contract** | [`contracts/api-v1.md`](../../contracts/api-v1.md) §8 |
| **Owner** | BE2 + FE |
| **Môi trường** | docker-compose + UI |

**Tài khoản:** `demo_doctor@example.com`; BN A/B/C.

**Surface UI:** `/doctor`, `/doctor/patients`, `/doctor/patients/{id}`, `/doctor/patients/{id}/meals`.

---

## Happy path

| # | Việc | Bước | Kỳ vọng | Pass |
|---|---|---|---|:---:|
| 1 | Danh sách BN | `/doctor/patients` | Hiện demo_patient_1/2/3; tên, trạng thái plan | [ ] |
| 2 | Thêm BN | Form thêm → register + `PUT .../profile` | BN mới trong list; **không** có `POST /doctor/patients` | [ ] |
| 3 | Chi tiết BN | Click BN → overview | Disease, thuốc, BMI, goals | [ ] |
| 4 | Sửa profile BN | Chart → sửa tuổi, SĐT, medications | `PUT /doctor/patients/{id}/profile` thành công | [ ] |
| 5 | Cập nhật goals | Tab/mục goals | `PUT .../goals` | [ ] |
| 6 | Cập nhật metrics BS | Nhập cân + cao trên chart | Snapshot profile + append history | [ ] |
| 7 | Catalog | Màn có dropdown chẩn đoán/thuốc | `GET /doctor/catalog` populate | [ ] |
| 8 | Tra cứu món | Generate/review có search món | `GET /doctor/foods?q=...` | [ ] |
| 9 | Danh sách plan BN | `/doctor/patients/{id}/meals` | List plan theo BN | [ ] |
| 10 | Xóa plan | Doctor xóa 1 plan pending/rejected | `DELETE /doctor/meal-plans/{id}` | [ ] |
| 11 | Xóa BN | Xóa BN test (cẩn thận env) | `DELETE /doctor/patients/{id}` cascade | [ ] |

---

## Edge cases

| # | Việc | Bước | Kỳ vọng | Pass |
|---|---|---|---|:---:|
| 12 | Metrics thiếu cặp | `PUT .../metrics` chỉ weight, không height | `400 METRICS_INCOMPLETE` | [ ] |
| 13 | Filter danh sách | Search `q`, filter plan_usage / meal_plan_request | Kết quả khớp API | [ ] |
| 14 | Patient không vào doctor API | Login patient gọi `/doctor/patients` | `403` / role guard | [ ] |
| 15 | Age validation doctor profile | `age` > 130 hoặc < 0 | `422` validation | [ ] |

---

## Pytest đã có

- [`test_api.py`](../../backend/tests/test_api.py): list, detail, goals, profile, metrics, catalog
- [`test_doctor_review.py`](../../backend/tests/test_doctor_review.py): delete plan/patient

**Gap tự động:** filter UI đầy đủ; dashboard `/doctor` mock chart.

---

## Không phải bug / N/A

- `POST /doctor/patients` — không tồn tại (by design).
- `/doctor/messages` redirect — không có backend messaging.
