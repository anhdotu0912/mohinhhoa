"""SSE event generator for chat streaming — mirrors graph nodes without LangGraph invoke."""

from __future__ import annotations

import logging
import re
import time
from collections.abc import Iterator

from app.agents.food_conversation import answer_food_conversation, resolve_food_followup
from app.agents.graph import (
    apply_guardrails,
    build_agent_run_output,
    clarification_node,
    doctor_note_node,
    food_log_node,
    greeting_node,
    interaction_check_node,
    meal_plan_node,
    metrics_delta_advice_node,
    refuse_node,
    unknown_node,
    weekly_compliance_node,
)
from app.agents.nodes.intent_classifier import intent_classifier
from app.agents.nodes.profile_loader import profile_loader
from app.agents.nodes.rag_tool import retrieve_rag_context, stream_answer_tokens
from app.agents.state import AgentState
from app.schemas.meal_plan import AgentRunInput, AgentRunOutput

logger = logging.getLogger(__name__)

_STATUS_MESSAGES: dict[str, str] = {
    "profile_loader": "Đang tải hồ sơ bệnh nhân...",
    "intent_classifier": "Đang phân loại yêu cầu...",
    "greeting": "Đang gửi lời chào...",
    "clarify": "Đang làm rõ câu hỏi...",
    "rag_qa": "Đang tìm tài liệu tham khảo...",
    "rag_qa_compose": "Đang soạn câu trả lời...",
    "meal_plan": "Đang đọc thực đơn từ hệ thống...",
    "interaction_check": "Đang kiểm tra tương tác thuốc–thực phẩm...",
    "food_log": "Đang xử lý ghi nhận bữa ăn...",
    "weekly_compliance": "Đang tổng hợp tuân thủ tuần...",
    "doctor_note": "Đang tải ghi chú từ bác sĩ...",
    "metrics_delta_advice": "Đang đối chiếu chỉ số sức khỏe...",
    "refuse": "Đang xử lý yêu cầu...",
    "unknown": "Đang phân tích câu hỏi...",
    "apply_guardrails": "Đang kiểm tra an toàn & nguồn trích dẫn...",
}

_INTENT_NODE_HANDLERS = {
    "greeting": greeting_node,
    "clarify": clarification_node,
    "meal_plan": meal_plan_node,
    "interaction_check": interaction_check_node,
    "food_log": food_log_node,
    "weekly_compliance": weekly_compliance_node,
    "doctor_note": doctor_note_node,
    "metrics_delta_advice": metrics_delta_advice_node,
    "refuse": refuse_node,
    "unknown": unknown_node,
}


def _status_event(node: str, message: str | None = None) -> dict:
    return {
        "type": "status",
        "node": node,
        "message": message or _STATUS_MESSAGES.get(node, f"Đang xử lý ({node})..."),
    }


def _chunk_text_for_tokens(text: str, chunk_size: int = 4) -> list[str]:
    """Split text into small word/syllable chunks for realistic streaming typing effect."""
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
    if "targeted_drug_food_interaction_alert" in flags or "targeted_allergy_alert" in flags:
        return "food_safety_alert"
    return "guardrail"


def _build_initial_state(input_data: AgentRunInput, db) -> AgentState:
    return {
        "user_id": input_data.user_id,
        "message": resolve_food_followup(input_data.message, [turn.model_dump() for turn in input_data.history]),
        "history": [turn.model_dump() for turn in input_data.history],
        "force_intent": input_data.force_intent,
        "db": db,
        "profile": {},
        "intent": "unknown",
        "secondary_intents": [],
        "rag_context": [],
        "meal_plan": None,
        "meal_preview": None,
        "meal_plan_id": None,
        "food_log": None,
        "interactions": None,
        "weekly_compliance": None,
        "doctor_note": None,
        "metrics_delta_advice": None,
        "answer": None,
        "citations": [],
        "guardrail_flags": [],
        "errors": [],
    }


def _state_to_output(final_state: AgentState) -> AgentRunOutput:
    return build_agent_run_output(final_state)


def _yield_tokens_from_text(text: str, *, simulate_delay: bool = True) -> Iterator[dict]:
    for chunk in _chunk_text_for_tokens(text, chunk_size=4):
        yield {"type": "token", "content": chunk}
        if simulate_delay:
            time.sleep(0.025)


def stream_agent_events(input_data: AgentRunInput, db=None) -> Iterator[dict]:
    """Yield SSE event dicts for the chat streaming endpoint."""
    state = _build_initial_state(input_data, db)
    full_answer = ""

    try:
        from app.core.cache import profile_cache

        if not profile_cache.is_cached(input_data.user_id):
            yield _status_event("profile_loader")
        state = {**state, **profile_loader(state)}

        yield _status_event("intent_classifier")
        state = {**state, **intent_classifier(state)}
        intent = state.get("intent", "unknown")
        secondary_intents = state.get("secondary_intents", [])
        yield {
            "type": "intent",
            "intent": intent,
            "secondary_intents": secondary_intents,
        }

        if intent == "rag_qa":
            message = state.get("message", "")
            profile = state.get("profile", {})

            yield _status_event("rag_qa")
            conversational = answer_food_conversation(message, profile, state.get("history"), db=db)
            if conversational is not None:
                state = {**state, **conversational, "intent": "clarify" if conversational.get("clarify") else "rag_qa"}
                for event in _yield_tokens_from_text(conversational["answer"]):
                    full_answer += event["content"]
                    yield event
            else:
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
        memory_error = isinstance(exc, MemoryError) or (
            isinstance(exc, OSError) and (
                getattr(exc, "winerror", None) == 1455
                or getattr(exc, "errno", None) in (12, 1455)
            )
        )
        message = (
            "Máy đang thiếu bộ nhớ. Vui lòng đóng bớt ứng dụng và thử lại."
            if memory_error else "Chưa xử lý được yêu cầu. Vui lòng thử lại sau."
        )
        yield {"type": "error", "message": message}
