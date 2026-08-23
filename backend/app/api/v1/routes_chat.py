"""Chat route — thin wrapper around BE1's run_agent facade (contract §7)."""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.core.security import require_roles
from app.db.session import get_db
from app.models.user import User
from app.schemas.chat import ChatRequest
from app.schemas.chat_history import (
    ChatMessagesReplace,
    ChatSessionCreate,
    ChatSessionOut,
    ChatSessionPatch,
    ChatSessionSummaryOut,
)
from app.schemas.meal_plan import AgentRunInput, AgentRunOutput
from app.services import chat_history_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=AgentRunOutput)
def chat(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("patient", "doctor")),
) -> AgentRunOutput:
    try:
        from app.agents.graph import run_agent

        return run_agent(AgentRunInput(user_id=user.id, message=payload.message), db=db)
    except APIError:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("Agent failed for user %s", user.id)
        raise APIError(503, "AGENT_ERROR", "Lỗi xử lý agent. Vui lòng thử lại sau.") from exc


@router.post("/stream")
def chat_stream(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("patient", "doctor")),
) -> StreamingResponse:
    from app.agents.streaming import stream_agent_events

    def _sse():
        for event in stream_agent_events(
            AgentRunInput(user_id=user.id, message=payload.message),
            db=db,
        ):
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

    return StreamingResponse(_sse(), media_type="text/event-stream")


@router.get("/sessions", response_model=list[ChatSessionSummaryOut])
def list_chat_sessions(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("patient")),
) -> list[ChatSessionSummaryOut]:
    return chat_history_service.list_sessions(db, user.id)


@router.post("/sessions", response_model=ChatSessionOut, status_code=status.HTTP_201_CREATED)
def create_chat_session(
    payload: ChatSessionCreate = ChatSessionCreate(),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("patient")),
) -> ChatSessionOut:
    return chat_history_service.create_session(db, user.id, payload)


@router.get("/sessions/{session_id}", response_model=ChatSessionOut)
def get_chat_session(
    session_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("patient")),
) -> ChatSessionOut:
    return chat_history_service.get_session(db, user.id, session_id)


@router.patch("/sessions/{session_id}", response_model=ChatSessionOut)
def patch_chat_session(
    session_id: str,
    payload: ChatSessionPatch,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("patient")),
) -> ChatSessionOut:
    return chat_history_service.patch_session(db, user.id, session_id, payload)


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_chat_session(
    session_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("patient")),
) -> Response:
    chat_history_service.delete_session(db, user.id, session_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/sessions", status_code=status.HTTP_204_NO_CONTENT)
def delete_all_chat_sessions(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("patient")),
) -> Response:
    chat_history_service.delete_all_sessions(db, user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/sessions/{session_id}/messages", response_model=ChatSessionOut)
def replace_chat_session_messages(
    session_id: str,
    payload: ChatMessagesReplace,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("patient")),
) -> ChatSessionOut:
    return chat_history_service.replace_messages(db, user.id, session_id, payload)
