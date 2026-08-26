# 10 — Doctor compliance view

| | |
|---|---|
| **Spec** | [`specs/10-doctor-compliance-view.md`](../../specs/10-doctor-compliance-view.md) |
| **Contract** | [`contracts/api-v1.md`](../../contracts/api-v1.md) §10 |
| **Owner** | BE2 + FE |
| **Môi trường** | docker-compose; có food log + notification done/check-in |

**Tài khoản:** `demo_doctor@example.com` → BN A.

**Surface UI:** `/doctor/patients/{id}/compliance`. Redirect cũ `/doctor/patients/compliance` → dashboard.

---

## Happy path

| # | Việc | Bước | Kỳ vọng | Pass |
|---|---|---|---|:---:|
| 1 | Xem compliance | Tab Tuân thủ trên chart BN | `GET .../compliance?days=14` load chart | [ ] |
| 2 | daily_series | Biểu đồ theo ngày | Ngày không check-in → `adherence_pct: null` | [ ] |
| 3 | overall_adherence_pct | Tổng tuần | Số hợp lý sau khi mark notification done | [ ] |
| 4 | Food log trong aggregation | Có log as_planned | Phản ánh trong compliance events | [ ] |
| 5 | Gửi nhắc | Nút "Gửi nhắc nhở" | `POST .../compliance/remind` → `manual_reminder` BN thấy | [ ] |
| 6 | BN self view | Patient `GET /compliance/me` (dock Chỉ số) | **Cùng số** với doctor view | [ ] |

---

## Edge cases

| # | Việc | Bước | Kỳ vọng | Pass |
|---|---|---|---|:---:|
| 7 | Ngưỡng thấp | adherence < **50%** (default config) | Badge/cảnh báo tuân thủ thấp (không nhầm 60%) | [ ] |
| 8 | Alert events | BN có alert Nguy hiểm/Cần chú ý | Hiện trong compliance events | [ ] |
| 9 | Patient forbidden | Patient gọi doctor compliance endpoint | Forbidden | [ ] |
| 10 | Patient not found | Doctor compliance BN không tồn tại | `404` | [ ] |
| 11 | Empty | BN mới không log | Chart empty, không crash | [ ] |

---

## Pytest đã có

- [`test_doctor_compliance.py`](../../backend/tests/test_doctor_compliance.py)

**Gap tự động:** Dashboard `/doctor` có thể dùng mock `THIS_WEEK_DATA`.

---

## Không phải bug / N/A

- Doctor không có trang food-log chi tiết từng bữa — tuân thủ suy từ check-in + log.
- Bảng summary riêng — không có (on-the-fly ADR-008).
