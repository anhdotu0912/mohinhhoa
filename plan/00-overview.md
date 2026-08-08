# Kế hoạch di chuyển code: fe_old/be_old → frontend/backend

## Bối cảnh
- Dự án `P-014` có `frontend/` và `backend/` là nguồn chuẩn (đúng convention, có CI, có tests).
- `fe_old` và `be_old` là code được **copy thủ công** từ các nhánh khác của team (không qua git merge), hiện nằm ở root repo.
- `fe_old` chủ yếu là **giao diện** (UI), có thể chưa nối API, cấu trúc không chuẩn.
- `be_old` chưa được phân tích — cần agent tự kiểm kê trước khi merge.
- Nhánh làm việc hiện tại được tạo từ `dev`. **Không merge trực tiếp vào `main` hoặc `dev`** cho đến khi qua review.
- Mục tiêu phụ: tái cấu trúc `frontend` thành 2 khu vực theo role — **bác sĩ** (`/doctor/*`) và **bệnh nhân** (`/patient/*`) — dùng chung components ở `components/ui` và `components/shared`.

## Nguyên tắc bắt buộc cho agent khi thực thi
1. **Không tự ý merge vào `main`/`dev`.** Chỉ làm việc trên nhánh migration (xem file `01-safety-setup.md`).
2. **Commit nhỏ, theo từng module.** Không gộp toàn bộ thay đổi vào 1 commit. Mỗi commit phải build/test được.
3. **Không ghi đè file khi trùng tên.** Luôn diff trước, merge nội dung thủ công, giải thích quyết định giữ/bỏ trong commit message.
4. **Chạy test sau mỗi cụm thay đổi** (`pytest` cho backend, `npm run build && npm run lint` cho frontend).
5. **Không xoá `fe_old`/`be_old`** cho đến khi hoàn thành Giai đoạn 6 (cleanup) và được xác nhận.
6. Nếu gặp xung đột logic không rõ nên giữ bản nào (fe_old/be_old vs frontend/backend hiện tại) → **dừng lại, ghi vào `MIGRATION_NOTES.md`, hỏi người dùng**, không tự quyết định.

## Trình tự thực hiện (đọc và làm theo đúng thứ tự các file)
| # | File | Nội dung |
|---|------|----------|
| 0 | `01-safety-setup.md` | Tạo backup, tag, nhánh migration |
| 1 | `02-inventory.md` | Kiểm kê fe_old/be_old, so sánh với frontend/backend hiện tại |
| 2 | `03-backend-migration.md` | Di chuyển be_old → backend |
| 3 | `04-frontend-restructure.md` | Tái cấu trúc frontend theo doctor/patient |
| 4 | `05-frontend-merge.md` | Di chuyển fe_old → cấu trúc frontend mới |
| 5 | `06-validation.md` | Test toàn diện |
| 6 | `07-cleanup.md` | Dọn dẹp, xoá fe_old/be_old, chuẩn bị PR |

## Output bắt buộc trong suốt quá trình
Agent phải duy trì file `MIGRATION_NOTES.md` ở root repo, log lại:
- Quyết định merge khi có xung đột (giữ bản nào, vì sao)
- File nào bị bỏ (không di chuyển) và lý do
- Vấn đề cần người dùng xác nhận

File này sẽ dùng làm changelog cho PR cuối cùng.
