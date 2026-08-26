# 04 — Clinical constraints (HITL)

| | |
|---|---|
| **Spec** | [`specs/04-clinical-constraints.md`](../../specs/04-clinical-constraints.md) |
| **Contract** | [`contracts/api-v1.md`](../../contracts/api-v1.md) §3 |
| **Owner** | BE2 + FE |
| **Môi trường** | docker-compose + UI |

**Tài khoản:** `demo_doctor@example.com` + `demo_patient_1@example.com`.

**Surface UI:** `/doctor/patients/{id}/constraints`, `/doctor/inbox` (filter `constraints`).

---

## Happy path

| # | Việc | Bước | Kỳ vọng | Pass |
|---|---|---|---|:---:|
| 1 | Xem ràng buộc | Tab Ràng buộc trên chart BN | Hiện target_kcal, muối (`salt_daily_g`), đường (`sugar_daily_g`) | [ ] |
| 2 | Doctor sửa ràng buộc | Đổi calo/muối/đường → Lưu | `PUT /doctor/patients/{id}/constraints`; `constraints_status=confirmed` | [ ] |
| 3 | BN tự sửa calo | Login patient → đổi target_kcal qua profile | `constraints_status=pending_doctor_review` | [ ] |
| 4 | Badge chờ xác nhận | Doctor mở constraints sau bước 3 | Badge "Chờ bác sĩ xác nhận" + nút Xác nhận | [ ] |
| 5 | Doctor approve HITL | Bấm Xác nhận | `POST .../constraints/approve` → `confirmed` | [ ] |
| 6 | Generate sau khi đổi | Generate plan mới cho BN | Planner dùng ràng buộc mới (calo/muối) | [ ] |

---

## Edge cases

| # | Việc | Bước | Kỳ vọng | Pass |
|---|---|---|---|:---:|
| 7 | Approve khi đã confirmed | Gọi approve khi không pending | `400 NOTHING_TO_APPROVE` | [ ] |
| 8 | Giá trị pending vẫn hiệu lực | Sau bước 3, generate trước khi approve | Plan vẫn dùng kcal BN vừa sửa | [ ] |
| 9 | Inbox constraints | `/doctor/inbox` filter | Hiện BN pending_doctor_review | [ ] |

---

## Pytest đã có

- [`test_constraints_and_adjustment.py`](../../backend/tests/test_constraints_and_adjustment.py)

**Gap tự động:** UI badge/nút; ghi chú lâm sàng local state.

---

## Không phải bug / N/A

- `protein_daily_g` — Won't Have, không có trên form doctor.
- Ghi chú lâm sàng (`INITIAL_NOTES`) — **chưa persist API** (local state FE).
