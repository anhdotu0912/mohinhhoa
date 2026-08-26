# Template ghi bug

Copy block dưới vào issue tracker / sheet QA. Mỗi bug P0/P1 nên có link tới checklist và (nếu có) test hồi quy.

---

## [Tiêu đề ngắn — hành vi sai]

| Field | Giá trị |
|---|---|
| **Mức độ** | P0 / P1 / P2 |
| **Role** | patient / doctor / cả hai / không cần login |
| **Route / màn hình** | Ví dụ: `/patient`, dock Thực đơn, `/doctor/reviews/{pid}/{planId}` |
| **Spec liên quan** | Ví dụ: `specs/06-meal-plan-review.md`, checklist `tasks/test/06-meal-plan-review.md` |
| **Owner gợi ý** | BE1 / BE2 / FE |
| **Ngày phát hiện** | YYYY-MM-DD |
| **Người test** | |
| **Môi trường** | docker-compose / dev local / pytest only |
| **Tài khoản** | Ví dụ: `demo_patient_1@example.com` |

### Bước reproduce

1.
2.
3.

### Kỳ vọng

(Mô tả hành vi đúng theo spec / contract)

### Thực tế

(Mô tả hành vi sai — crash, sai dữ liệu, UI trắng, …)

### API (nếu có)

- Request: `METHOD /api/v1/...`
- Response: status `___`, body/code `___`
- Network tab / curl:

```bash
# paste curl nếu cần
```

### Screenshot / recording

(Đính kèm hoặc link)

### Pytest hiện có?

- [ ] Có test liên quan (ghi tên file::test_...)
- [ ] Chưa có — cần thêm test hồi quy sau khi fix

### Ghi chú thêm

(Regression từ commit nào, liên quan bug khác, workaround tạm, …)

---

## Quy ước mức độ

| Mức | Định nghĩa | Ví dụ |
|---|---|---|
| **P0** | Chặn North Star / crash / 500 trên luồng demo | Không login, generate fail, apply không materialize reminder |
| **P1** | Sai dữ liệu, sai timezone VN, intent chat sai, dock không sync | Compliance BN ≠ bác sĩ, food log ngày sai |
| **P2** | UX/copy, mock dashboard, lint | Badge màu, mock `/doctor` chart |

## Không mở ticket (known limitation)

Ghi **N/A** thay vì bug — xem mục "Không phải bug" trong từng checklist `0x-*.md` và [`../roadmap-mvp.md`](../roadmap-mvp.md):

- FE chưa nút `request-adjustment` (BE Done)
- Dashboard `/doctor` còn mock một phần
- `/doctor/messages` redirect — không có backend
- Chat intent `meal_plan` read-only — không persist plan mới
- Đi chợ / PDF / messaging — Could Have
