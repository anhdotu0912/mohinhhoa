"""Chat schemas — contract §7."""

from __future__ import annotations

from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
