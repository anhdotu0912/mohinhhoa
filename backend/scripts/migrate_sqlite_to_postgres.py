"""One-off migration script: SQLite (backend/app.db) → PostgreSQL (DATABASE_URL).

Cách dùng (từ thư mục repo hoặc backend/):

    # 1) Export URL Postgres (hoặc set trong .env — script đọc env trước)
    export DATABASE_URL="postgresql://user:pass@host:5432/dbname"

    # 2) Chạy migrate (mặc định đọc backend/app.db, tạo bảng + copy toàn bộ data,
    #    giữ nguyên ID, từ chối ghi đè bảng đã có data trừ khi dùng --force)
    python backend/scripts/migrate_sqlite_to_postgres.py
    python backend/scripts/migrate_sqlite_to_postgres.py --force   # xoá data cũ ở target trước khi copy

Quy tắc:
- ID (string UUID) và created_at/updated_at được giữ nguyên từ SQLite.
- JSON columns được SQLAlchemy serialize lại đúng cho Postgres.
- Không đụng tới file app.db gốc (chỉ đọc).
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from sqlalchemy import create_engine, inspect

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from app.db.session import Base  # noqa: E402
import app.models  # noqa: E402,F401  — đăng ký toàn bộ model vào Base.metadata


def _normalize_url(url: str) -> str:
    url = url.strip()
    if url.startswith("postgres://"):
        return "postgresql://" + url[len("postgres://"):]
    return url


def _target_url() -> str:
    url = os.environ.get("DATABASE_URL", "").strip() or ""
    if not url:
        sys.exit(
            "ERROR: chưa set DATABASE_URL (Postgres). "
            "VD: set DATABASE_URL=postgresql://user:pass@host:5432/dbname (hoặc đặt trong .env)"
        )
    url = _normalize_url(url)
    if url.startswith("sqlite"):
        sys.exit("ERROR: DATABASE_URL đang trỏ tới SQLite — cần URL Postgres để migrate.")
    return url


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate SQLite app.db → PostgreSQL (DATABASE_URL)")
    parser.add_argument(
        "--sqlite",
        default=str(BACKEND_DIR / "app.db"),
        help="Đường dẫn file SQLite nguồn (mặc định: backend/app.db)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Xoá data hiện có ở các bảng target trước khi copy",
    )
    args = parser.parse_args()

    sqlite_path = Path(args.sqlite)
    if not sqlite_path.exists():
        sys.exit(f"ERROR: không tìm thấy file SQLite: {sqlite_path}")

    target_url = _target_url()
    print(f"Source (SQLite):  {sqlite_path}")
    print(f"Target (Postgres): {target_url.split('@')[-1]}")

    src_engine = create_engine(f"sqlite:///{sqlite_path.as_posix()}")
    dst_engine = create_engine(target_url)

    # Tạo bảng ở target nếu chưa có (create_all chỉ tạo bảng thiếu).
    Base.metadata.create_all(bind=dst_engine)

    with dst_engine.connect() as dst_conn:
        target_tables = {t.name for t in Base.metadata.sorted_tables}
        existing = set(inspect(dst_engine).get_table_names()) & target_tables

        if args.force:
            for table in reversed(Base.metadata.sorted_tables):
                if table.name in existing:
                    dst_conn.execute(table.delete())
            dst_conn.commit()
            print("--force: đã xoá data cũ ở các bảng target.")

        total = 0
        for table in Base.metadata.sorted_tables:
            if table.name not in existing:
                # create_all vừa tạo — bảng mới, copy trực tiếp.
                pass
            with src_engine.connect() as src_conn:
                rows = [dict(r._mapping) for r in src_conn.execute(table.select())]
            if not rows:
                print(f"  {table.name}: 0 rows (skip)")
                continue
            if not args.force:
                existing_rows = dst_conn.execute(table.select().limit(1)).first()
                if existing_rows is not None:
                    print(
                        f"  {table.name}: BỎ QUA — target đã có data "
                        f"(chạy lại với --force để ghi đè)"
                    )
                    continue
            dst_conn.execute(table.insert(), rows)
            dst_conn.commit()
            total += len(rows)
            print(f"  {table.name}: copy {len(rows)} rows")

        print(f"\nDone — tổng {total} rows migrated. ID/created_at giữ nguyên.")
        print("App startup (init_db) sẽ seed/idempotent-upsert demo accounts & catalog.")


if __name__ == "__main__":
    main()
