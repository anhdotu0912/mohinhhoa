# ADR-006: SQLite cho Dev, PostgreSQL cho Production

## Status
Accepted (implemented 2026-08-14) — kết nối qua `DATABASE_URL`: SQLite là mặc định dev local (fallback), **PostgreSQL external là DB chính** (đã cấu hình `psycopg2-binary`, engine normalization `postgres://`→`postgresql://`, `pool_pre_ping`). Migration data từ SQLite → Postgres: `backend/scripts/migrate_sqlite_to_postgres.py`.

## Context
Cần một DB setup nhanh cho dev/demo local (không cần cài đặt service riêng), nhưng production (deploy Railway) cần DB bền vững, hỗ trợ concurrent write tốt hơn SQLite.

## Decision
Dùng **SQLite** (file `app.db`) làm mặc định cho môi trường dev/local, **PostgreSQL** (external URL qua `DATABASE_URL`) làm DB thật — SQLAlchemy làm ORM layer để giữ code tương thích cả 2 (tránh dùng SQLite-specific feature).

## Consequences
- **Positive:** Onboard dev mới nhanh (`docker-compose up` không cần thêm DB service), demo local không phụ thuộc network; cùng một `DATABASE_URL` chạy được cả local lẫn production.
- **Negative:** Có rủi ro behavior khác nhau giữa SQLite và PostgreSQL (vd: kiểu dữ liệu JSON, ràng buộc concurrent write) — test hermetic vẫn dùng SQLite in-memory (`backend/tests/conftest.py`); cần chạy `pytest` + smoke test trên Postgres thật trước go-live.
- **Alternatives considered:** Dùng PostgreSQL ngay cả cho dev (qua Docker) — bị bỏ qua để ưu tiên tốc độ setup trong khung 2 tuần prototype.
