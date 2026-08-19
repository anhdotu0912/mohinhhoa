"""Auth routes — register/login (contract §6)."""

from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import APIError
from app.core.security import create_access_token, get_current_user, hash_password, verify_password
from app.db.session import get_db
from app.models.password_reset import PasswordResetToken
from app.models.user import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    RegisterRequest,
    RegisterResponse,
    ResetPasswordRequest,
    ResetPasswordResponse,
    TokenResponse,
    UserMeResponse,
)
from app.services import email as email_service
from app.services.login_rate_limit import check_rate_limit, clear_attempts, record_failed_attempt

router = APIRouter(prefix="/auth", tags=["auth"])

_RESET_MESSAGE = "Nếu email tồn tại, liên kết đặt lại mật khẩu đã được gửi tới email của bạn."
_PASSWORD_RESET_EXPIRE_HOURS = 1


@router.post("/register", response_model=RegisterResponse, status_code=201)
def register(
    payload: RegisterRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> RegisterResponse:
    client_ip = request.client.host if request.client else "unknown"
    email = payload.email.strip().lower()
    check_rate_limit("register", email, client_ip)

    if db.query(User).filter(User.email == email).first() is not None:
        record_failed_attempt("register", email, client_ip)
        raise APIError(409, "EMAIL_EXISTS", "Email đã được đăng ký.")
    user = User(
        email=email,
        hashed_password=hash_password(payload.password),
        role="patient",
        full_name=(payload.full_name or "").strip() or None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    clear_attempts("register", email, client_ip)
    return RegisterResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        full_name=user.full_name,
    )


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> TokenResponse:
    client_ip = request.client.host if request.client else "unknown"
    email = payload.email.strip().lower()
    check_rate_limit("login", email, client_ip)

    user = db.query(User).filter(User.email == email).first()
    if user is None or not verify_password(payload.password, user.hashed_password):
        record_failed_attempt("login", email, client_ip)
        raise APIError(401, "INVALID_CREDENTIALS", "Email hoặc mật khẩu không đúng.")

    clear_attempts("login", email, client_ip)
    return TokenResponse(
        access_token=create_access_token(user.id, user.role),
        role=user.role,
        user_id=user.id,
    )


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> ForgotPasswordResponse:
    if not email_service.is_configured():
        raise APIError(
            503,
            "EMAIL_NOT_CONFIGURED",
            "Chưa cấu hình gửi email (SMTP). Liên hệ quản trị viên.",
        )

    client_ip = request.client.host if request.client else "unknown"
    email = payload.email.strip().lower()
    check_rate_limit("forgot_password", email, client_ip)

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        return ForgotPasswordResponse(message=_RESET_MESSAGE)

    raw_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(UTC).replace(tzinfo=None) + timedelta(hours=_PASSWORD_RESET_EXPIRE_HOURS)
    db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user.id).delete()
    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=hash_password(raw_token),
            expires_at=expires_at,
        )
    )
    db.commit()

    reset_url = (
        settings.FRONTEND_URL.rstrip("/") + f"/reset-password?token={raw_token}"
    )
    try:
        email_service.send_password_reset_link(user.email, reset_url)
    except email_service.EmailNotConfiguredError:
        raise APIError(
            503,
            "EMAIL_NOT_CONFIGURED",
            "Chưa cấu hình gửi email (SMTP). Liên hệ quản trị viên.",
        )
    except email_service.EmailAuthError:
        raise APIError(
            502,
            "EMAIL_AUTH_FAILED",
            "Gmail từ chối đăng nhập SMTP. Dùng App Password 16 ký tự "
            "(không phải mật khẩu email). Tài khoản trường có thể bị chặn SMTP — thử Gmail cá nhân.",
        )
    except email_service.EmailError:
        raise APIError(
            500,
            "EMAIL_SEND_FAILED",
            "Không gửi được email. Vui lòng thử lại sau.",
        )

    clear_attempts("forgot_password", email, client_ip)
    return ForgotPasswordResponse(message=_RESET_MESSAGE)


@router.post("/reset-password", response_model=ResetPasswordResponse)
def reset_password(
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
) -> ResetPasswordResponse:
    now = datetime.now(UTC).replace(tzinfo=None)
    tokens = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.expires_at >= now)
        .order_by(PasswordResetToken.created_at.desc())
        .all()
    )
    matched: PasswordResetToken | None = None
    for row in tokens:
        if verify_password(payload.token, row.token_hash):
            matched = row
            break
    if matched is None:
        raise APIError(
            400,
            "INVALID_OR_EXPIRED_TOKEN",
            "Token không hợp lệ hoặc đã hết hạn.",
        )

    user = db.get(User, matched.user_id)
    if user is None:
        raise APIError(
            400,
            "INVALID_OR_EXPIRED_TOKEN",
            "Token không hợp lệ hoặc đã hết hạn.",
        )

    user.hashed_password = hash_password(payload.new_password)
    db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user.id).delete()
    db.commit()
    return ResetPasswordResponse(message="Đặt lại mật khẩu thành công.")


@router.get("/me", response_model=UserMeResponse)
def get_me(user: User = Depends(get_current_user)) -> UserMeResponse:
    return UserMeResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        full_name=user.full_name,
        avatar=user.avatar,
    )
