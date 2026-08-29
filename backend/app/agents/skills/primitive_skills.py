"""Primitive Skills — Atomic, single-responsibility business functions for Agent.

Each skill performs exactly ONE domain task with minimum parameters and no cross-tool bloat.
Follows Modular Skills Architecture & Description Engineering (P-014 Phase 3).
"""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.orm import Session

from app.schemas.meal_plan import (
    DoctorNoteItem,
    DoctorNoteOut,
    InteractionCheckInput,
    InteractionCheckOutput,
    MealPreviewOut,
    MetricsDeltaAdviceOut,
    WeeklyComplianceOut,
)

_DOCTOR_NOTE_LIMIT = 10

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 1. get_patient_meal_plan
# ---------------------------------------------------------------------------
def get_patient_meal_plan(
    db: Session | None,
    user_id: str,
    message: str = "",
) -> tuple[MealPreviewOut | None, str, list[str], str | None]:
    """[MỤC ĐÍCH]: Đọc và hiển thị thực đơn dinh dưỡng cá nhân hóa của bệnh nhân từ cơ sở dữ liệu theo bữa/ngày/tuần mà không tạo mới hay gọi RAG.

    [KHI NÀO DÙNG]:
    • "Hôm nay tôi nên ăn gì?"
    • "Cho tôi xem thực đơn sáng nay"
    • "Bác sĩ đã lên thực đơn tuần này cho tôi chưa?"
    • "Trưa nay có món gì trong thực đơn?"

    [TUYỆT ĐỐI KHÔNG DÙNG]:
    • Hỏi kiến thức dinh dưỡng tổng quát hoặc danh sách nhóm thực phẩm (ví dụ: 'người tiểu đường nên ăn gì?', 'các loại rau tốt').
    • Hỏi kiểm tra an toàn hay tương tác của một món ăn cụ thể với thuốc đang uống (ví dụ: 'uống metformin có ăn bưởi được không?').
    • Ghi nhận món bệnh nhân vừa ăn xong (dùng skill log_food_adherence).

    Args:
        db: Active SQLAlchemy session.
        user_id: Patient user UUID.
        message: Optional user message for meal slot extraction (breakfast/lunch/dinner).

    Returns:
        tuple of (meal_preview, formatted_answer, citations, meal_plan_id)
    """
    if db is None or not user_id:
        return (
            None,
            "Không thể tải thực đơn lúc này. Vui lòng thử lại hoặc mở mục Thực đơn trên ứng dụng.",
            [],
            None,
        )

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

    return preview, answer, citations, meal_plan_id


# ---------------------------------------------------------------------------
# 2. check_drug_food_interaction & check_allergy_match
# ---------------------------------------------------------------------------
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


def check_allergy_match(allergies: list[str], foods: list[str]) -> list[str]:
    """[MỤC ĐÍCH]: Kiểm tra xem các món ăn người dùng hỏi có trùng khớp với tiền sử dị ứng trong hồ sơ bệnh nhân hay không.

    [KHI NÀO DÙNG]:
    • Người dùng hỏi về món ăn có thể gây dị ứng dựa trên danh sách dị ứng đã đăng ký.

    [TUYỆT ĐỐI KHÔNG DÙNG]:
    • Không dùng khi người dùng không có dị ứng hoặc không đề cập đến thực phẩm cụ thể.
    """
    if not allergies or not foods:
        return []

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
                break

    return warnings


def check_drug_food_interaction(
    message: str,
    medications: list[str],
    allergies: list[str] | None = None,
    user_id: str | None = None,
    db: Session | None = None,
) -> dict[str, Any]:
    """[MỤC ĐÍCH]: Tra cứu an toàn và cảnh báo tương tác giữa thuốc đang điều trị với thực phẩm cụ thể hoặc kiểm tra dị ứng thực phẩm theo hồ sơ bệnh nhân.

    [KHI NÀO DÙNG]:
    • "Uống metformin có ăn bưởi được không?"
    • "Tôi ăn tôm có sao không khi đang uống thuốc hạ đường huyết?"
    • "Thuốc điều trị này có kỵ rượu hay kiêng gì không?"
    • "Đang uống thuốc mỡ máu ăn bơ được không?"

    [TUYỆT ĐỐI KHÔNG DÙNG]:
    • Hỏi xem thực đơn ăn uống trong ngày hoặc trong tuần (dùng skill get_patient_meal_plan).
    • Hỏi danh sách nhóm thực phẩm kiến thức chung (ví dụ: 'các loại trái cây ít đường' — dùng skill search_medical_guidelines).
    • Yêu cầu kê đơn thuốc mới hoặc tự ý thay đổi liều lượng thuốc (dùng skill refuse_unsafe_medication).
    """
    from app.agents.interaction_checker_agent import (
        extract_foods_from_message,
        get_medication_known_interactions,
        interaction_checker_agent,
    )

    allergies = allergies or []
    foods, is_specific_query = extract_foods_from_message(message)
    allergy_warnings = check_allergy_match(allergies, foods)

    check_input = InteractionCheckInput(
        medications=medications,
        foods=foods,
        profile_user_id=user_id,
    )

    if not foods and not is_specific_query:
        interactions = get_medication_known_interactions(medications, db=db)
        result = InteractionCheckOutput(interactions=interactions, unmatched_pairs=[])
    else:
        result = interaction_checker_agent(check_input, db=db)
        interactions = result.interactions

    meds_str = ", ".join(m.capitalize() for m in medications)

    if allergy_warnings:
        from app.agents.graph import _generate_allergy_blocked_answer

        matched_allergies = [
            a for a in allergies if any(w for w in allergy_warnings if a.lower() in w.lower())
        ] or allergies
        answer_text = _generate_allergy_blocked_answer(
            message, medications, foods, matched_allergies, interactions
        )
    elif interactions:
        if is_specific_query and foods:
            lines = [f"Phát hiện {len(interactions)} tương tác thuốc-thực phẩm cho yêu cầu của bạn:"]
        else:
            lines = [f"Các tương tác thuốc-thực phẩm cần lưu ý đối với thuốc bạn đang dùng ({meds_str}):"]

        for item in interactions:
            lines.append(
                f"• **{item.drug.capitalize()} + {item.food}** [{item.severity}]: {item.mechanism}\n"
                f"  💡 Khuyến nghị: {item.recommendation}"
            )
        answer_text = "\n\n".join(lines)
    else:
        if is_specific_query and foods:
            from app.agents.graph import _generate_safe_food_answer
            answer_text = _generate_safe_food_answer(message, medications, foods)
        else:
            answer_text = f"✅ Không tìm thấy tương tác nguy hiểm giữa các thuốc ({meds_str}) và thực phẩm được kiểm tra trong cơ sở dữ liệu."

    all_sources = list({src for item in interactions for src in item.sources})

    return {
        "answer": answer_text,
        "interactions": result,
        "citations": all_sources,
        "has_allergy_warning": bool(allergy_warnings),
        "allergy_warnings": allergy_warnings,
    }


# ---------------------------------------------------------------------------
# 3. search_medical_guidelines
# ---------------------------------------------------------------------------
def search_medical_guidelines(
    query: str,
    profile: dict | None = None,
) -> tuple[list[dict], list[str]]:
    """[MỤC ĐÍCH]: Tra cứu hướng dẫn lâm sàng của Bộ Y Tế / ADA về kiến thức dinh dưỡng tổng quát, chỉ số GI, đếm carb, calo, và lối sống cho người đái tháo đường.

    [KHI NÀO DÙNG]:
    • "Những loại rau nào người tiểu đường không nên ăn?"
    • "Chỉ số GI của gạo lứt là bao nhiêu?"
    • "Lợi ích của cá hồi đối với kiểm soát đường huyết?"
    • "Bị đái tháo đường type 2 cần kiêng những gì?"

    [TUYỆT ĐỐI KHÔNG DÙNG]:
    • Bệnh nhân hỏi xem thực đơn cụ thể đã tạo trong ứng dụng (dùng skill get_patient_meal_plan).
    • Hỏi về tương tác cụ thể của một thực phẩm với thuốc đang uống (dùng skill check_drug_food_interaction).
    • Ghi nhận nhật ký bữa ăn vừa ăn (dùng skill log_food_adherence).
    • Bệnh nhân đang có dấu hiệu cấp cứu hạ đường huyết cấp tính (dùng skill emergency_triage_check).

    Returns:
        (rag_context_list, citations_list)
    """
    from app.agents.nodes.rag_tool import _build_rag_context
    return _build_rag_context(query, profile or {})


# ---------------------------------------------------------------------------
# 4. log_food_adherence
# ---------------------------------------------------------------------------
def log_food_adherence(
    db: Session | None,
    user_id: str,
    limit: int = 4,
) -> tuple[str, dict | None]:
    """[MỤC ĐÍCH]: Truy xuất và tổng hợp các bản ghi nhật ký bữa ăn gần đây của bệnh nhân từ cơ sở dữ liệu.

    [KHI NÀO DÙNG]:
    • "Sáng nay tôi đã ăn phở bò"
    • "Tôi vừa ăn xong bữa trưa đúng theo thực đơn"
    • "Xem lại nhật ký ăn uống gần đây của tôi"
    • "Hôm nay tôi đã ghi nhận những bữa ăn nào?"

    [TUYỆT ĐỐI KHÔNG DÙNG]:
    • Hỏi gợi ý thực đơn sắp tới (dùng skill get_patient_meal_plan).
    • Hỏi tra cứu calo hay kiến thức món ăn (dùng skill search_medical_guidelines).
    • Kiểm tra tương tác thuốc (dùng skill check_drug_food_interaction).
    """
    if db is None or not user_id:
        return "Tính năng ghi nhận bữa ăn chưa khả dụng trong phiên bản này.", None

    from app.models.food_log import FoodLog

    logs = (
        db.query(FoodLog)
        .filter(FoodLog.user_id == user_id)
        .order_by(FoodLog.logged_at.desc())
        .limit(limit)
        .all()
    )

    if not logs:
        return (
            "Bạn chưa có ghi nhận bữa ăn nào. "
            "Hãy mở mục «Ghi nhận bữa ăn» trên ứng dụng để ghi lại các bữa trong ngày.",
            None,
        )

    slot_labels = {
        "morning": "Bữa sáng",
        "noon": "Bữa trưa",
        "evening": "Bữa tối",
        "snack": "Bữa phụ",
    }
    lines = ["Ghi nhận bữa ăn gần đây của bạn:"]
    for log in reversed(logs):
        label = slot_labels.get(log.slot, log.slot)
        if log.type == "as_planned":
            lines.append(f"• {label}: Đã ăn theo kế hoạch")
        else:
            lines.append(f"• {label}: Ăn khác — {log.note}")

    return "\n".join(lines), {"recent_count": len(logs)}


# ---------------------------------------------------------------------------
# 5. get_weekly_adherence_summary
# ---------------------------------------------------------------------------
def get_weekly_adherence_summary(
    db: Session | None,
    user_id: str,
    days: int = 7,
) -> tuple[str, WeeklyComplianceOut | None]:
    """[MỤC ĐÍCH]: Tính toán và báo cáo tỷ lệ (%) tuân thủ kế hoạch ăn uống cùng chuỗi dữ liệu theo dõi 7 ngày gần nhất.

    [KHI NÀO DÙNG]:
    • "Tuần này tôi tuân thủ thực đơn bao nhiêu phần trăm?"
    • "Báo cáo tuân thủ tuần này của tôi thế nào?"
    • "Tỷ lệ tuân thủ ăn uống gần đây của tôi?"
    • "Xem tiến độ tuân thủ dinh dưỡng cả tuần"

    [TUYỆT ĐỐI KHÔNG DÙNG]:
    • Hỏi chi tiết thực đơn hôm nay ăn món gì (dùng skill get_patient_meal_plan).
    • Hỏi về xu hướng chỉ số cân nặng/đường huyết (dùng skill get_metrics_delta_advice).
    • Hỏi tương tác thuốc (dùng skill check_drug_food_interaction).
    """
    if db is None or not user_id:
        return "Không thể tải dữ liệu tuân thủ lúc này. Vui lòng thử lại sau.", None

    from app.services.compliance import ComplianceService

    compliance = ComplianceService(db).get_patient_compliance(user_id, days=days)
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

    return answer, weekly


# ---------------------------------------------------------------------------
# 6. get_metrics_delta_advice
# ---------------------------------------------------------------------------
def get_metrics_delta_advice(
    db: Session | None,
    user_id: str,
) -> tuple[str, MetricsDeltaAdviceOut | None]:
    """[MỤC ĐÍCH]: So sánh xu hướng thay đổi giữa 2 lần ghi nhận chỉ số sức khỏe gần nhất (cân nặng, đường huyết, BMI) và đưa ra nhận xét quan sát an toàn (không chẩn đoán).

    [KHI NÀO DÙNG]:
    • "Dạo này cân nặng của tôi thế nào?"
    • "Đường huyết của tôi có xu hướng tăng hay giảm?"
    • "Chỉ số sức khỏe gần đây có ổn định không?"
    • "Xu hướng BMI và huyết áp của tôi"

    [TUYỆT ĐỐI KHÔNG DÙNG]:
    • Tự ý chẩn đoán bệnh mới, kết luận khỏi bệnh hay tiên lượng bệnh.
    • Kê đơn thuốc hoặc thay đổi liều điều trị.
    • Bệnh nhân đang có triệu chứng cấp tính nguy kịch (vã mồ hôi, đói cồn cào, run tay — dùng skill emergency_triage_check).
    """
    if db is None or not user_id:
        return "Chỉ số sức khỏe của bạn đang được theo dõi ổn định cùng kế hoạch dinh dưỡng.", None

    from app.services.body_metrics_service import get_recent_metrics

    metrics_list = get_recent_metrics(db, user_id=user_id, limit=2)
    if not metrics_list:
        return (
            "Bạn chưa có bản ghi chỉ số cơ thể nào gần đây. "
            "Hãy nhập cân nặng và đường huyết tại mục Theo dõi để nhận lời khuyên dinh dưỡng phù hợp.",
            None,
        )

    curr = metrics_list[0]
    prev = metrics_list[1] if len(metrics_list) > 1 else None

    from app.agents.graph import _format_metrics_advice_message

    advice_out = _format_metrics_advice_message(curr, prev)
    return advice_out.message, advice_out


# ---------------------------------------------------------------------------
# 7. get_doctor_notes
# ---------------------------------------------------------------------------
def _assigned_doctor_for_patient(db: Session, user_id: str):
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


def get_doctor_notes(
    db: Session | None,
    user_id: str,
) -> tuple[str, DoctorNoteOut | None]:
    """[MỤC ĐÍCH]: Truy xuất danh sách lời nhắc/lời dặn manual_reminder từ bác sĩ được gán (không bịa tên).

    [KHI NÀO DÙNG]:
    • "Bác sĩ có dặn dò gì mới không?"
    • "Xem lời nhắc từ bác sĩ điều trị"
    • "Bác sĩ ghi chú gì về chế độ ăn của tôi?"
    • "Lời khuyên của bác sĩ trong lần khám gần nhất"

    [TUYỆT ĐỐI KHÔNG DÙNG]:
    • Hỏi kiến thức y khoa chung ngoài ghi chú hồ sơ (dùng skill search_medical_guidelines).
    • Hỏi thực đơn dinh dưỡng chi tiết (dùng skill get_patient_meal_plan).
    • Hỏi kiểm tra tương tác thuốc (dùng skill check_drug_food_interaction).
    """
    if db is None or not user_id:
        return "Không thể tải lời dặn bác sĩ lúc này. Vui lòng thử lại sau.", None

    from sqlalchemy import func as sa_func

    from app.models.notification import Notification
    from app.services.meal_plan_service import resolve_patient_plan_row

    doctor = _assigned_doctor_for_patient(db, user_id)
    awaiting_assignment = doctor is None

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

    if notes:
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
        return answer, doctor_note

    # Fallback: meal-plan adjustment note when no manual_reminder rows
    plan_row = resolve_patient_plan_row(db, user_id)
    if plan_row is not None and getattr(plan_row, "adjustment_note", None):
        adj_note = (plan_row.adjustment_note or "").strip()
        if adj_note:
            doctor_name = _doctor_display_name(doctor) or "Bác sĩ điều trị"
            doctor_note = DoctorNoteOut(
                doctor_name=doctor_name,
                doctor_avatar=doctor.avatar if doctor is not None else None,
                note=adj_note,
                created_at=plan_row.created_at,
                tags=[],
                notes=[],
            )
            return f"{doctor_name} dặn: {adj_note}", doctor_note

    if awaiting_assignment:
        answer = "Bạn đang chờ bác sĩ nhận hồ sơ. Khi có lời dặn, tôi sẽ hiện tại đây."
    else:
        answer = "Bạn chưa có lời dặn nào từ bác sĩ gần đây."
    return answer, None
