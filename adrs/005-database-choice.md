# ADR-005: Database — PostgreSQL only

## Status
Accepted — **Update 2026-08-19: PostgreSQL là RDBMS DUY NHẤT** cho dev lẫn production, theo yêu cầu "chỉ dùng 2 database: Qdrant + Postgres" (xem ADR-001 cho phần Qdrant). SQLite không còn là default/lựa chọn hỗ trợ; `docker-compose.yml` nay có sẵn service `postgres` để dev local không cần cài đặt gì thêm ngoài Docker.

## Context
Cần một RDBMS cho `users`, `profiles`, `meal_plans`, `alerts`, `notifications`, catalog tables (`medicines`, `allergies`, `diagnoses`). Ràng buộc: setup nhanh trong 2 tuần, không cần DBA, deploy free-tier (Railway/Vercel) khả thi khi go-live.

As-built (`backend/app/core/config.py`, `backend/app/db/`):
- `DATABASE_URL: str = "postgresql://p014:p014@localhost:5432/p014"` (default) — đọc qua SQLAlchemy; `docker-compose.yml` chạy kèm service `postgres` (image `postgres:16-alpine`) với user/db `p014`.
- `init_db()` (`db/init_db.py`) chạy khi FastAPI lifespan start: `Base.metadata.create_all(bind=engine)` rồi seed demo accounts (`demo_patient_1/2/3`, `demo_doctor`) + catalog (thuốc/dị ứng/chẩn đoán).
- **Không dùng Alembic hay migration tool nào** — schema evolution thực hiện bằng các hàm `_migrate_add_*` (idempotent, kiểm tra cột đã tồn tại qua `sqlalchemy.inspect` rồi `ALTER TABLE ... ADD COLUMN` thủ công) chạy mỗi lần `init_db()`.
- Model dùng `sqlalchemy.orm.Mapped`/`mapped_column` (SQLAlchemy 2.0 style).
- `backend/scripts/migrate_sqlite_to_postgres.py` được giữ lại như một tiện ích one-off cho ai còn deploy cũ dùng SQLite cần chuyển dữ liệu sang Postgres — không phải một lựa chọn runtime được hỗ trợ.

## Decision
- **Dev lẫn Production:** PostgreSQL only — `docker-compose.yml` (dev/VPS IP-only) và `docker-compose.prod.yml` (domain + Nginx/HTTPS) đều chạy service `postgres` riêng.
- Giữ chiến lược migration thủ công (`_migrate_add_*`) cho phạm vi prototype hiện tại — **không** đưa Alembic vào vì thêm overhead setup không cần thiết ở quy mô schema hiện tại (< 15 bảng, ít thay đổi/ngày).
- pytest test suite (`backend/tests/conftest.py`) tiếp tục dùng SQLite in-memory (`sqlite://` + `StaticPool`) làm test double cho tốc độ/hermetic — đây **không** phải một database được hỗ trợ trong deployment, chỉ là chi tiết triển khai của test harness (xem docstring `app/db/session.py`).

## Consequences
**Positive**
- Một RDBMS duy nhất cho mọi môi trường → không còn rủi ro lệch hành vi SQLite vs Postgres (kiểu dữ liệu, concurrent write, độ dài cột) giữa dev và prod.
- `docker-compose up` chạy được ngay cả khi máy dev không có Postgres cài sẵn (service `postgres` tự khởi động trong container).
- Đường migrate từ các bản deploy SQLite cũ đã có sẵn (`scripts/migrate_sqlite_to_postgres.py`).

**Negative**
- Dev cần Docker (hoặc Postgres cài sẵn) để chạy backend cục bộ — không còn "chạy ngay không cần service ngoài" như SQLite file trước đây.
- Migration thủ công (`_migrate_add_*`) không scale tốt khi số lượng thay đổi schema tăng — dễ quên xoá code migration cũ, không có version history rõ ràng như Alembic.
- Không có migration rollback — mọi `ALTER TABLE` là một-chiều.

**Alternatives đã cân nhắc**
- Giữ SQLite làm default dev: bị loại (2026-08-19) để tránh 2 RDBMS khác nhau giữa dev/prod, đơn giản hoá theo yêu cầu "chỉ 2 database" của dự án.
- Alembic từ đầu: bị loại vì overhead setup (baseline migration, autogenerate config) không đáng cho 2 tuần prototype; **nên áp dụng khi chuẩn bị lên production thật** (ghi vào `tasks/be2-platform.md` như backlog P2).
