"""Serve database-backed avatars using the same public URLs as local storage."""

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.db.session import get_db
from app.models.user_avatar import UserAvatar

router = APIRouter(prefix="/static/avatars", tags=["avatars"])


@router.get("/{filename}")
def read_avatar(filename: str, db: Session = Depends(get_db)) -> Response:
    row = db.query(UserAvatar).filter(UserAvatar.filename == filename).first()
    if row is None:
        raise APIError(404, "AVATAR_NOT_FOUND", "Không tìm thấy ảnh đại diện.")
    return Response(
        content=row.content,
        media_type=row.content_type,
        headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "no-cache"},
    )
