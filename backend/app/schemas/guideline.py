"""Guideline citation source — contract api-v1 §14."""

from typing import Literal

from pydantic import BaseModel


class GuidelineSourceOut(BaseModel):
    id: str
    kind: Literal["guideline", "catalog"]
    title: str
    body: str
