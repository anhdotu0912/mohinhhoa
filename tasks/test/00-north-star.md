# 00 — North Star smoke (P0)

**Mục tiêu:** Luồng demo end-to-end phải chạy mượt không crash — khớp [`tasks/README.md`](../README.md) § North Star và [`docs/MO_TA_HE_THONG.md`](../../docs/MO_TA_HE_THONG.md).

**Môi trường:** `docker-compose up` (Postgres + Qdrant) + `npm run dev` + uvicorn. **Không** chỉ chạy pytest.

**Tài khoản:** `demo_patient_1@example.com` (BN A), `demo_doctor@example.com` / `demo1234`.

**Quy tắc dừng:** Fail **bước 1–5** → ghi bug **P0**, **dừng** — không chạy checklist `01`–`13` cho đến khi sửa.

**Lưu ý as-built:** Duyệt (`approve`) **không** tạo `meal_reminder` / `adherence_checkin`. Phải **`POST .../apply`** sau duyệt mới materialize nhắc.

---

## Checklist (10 bước)

| # | Việc | Bước thao tác | Kỳ vọng | Pass |
|---|---|---|---|:---:|
| 1 | BN đăng nhập + chat-home | Login `demo_patient_1@example.com` → `/patient` | Trang chat load; sidebar session; không crash | [ ] |
| 2 | BN yêu cầu thực đơn (nếu chưa có plan apply) | Dock Thực đơn hoặc luồng yêu cầu → `POST /meal-plans/request` (UI) | Trạng thái yêu cầu hiện; inbox BS có mục liên quan | [ ] |
| 3 | BS generate plan | Login doctor → `/doctor/inbox` hoặc `/doctor/patients/demo_patient_1/generate` → Generate | Plan `pending_review`; QueueDrawer hoàn tất; 7 ngày | [ ] |
| 4 | BS duyệt plan | Mở `/doctor/reviews/demo_patient_1/{planId}` → **Duyệt** | `status=approved`; có thông báo `plan_approved`; **chưa** có meal_reminder | [ ] |
| 5 | BS áp dụng tuần | Cùng flow hoặc tab Lịch sử → **Áp dụng** (`apply`, `replace_active` nếu cần) | Plan active; `starts_on`/`ends_on` set | [ ] |
| 6 | BN xem thực đơn | Dock **Thực đơn & Nhật ký** trên `/patient` | Thấy món theo ngày; badge swap nếu có | [ ] |
| 7 | BN ghi food log | Trong dock → 1 slot (`morning`/`noon`/`evening`) `as_planned` | Lưu thành công; hiện trên panel | [ ] |
| 8 | BN thông báo | Dock **Thông báo** | Có `meal_reminder` / `adherence_checkin` sau apply; read/dismiss/done hoạt động | [ ] |
| 9 | BN chat | Gửi "hôm nay tôi nên ăn gì?" và "tăng liều metformin" | Câu 1: meal/card hoặc hướng dẫn plan; câu 2: **refuse** / redirect bác sĩ | [ ] |
| 10 | BS xem tuân thủ | `/doctor/patients/demo_patient_1/compliance` | Biểu đồ load; có thể gửi nhắc `manual_reminder` | [ ] |

---

## Edge nhanh (nếu còn thời gian)

- [ ] Sau bước 4: xác nhận BN **không** thấy meal_reminder (chỉ sau bước 5).
- [ ] Reject plan khác (patient 2): notification `pending` gắn plan bị hủy.
- [ ] `GET /health` → `database` và `vector_store` ok.

---

## Pytest tương ứng

- [`backend/tests/test_api.py::test_north_star_flow`](../../backend/tests/test_api.py) — HTTP only, SQLite.
- Gap: không cover UI dock, SSE chat, Postgres.

---

## Không phải bug ở bước này

- Chat không **tạo mới** plan qua intent `meal_plan` (read-only).
- FE chưa nút request-adjustment.
- Dashboard `/doctor` có thể mock một phần — bước 10 dùng tab compliance riêng.
