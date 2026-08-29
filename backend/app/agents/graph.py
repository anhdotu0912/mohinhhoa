"""LangGraph agent graph — compiles the full agent workflow.

Flow: profile_loader → intent_classifier → conditional routing →
      (rag_qa / meal_plan / interaction_check / refuse) → apply_guardrails

Provides `run_agent()` facade function for BE2 to call.
"""

from __future__ import annotations

import logging
from typing import Literal

from langgraph.graph import END, StateGraph

from app.agents.interaction_checker_agent import (
    extract_foods_from_message,
    interaction_checker_agent,
    load_interaction_kb,
)
from app.agents.nodes.intent_classifier import intent_classifier
from app.agents.nodes.profile_loader import profile_loader
from app.agents.nodes.rag_tool import rag_qa_node
from app.agents.state import AgentState
from app.guardrails.rules import enforce_output_safety, get_refuse_message
from app.guardrails.source_check import enforce_citation_guardrail
from app.schemas.meal_plan import (
    AgentRunInput,
    AgentRunOutput,
    DoctorNoteItem,
    DoctorNoteOut,
    InteractionCheckInput,
    MealPreviewOut,
    MetricsDeltaAdviceOut,
    WeeklyComplianceOut,
)
from app.schemas.profile import PatientProfile

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


def _check_allergy_match(allergies: list[str], foods: list[str]) -> list[str]:
    """Check if any queried foods match patient allergies.

    Returns list of allergy warnings (empty if no match).
    Handles common Vietnamese food-allergy mappings.
    """
    if not allergies or not foods:
        return []

    # Mapping from allergy category → food items that belong to it
    _ALLERGY_FOOD_MAP: dict[str, list[str]] = {
        "hải sản": [
            "tôm", "cua", "mực", "nghêu", "sò", "ốc", "hàu", "bạch tuộc",
            "cá hồi", "cá thu", "cá basa", "cá rô phi", "cá lóc", "cá ngừ",
            "cá", "hải sản", "tôm hùm", "ghẹ", "cá tra", "cá chẽm",
        ],
        "sữa": ["sữa", "phô mai", "bơ", "kem", "sữa chua", "whey"],
        "đậu phộng": ["đậu phộng", "lạc", "bơ đậu phộng"],
        "trứng": ["trứng", "trứng gà", "trứng vịt"],
        "đậu nành": ["đậu nành", "đậu hũ", "tàu hũ", "nước tương", "miso"],
        "gluten": ["lúa mì", "bánh mì", "mì ống", "mì", "bột mì"],
    }

    warnings: list[str] = []
    for allergy in allergies:
        allergy_lower = allergy.lower().strip()
        related_foods = _ALLERGY_FOOD_MAP.get(allergy_lower, [allergy_lower])

        for food in foods:
            food_lower = food.lower().strip()
            if food_lower in related_foods or any(rf in food_lower for rf in related_foods):
                warnings.append(
                    f"⚠️ **CẢNH BÁO DỊ ỨNG:** Hồ sơ của bạn ghi nhận dị ứng **{allergy}**. "
                    f"**{food.capitalize()}** thuộc nhóm {allergy} — bạn **KHÔNG NÊN** ăn/dùng. "
                    f"Vui lòng tham khảo bác sĩ nếu cần thay thế."
                )
                break  # One warning per allergy category is enough

    return warnings


def interaction_check_node(state: AgentState) -> AgentState:
    """InteractionChecker node — checks drug-food interactions from user query or state."""
    profile_data = state.get("profile", {})
    profile = PatientProfile(**profile_data) if isinstance(profile_data, dict) else profile_data
    db = state.get("db")
    medications = profile.medications or ["metformin", "glipizide", "sitagliptin", "atorvastatin"]
    allergies = profile.allergies or []

    message = state.get("message", "")
    foods, is_specific_query = extract_foods_from_message(message)

    # P4: Check allergy FIRST — this takes priority over interaction check
    allergy_warnings = _check_allergy_match(allergies, foods)

    check_input = InteractionCheckInput(
        medications=medications,
        foods=foods,
        profile_user_id=state.get("user_id"),
    )

    try:
        result = interaction_checker_agent(check_input, db=db)
        interactions = result.interactions

        if allergy_warnings:
            # When food is matched with patient's allergy, use dedicated allergy-blocked answer
            # to NEVER contradict by saying "it is completely safe to eat"
            matched_allergies = [
                a for a in allergies if any(w for w in allergy_warnings if a.lower() in w.lower())
            ] or allergies
            answer_text = _generate_allergy_blocked_answer(
                message, medications, foods, matched_allergies, interactions
            )
        elif interactions:
            if is_specific_query:
                lines = [f"Phát hiện {len(interactions)} tương tác thuốc-thực phẩm cho yêu cầu của bạn:"]
            else:
                lines = ["Các tương tác thuốc-thực phẩm cần lưu ý đối với thuốc bạn đang dùng:"]

            for item in interactions:
                lines.append(
                    f"• **{item.drug.capitalize()} + {item.food}** [{item.severity}]: {item.mechanism}\n"
                    f"  💡 Khuyến nghị: {item.recommendation}"
                )
            answer_text = "\n\n".join(lines)
        else:
            if is_specific_query and foods:
                answer_text = _generate_safe_food_answer(message, medications, foods)
            else:
                meds_str = ", ".join(m.capitalize() for m in medications)
                answer_text = f"✅ Không tìm thấy tương tác nguy hiểm giữa các thuốc ({meds_str}) và thực phẩm được kiểm tra."

        all_sources = list({src for item in interactions for src in item.sources})

        return {
            **state,
            "answer": answer_text,
            "interactions": result,
            "citations": all_sources,
        }
    except Exception as e:
        logger.error("Interaction check failed: %s", e, exc_info=True)
        # Still show allergy warnings even if interaction check fails
        error_msg = f"Lỗi khi kiểm tra tương tác: {str(e)}"
        if allergy_warnings:
            error_msg = "\n\n".join(allergy_warnings) + "\n\n" + error_msg
        return {
            **state,
            "answer": error_msg,
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
        .limit(4)
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

    slot_labels = {"morning": "Bữa sáng", "noon": "Bữa trưa", "evening": "Bữa tối", "snack": "Bữa phụ"}
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


def weekly_compliance_node(state: AgentState) -> AgentState:
    """Summarize patient weekly adherence from ComplianceService."""
    db = state.get("db")
    user_id = state.get("user_id", "")

    if db is None or not user_id:
        return {
            **state,
            "answer": "Không thể tải dữ liệu tuân thủ lúc này. Vui lòng thử lại sau.",
            "weekly_compliance": None,
        }

    from app.services.compliance import ComplianceService

    compliance = ComplianceService(db).get_patient_compliance(user_id, days=7)
    weekly = WeeklyComplianceOut(
        overall_adherence_pct=compliance.overall_adherence_pct,
        daily_series=[
            {"date": point.date, "adherence_pct": point.adherence_pct}
            for point in compliance.daily_series
        ],
    )
    pct = compliance.overall_adherence_pct
    if pct is not None:
        answer = f"Tuân thủ tuần này của bạn đạt {pct}%."
    else:
        answer = (
            "Bạn chưa có dữ liệu tuân thủ tuần này. "
            "Hãy ghi nhận bữa ăn hoặc phản hồi check-in để theo dõi tiến độ."
        )

    return {
        **state,
        "answer": answer,
        "weekly_compliance": weekly.model_dump(mode="json"),
    }


def greeting_node(state: AgentState) -> AgentState:
    """Handle greetings, introductions, thanks, and polite chit-chat."""
    message = (state.get("message") or "").strip().lower()

    if any(thanks_word in message for thanks_word in ["cảm ơn", "cám ơn", "thank", "tks"]):
        answer = (
            "Rất vui được hỗ trợ bạn! Chúc bạn luôn dồi dào sức khỏe và kiểm soát đường huyết ổn định. "
            "Nếu bạn cần thêm thực đơn hay tra cứu dinh dưỡng, đừng ngần ngại nhắn tôi nhé!"
        )
    elif any(bye_word in message for bye_word in ["tạm biệt", "bye", "goodbye"]):
        answer = (
            "Tạm biệt bạn! Chúc bạn một ngày tốt lành và luôn duy trì lối sống lành mạnh."
        )
    else:
        answer = (
            "Xin chào! Tôi là Trợ lý Dinh dưỡng AI chuyên hỗ trợ bệnh nhân đái tháo đường type 2. "
            "Tôi có thể hỗ trợ bạn:\n\n"
            "1. 📋 **Xem & tra cứu thực đơn dinh dưỡng** phù hợp mức đường huyết\n"
            "2. ⚠️ **Kiểm tra tương tác thuốc - thực phẩm** (ví dụ: Metformin, Sulfonylurea uống khi nào, nên kiêng gì)\n"
            "3. 🥗 **Giải đáp dinh dưỡng & lối sống** (tinh bột, hoa quả, đếm carb, xử trí hạ đường huyết, chăm sóc bàn chân)\n\n"
            "Hôm nay tôi có thể giúp gì cho bạn?"
        )

    return {
        **state,
        "answer": answer,
        "citations": [],
    }


_DOCTOR_NOTE_LIMIT = 10


def _assigned_doctor_for_patient(db, user_id: str):
    from app.models.user import User

    patient = db.get(User, user_id)
    if patient is None or not patient.assigned_doctor_id:
        return None
    return db.get(User, patient.assigned_doctor_id)


def _doctor_display_name(doctor) -> str:
    if doctor is None:
        return ""
    name = (doctor.full_name or "").strip()
    if name:
        return name
    return (doctor.email or "").strip()


def _reminder_tags(payload: dict | None) -> list[str]:
    tags_raw = (payload or {}).get("tags", [])
    if not isinstance(tags_raw, list):
        return []
    return [str(tag) for tag in tags_raw if isinstance(tag, str) and tag.strip()]


def doctor_note_node(state: AgentState) -> AgentState:
    """Load assigned doctor's manual_reminder list for the patient — no invented name."""
    db = state.get("db")
    user_id = state.get("user_id", "")

    if db is None or not user_id:
        return {
            **state,
            "answer": "Không thể tải lời dặn bác sĩ lúc này. Vui lòng thử lại sau.",
            "doctor_note": None,
        }

    from app.models.notification import Notification

    doctor = _assigned_doctor_for_patient(db, user_id)
    awaiting_assignment = doctor is None

    from sqlalchemy import func as sa_func

    reminders = (
        db.query(Notification)
        .filter(
            Notification.user_id == user_id,
            Notification.type == "manual_reminder",
        )
        .order_by(sa_func.coalesce(Notification.scheduled_at, Notification.created_at).desc())
        .limit(_DOCTOR_NOTE_LIMIT + 1)
        .all()
    )
    has_more = len(reminders) > _DOCTOR_NOTE_LIMIT
    reminders = reminders[:_DOCTOR_NOTE_LIMIT]

    notes: list[DoctorNoteItem] = []
    for reminder in reminders:
        note_text = (reminder.body or reminder.title or "").strip()
        if not note_text:
            continue
        created_at = reminder.scheduled_at or reminder.created_at
        notes.append(
            DoctorNoteItem(
                id=reminder.id,
                title=(reminder.title or "").strip(),
                note=note_text,
                created_at=created_at,
                tags=_reminder_tags(reminder.payload if isinstance(reminder.payload, dict) else None),
            )
        )

    if not notes:
        if awaiting_assignment:
            answer = (
                "Bạn đang chờ bác sĩ nhận hồ sơ. Khi có lời dặn, tôi sẽ hiện tại đây."
            )
        else:
            answer = "Bạn chưa có lời dặn nào từ bác sĩ gần đây."
        return {
            **state,
            "answer": answer,
            "doctor_note": None,
        }

    latest = notes[0]
    doctor_name = _doctor_display_name(doctor)
    doctor_note = DoctorNoteOut(
        doctor_name=doctor_name,
        doctor_avatar=doctor.avatar if doctor is not None else None,
        note=latest.note,
        created_at=latest.created_at,
        tags=latest.tags,
        has_more=has_more,
        notes=notes,
    )

    who = doctor_name or "Bác sĩ phụ trách"
    if len(notes) == 1:
        answer = f"{who} dặn: {latest.note}"
    else:
        answer = f"{who} có {len(notes)} lời dặn gần đây."
        if has_more:
            answer += " Xem thêm trong thông báo."

    return {
        **state,
        "answer": answer,
        "doctor_note": doctor_note.model_dump(mode="json"),
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
    """Handle requests outside scope (e.g. change medication, prescribe)."""
    return {
        **state,
        "answer": get_refuse_message(),
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
    """Handle unknown/unclassified intents with empathetic dynamic guidance."""
    message = state.get("message", "")
    profile = state.get("profile", {})
    answer = _generate_dynamic_unknown_answer(message, profile)
    return {
        **state,
        "answer": answer,
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
        "weekly_compliance": None,
        "doctor_note": None,
        "metrics_delta_advice": None,
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

    return build_agent_run_output(final_state)
