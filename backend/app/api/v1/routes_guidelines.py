"""Guideline citation reader — contract api-v1 §14."""

from __future__ import annotations

import re
from urllib.parse import unquote

from fastapi import APIRouter, Depends

from app.core.errors import APIError
from app.core.security import require_roles
from app.models.user import User
from app.rag.indexer import GUIDELINES_DIR
from app.schemas.guideline import GuidelineSourceOut

router = APIRouter(prefix="/guidelines", tags=["guidelines"])

_SOURCE_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._#-]*$")
_HEADING_RE = re.compile(r"^#{1,6}\s+(.+)$")


def _title_from_markdown(body: str, fallback: str) -> str:
    for line in body.splitlines():
        match = _HEADING_RE.match(line.strip())
        if match:
            title = match.group(1).strip()
            if title:
                return title
    return fallback


def resolve_guideline_source(source_id: str) -> GuidelineSourceOut:
    raw = unquote(source_id or "").strip()
    if not raw or not _SOURCE_RE.match(raw):
        raise APIError(400, "INVALID_SOURCE", "Mã trích dẫn không hợp lệ.")

    if "#" in raw:
        return GuidelineSourceOut(
            id=raw,
            kind="catalog",
            title="Nguồn catalog thực phẩm",
            body=(
                f"Citation `{raw}` trỏ tới món trong catalog dinh dưỡng, "
                "không phải guideline lâm sàng."
            ),
        )

    if "/" in raw or "\\" in raw or ".." in raw or not raw.endswith(".md"):
        raise APIError(400, "INVALID_SOURCE", "Mã trích dẫn không hợp lệ.")

    guidelines_root = GUIDELINES_DIR.resolve()
    path = (guidelines_root / raw).resolve()
    if path.parent != guidelines_root:
        raise APIError(400, "INVALID_SOURCE", "Mã trích dẫn không hợp lệ.")
    if not path.is_file():
        raise APIError(404, "GUIDELINE_NOT_FOUND", "Không tìm thấy nguồn trích dẫn.")

    body = path.read_text(encoding="utf-8")
    return GuidelineSourceOut(
        id=raw,
        kind="guideline",
        title=_title_from_markdown(body, raw),
        body=body,
    )


@router.get("/{source_id:path}", response_model=GuidelineSourceOut)
def get_guideline_source(
    source_id: str,
    _user: User = Depends(require_roles("patient", "doctor")),
) -> GuidelineSourceOut:
    return resolve_guideline_source(source_id)
