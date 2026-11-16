"""Persist user avatar files under backend/static/avatars."""

from __future__ import annotations

from pathlib import Path

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import APIError
from app.core.image_validation import detect_image_type
from app.models.user import User
from app.models.user_avatar import UserAvatar

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
    detected_type, ext = detected

    filename = f"{user.id}{ext}"
    if settings.AVATAR_STORAGE == "database":
        row = db.get(UserAvatar, user.id)
        if row is None:
            row = UserAvatar(user_id=user.id)
            db.add(row)
        row.filename = filename
        row.content_type = detected_type
        row.content = content
    else:
        STATIC_AVATARS_DIR.mkdir(parents=True, exist_ok=True)
        (STATIC_AVATARS_DIR / filename).write_bytes(content)

    user.avatar = f"/static/avatars/{filename}"
    db.commit()
    return user.avatar
