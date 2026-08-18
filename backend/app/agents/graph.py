"""LangGraph agent graph — compiles the full agent workflow.

Flow: profile_loader → intent_classifier → conditional routing →
      (rag_qa / meal_plan / interaction_check / refuse) → apply_guardrails

Provides `run_agent()` facade function for BE2 to call.
"""

from __future__ import annotations

import logging
from typing import Literal

from langgraph.graph import END, StateGraph

from app.agents.interaction_checker_agent import interaction_checker_agent, load_interaction_kb
from app.agents.nodes.intent_classifier import intent_classifier
from app.agents.nodes.profile_loader import profile_loader
from app.agents.nodes.rag_tool import rag_qa_node
from app.agents.state import AgentState
from app.guardrails.rules import enforce_output_safety, get_refuse_message
from app.guardrails.source_check import enforce_citation_guardrail
from app.schemas.meal_plan import (
    AgentRunInput,
    AgentRunOutput,
    InteractionCheckInput,
)
from app.schemas.profile import PatientProfile

logger = logging.getLogger(__name__)

_DEFAULT_INTERACTION_FOODS = [
    "rau muống",
    "bưởi",
    "rượu",
    "bia",
    "chuối",
    "sữa tươi",
    "cơm trắng",
]


def _extract_foods_from_message(message: str) -> list[str]:
    """Match foods mentioned in the user message against the interaction KB."""
    message_lower = message.lower()
    kb = load_interaction_kb()
    foods_in_kb = sorted(
        {entry["food"] for entry in kb if entry.get("food")},
        key=len,
        reverse=True,
    )
    matched = [food for food in foods_in_kb if food.lower() in message_lower]
    return matched or list(_DEFAULT_INTERACTION_FOODS)


def meal_plan_node(state: AgentState) -> AgentState:
    """Read-only meal plan view — load existing plan from DB, never generate."""
    db = state.get("db")
    user_id = state.get("user_id", "")
    message = state.get("message", "")

    if db is None or not user_id:
        return {
            **state,
            "answer": (
                "Không thể tải thực đơn lúc này. "
                "Vui lòng thử lại hoặc mở mục Thực đơn trên ứng dụng."
            ),
            "meal_preview": None,
            "meal_plan_id": None,
            "meal_plan": None,
            "citations": [],
        }

    from app.services.meal_plan_service import (
        _collect_citations,
        build_meal_preview,
        format_meal_preview_message,
        meal_plan_from_row,
        resolve_patient_plan_row,
    )

    preview = build_meal_preview(db, user_id, message)
    answer = format_meal_preview_message(preview, message)
    citations: list[str] = []
    meal_plan_id: str | None = None
    if preview is not None:
        meal_plan_id = preview.meal_plan_id
        row = resolve_patient_plan_row(db, user_id)
        if row is not None:
            citations = _collect_citations(meal_plan_from_row(row), preview.meals)

    return {
        **state,
        "answer": answer,
        "meal_preview": preview.model_dump(mode="json") if preview else None,
        "meal_plan_id": meal_plan_id,
        "meal_plan": None,
        "citations": citations,
    }


def interaction_check_node(state: AgentState) -> AgentState:
    """InteractionChecker node — checks drug-food interactions from user query or state."""
    profile_data = state.get("profile", {})
    profile = PatientProfile(**profile_data) if isinstance(profile_data, dict) else profile_data
    db = state.get("db")
    medications = profile.medications or ["metformin", "glipizide", "sitagliptin", "atorvastatin"]

    message = state.get("message", "")
    foods = _extract_foods_from_message(message)

    check_input = InteractionCheckInput(
        medications=medications,
        foods=foods,
        profile_user_id=state.get("user_id"),
    )

    try:
        result = interaction_checker_agent(check_input, db=db)
        interactions = result.interactions

        if interactions:
            lines = [f"Phát hiện {len(interactions)} tương tác thuốc-thực phẩm:"]
            for item in interactions:
                lines.append(
                    f"• {item.drug.capitalize()} + {item.food}: [{item.severity}] {item.mechanism}\n"
                    f"  Khuyến nghị: {item.recommendation}"
                )
            answer_text = "\n".join(lines)
        else:
            answer_text = "Không tìm thấy tương tác nguy hiểm giữa các thuốc và thực phẩm kiểm tra."

        all_sources = list({src for item in interactions for src in item.sources})

        return {
            **state,
            "answer": answer_text,
            "interactions": result,
            "citations": all_sources,
        }
    except Exception as e:
        logger.error("Interaction check failed: %s", e, exc_info=True)
        return {
            **state,
            "answer": f"Lỗi khi kiểm tra tương tác: {str(e)}",
            "interactions": None,
            "errors": state.get("errors", []) + [str(e)],
        }


def food_log_node(state: AgentState) -> AgentState:
    """Summarize recent food logs for the patient."""
    db = state.get("db")
    user_id = state.get("user_id", "")

    if db is None or not user_id:
        return {
            **state,
            "answer": "Tính năng ghi nhận bữa ăn chưa khả dụng trong phiên bản này.",
            "food_log": None,
        }

    from app.models.food_log import FoodLog

    logs = (
        db.query(FoodLog)
        .filter(FoodLog.user_id == user_id)
        .order_by(FoodLog.logged_at.desc())
        .limit(3)
        .all()
    )
    if not logs:
        return {
            **state,
            "answer": (
                "Bạn chưa có ghi nhận bữa ăn nào. "
                "Hãy mở mục «Ghi nhận bữa ăn» trên ứng dụng để ghi lại các bữa trong ngày."
            ),
            "food_log": None,
        }

    slot_labels = {"morning": "Bữa sáng", "noon": "Bữa trưa", "evening": "Bữa tối"}
    lines = ["Ghi nhận bữa ăn gần đây của bạn:"]
    for log in reversed(logs):
        label = slot_labels.get(log.slot, log.slot)
        if log.type == "as_planned":
            lines.append(f"• {label}: Đã ăn theo kế hoạch")
        else:
            lines.append(f"• {label}: Ăn khác — {log.note}")

    return {
        **state,
        "answer": "\n".join(lines),
        "food_log": {"recent_count": len(logs)},
    }


def refuse_node(state: AgentState) -> AgentState:
    """Handle requests outside scope (e.g. change medication, prescribe)."""
    return {
        **state,
        "answer": get_refuse_message(),
        "guardrail_flags": state.get("guardrail_flags", []) + ["refuse_medical_scope"],
    }


def unknown_node(state: AgentState) -> AgentState:
    """Handle unknown/unclassified intents."""
    return {
        **state,
        "answer": (
            "Tôi chưa hiểu rõ yêu cầu của bạn. Tôi có thể hỗ trợ:\n"
            "1. 📋 Lập thực đơn 7 ngày theo bệnh lý\n"
            "2. ⚠️ Kiểm tra tương tác thuốc-thực phẩm\n"
            "3. ❓ Trả lời câu hỏi về dinh dưỡng\n\n"
            "Bạn muốn hỏi về vấn đề nào?"
        ),
    }


def apply_guardrails(state: AgentState) -> AgentState:
    """Post-process node: citation checks and unsafe recommendation blocking."""
    intent = state.get("intent", "unknown")
    answer = state.get("answer") or ""
    citations = list(state.get("citations") or [])
    flags = list(state.get("guardrail_flags") or [])

    answer, citation_flags, citations = enforce_citation_guardrail(intent, answer, citations)
    flags.extend(citation_flags)

    answer, safety_flags, force_refuse = enforce_output_safety(answer)
    flags.extend(safety_flags)
    if force_refuse:
        intent = "refuse"

    return {
        **state,
        "intent": intent,
        "answer": answer,
        "citations": citations,
        "guardrail_flags": flags,
    }


# --- Router ---

def route_intent(state: AgentState) -> Literal[
    "rag_qa", "meal_plan", "interaction_check", "food_log", "refuse", "unknown"
]:
    """Route to the appropriate node based on classified intent."""
    intent = state.get("intent", "unknown")

    if intent in ("rag_qa", "meal_plan", "interaction_check", "food_log", "refuse"):
        return intent

    return "unknown"


# --- Build Graph ---

def build_graph() -> StateGraph:
    """Build and compile the LangGraph agent workflow."""
    graph = StateGraph(AgentState)

    graph.add_node("profile_loader", profile_loader)
    graph.add_node("intent_classifier", intent_classifier)
    graph.add_node("rag_qa", rag_qa_node)
    graph.add_node("meal_plan", meal_plan_node)
    graph.add_node("interaction_check", interaction_check_node)
    graph.add_node("food_log", food_log_node)
    graph.add_node("refuse", refuse_node)
    graph.add_node("unknown", unknown_node)
    graph.add_node("apply_guardrails", apply_guardrails)

    graph.set_entry_point("profile_loader")
    graph.add_edge("profile_loader", "intent_classifier")

    graph.add_conditional_edges(
        "intent_classifier",
        route_intent,
        {
            "rag_qa": "rag_qa",
            "meal_plan": "meal_plan",
            "interaction_check": "interaction_check",
            "food_log": "food_log",
            "refuse": "refuse",
            "unknown": "unknown",
        },
    )

    graph.add_edge("rag_qa", "apply_guardrails")
    graph.add_edge("meal_plan", "apply_guardrails")
    graph.add_edge("interaction_check", "apply_guardrails")
    graph.add_edge("food_log", "apply_guardrails")
    graph.add_edge("refuse", "apply_guardrails")
    graph.add_edge("unknown", "apply_guardrails")
    graph.add_edge("apply_guardrails", END)

    return graph


# Compile once
_compiled_graph = None


def get_compiled_graph():
    """Get or compile the agent graph (singleton)."""
    global _compiled_graph
    if _compiled_graph is None:
        graph = build_graph()
        _compiled_graph = graph.compile()
        logger.info("Agent graph compiled successfully")
    return _compiled_graph


def reset_compiled_graph() -> None:
    """Clear cached graph (for tests after graph structure changes)."""
    global _compiled_graph
    _compiled_graph = None


# --- Facade ---

def run_agent(input_data: AgentRunInput, db=None) -> AgentRunOutput:
    """Run the agent graph with the given input.

    This is the main facade function that BE2 calls.

    Args:
        input_data: AgentRunInput with user_id, message, and optional force_intent.

    Returns:
        AgentRunOutput with the agent's response.
    """
    compiled = get_compiled_graph()

    initial_state: AgentState = {
        "user_id": input_data.user_id,
        "message": input_data.message,
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
        "answer": None,
        "citations": [],
        "guardrail_flags": [],
        "errors": [],
    }

    try:
        final_state = compiled.invoke(initial_state)
    except Exception as e:
        logger.error("Agent graph execution failed: %s", e, exc_info=True)
        return AgentRunOutput(
            intent="unknown",
            secondary_intents=[],
            message=f"Đã xảy ra lỗi trong quá trình xử lý: {str(e)}",
            guardrail_triggered=False,
        )

    meal_plan_obj = final_state.get("meal_plan")
    meal_plan_id = final_state.get("meal_plan_id") or (
        meal_plan_obj.id if meal_plan_obj else None
    )
    meal_preview_raw = final_state.get("meal_preview")
    meal_preview = None
    if meal_preview_raw:
        from app.schemas.meal_plan import MealPreviewOut

        meal_preview = MealPreviewOut(**meal_preview_raw)

    return AgentRunOutput(
        intent=final_state.get("intent", "unknown"),
        secondary_intents=final_state.get("secondary_intents", []),
        message=final_state.get("answer", ""),
        meal_plan_id=meal_plan_id,
        meal_preview=meal_preview,
        food_log_id=None,
        alert_ids=[],
        citations=final_state.get("citations", []),
        guardrail_triggered=bool(final_state.get("guardrail_flags")),
    )
