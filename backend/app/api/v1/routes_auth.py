"""Auth routes — register/login (contract §6)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.core.security import create_access_token, get_current_user, hash_password, verify_password
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    RegisterResponse,
    TokenResponse,
    UserMeResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=RegisterResponse, status_code=201)
def register(
    payload: RegisterRequest,
    db: Session = Depends(get_db),
) -> RegisterResponse:
    email = payload.email.strip().lower()
    if db.query(User).filter(User.email == email).first() is not None:
        raise APIError(409, "EMAIL_EXISTS", "Email đã được đăng ký.")
    user = User(
        email=email,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        full_name=(payload.full_name or "").strip() or None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return RegisterResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        full_name=user.full_name,
    )


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    user = db.query(User).filter(User.email == payload.email.strip().lower()).first()
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise APIError(401, "INVALID_CREDENTIALS", "Email hoặc mật khẩu không đúng.")
    return TokenResponse(
        access_token=create_access_token(user.id, user.role),
        role=user.role,
        user_id=user.id,
    )


@router.get("/me", response_model=UserMeResponse)
def get_me(user: User = Depends(get_current_user)) -> UserMeResponse:
    return UserMeResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        full_name=user.full_name,
        avatar=user.avatar,
    )
