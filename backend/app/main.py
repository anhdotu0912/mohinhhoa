"""VinNutri API — FastAPI entrypoint."""

from __future__ import annotations

import json
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.api.v1 import (
    routes_alerts,
    routes_auth,
    routes_avatars,
    routes_chat,
    routes_compliance,
    routes_doctor,
    routes_escalations,
    routes_food_log,
    routes_guidelines,
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
from app.db.session import engine

logger = logging.getLogger(__name__)

STATIC_DIR = Path(__file__).resolve().parents[1] / "static"

_REQUIRED_COLLECTIONS = ("food_items", "guidelines")


def _check_database() -> dict[str, str]:
    """Lightweight DB connectivity probe."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok"}
    except Exception as exc:  # noqa: BLE001 — health probe only
        return {"status": "error", "detail": str(exc)}


def _check_qdrant_readiness() -> dict[str, object]:
    from app.rag.indexer import _get_qdrant_client

    client = _get_qdrant_client()
    existing = {collection.name for collection in client.get_collections().collections}
    missing = [name for name in _REQUIRED_COLLECTIONS if name not in existing]
    empty: list[str] = []
    for name in _REQUIRED_COLLECTIONS:
        if name not in existing:
            continue
        info = client.get_collection(name)
        point_count = getattr(info, "points_count", None)
        if point_count == 0:
            empty.append(name)
    ready = not missing and not empty
    return {
        "provider": "qdrant",
        "ready": ready,
        "missing": missing,
        "empty": empty,
    }


def check_vector_store_readiness() -> dict[str, object]:
    """Check the selected retrieval backend without loading an embedding model."""
    if settings.RAG_RETRIEVAL_MODE == "keyword":
        data_dir = Path(__file__).resolve().parents[1] / "data"
        missing, empty = [], []
        food_path = data_dir / "food_db_vn.json"
        if not food_path.is_file():
            missing.append("food_items")
        else:
            try:
                foods = json.loads(food_path.read_text(encoding="utf-8"))
                if not isinstance(foods, list) or not foods:
                    empty.append("food_items")
            except (OSError, ValueError):
                empty.append("food_items")
        guidelines = list((data_dir / "guidelines").glob("*.md"))
        if not guidelines:
            missing.append("guidelines")
        elif not any(path.stat().st_size for path in guidelines):
            empty.append("guidelines")
        return {
            "provider": "bm25", "ready": not missing and not empty,
            "missing": missing, "empty": empty,
        }
    try:
        return _check_qdrant_readiness()
    except Exception as exc:  # noqa: BLE001 — health probe only
        return {
            "provider": "qdrant",
            "ready": False,
            "missing": list(_REQUIRED_COLLECTIONS),
            "empty": [],
            "detail": str(exc),
        }


def _warn_if_vector_store_empty() -> None:
    """Log when RAG collections are missing (run `python -m app.rag.indexer` after deploy)."""
    try:
        status = check_vector_store_readiness()
        missing = status.get("missing") or []
        empty = status.get("empty") or []
        if missing or empty or not status.get("ready"):
            logger.warning(
                "Vector store (%s) not ready (missing=%s empty=%s) — "
                "run `python -m app.rag.indexer` or deploy/bootstrap.sh",
                status.get("provider", "qdrant"),
                missing or "none",
                empty or "none",
            )
    except Exception as exc:  # noqa: BLE001 — startup hint only
        logger.warning("Vector store index check skipped: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    validate_security_settings()
    if settings.INITIALIZE_DATABASE_ON_STARTUP:
        init_db()
    _warn_if_vector_store_empty()
    yield
    from app.rag.qdrant import close_qdrant_client
    close_qdrant_client()


app = FastAPI(title="VinNutri API", version="0.1.0", lifespan=lifespan)

if settings.AVATAR_STORAGE == "database":
    app.include_router(routes_avatars.router)
else:
    STATIC_DIR.mkdir(parents=True, exist_ok=True)
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()],
    allow_credentials=True,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX or None,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_error_handlers(app)

for router in (
    routes_auth.router,
    routes_profile.router,
    routes_meal_plan.router,
    routes_chat.router,
    routes_escalations.patient_router,
    routes_escalations.doctor_router,
    routes_interactions.router,
    routes_alerts.router,
    routes_notifications.router,
    routes_food_log.router,
    routes_metrics.router,
    routes_compliance.router,
    routes_guidelines.router,
    routes_doctor.router,
):
    app.include_router(router, prefix="/api/v1")


@app.get("/")
def read_root():
    return {"Hello": "World"}


@app.get("/health")
def health():
    db = _check_database()
    vector_store = check_vector_store_readiness()
    overall_ok = db.get("status") == "ok" and bool(vector_store.get("ready"))
    return {
        "status": "ok" if overall_ok else "degraded",
        "database": db,
        "vector_store": vector_store,
    }
