# 09 — Food log (ADR-009)

| | |
|---|---|
| **Spec** | [`specs/09-food-log-adherence.md`](../../specs/09-food-log-adherence.md) |
| **Contract** | [`contracts/api-v1.md`](../../contracts/api-v1.md) §12 |
| **Owner** | BE2 + FE |
| **Môi trường** | docker-compose; plan đã apply |

**Tài khoản:** `demo_patient_1@example.com`.

**Surface UI:** `/patient` dock **Thực đơn & Nhật ký** (`MealLogPanel`). **Không** test `/patient/meals` (đã gỡ).

---

## Happy path

| # | Việc | Bước | Kỳ vọng | Pass |
|---|---|---|---|:---:|
| 1 | Log as_planned | Chọn slot sáng/trưa/tối → "theo kế hoạch" | `POST /food-log` thành công | [ ] |
| 2 | Log custom + note | Custom + ghi chú bắt buộc | Lưu được; note hiển thị | [ ] |
| 3 | List theo ngày | Xem log ngày hôm nay | `GET /food-log?date=...` khớp UI | [ ] |
| 4 | Upsert cùng slot | Ghi lại cùng slot cùng ngày VN | Ghi đè, không duplicate | [ ] |
| 5 | Chat food_log | "tôi đã ăn gì gần đây?" | Intent `food_log`; tóm tắt 3 log gần nhất (**không** tạo log mới) | [ ] |

---

## Edge cases

| # | Việc | Bước | Kỳ vọng | Pass |
|---|---|---|---|:---:|
| 6 | Custom thiếu note | Custom không note | `400` validation | [ ] |
| 7 | Ngày VN vs UTC | Log lúc ~23:30–00:30 (biên ngày) | Thuộc đúng ngày lịch **Asia/Ho_Chi_Minh** | [ ] |
| 8 | Plan foreign | Gửi meal_plan_id không thuộc patient | `403`/reject | [ ] |
| 9 | Custom + interaction | Note khớp cặp nguy hiểm | Alert tạo (xem checklist 08) | [ ] |

---

## Pytest đã có

- [`test_food_log.py`](../../backend/tests/test_food_log.py)
- [`test_datetime_vn.py`](../../backend/tests/test_datetime_vn.py)

**Gap tự động:** UI 3 slot trên dock; biên đêm VN cần test tay.

---

## Không phải bug / N/A

- NLP parse tự do / nhận diện ảnh món — Won't Have (ADR-009).
