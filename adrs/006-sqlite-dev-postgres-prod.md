# ADR-006: SQLite cho Dev, PostgreSQL cho Production

## Status
Accepted (target) — dev đang chạy SQLite, chưa migrate sang PostgreSQL.

## Context
Cần một DB setup nhanh cho dev/demo local (không cần cài đặt service riêng), nhưng production (deploy Railway) cần DB bền vững, hỗ trợ concurrent write tốt hơn SQLite.

## Decision
Dùng **SQLite** (file `app.db`) làm mặc định cho môi trường dev/local. **PostgreSQL** là target cho production, kết nối qua `DATABASE_URL`. SQLAlchemy làm ORM layer để giữ code tương thích cả 2 (tránh dùng SQLite-specific feature).

## Consequences
- **Positive:** Onboard dev mới nhanh (`docker-compose up` không cần thêm DB service), demo local không phụ thuộc network.
- **Negative:** Có rủi ro behavior khác nhau giữa SQLite và PostgreSQL (vd: kiểu dữ liệu JSON, ràng buộc concurrent write) không được phát hiện cho tới khi deploy thật — cần test riêng trên PostgreSQL trước khi go-live (xem `tasks/roadmap-gap-closure.md`).
- **Alternatives considered:** Dùng PostgreSQL ngay cả cho dev (qua Docker) — bị bỏ qua để ưu tiên tốc độ setup trong khung 2 tuần prototype.
