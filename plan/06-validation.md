# Giai đoạn 5 — Validate toàn diện

Mục tiêu: đảm bảo hệ thống hoạt động đúng sau toàn bộ quá trình migrate, trước khi dọn dẹp và tạo PR.

## Việc cần làm

- [ ] Backend — chạy full test suite:
  ```bash
  cd backend && python -m pytest tests -v
  ```
  Tất cả phải pass. Nếu có test fail do thiếu fixture/data từ be_old, bổ sung.

- [ ] Frontend — build + lint:
  ```bash
  cd frontend && npm run build && npm run lint
  ```

- [ ] Tích hợp — chạy thử toàn bộ hệ thống qua docker-compose:
  ```bash
  docker-compose up --build
  ```
  Kiểm tra backend healthy, frontend load được, không lỗi console nghiêm trọng.

- [ ] Test luồng chính thủ công (hoặc scripted nếu có thể):
  - [ ] Đăng nhập với tài khoản role bệnh nhân → redirect đúng `/patient/dashboard`.
  - [ ] Đăng nhập với tài khoản role bác sĩ → redirect đúng `/doctor/dashboard`.
  - [ ] Bệnh nhân không truy cập được route `/doctor/*` (guard hoạt động).
  - [ ] Bác sĩ không bị chặn nhầm khỏi `/doctor/*`.
  - [ ] Các màn hình migrate từ fe_old (food-log, meal-plan, dietitian, patients) load được data thật từ backend, không còn mock data sót lại.
  - [ ] Các endpoint migrate từ be_old được gọi đúng và trả dữ liệu hợp lệ.

- [ ] Kiểm tra lại `MIGRATION_NOTES.md`:
  - [ ] Không còn mục nào đánh dấu "cần hỏi người dùng" mà chưa có câu trả lời.
  - [ ] Danh sách "API còn thiếu" (nếu có từ Giai đoạn 4) đã được xử lý hoặc chuyển thành task riêng.

- [ ] Chạy CI cục bộ nếu có thể mô phỏng (`.github/workflows/ci.yml`) hoặc push nhánh migration lên remote để CI thật chạy:
  ```bash
  git push origin migration/fe-be-consolidation
  ```
  Kiểm tra kết quả CI trên GitHub.

## Điều kiện để chuyển sang giai đoạn tiếp theo
- Toàn bộ checklist trên đều pass hoặc có ghi chú rõ ràng lý do skip.
- CI trên nhánh `migration/fe-be-consolidation` xanh (hoặc lỗi đã biết và không liên quan đến migration).

→ Tiếp tục với `07-cleanup.md`.
