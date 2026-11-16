"""Chat schemas — contract §7."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000)
    session_id: str | None = Field(default=None, min_length=1, max_length=36)
