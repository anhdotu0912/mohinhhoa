"""SSE event generator for chat streaming — mirrors graph nodes without LangGraph invoke."""

from __future__ import annotations

import logging
import re
import time
from collections.abc import Iterator

from app.agents.graph import (
    apply_guardrails,
    food_log_node,
    interaction_check_node,
    meal_plan_node,
    refuse_node,
    unknown_node,
)
from app.agents.nodes.intent_classifier import intent_classifier
from app.agents.nodes.profile_loader import profile_loader
from app.agents.nodes.rag_tool import retrieve_rag_context, stream_answer_tokens
from app.agents.state import AgentState
from app.schemas.meal_plan import AgentRunInput, AgentRunOutput, MealPreviewOut

logger = logging.getLogger(__name__)

_STATUS_MESSAGES: dict[str, str] = {
    "profile_loader": "Đang tải hồ sơ bệnh nhân...",
    "intent_classifier": "Đang phân loại yêu cầu...",
    "rag_qa": "Đang tìm tài liệu tham khảo...",
    "rag_qa_compose": "Đang soạn câu trả lời...",
    "meal_plan": "Đang đọc thực đơn từ hệ thống...",
    "interaction_check": "Đang kiểm tra tương tác thuốc–thực phẩm...",
    "food_log": "Đang xử lý ghi nhận bữa ăn...",
    "refuse": "Đang xử lý yêu cầu...",
    "unknown": "Đang phân tích câu hỏi...",
    "apply_guardrails": "Đang kiểm tra an toàn & nguồn trích dẫn...",
}

_INTENT_NODE_HANDLERS = {
    "meal_plan": meal_plan_node,
    "interaction_check": interaction_check_node,
    "food_log": food_log_node,
    "refuse": refuse_node,
    "unknown": unknown_node,
}


def _status_event(node: str, message: str | None = None) -> dict:
    return {
        "type": "status",
        "node": node,
        "message": message or _STATUS_MESSAGES.get(node, f"Đang xử lý ({node})..."),
    }


def _chunk_text_for_tokens(text: str, chunk_size: int = 12) -> list[str]:
    """Split text into small chunks for simulated typing effect."""
    if not text:
        return []
    words = re.split(r"(\s+)", text)
    chunks: list[str] = []
    current = ""
    for part in words:
        if len(current) + len(part) > chunk_size and current:
            chunks.append(current)
            current = part
        else:
            current += part
    if current:
        chunks.append(current)
    return chunks


def _derive_correction_reason(flags: list[str]) -> str:
    if "unsafe_recommendation" in flags:
        return "unsafe_recommendation"
    if "missing_citations" in flags:
        return "missing_citations"
    return "guardrail"


def _build_initial_state(input_data: AgentRunInput, db) -> AgentState:
    return {
        "user_id": input_data.user_id,
        "message": input_data.message,
        "force_intent": input_data.force_intent,
        "db": db,
        "profile": {},
        "intent": "unknown",
        "rag_context": [],
        "meal_plan": None,
        "meal_preview": None,
        "meal_plan_id": None,
        "food_log": None,
        "interactions": None,
        "answer": None,
        "citations": [],
        "guardrail_flags": [],
        "errors": [],
    }


def _state_to_output(final_state: AgentState) -> AgentRunOutput:
    meal_plan_obj = final_state.get("meal_plan")
    meal_plan_id = final_state.get("meal_plan_id") or (
        meal_plan_obj.id if meal_plan_obj else None
    )
    meal_preview_raw = final_state.get("meal_preview")
    meal_preview = None
    if meal_preview_raw:
        meal_preview = MealPreviewOut(**meal_preview_raw)

    return AgentRunOutput(
        intent=final_state.get("intent", "unknown"),
        message=final_state.get("answer", ""),
        meal_plan_id=meal_plan_id,
        meal_preview=meal_preview,
        food_log_id=None,
        alert_ids=[],
        citations=final_state.get("citations", []),
        guardrail_triggered=bool(final_state.get("guardrail_flags")),
    )


def _yield_tokens_from_text(text: str, *, simulate_delay: bool = True) -> Iterator[dict]:
    for chunk in _chunk_text_for_tokens(text):
        yield {"type": "token", "content": chunk}
        if simulate_delay:
            time.sleep(0.02)


def stream_agent_events(input_data: AgentRunInput, db=None) -> Iterator[dict]:
    """Yield SSE event dicts for the chat streaming endpoint."""
    state = _build_initial_state(input_data, db)
    full_answer = ""

    try:
        yield _status_event("profile_loader")
        state = {**state, **profile_loader(state)}

        yield _status_event("intent_classifier")
        state = {**state, **intent_classifier(state)}
        intent = state.get("intent", "unknown")
        yield {"type": "intent", "intent": intent}

        if intent == "rag_qa":
            message = state.get("message", "")
            profile = state.get("profile", {})

            yield _status_event("rag_qa")
            rag_context, citations = retrieve_rag_context(message, profile)
            state = {**state, "rag_context": rag_context, "citations": citations}

            yield _status_event("rag_qa", _STATUS_MESSAGES["rag_qa_compose"])
            for token in stream_answer_tokens(message, rag_context, profile):
                full_answer += token
                yield {"type": "token", "content": token}

        elif intent in _INTENT_NODE_HANDLERS:
            yield _status_event(intent)
            node_fn = _INTENT_NODE_HANDLERS[intent]
            result = node_fn(state)
            state = {**state, **result}
            answer = state.get("answer") or ""
            for event in _yield_tokens_from_text(answer):
                full_answer += event["content"]
                yield event

        else:
            yield _status_event("unknown")
            result = unknown_node(state)
            state = {**state, **result}
            answer = state.get("answer") or ""
            for event in _yield_tokens_from_text(answer):
                full_answer += event["content"]
                yield event

        yield _status_event("apply_guardrails")
        guardrail_input = {**state, "answer": full_answer}
        final_state = apply_guardrails(guardrail_input)
        final_answer = final_state.get("answer") or ""

        if final_answer != full_answer:
            flags = list(final_state.get("guardrail_flags") or [])
            yield {
                "type": "correction",
                "message": final_answer,
                "reason": _derive_correction_reason(flags),
            }

        output = _state_to_output(final_state)
        yield {"type": "done", "data": output.model_dump(mode="json")}

    except Exception as exc:
        logger.exception("stream_agent_events failed for user %s", input_data.user_id)
        yield {"type": "error", "message": str(exc)}
