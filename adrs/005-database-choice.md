# ADR-005: Database — SQLite (dev) / Postgres (prod)

## Status
Accepted

## Context
Cần một RDBMS cho `users`, `profiles`, `meal_plans`, `alerts`, `notifications`, catalog tables (`medicines`, `allergies`, `diagnoses`). Ràng buộc: setup nhanh trong 2 tuần, không cần DBA, deploy free-tier (Railway/Vercel) khả thi khi go-live.

As-built (`backend/app/core/config.py`, `backend/app/db/`):
- `DATABASE_URL: str = "sqlite:///./app.db"` (default) — đọc qua SQLAlchemy, đổi được bằng env sang bất kỳ connection string Postgres-compatible.
- `init_db()` (`db/init_db.py`) chạy khi FastAPI lifespan start: `Base.metadata.create_all(bind=engine)` rồi seed demo accounts (`demo_patient_1/2/3`, `demo_doctor`) + catalog (thuốc/dị ứng/chẩn đoán).
- **Không dùng Alembic hay migration tool nào** — schema evolution thực hiện bằng các hàm `_migrate_add_*` (idempotent, kiểm tra cột đã tồn tại qua `sqlalchemy.inspect` rồi `ALTER TABLE ... ADD COLUMN` thủ công) chạy mỗi lần `init_db()`. Có 4 migration thủ công hiện tại: `full_name`, `avatar`, `weight/height`, các cột chi tiết profile (`age/gender/phone/address/blood_pressure/blood_glucose/treatment_goals`).
- Model dùng `sqlalchemy.orm.Mapped`/`mapped_column` (SQLAlchemy 2.0 style), tương thích cả SQLite và Postgres không cần đổi code.

## Decision
- **Dev/demo:** SQLite file-based (`app.db`), zero-config, không cần service riêng.
- **Production (khi có):** Postgres — chỉ cần đổi `DATABASE_URL`; code ORM đã Postgres-ready (không dùng SQLite-only feature như `PRAGMA`).
- Giữ chiến lược migration thủ công (`_migrate_add_*`) cho phạm vi prototype hiện tại — **không** đưa Alembic vào trong 2 tuần vì thêm overhead setup không cần thiết ở quy mô schema hiện tại (< 10 bảng, ít thay đổi/ngày).

## Consequences
**Positive**
- Dev mới clone repo chạy được ngay, không cần cài Postgres.
- Đường migrate lên Postgres production đã rõ ràng, không cần refactor ORM.

**Negative**
- Migration thủ công (`_migrate_add_*`) không scale tốt khi số lượng thay đổi schema tăng — dễ quên xoá code migration cũ, không có version history rõ ràng như Alembic.
- SQLite không hỗ trợ concurrent write tốt — nếu demo có nhiều request đồng thời (nhiều doctor/patient cùng lúc) có thể gặp `database is locked`. Chấp nhận rủi ro này cho quy mô demo (1 doctor demo + vài patient demo).
- Không có migration rollback — mọi `ALTER TABLE` là một-chiều.

**Alternatives đã cân nhắc**
- Alembic từ đầu: bị loại vì overhead setup (baseline migration, autogenerate config) không đáng cho 2 tuần prototype; **nên áp dụng khi chuẩn bị lên production thật** (ghi vào `tasks/be2-platform.md` như backlog P2).
- Postgres từ đầu (dev = prod): bị loại vì cần Docker/service ngoài chạy local, tăng friction cho dev setup trong thời gian ngắn.
