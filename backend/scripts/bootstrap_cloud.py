"""Explicit one-off schema/catalog setup for the hosted PostgreSQL database.

Run from the repository root:
  python backend/scripts/bootstrap_cloud.py --env-file .env.vercel
  python backend/scripts/bootstrap_cloud.py --env-file .env.vercel --with-demo

Credentials are read from an ignored file and are never printed.
"""

from __future__ import annotations

import argparse
import os
import secrets
import sys
from pathlib import Path

from dotenv import dotenv_values


def main() -> int:
    parser = argparse.ArgumentParser(description="Initialize the Vercel PostgreSQL database")
    parser.add_argument("--env-file", type=Path, required=True)
    parser.add_argument("--with-demo", action="store_true", help="Create synthetic demo accounts explicitly")
    args = parser.parse_args()
    if not args.env_file.is_file():
        parser.error("Environment file does not exist")
    values = dotenv_values(args.env_file)
    url = (values.get("DATABASE_URL") or "").strip()
    if not url.startswith(("postgresql://", "postgresql+psycopg2://", "postgres://")):
        parser.error("DATABASE_URL must be a PostgreSQL connection string")
    secret = (values.get("JWT_SECRET") or "").strip()
    if len(secret) < 32 or secret.startswith("REPLACE_"):
        parser.error("Set a random JWT_SECRET of at least 32 characters in the environment file")
    if args.with_demo and len(values.get("DEMO_PASSWORD") or "") < 8:
        parser.error("Set DEMO_PASSWORD (at least 8 characters) in the environment file")
    for key, value in values.items():
        if value is not None:
            os.environ[key] = value
    os.environ["APP_ENV"] = "production"
    os.environ["RAG_RETRIEVAL_MODE"] = "keyword"
    os.environ["DATABASE_POOL_MODE"] = "null"
    os.environ.setdefault("JWT_SECRET", secrets.token_urlsafe(48))
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from app.db.init_db import init_db, seed_demo_accounts
    from app.db.session import SessionLocal

    init_db()
    if args.with_demo:
        with SessionLocal() as db:
            seed_demo_accounts(db, password=os.environ["DEMO_PASSWORD"])
    print("PostgreSQL schema and nutrition catalog are ready.")
    if args.with_demo:
        print("Synthetic demo accounts prepared; existing passwords were not reset.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
