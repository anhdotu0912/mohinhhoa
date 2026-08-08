"""JWT auth + password hashing for the platform API."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import APIError
from app.db.session import get_db
from app.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(user_id: str, role: str, expires_minutes: int | None = None) -> str:
    """Create a signed JWT with sub=user_id and role claim."""
    expire_minutes = expires_minutes or settings.JWT_EXPIRE_MINUTES
    now = datetime.now(UTC)
    payload = {
        "sub": user_id,
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=expire_minutes),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError as exc:
        raise APIError(401, "INVALID_TOKEN", "Token không hợp lệ hoặc đã hết hạn.") from exc
    return payload


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise APIError(401, "MISSING_TOKEN", "Thiếu Authorization header.")
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise APIError(401, "INVALID_TOKEN", "Token không chứa user id.")
    user = db.get(User, user_id)
    if user is None:
        raise APIError(401, "USER_NOT_FOUND", "Người dùng không tồn tại.")
    return user


def require_roles(*roles: str):
    """Dependency factory: only allow the given roles."""

    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise APIError(403, "FORBIDDEN", "Bạn không có quyền truy cập tài nguyên này.")
        return user

    return checker
