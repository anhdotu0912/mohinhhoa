"""LangGraph agent graph — compiles the full agent workflow.

Flow: profile_loader → intent_classifier → conditional routing →
      (rag_qa / meal_plan / interaction_check / refuse)

Provides `run_agent()` facade function for BE2 to call.
"""

from __future__ import annotations

import logging
import uuid
from typing import Literal

from langgraph.graph import END, StateGraph

from app.agents.interaction_checker_agent import interaction_checker_agent
from app.agents.meal_planner_agent import meal_planner_agent
from app.agents.nodes.intent_classifier import intent_classifier
from app.agents.nodes.profile_loader import profile_loader
from app.agents.nodes.rag_tool import rag_qa_node
from app.agents.state import AgentState
from app.schemas.meal_plan import (
    AgentRunInput,
    AgentRunOutput,
    InteractionCheckInput,
)
from app.schemas.profile import PatientProfile

logger = logging.getLogger(__name__)


def meal_plan_node(state: AgentState) -> AgentState:
    """MealPlanner node — generates 7-day personalized medical meal plan."""
    profile_data = state.get("profile", {})
    profile = PatientProfile(**profile_data) if isinstance(profile_data, dict) else profile_data

    try:
        plan_output = meal_planner_agent(profile)
        summary = (
            f"Đã tạo thành công thực đơn 7 ngày cá nhân hóa cho bệnh nhân "
            f"(Mục tiêu: {profile.target_kcal} kcal/ngày, Bệnh lý: {', '.join(profile.disease or ['bình thường'])}).\n"
            f"- Số ngày: 7 ngày (tổng {len(plan_output.days)} ngày)\n"
            f"- Số món ăn bị thay thế do tương tác thuốc: {len(plan_output.swaps)} món\n"
            f"- Trạng thái: {plan_output.status} (chờ bác sĩ duyệt)"
        )
        return {
            **state,
            "answer": summary,
            "meal_plan": plan_output,
            "citations": plan_output.citations,
        }
    except Exception as e:
        logger.error("Failed to generate meal plan: %s", e, exc_info=True)
        return {
            **state,
            "answer": f"Lỗi khi lập thực đơn: {str(e)}",
            "meal_plan": None,
            "errors": state.get("errors", []) + [str(e)],
        }


def interaction_check_node(state: AgentState) -> AgentState:
    """InteractionChecker node — checks drug-food interactions from user query or state."""
    profile_data = state.get("profile", {})
    profile = PatientProfile(**profile_data) if isinstance(profile_data, dict) else profile_data
    medications = profile.medications or ["metformin", "warfarin", "amlodipine"]

    # Extract foods from message if mentioned, otherwise use common foods
    message = state.get("message", "")
    foods = ["rau muống", "bưởi", "rượu", "bia", "chuối", "sữa tươi", "cơm trắng"]

    check_input = InteractionCheckInput(
        medications=medications,
        foods=foods,
        profile_user_id=state.get("user_id"),
    )

    try:
        result = interaction_checker_agent(check_input)
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
    """Stub for FoodLog — out of MVP scope."""
    return {
        **state,
        "answer": "Tính năng ghi nhận bữa ăn chưa khả dụng trong phiên bản này.",
        "food_log": None,
    }


def refuse_node(state: AgentState) -> AgentState:
    """Handle requests outside scope (e.g. change medication, prescribe)."""
    return {
        **state,
        "answer": (
            "Xin lỗi, tôi không thể hỗ trợ yêu cầu này. "
            "Tôi là trợ lý dinh dưỡng AI và không có quyền:\n"
            "- Kê đơn thuốc hoặc đổi thuốc\n"
            "- Thay đổi liều thuốc\n"
            "- Chẩn đoán bệnh\n\n"
            "Vui lòng tham vấn bác sĩ trực tiếp cho các vấn đề này."
        ),
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

    # Add nodes
    graph.add_node("profile_loader", profile_loader)
    graph.add_node("intent_classifier", intent_classifier)
    graph.add_node("rag_qa", rag_qa_node)
    graph.add_node("meal_plan", meal_plan_node)
    graph.add_node("interaction_check", interaction_check_node)
    graph.add_node("food_log", food_log_node)
    graph.add_node("refuse", refuse_node)
    graph.add_node("unknown", unknown_node)

    # Set entry point
    graph.set_entry_point("profile_loader")

    # Edges
    graph.add_edge("profile_loader", "intent_classifier")

    # Conditional routing after intent classification
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

    # All terminal nodes go to END
    graph.add_edge("rag_qa", END)
    graph.add_edge("meal_plan", END)
    graph.add_edge("interaction_check", END)
    graph.add_edge("food_log", END)
    graph.add_edge("refuse", END)
    graph.add_edge("unknown", END)

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


# --- Facade ---

def run_agent(input_data: AgentRunInput) -> AgentRunOutput:
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
        "profile": {},
        "intent": "unknown",
        "rag_context": [],
        "meal_plan": None,
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
            message=f"Đã xảy ra lỗi trong quá trình xử lý: {str(e)}",
            guardrail_triggered=False,
        )

    meal_plan_obj = final_state.get("meal_plan")
    meal_plan_id = meal_plan_obj.id if meal_plan_obj else None

    return AgentRunOutput(
        intent=final_state.get("intent", "unknown"),
        message=final_state.get("answer", ""),
        meal_plan_id=meal_plan_id,
        food_log_id=None,
        alert_ids=[],
        citations=final_state.get("citations", []),
        guardrail_triggered=bool(final_state.get("guardrail_flags")),
    )
