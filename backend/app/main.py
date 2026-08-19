"""P-014 Nutrition Agent API — FastAPI entrypoint."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1 import (
    routes_alerts,
    routes_auth,
    routes_chat,
    routes_doctor,
    routes_food_log,
    routes_interactions,
    routes_meal_plan,
    routes_metrics,
    routes_notifications,
    routes_profile,
)
from app.core.config import settings
from app.core.errors import register_error_handlers
from app.core.startup_checks import validate_security_settings
from app.db.init_db import init_db

logger = logging.getLogger(__name__)

STATIC_DIR = Path(__file__).resolve().parents[1] / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)


def _warn_if_chroma_empty() -> None:
    """Log when RAG collections are missing (run `python -m app.rag.indexer` after deploy)."""
    try:
        from app.rag.indexer import _get_chroma_client

        client = _get_chroma_client()
        existing = {collection.name for collection in client.list_collections()}
        missing = [name for name in ("food_items", "guidelines") if name not in existing]
        empty = [
            name
            for name in ("food_items", "guidelines")
            if name in existing and client.get_collection(name).count() == 0
        ]
        if missing or empty:
            logger.warning(
                "ChromaDB not ready (missing=%s empty=%s) — run `python -m app.rag.indexer` or deploy/bootstrap.sh",
                missing or "none",
                empty or "none",
            )
    except Exception as exc:  # noqa: BLE001 — startup hint only
        logger.warning("ChromaDB index check skipped: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    validate_security_settings()
    init_db()
    _warn_if_chroma_empty()
    yield


app = FastAPI(title="P-014 Nutrition Agent API", version="0.1.0", lifespan=lifespan)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_error_handlers(app)

for router in (
    routes_auth.router,
    routes_profile.router,
    routes_meal_plan.router,
    routes_chat.router,
    routes_interactions.router,
    routes_alerts.router,
    routes_notifications.router,
    routes_food_log.router,
    routes_metrics.router,
    routes_doctor.router,
):
    app.include_router(router, prefix="/api/v1")


@app.get("/")
def read_root():
    return {"Hello": "World"}


@app.get("/health")
def health():
    return {"status": "ok"}
