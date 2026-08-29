"""LangGraph agent graph — compiles the full agent workflow.

Flow: profile_loader → intent_classifier → conditional routing →
      (rag_qa / meal_plan / interaction_check / refuse) → apply_guardrails

Provides `run_agent()` facade function for BE2 to call.
"""

from __future__ import annotations

import logging
from typing import Literal

from langgraph.graph import END, StateGraph

from app.agents.nodes.intent_classifier import intent_classifier
from app.agents.nodes.profile_loader import profile_loader
from app.agents.nodes.rag_tool import rag_qa_node
from app.agents.state import AgentState
from app.guardrails.rules import enforce_output_safety
from app.guardrails.source_check import enforce_citation_guardrail
from app.schemas.meal_plan import (
    AgentRunInput,
    AgentRunOutput,
    DoctorNoteOut,
    MealPreviewOut,
    MetricsDeltaAdviceOut,
    WeeklyComplianceOut,
)

logger = logging.getLogger(__name__)


def _generate_allergy_blocked_answer(
    message: str,
    medications: list[str],
    foods: list[str],
    matched_allergies: list[str],
    interactions: list,
) -> str:
    """Generate a clear, medically safe response when queried food is blocked by patient's allergy."""
    meds_str = ", ".join(m.capitalize() for m in medications) or "thuốc điều trị hiện tại"
    food_names_str = ", ".join(f.capitalize() for f in foods)
    allergy_names_str = ", ".join(a.capitalize() for a in matched_allergies)

    try:
        from app.core.llm import get_chat_llm

        llm = get_chat_llm(temperature=0.2)
        if llm is not None:
            prompt = (
                f"Bạn là chuyên gia an toàn dinh dưỡng y tế và sử dụng thuốc cho bệnh nhân đái tháo đường & bệnh mạn tính.\n"
                f"Bệnh nhân có tiền sử DỊ ỨNG: [{allergy_names_str}].\n"
                f"Thuốc bệnh nhân đang dùng: [{meds_str}].\n"
                f"Câu hỏi của bệnh nhân: \"{message}\"\n"
                f"Thực phẩm được hỏi: [{food_names_str}] thuộc nhóm dị ứng [{allergy_names_str}].\n\n"
                "YÊU CẦU BẮT BUỘC (TUYỆT ĐỐI KHÔNG TỰ MÂU THUẪN, KHÔNG NÓI AN TOÀN KHI ĐÃ BỊ DỊ ỨNG):\n"
                "1. Đi thẳng trực tiếp vào nội dung, TUYỆT ĐỐI KHÔNG viết lời chào hỏi, cảm ơn lan man (như 'Chào bạn, cảm ơn bạn...', 'Dựa trên kết quả...').\n"
                "2. TUYỆT ĐỐI KHÔNG dùng đường kẻ `---`.\n"
                "3. Cấu trúc đúng 3 phần rõ ràng, cách nhau bởi 1 dòng trống (double newline):\n\n"
                f"🚫 **KHÔNG NÊN ĂN (Cảnh báo dị ứng):**\n"
                f"• Khẳng định rõ {food_names_str} thuộc nhóm dị ứng {allergy_names_str} trong hồ sơ của bạn. Tuyệt đối không nên ăn/dùng để tránh nguy cơ dị ứng hoặc sốc phản vệ.\n\n"
                f"💊 **Về thuốc đang sử dụng ({meds_str}):**\n"
                f"• Giải thích ngắn gọn: Mặc dù {food_names_str} không có tương tác hóa học xấu với {meds_str}, nhưng do yếu tố dị ứng nên bạn bắt buộc phải kiêng hoàn toàn.\n\n"
                f"💡 **Gợi ý thực phẩm thay thế an toàn:**\n"
                f"• Đưa ra 2-3 nguồn thực phẩm lành mạnh thay thế giàu dinh dưỡng (đạm, chất béo tốt) an toàn cho người đái tháo đường và không gây dị ứng {allergy_names_str} (ví dụ: thịt ức gà, thịt nạc, trứng, đậu phụ, quả bơ, dầu thực vật, hạt chia...).\n\n"
                "Trình bày khoa học, súc tích, định dạng markdown chuẩn."
            )
            response = llm.invoke(prompt)
            if response and getattr(response, "content", None):
                content = response.content.strip()
                if content:
                    return content
    except Exception as e:
        logger.warning("LLM allergy blocked answer generation failed: %s", e)

    return (
        f"🚫 **KHÔNG NÊN ĂN (Cảnh báo dị ứng):**\n"
        f"• Hồ sơ của bạn ghi nhận tiền sử dị ứng **{allergy_names_str}**, trong khi **{food_names_str}** thuộc nhóm này. Bạn **tuyệt đối không nên ăn** để tránh nguy cơ dị ứng hoặc sốc phản vệ.\n\n"
        f"💊 **Về thuốc đang sử dụng ({meds_str}):**\n"
        f"• Mặc dù {food_names_str} không ghi nhận tương tác nguy hiểm với thuốc bạn đang dùng, nhưng vì lý do dị ứng nên bạn **bắt buộc phải kiêng hoàn toàn**.\n\n"
        f"💡 **Gợi ý thực phẩm thay thế an toàn:**\n"
        f"• **Bổ sung chất đạm:** Thịt ức gà, thịt nạc lợn, trứng, đậu phụ.\n"
        f"• **Bổ sung chất béo tốt:** Quả bơ, dầu ô liu, hạt chia, hạt óc chó."
    )


def _generate_safe_food_answer(message: str, medications: list[str], foods: list[str]) -> str:
    """Generate an informative, friendly response when no dangerous interaction is found for queried foods."""
    meds_str = ", ".join(m.capitalize() for m in medications)
    food_names_str = ", ".join(foods)

    try:
        from app.core.llm import get_chat_llm

        llm = get_chat_llm(temperature=0.2)
        if llm is not None:
            prompt = (
                f"Bạn là chuyên gia dinh dưỡng y tế và an toàn sử dụng thuốc cho bệnh nhân đái tháo đường & bệnh mạn tính.\n"
                f"Thuốc bệnh nhân đang dùng: {meds_str}.\n"
                f"Câu hỏi của bệnh nhân: \"{message}\"\n"
                f"Kết quả tra cứu y khoa: KHÔNG có tương tác nguy hiểm hoặc chống chỉ định nào giữa {meds_str} và {food_names_str}.\n\n"
                "YÊU CẦU BẮT BUỘC:\n"
                "- Đi thẳng trực tiếp vào nội dung, TUYỆT ĐỐI KHÔNG viết lời chào hỏi, cảm ơn lan man (như 'Chào bạn, cảm ơn bạn...', 'Dựa trên kết quả...').\n"
                "- TUYỆT ĐỐI KHÔNG dùng đường kẻ `---`.\n"
                "- Trình bày KHOA HỌC, ngắn gọn theo 3 mục rõ ràng, cách nhau bởi 1 dòng trống (double newline):\n\n"
                f"1. ✅ **Xác nhận an toàn:** Khẳng định {food_names_str} an toàn / có thể ăn được khi đang dùng {meds_str}.\n"
                f"2. 🥗 **Giá trị dinh dưỡng & Lợi ích:** Nêu 1-2 điểm nổi bật về chỉ số đường huyết (GI), chất xơ, chất béo hoặc đạm có lợi cho sức khỏe.\n"
                f"3. 💡 **Khuyến nghị sử dụng & Chế biến:** Khẩu phần hợp lý và phương pháp chế biến lành mạnh (hấp, luộc, áp chảo ít dầu; hạn chế đường/mỡ bão hòa)."
            )
            response = llm.invoke(prompt)
            if response and getattr(response, "content", None):
                content = response.content.strip()
                if content:
                    return content
    except Exception as e:
        logger.warning("LLM safe food answer generation failed: %s", e)

    return (
        f"✅ **Xác nhận an toàn:** Không ghi nhận tương tác nguy hiểm giữa các thuốc bạn đang dùng ({meds_str}) và **{food_names_str}**.\n\n"
        f"🥗 **Giá trị dinh dưỡng:** {food_names_str.capitalize()} là thực phẩm an toàn, có thể bổ sung vào thực đơn đối với người bệnh đái tháo đường.\n\n"
        f"💡 **Khuyến nghị sử dụng & Chế biến:**\n"
        f"• Ăn với khẩu phần vừa phải, cân đối tổng lượng carbohydrate trong toàn bộ bữa ăn.\n"
        f"• Ưu tiên các phương pháp chế biến lành mạnh như hấp, luộc, hoặc áp chảo ít dầu."
    )




def meal_plan_node(state: AgentState) -> AgentState:
    """Read-only meal plan view — delegated to primitive skill get_patient_meal_plan with state pruning."""
    from app.agents.skills import get_lean_state_for_intent, get_patient_meal_plan

    lean = get_lean_state_for_intent(state, "meal_plan")
    db = lean.get("db")
    user_id = lean.get("user_id", "")
    message = lean.get("message", "")

    preview, answer, citations, meal_plan_id = get_patient_meal_plan(db, user_id, message)
    return {
        **state,
        "answer": answer,
        "meal_preview": preview.model_dump(mode="json") if preview else None,
        "meal_plan_id": meal_plan_id,
        "meal_plan": None,
        "citations": citations,
    }


def interaction_check_node(state: AgentState) -> AgentState:
    """InteractionChecker node — delegated to primitive skill check_drug_food_interaction with state pruning."""
    from app.agents.skills import check_drug_food_interaction, get_lean_state_for_intent

    lean = get_lean_state_for_intent(state, "interaction_check")
    medications = lean.get("medications") or ["metformin", "glipizide", "sitagliptin", "atorvastatin"]
    allergies = lean.get("allergies") or []
    message = lean.get("message", "")
    user_id = lean.get("user_id")
    db = lean.get("db")

    try:
        res = check_drug_food_interaction(
            message=message,
            medications=medications,
            allergies=allergies,
            user_id=user_id,
            db=db,
        )
        return {
            **state,
            "answer": res["answer"],
            "interactions": res["interactions"],
            "citations": res["citations"],
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
    """Summarize recent food logs — delegated to primitive skill log_food_adherence with state pruning."""
    from app.agents.skills import get_lean_state_for_intent, log_food_adherence

    lean = get_lean_state_for_intent(state, "food_log")
    db = lean.get("db")
    user_id = lean.get("user_id", "")
    answer, log_info = log_food_adherence(db, user_id, limit=4)
    return {
        **state,
        "answer": answer,
        "food_log": log_info,
    }


def weekly_compliance_node(state: AgentState) -> AgentState:
    """Summarize patient weekly adherence — delegated to primitive skill get_weekly_adherence_summary with state pruning."""
    from app.agents.skills import get_lean_state_for_intent, get_weekly_adherence_summary

    lean = get_lean_state_for_intent(state, "weekly_compliance")
    db = lean.get("db")
    user_id = lean.get("user_id", "")
    answer, weekly = get_weekly_adherence_summary(db, user_id, days=7)
    return {
        **state,
        "answer": answer,
        "weekly_compliance": weekly.model_dump(mode="json") if weekly else None,
    }


def greeting_node(state: AgentState) -> AgentState:
    """Handle greetings, introductions, thanks, and polite chit-chat — delegated to utility skill chit_chat_greeting."""
    from app.agents.skills import chit_chat_greeting, get_lean_state_for_intent

    lean = get_lean_state_for_intent(state, "greeting")
    message = lean.get("message", "")
    answer = chit_chat_greeting(message)
    return {
        **state,
        "answer": answer,
        "citations": [],
    }


def doctor_note_node(state: AgentState) -> AgentState:
    """Load assigned doctor's manual_reminder list — delegated to primitive skill get_doctor_notes with state pruning."""
    from app.agents.skills import get_doctor_notes, get_lean_state_for_intent

    lean = get_lean_state_for_intent(state, "doctor_note")
    db = lean.get("db")
    user_id = lean.get("user_id", "")
    answer, doctor_note = get_doctor_notes(db, user_id)
    return {
        **state,
        "answer": answer,
        "doctor_note": doctor_note.model_dump(mode="json") if doctor_note else None,
    }


def metrics_delta_advice_node(state: AgentState) -> AgentState:
    """Observational comment when body metrics change — HITL, no diagnosis."""
    db = state.get("db")
    user_id = state.get("user_id", "")
    if db is None or not user_id:
        return {
            **state,
            "answer": "Không thể đọc chỉ số lúc này. Vui lòng thử lại sau.",
            "metrics_delta_advice": None,
        }

    from app.services.metrics_delta_advice import advice_from_latest_entries

    advice = advice_from_latest_entries(db, user_id)
    if advice is None:
        return {
            **state,
            "answer": (
                "Bạn chưa có đủ dữ liệu chỉ số để nhận xét xu hướng. "
                "Hãy ghi nhận chỉ số trong mục Chỉ số sức khỏe."
            ),
            "metrics_delta_advice": None,
        }

    extra = " Hãy trao đổi với bác sĩ nếu bạn lo ngại." if advice.ask_doctor else ""
    return {
        **state,
        "answer": advice.message + extra,
        "citations": list(advice.citations),
        "metrics_delta_advice": advice.model_dump(mode="json"),
    }


def refuse_node(state: AgentState) -> AgentState:
    """Handle requests outside scope — delegated to utility skill refuse_unsafe_medication."""
    from app.agents.skills import refuse_unsafe_medication

    message = state.get("message", "")
    return {
        **state,
        "answer": refuse_unsafe_medication(message),
        "guardrail_flags": state.get("guardrail_flags", []) + ["refuse_medical_scope"],
    }


def _generate_dynamic_unknown_answer(message: str, profile: dict) -> str:
    """Generate a concise, empathetic, safety-conscious fallback answer using LLM."""
    diseases = ", ".join(profile.get("disease", [])) if profile else ""
    medications = ", ".join(profile.get("medications", [])) if profile else ""

    try:
        from app.core.llm import get_chat_llm

        llm = get_chat_llm(temperature=0.2)
        if llm is not None:
            profile_context = ""
            if diseases or medications:
                profile_context = f"\nHồ sơ bệnh nhân: Bệnh nền [{diseases or 'Chưa rõ'}], Thuốc [{medications or 'Chưa rõ'}]."

            prompt = (
                f"Bạn là Trợ lý Dinh dưỡng & Tuân thủ AI cho người bệnh mạn tính.{profile_context}\n"
                f"Tin nhắn người dùng: \"{message}\"\n\n"
                "QUY TẮC PHẢN HỒI (BẮT BUỘC CỰC KỲ NGẮN GỌN, DƯỚI 80 TỪ, TỐI ĐA 4 Ý, TUYỆT ĐỐI KHÔNG VIẾT VĂN MỞ ĐẦU LAN MAN):\n\n"
                "1. Nếu người dùng kêu MỆT, CHOÁNG, ĐÓI LẢ hoặc có triệu chứng thể chất:\n"
                "   - Ý 1: Khuyên ngồi/nằm nghỉ ngơi ngay ở nơi thoáng mát (1 câu ngắn).\n"
                "   - Ý 2: 🛑 **Nếu nghi hạ đường huyết** (run tay, vã mồ hôi, đói cồn cào): Uống ngay 1/2 ly nước đường/nước trái cây hoặc 3-4 viên kẹo (quy tắc 15-15).\n"
                "   - Ý 3: 🚨 **Cấp cứu:** Gọi ngay 115 hoặc báo người nhà nếu đau ngực, khó thở, hoặc mệt không giảm sau nghỉ ngơi.\n"
                "   - Ý 4: 💡 Khi đã hồi phục, tôi có thể gợi ý các món ăn nhẹ giúp bạn bồi bổ sức khỏe.\n\n"
                "2. Nếu là câu hỏi trò chuyện chung ngoài phạm vi:\n"
                "   - Trả lời thân thiện trong 1-2 câu ngắn.\n"
                "   - Nêu 3 chức năng chính: (1) Thực đơn 7 ngày, (2) Kiểm tra tương tác thuốc, (3) Tư vấn dinh dưỡng lâm sàng.\n\n"
                "YÊU CẦU ĐỊNH DẠNG: Chia các ý cách nhau bởi 1 dòng trống (double newline) để hiển thị thoáng đãng. Không tự ý chẩn đoán hay kê đơn."
            )
            response = llm.invoke(prompt)
            if response and getattr(response, "content", None):
                content = response.content.strip()
                if content:
                    return content
    except Exception as e:
        logger.warning("LLM dynamic unknown answer failed: %s", e)

    return (
        "Bạn hãy tạm dừng công việc và **ngồi hoặc nằm nghỉ ngơi ngay** ở nơi thoáng mát nhé.\n\n"
        "🛑 **Nếu nghi hạ đường huyết** (run tay, vã mồ hôi, đói cồn cào): Uống ngay 1/2 ly nước đường/nước trái cây hoặc 3-4 viên kẹo (quy tắc 15-15).\n\n"
        "🚨 **Cấp cứu:** Gọi ngay **115** hoặc báo người nhà nếu tức ngực, khó thở, hoặc mệt không thuyên giảm.\n\n"
        "💡 Khi bạn đã cảm thấy đỡ hơn, tôi là Trợ lý Dinh dưỡng AI sẵn sàng hỗ trợ gợi ý thực đơn và các món ăn nhẹ bồi bổ thể trạng."
    )


def unknown_node(state: AgentState) -> AgentState:
    """Handle unknown/unclassified intents with emergency triage check and empathetic fallback using pruned state."""
    from app.agents.skills import emergency_triage_check, get_lean_state_for_intent

    lean = get_lean_state_for_intent(state, "unknown")
    message = lean.get("message", "")
    triage = emergency_triage_check(message)
    if triage is not None:
        return {
            **state,
            "answer": triage["message"],
            "guardrail_flags": state.get("guardrail_flags", []) + [f"emergency_triage_{triage['type']}"],
        }

    profile = lean.get("profile", {})
    answer = _generate_dynamic_unknown_answer(message, profile)
    return {
        **state,
        "answer": answer,
    }



def apply_guardrails(state: AgentState) -> AgentState:
    """Post-process node: citation checks, unsafe recommendation blocking, and food safety filtering."""
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

    # Deterministic Food Safety & Allergy Guardrail (Tier-2 Post-Generation Filter)
    if not force_refuse and intent not in ("greeting", "refuse"):
        from app.guardrails.food_safety import enforce_food_safety_guardrail

        profile = state.get("profile") or {}
        medications = profile.get("medications", []) if isinstance(profile, dict) else (getattr(profile, "medications", []) or [])
        allergies = profile.get("allergies", []) if isinstance(profile, dict) else (getattr(profile, "allergies", []) or [])

        answer, food_safety_flags = enforce_food_safety_guardrail(
            answer=answer,
            medications=medications,
            allergies=allergies,
            db=state.get("db"),
        )
        flags.extend(food_safety_flags)

    return {
        **state,
        "intent": intent,
        "answer": answer,
        "citations": citations,
        "guardrail_flags": flags,
    }


# --- Router ---

def route_intent(state: AgentState) -> Literal[
    "greeting",
    "rag_qa",
    "meal_plan",
    "interaction_check",
    "food_log",
    "weekly_compliance",
    "doctor_note",
    "metrics_delta_advice",
    "refuse",
    "unknown",

]:
    """Route to the appropriate node based on classified intent."""
    intent = state.get("intent", "unknown")

    if intent in (
        "greeting",
        "rag_qa",
        "meal_plan",
        "interaction_check",
        "food_log",
        "weekly_compliance",
        "doctor_note",
        "metrics_delta_advice",
        "refuse",
    ):

        return intent

    return "unknown"


# --- Build Graph ---

def build_graph() -> StateGraph:
    """Build and compile the LangGraph agent workflow."""
    graph = StateGraph(AgentState)

    graph.add_node("profile_loader", profile_loader)
    graph.add_node("intent_classifier", intent_classifier)
    graph.add_node("greeting", greeting_node)
    graph.add_node("rag_qa", rag_qa_node)
    graph.add_node("meal_plan", meal_plan_node)
    graph.add_node("interaction_check", interaction_check_node)
    graph.add_node("food_log", food_log_node)
    graph.add_node("weekly_compliance", weekly_compliance_node)
    graph.add_node("doctor_note", doctor_note_node)
    graph.add_node("metrics_delta_advice", metrics_delta_advice_node)
    graph.add_node("refuse", refuse_node)
    graph.add_node("unknown", unknown_node)
    graph.add_node("apply_guardrails", apply_guardrails)

    graph.set_entry_point("profile_loader")
    graph.add_edge("profile_loader", "intent_classifier")

    graph.add_conditional_edges(
        "intent_classifier",
        route_intent,
        {
            "greeting": "greeting",
            "rag_qa": "rag_qa",
            "meal_plan": "meal_plan",
            "interaction_check": "interaction_check",
            "food_log": "food_log",
            "weekly_compliance": "weekly_compliance",
            "doctor_note": "doctor_note",
            "metrics_delta_advice": "metrics_delta_advice",
            "refuse": "refuse",
            "unknown": "unknown",
        },
    )

    graph.add_edge("greeting", "apply_guardrails")
    graph.add_edge("rag_qa", "apply_guardrails")
    graph.add_edge("meal_plan", "apply_guardrails")
    graph.add_edge("interaction_check", "apply_guardrails")
    graph.add_edge("food_log", "apply_guardrails")
    graph.add_edge("weekly_compliance", "apply_guardrails")
    graph.add_edge("doctor_note", "apply_guardrails")
    graph.add_edge("metrics_delta_advice", "apply_guardrails")
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

def build_agent_run_output(final_state: AgentState) -> AgentRunOutput:
    """Map final graph state to AgentRunOutput (shared by sync and streaming paths)."""
    meal_plan_obj = final_state.get("meal_plan")
    meal_plan_id = final_state.get("meal_plan_id") or (
        meal_plan_obj.id if meal_plan_obj else None
    )
    meal_preview_raw = final_state.get("meal_preview")
    meal_preview = None
    if meal_preview_raw:
        meal_preview = MealPreviewOut(**meal_preview_raw)

    weekly_compliance_raw = final_state.get("weekly_compliance")
    weekly_compliance = None
    if weekly_compliance_raw:
        weekly_compliance = WeeklyComplianceOut(**weekly_compliance_raw)

    doctor_note_raw = final_state.get("doctor_note")
    doctor_note = None
    if doctor_note_raw:
        doctor_note = DoctorNoteOut(**doctor_note_raw)

    metrics_advice_raw = final_state.get("metrics_delta_advice")
    metrics_delta_advice = None
    if metrics_advice_raw:
        metrics_delta_advice = MetricsDeltaAdviceOut(**metrics_advice_raw)

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
        weekly_compliance=weekly_compliance,
        doctor_note=doctor_note,
        metrics_delta_advice=metrics_delta_advice,
    )


import os

def run_agent(input_data: AgentRunInput, db=None) -> AgentRunOutput:
    """Run the agent graph with Langfuse tracing, token and cost tracking."""
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
        "weekly_compliance": None,
        "doctor_note": None,
        "metrics_delta_advice": None,
        "answer": None,
        "citations": [],
        "guardrail_flags": [],
        "errors": [],
    }

    # 1. Khởi tạo Langfuse Callback nếu có cấu hình API Key
    callbacks = []
    if os.getenv("LANGFUSE_PUBLIC_KEY") and os.getenv("LANGFUSE_SECRET_KEY"):
        try:
            from langfuse.langchain import CallbackHandler

            langfuse_handler = CallbackHandler(
                user_id=str(input_data.user_id) if input_data.user_id else "anonymous",
                tags=["p014-nutrition-agent", input_data.force_intent or "auto"],
                metadata={
                    "patient_id": str(input_data.user_id),
                },
            )
            callbacks.append(langfuse_handler)
        except Exception as e:
            logger.warning("Không thể khởi tạo Langfuse Handler: %s", e)

    config = {"callbacks": callbacks} if callbacks else None

    # 2. Thực thi graph với config callbacks
    try:
        final_state = compiled.invoke(initial_state, config=config)
    except Exception as e:
        logger.error("Agent graph execution failed: %s", e, exc_info=True)
        return AgentRunOutput(
            intent="unknown",
            secondary_intents=[],
            message=f"Đã xảy ra lỗi trong quá trình xử lý: {str(e)}",
            guardrail_triggered=False,
        )

    return build_agent_run_output(final_state)

