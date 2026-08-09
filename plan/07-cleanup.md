# Giai đoạn 6 — Dọn dẹp & Chuẩn bị PR

Chỉ thực hiện sau khi Giai đoạn 5 (validation) đã pass hoàn toàn.

## Việc cần làm

- [ ] Xoá `fe_old` và `be_old` khỏi repo:
  ```bash
  git rm -r fe_old be_old
  git commit -m "chore: remove fe_old/be_old sau khi hoàn tất migration"
  ```

- [ ] Dọn các file tạm sinh ra trong quá trình kiểm kê (giữ lại nếu muốn làm tài liệu tham khảo, hoặc xoá nếu không cần):
  ```bash
  # Tuỳ chọn: giữ lại làm changelog, hoặc dọn:
  # rm MIGRATION_fe_old_structure.md MIGRATION_be_old_structure.md
  # rm MIGRATION_frontend_structure.md MIGRATION_backend_structure.md
  # rm MIGRATION_fe_diff.txt MIGRATION_be_diff.txt
  ```
  Khuyến nghị: **giữ lại `MIGRATION_NOTES.md`** làm tài liệu lịch sử quyết định, có thể chuyển vào `docs/` thay vì xoá:
  ```bash
  mv MIGRATION_NOTES.md docs/migration-fe-be-old-2026.md
  git add docs/migration-fe-be-old-2026.md
  git commit -m "docs: lưu migration notes vào docs/"
  ```

- [ ] Cập nhật `docs/architecture_diagram.md` và/hoặc `ARCHITECTURE.md` nếu cấu trúc doctor/patient mới cần được phản ánh trong tài liệu kiến trúc.

- [ ] Cập nhật `docs/guide/architecture/system-design.md` nếu có mô tả cấu trúc frontend cũ.

- [ ] Rà lại toàn bộ commit trên nhánh `migration/fe-be-consolidation`, đảm bảo message rõ ràng, không có commit debug/rác.

- [ ] Push nhánh và chuẩn bị mở Pull Request:
  ```bash
  git push origin migration/fe-be-consolidation
  ```
  - **Target: `dev`** (không phải `main`).
  - Mô tả PR nên tóm tắt: số lượng file migrate, các quyết định merge quan trọng (tham chiếu `docs/migration-fe-be-old-2026.md`), và danh sách API còn thiếu (nếu có) như follow-up task.

- [ ] Thông báo cho người dùng để review PR trước khi merge — **không tự merge PR này**.

## Điều kiện hoàn thành
- `fe_old`/`be_old` đã bị xoá khỏi working tree trên nhánh migration.
- PR đã được tạo, target `dev`, có mô tả đầy đủ.
- Người dùng đã được thông báo để review.
