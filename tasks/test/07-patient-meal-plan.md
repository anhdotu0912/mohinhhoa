# 07 — Patient meal plan view

| | |
|---|---|
| **Spec** | [`specs/07-patient-meal-plan-view.md`](../../specs/07-patient-meal-plan-view.md) |
| **Contract** | [`contracts/api-v1.md`](../../contracts/api-v1.md) §4 |
| **Owner** | BE2 + FE |
| **Môi trường** | docker-compose; cần plan đã **apply** (checklist 06) |

**Tài khoản:** `demo_patient_1@example.com`.

**Surface UI:** `/patient` dock **Thực đơn & Nhật ký**; card chat meal preview. **Không** dùng `/patient/meals` (route đã gỡ).

---

## Happy path

| # | Việc | Bước | Kỳ vọng | Pass |
|---|---|---|---|:---:|
| 1 | Xem plan đang apply | Dock Thực đơn | Món theo ngày/slot; khớp `GET /meal-plans/me` | [ ] |
| 2 | Lịch tuần | Network `GET /meal-plans/schedule` hoặc UI lịch | Schema schedule ADR-012 | [ ] |
| 3 | Chi tiết plan | `GET /meal-plans/{id}` | swaps, citations, status | [ ] |
| 4 | Badge swap | Món bị đổi do interaction | Hiện món gốc, severity, món thay | [ ] |
| 5 | Yêu cầu tạo TD | Khi không có plan apply / hết hạn | `POST /meal-plans/request` | [ ] |
| 6 | Trạng thái request | `GET /meal-plans/request` | Phản ánh pending/none | [ ] |
| 7 | Chat read-only meal | "hôm nay ăn gì?" trên `/patient` | Card preview; **không** tạo plan DB mới | [ ] |

---

## Edge cases

| # | Việc | Bước | Kỳ vọng | Pass |
|---|---|---|---|:---:|
| 8 | Plan hết hạn | Plan active sắp hết / đã hết (hoặc demo expiry API) | `GET /meal-plans/me` materialize `plan_expiring` / `plan_expired` idempotent | [ ] |
| 9 | Chưa có plan | Patient chưa từng apply | Hướng dẫn yêu cầu TD; chat không hallucinate plan | [ ] |
| 10 | Plan not found | `GET` id không tồn tại | `404` | [ ] |

---

## Pytest đã có

- [`test_meal_plan_request.py`](../../backend/tests/test_meal_plan_request.py)
- [`test_plan_expiry.py`](../../backend/tests/test_plan_expiry.py)
- [`test_meal_preview.py`](../../backend/tests/test_meal_preview.py)
- `test_request_adjustment` ([`test_constraints_and_adjustment.py`](../../backend/tests/test_constraints_and_adjustment.py)) — API only

**Gap tự động:** Dock UI; nút request-adjustment FE.

---

## Không phải bug / N/A

- Nút **"Yêu cầu điều chỉnh"** trên UI BN — BE Done, FE chưa gắn (`POST .../request-adjustment`).
- Danh sách đi chợ / gợi ý khu vực / Export PDF — Could Have.
