"""Interactive CLI to create demo accounts (explicit ops — never on app startup).

Usage (from backend/):
  python -m scripts.create_demo_accounts
  python -m scripts.create_demo_accounts --password 'your-secret' --reset-passwords -y

Requires DATABASE_URL (and running Postgres). Does not write passwords to repo or logs
beyond this terminal session.
"""

from __future__ import annotations

import argparse
import getpass
import secrets
import sys

from app.core.config import get_settings
from app.db.init_db import DEMO_ACCOUNTS, init_db, seed_demo_accounts
from app.db.session import SessionLocal

MIN_PASSWORD_LEN = 8


def _mask_database_url(url: str) -> str:
    if "@" in url:
        return url.split("@", 1)[1]
    return url


def _prompt_password() -> str:
    while True:
        first = getpass.getpass(
            f"Mật khẩu demo (Enter = sinh ngẫu nhiên, tối thiểu {MIN_PASSWORD_LEN} ký tự): "
        )
        if not first.strip():
            generated = secrets.token_urlsafe(12)
            print("Đã sinh mật khẩu ngẫu nhiên.")
            return generated
        if len(first) < MIN_PASSWORD_LEN:
            print(f"Mật khẩu tối thiểu {MIN_PASSWORD_LEN} ký tự.")
            continue
        second = getpass.getpass("Xác nhận mật khẩu: ")
        if first != second:
            print("Mật khẩu không khớp, thử lại.")
            continue
        return first


def _confirm(message: str) -> bool:
    answer = input(f"{message} [y/N]: ").strip().lower()
    return answer in ("y", "yes")


def _print_account_plan() -> None:
    print(f"Sẽ tạo/cập nhật {len(DEMO_ACCOUNTS)} tài khoản:")
    for account in DEMO_ACCOUNTS:
        role_label = "bác sĩ" if account["role"] == "doctor" else "bệnh nhân"
        print(f"  - {account['email']} ({role_label})")
    print("  (demo_patient_1–4 gắn demo_doctor; demo_patient_5 chưa gắn — Hàng việc)")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Tạo hoặc cập nhật tài khoản demo (chạy thủ công, không auto khi start app)."
    )
    parser.add_argument(
        "--password",
        help="Mật khẩu dùng chung cho demo (bỏ qua nhập tương tác)",
    )
    parser.add_argument(
        "--reset-passwords",
        action="store_true",
        help="Ghi đè mật khẩu các tài khoản demo đã tồn tại",
    )
    parser.add_argument(
        "-y",
        "--yes",
        action="store_true",
        help="Bỏ qua xác nhận (non-interactive)",
    )
    parser.add_argument(
        "--skip-init-db",
        action="store_true",
        help="Không chạy init_db (schema/migrations) trước khi seed",
    )
    args = parser.parse_args()

    settings = get_settings()
    print("VinNutri — Tạo tài khoản demo\n")
    print(f"APP_ENV:    {settings.APP_ENV}")
    print(f"Database:   {_mask_database_url(settings.DATABASE_URL)}\n")
    _print_account_plan()
    print()

    if settings.APP_ENV != "development" and not args.yes:
        print(
            f"Cảnh báo: APP_ENV={settings.APP_ENV!r} — chỉ chạy khi bạn chủ đích "
            "tạo demo (staging/chấm điểm)."
        )
        if not _confirm("Tiếp tục?"):
            print("Đã hủy.")
            return 1

    password = args.password
    if password is not None and len(password) < MIN_PASSWORD_LEN:
        print(f"Lỗi: mật khẩu tối thiểu {MIN_PASSWORD_LEN} ký tự.", file=sys.stderr)
        return 1
    if password is None and sys.stdin.isatty():
        password = _prompt_password()
    elif password is None:
        password = secrets.token_urlsafe(12)
        print("Non-interactive: đã sinh mật khẩu ngẫu nhiên.")

    reset_passwords = args.reset_passwords
    if not args.yes and not args.reset_passwords and sys.stdin.isatty():
        reset_passwords = _confirm(
            "Cập nhật mật khẩu cho tài khoản demo đã tồn tại?"
        )

    if not args.yes and sys.stdin.isatty() and not _confirm("Xác nhận tạo/cập nhật?"):
        print("Đã hủy.")
        return 1

    if not args.skip_init_db:
        print("\nChạy init_db (schema + catalog)...")
        init_db()

    db = SessionLocal()
    try:
        used_password = seed_demo_accounts(
            db,
            password=password,
            reset_passwords=reset_passwords,
        )
    except Exception as exc:
        db.rollback()
        print(f"Lỗi: {exc}", file=sys.stderr)
        return 1
    finally:
        db.close()

    print("\nHoàn tất.")
    print("Đăng nhập bằng email demo ở trên.")
    print(f"Mật khẩu (lưu lại — không commit vào repo): {used_password}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
