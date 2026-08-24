"""Persist user avatar files under backend/static/avatars."""

from __future__ import annotations

from pathlib import Path

from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.core.image_validation import detect_image_type
from app.models.user import User

STATIC_AVATARS_DIR = Path(__file__).resolve().parents[2] / "static" / "avatars"
MAX_AVATAR_BYTES = 2 * 1024 * 1024


def save_user_avatar(*, user: User, content: bytes, content_type: str, db: Session) -> str:
    """Write image bytes and set ``user.avatar`` to the public static path."""
    if not (content_type or "").lower().startswith("image/"):
        raise APIError(415, "INVALID_IMAGE", "File phải là ảnh (png/jpg/webp/gif).")
    if len(content) > MAX_AVATAR_BYTES:
        raise APIError(413, "IMAGE_TOO_LARGE", "Ảnh tối đa 2MB.")

    detected = detect_image_type(content)
    if detected is None:
        raise APIError(415, "INVALID_IMAGE", "File phải là ảnh (png/jpg/webp/gif).")
    _, ext = detected

    STATIC_AVATARS_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{user.id}{ext}"
    (STATIC_AVATARS_DIR / filename).write_bytes(content)

    user.avatar = f"/static/avatars/{filename}"
    db.commit()
    return user.avatar
