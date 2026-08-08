"""Chat route — thin wrapper around BE1's run_agent facade (contract §7)."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.core.security import require_roles
from app.db.session import get_db
from app.models.user import User
from app.schemas.chat import ChatRequest
from app.schemas.meal_plan import AgentRunInput, AgentRunOutput

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=AgentRunOutput)
def chat(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("patient", "dietitian")),
) -> AgentRunOutput:
    try:
        from app.agents.graph import run_agent

        return run_agent(AgentRunInput(user_id=user.id, message=payload.message))
    except APIError:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("Agent failed for user %s", user.id)
        raise APIError(503, "AGENT_ERROR", f"Lỗi xử lý agent: {exc}") from exc
