# Giai đoạn 1 — Kiểm kê (Inventory)

Mục tiêu: hiểu rõ fe_old/be_old chứa gì, file nào mới, file nào trùng cần merge, trước khi di chuyển bất kỳ thứ gì.

## Việc cần làm

- [ ] Sinh cây thư mục của cả 4 thư mục liên quan:
  ```bash
  tree fe_old -I 'node_modules' > MIGRATION_fe_old_structure.md
  tree be_old -I '__pycache__|.venv|*.pyc' > MIGRATION_be_old_structure.md
  tree frontend -I 'node_modules|.next' > MIGRATION_frontend_structure.md
  tree backend -I '__pycache__|.venv|*.pyc' > MIGRATION_backend_structure.md
  ```

- [ ] So sánh danh sách file để tìm trùng lặp (nguy cơ xung đột) và file mới hoàn toàn:
  ```bash
  diff <(cd frontend && find . -type f | sort) <(cd fe_old && find . -type f | sort) > MIGRATION_fe_diff.txt
  diff <(cd backend && find . -type f | sort) <(cd be_old && find . -type f | sort) > MIGRATION_be_diff.txt
  ```

- [ ] Với `be_old`, xác định và ghi vào `MIGRATION_NOTES.md`:
  - Loại code chủ yếu: routes/API mới? services/business logic? models? scripts?
  - Có dependency nào trong `be_old` (import, package) chưa có trong `backend/requirements.txt` không? Liệt kê ra.
  - Có file `.env`/config/secret nào trong `be_old` cần xử lý cẩn thận (không commit secret) không?

- [ ] Với `fe_old`, xác định và ghi vào `MIGRATION_NOTES.md`:
  - Danh sách màn hình/page có trong `fe_old`, phân loại từng cái thuộc **bác sĩ**, **bệnh nhân**, hoặc **dùng chung** (ví dụ: trang chat có thể dùng chung).
  - Có bộ UI component riêng (design system) khác với `frontend/components/ui` không? Nếu có, quyết định giữ bộ nào (mặc định: giữ bộ đang dùng trong `frontend` để tránh 2 design system song song).
  - `fe_old` đã nối API thật chưa, hay đang dùng mock data? Ghi rõ.

- [ ] Với mỗi file trong 2 file diff (`MIGRATION_fe_diff.txt`, `MIGRATION_be_diff.txt`), phân loại vào 1 trong 3 nhóm và ghi thành bảng trong `MIGRATION_NOTES.md`:
  - **NEW** — chỉ có ở `*_old`, không có ở đích → di chuyển thẳng.
  - **CONFLICT** — trùng đường dẫn/tên ở cả 2 bên → cần merge thủ công, xem giai đoạn tương ứng.
  - **SKIP** — file rác, file thử nghiệm, file không còn liên quan (ví dụ file test tạm, file backup `.bak`) → không di chuyển, ghi rõ lý do.

- [ ] Commit kết quả kiểm kê:
  ```bash
  git add MIGRATION_*.md MIGRATION_*.txt
  git commit -m "docs: kiểm kê fe_old/be_old trước khi migration"
  ```

## Điều kiện để chuyển sang giai đoạn tiếp theo
- `MIGRATION_NOTES.md` có đầy đủ bảng phân loại NEW/CONFLICT/SKIP cho cả fe_old và be_old.
- Không còn ambiguity nào chưa được ghi chú (nếu có phần không chắc, đã hỏi người dùng và có câu trả lời).

→ Tiếp tục với `03-backend-migration.md`.
