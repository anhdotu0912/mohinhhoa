# Giai đoạn 4 — Di chuyển fe_old vào cấu trúc Frontend mới

Thực hiện sau khi `frontend/` đã có khung sườn doctor/patient (Giai đoạn 3). fe_old được mô tả là "chỉ có giao diện, cấu trúc không chuẩn" → giả định nhiều màn hình chưa nối API thật, có thể dùng mock data.

## Việc cần làm

- [ ] Với mỗi màn hình trong `fe_old` (dựa theo bảng phân loại đã lập ở `02-inventory.md`):
  1. Xác định thuộc `doctor`, `patient`, hay `shared`.
  2. Xác định xem `frontend/` (sau tái cấu trúc) đã có page/component tương đương chưa:
     - **Chưa có** → đây là màn hình mới, copy JSX/UI vào đúng thư mục (`app/doctor/...`, `app/patient/...`, hoặc `components/...`).
     - **Đã có** → so sánh UI, quyết định giữ bản nào đẹp/đầy đủ hơn, hoặc merge phần UI mới vào bản hiện tại. Ghi quyết định vào `MIGRATION_NOTES.md`.

- [ ] Khi copy 1 màn hình từ fe_old:
  - **KHÔNG** copy nguyên state/data-fetching logic cũ nếu `frontend` đã có `lib/api.ts` và `store/` chuẩn hơn.
  - Chỉ lấy phần JSX/UI/styling, sau đó nối lại với API call qua `lib/api.ts` và state qua store hiện có.
  - Nếu màn hình đang dùng mock data trong fe_old, thay bằng gọi API thật tương ứng (tham chiếu `backend/app/api/v1/routes_*.py` để biết endpoint đúng — bao gồm cả các route vừa migrate ở Giai đoạn 2).

- [ ] Với component UI (`components/ui` trong fe_old nếu có):
  - Mặc định **giữ bộ UI đang dùng trong `frontend/components/ui`** để tránh 2 design system song song.
  - Nếu fe_old có component UI mà `frontend/components/ui` chưa có (ví dụ 1 loại chart, 1 loại modal đặc thù), bổ sung riêng component đó theo đúng convention/style hiện có, không copy nguyên khối.

- [ ] Kiểm tra kỹ styling/CSS: nếu fe_old dùng cách styling khác (ví dụ CSS module khác Tailwind config hiện tại), chuẩn hoá lại theo cách frontend hiện tại đang dùng — tham khảo `frontend-design` skill nếu cần đảm bảo tính nhất quán thị giác.

- [ ] Sau mỗi 2-3 màn hình migrate xong:
  ```bash
  cd frontend && npm run build
  ```
  Bắt lỗi type/import sớm, không dồn đến cuối.

- [ ] Commit theo từng màn hình hoặc từng cụm màn hình liên quan (ví dụ: toàn bộ màn hình `doctor/patients/*` trong 1 commit).

- [ ] Ghi vào `MIGRATION_NOTES.md` danh sách màn hình đã migrate, màn hình nào còn thiếu API backend tương ứng (cần backend team bổ sung route) — đây là input quan trọng cho phần chưa xong.

## Điều kiện để chuyển sang giai đoạn tiếp theo
- Toàn bộ màn hình trong bảng phân loại NEW/CONFLICT của fe_old đã được xử lý.
- `npm run build` pass sau khi merge xong toàn bộ.
- Danh sách "API còn thiếu" (nếu có) đã được ghi rõ trong `MIGRATION_NOTES.md`.

→ Tiếp tục với `06-validation.md`.
