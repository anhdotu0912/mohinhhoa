"""Serverless must keep avatars in the database and avoid local model/disk use."""

import asyncio
import json
import os
import subprocess
import sys
from pathlib import Path
from unittest.mock import Mock

import app.main as main
from app.api.v1.routes_avatars import router
from app.core.config import settings
from app.core.errors import register_error_handlers
from app.db.session import get_db
from app.models.user import User
from app.models.user_avatar import UserAvatar
from app.services import avatar_service
from fastapi import FastAPI
from fastapi.testclient import TestClient

PNG = b"\x89PNG\r\n\x1a\n" + b"test-image"


def test_avatar_survives_session_close_without_filesystem(db_session, monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "AVATAR_STORAGE", "database")
    forbidden_dir = tmp_path / "must-not-be-created"
    monkeypatch.setattr(avatar_service, "STATIC_AVATARS_DIR", forbidden_dir)
    user = User(id="serverless-avatar", email="avatar@example.test", hashed_password="unused")
    db_session.add(user)
    db_session.commit()
    url = avatar_service.save_user_avatar(
        user=user, content=PNG, content_type="image/png", db=db_session
    )
    assert not forbidden_dir.exists()
    db_session.expunge_all()

    app = FastAPI()
    register_error_handlers(app)
    app.include_router(router)
    app.dependency_overrides[get_db] = lambda: db_session
    with TestClient(app) as client:
        response = client.get(url)
        assert response.status_code == 200
        assert response.content == PNG
        assert response.headers["content-type"] == "image/png"
        assert response.headers["x-content-type-options"] == "nosniff"
        assert client.get("/static/avatars/missing.png").status_code == 404

    user = db_session.get(User, "serverless-avatar")
    new_image = b"GIF89a" + b"replacement"
    new_url = avatar_service.save_user_avatar(
        user=user, content=new_image, content_type="image/gif", db=db_session
    )
    db_session.expunge_all()
    assert db_session.get(UserAvatar, user.id).content == new_image
    with TestClient(app) as client:
        assert client.get(url).status_code == 404
        assert client.get(new_url).content == new_image


def test_keyword_health_does_not_open_qdrant_or_load_embeddings(monkeypatch):
    monkeypatch.setattr(settings, "RAG_RETRIEVAL_MODE", "keyword")
    forbidden = Mock(side_effect=AssertionError("Must not use dense backend"))
    monkeypatch.setattr(main, "_check_qdrant_readiness", forbidden)
    status = main.check_vector_store_readiness()
    assert status["provider"] == "bm25"
    assert status["ready"] is True
    forbidden.assert_not_called()


def test_serverless_startup_skips_schema_mutation(monkeypatch):
    monkeypatch.setattr(settings, "INITIALIZE_DATABASE_ON_STARTUP", False)
    forbidden = Mock(side_effect=AssertionError("Initialize database before deployment"))
    monkeypatch.setattr(main, "init_db", forbidden)
    monkeypatch.setattr(main, "validate_security_settings", lambda: None)
    monkeypatch.setattr(main, "_warn_if_vector_store_empty", lambda: None)

    async def run():
        async with main.lifespan(main.app):
            pass

    asyncio.run(run())
    forbidden.assert_not_called()


def test_cloud_environment_has_priority_over_local_dotenv(tmp_path):
    (tmp_path / ".env").write_text("JWT_SECRET=local-value\nDATABASE_URL=sqlite://\n", encoding="utf-8")
    env = dict(os.environ)
    env.pop("PYTEST_RUNNING", None)
    env.update({
        "VERCEL": "1", "APP_ENV": "production", "JWT_SECRET": "cloud-secret-value",
        "DATABASE_URL": "postgresql://user:pass@database.test/cloud",
        "PYTHONPATH": str(Path(__file__).resolve().parents[1]),
    })
    result = subprocess.run(
        [sys.executable, "-c", "import json;from app.core.config import settings;print(json.dumps([settings.JWT_SECRET,settings.DATABASE_URL]))"],
        cwd=tmp_path, env=env, check=True, capture_output=True, text=True,
    )
    assert json.loads(result.stdout) == ["cloud-secret-value", "postgresql://user:pass@database.test/cloud"]
