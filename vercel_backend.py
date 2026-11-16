"""Vercel entrypoint; application code remains shared with Docker/local runs."""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "backend"))

# A function has no durable local disk or resident embedding model. Use the
# existing grounded keyword retriever and PostgreSQL for all persistent data.
os.environ.setdefault("APP_ENV", "production")
os.environ.setdefault("RAG_RETRIEVAL_MODE", "keyword")
os.environ.setdefault("AVATAR_STORAGE", "database")
os.environ.setdefault("DATABASE_POOL_MODE", "null")
os.environ.setdefault("INITIALIZE_DATABASE_ON_STARTUP", "false")

from app.main import app  # noqa: E402,F401
