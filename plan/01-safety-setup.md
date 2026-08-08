# Giai đoạn 0 — Thiết lập an toàn

Mục tiêu: đảm bảo có điểm rollback tức thời trước khi đụng vào bất kỳ file nào.

## Việc cần làm

- [ ] Kiểm tra đang ở đúng nhánh làm việc (tạo từ `dev`, không phải `main`/`dev`):
  ```bash
  git status
  git branch --show-current
  ```
  Nếu không chắc nhánh hiện tại an toàn, **dừng lại và hỏi người dùng**.

- [ ] Tag trạng thái hiện tại để rollback nhanh nếu cần:
  ```bash
  git tag pre-migration-backup
  ```

- [ ] Tạo nhánh riêng cho việc di chuyển, tách khỏi nhánh làm việc chính:
  ```bash
  git checkout -b migration/fe-be-consolidation
  ```

- [ ] Tạo file changelog cho toàn bộ quá trình:
  ```bash
  touch MIGRATION_NOTES.md
  echo "# Migration Notes: fe_old/be_old -> frontend/backend" > MIGRATION_NOTES.md
  echo "" >> MIGRATION_NOTES.md
  echo "Bắt đầu: $(date)" >> MIGRATION_NOTES.md
  git add MIGRATION_NOTES.md
  git commit -m "chore: khởi tạo migration notes"
  ```

- [ ] Xác nhận backend hiện tại chạy được test trước khi thay đổi (baseline):
  ```bash
  cd backend && python -m pytest tests -v || echo "BASELINE FAIL - ghi vào MIGRATION_NOTES.md trước khi tiếp tục"
  cd ..
  ```

- [ ] Xác nhận frontend hiện tại build được trước khi thay đổi (baseline):
  ```bash
  cd frontend && npm install && npm run build || echo "BASELINE FAIL - ghi vào MIGRATION_NOTES.md trước khi tiếp tục"
  cd ..
  ```

## Điều kiện để chuyển sang giai đoạn tiếp theo
- Đang ở nhánh `migration/fe-be-consolidation`.
- Có tag `pre-migration-backup`.
- Baseline test/build đã chạy (pass hoặc fail đã được ghi chú rõ trong `MIGRATION_NOTES.md`).

→ Tiếp tục với `02-inventory.md`.
