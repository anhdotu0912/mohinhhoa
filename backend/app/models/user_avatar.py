"""Durable avatar bytes for deployments without a writable persistent disk."""

from sqlalchemy import ForeignKey, LargeBinary, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class UserAvatar(Base):
    __tablename__ = "user_avatars"

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    filename: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    content_type: Mapped[str] = mapped_column(String(50), nullable=False)
    content: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
