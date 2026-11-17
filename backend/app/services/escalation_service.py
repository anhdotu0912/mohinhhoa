"""Chat escalation HITL — patient opt-in handoff when AI cannot answer safely."""

from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.agents.skills.utility_skills import emergency_triage_check
from app.core.datetime_vn import utc_now_naive
from app.core.errors import APIError
from app.models.chat_escalation import ChatEscalation, ChatEscalationMessage
from app.models.chat_session import ChatMessage, ChatSession
from app.models.notification import Notification
from app.models.profile import Profile
from app.models.user import User
from app.schemas.escalation import (
    EscalationCreate,
    EscalationListItem,
    EscalationMessageOut,
    EscalationOut,
)
from app.schemas.meal_plan import UnmatchedPair
from app.services.notification import NotificationService

OPEN_STATUSES = ("waiting_doctor", "waiting_patient")
REASON_LABELS = {
    "missing_citations": "AI không tìm được nguồn tham khảo",
    "unknown": "Ngoài phạm vi trợ lý AI",
    "refuse": "Ngoài phạm vi y khoa của trợ lý",
    "unmatched_kb": "Chưa có dữ liệu tương tác thuốc–thực phẩm",
}


def classify_escalation_reason(
    *,
    intent: str | None,
    citations: list[str] | None,
    correction_reason: str | None,
    unmatched_pairs: list | None,
    guardrail_triggered: bool,
    user_text: str,
) -> str | None:
    """Return reason or None when the turn must not be escalated."""
    if emergency_triage_check(user_text):
        return None
    intent_norm = (intent or "").strip()
    if intent_norm == "refuse":
        return "refuse"
    if intent_norm == "unknown":
        return "unknown"
    if unmatched_pairs:
        return "unmatched_kb"
    cites = citations or []
    if intent_norm == "rag_qa" and (
        correction_reason == "missing_citations"
        or (guardrail_triggered and not cites)
        or not cites
    ):
        return "missing_citations"
    return None


def _truncate(text: str, limit: int = 160) -> str:
    cleaned = " ".join((text or "").split())
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[: limit - 1] + "…"


def _unmatched_as_dicts(pairs: list[UnmatchedPair] | list[dict] | None) -> list[dict]:
    out: list[dict] = []
    for item in pairs or []:
        if isinstance(item, dict):
            out.append({"drug": item.get("drug", ""), "food": item.get("food", "")})
        else:
            out.append({"drug": item.drug, "food": item.food})
    return [p for p in out if p["drug"] or p["food"]]


def _load_session_turn(
    db: Session, patient_id: str, session_id: str, ai_message_id: str
) -> tuple[ChatMessage | None, ChatMessage | None]:
    session = (
        db.query(ChatSession)
        .options(joinedload(ChatSession.messages))
        .filter(ChatSession.id == session_id, ChatSession.user_id == patient_id)
        .first()
    )
    if session is None:
        return None, None
    ordered = list(session.messages)
    ai_msg = next((m for m in ordered if m.id == ai_message_id and m.sender == "ai"), None)
    if ai_msg is None:
        return None, None
    prev_user = None
    for msg in ordered:
        if msg.id == ai_msg.id:
            break
        if msg.sender == "user":
            prev_user = msg
    return prev_user, ai_msg


def _notify_sent(db: Session, patient_id: str, escalation: ChatEscalation) -> Notification:
    question = _truncate(escalation.question_text or escalation.patient_note, 180)
    return NotificationService(db)._add(
        user_id=patient_id,
        type="escalation_sent",
        title="Đã gửi câu hỏi cho bác sĩ",
        body=question or "Câu hỏi của bạn đã được chuyển tới bác sĩ phụ trách.",
        scheduled_at=utc_now_naive(),
        status="sent",
        related_ids={"escalation_id": escalation.id},
        payload={"reason": escalation.reason},
    )


def _notify_reply(db: Session, patient_id: str, escalation: ChatEscalation, body: str) -> Notification:
    return NotificationService(db)._add(
        user_id=patient_id,
        type="escalation_reply",
        title="Bác sĩ đã phản hồi",
        body=_truncate(body, 180) or "Bác sĩ phụ trách đã trả lời câu hỏi của bạn.",
        scheduled_at=utc_now_naive(),
        status="sent",
        related_ids={"escalation_id": escalation.id},
        payload={"reason": escalation.reason},
    )


def _patient_display(db: Session, patient: User) -> tuple[str, str | None, list[str]]:
    name = (patient.full_name or "").strip() or patient.email
    profile = db.query(Profile).filter(Profile.user_id == patient.id).first()
    disease = list(profile.disease or []) if profile else []
    return name, patient.avatar, disease


def _to_out(
    db: Session,
    row: ChatEscalation,
    *,
    notification_id: str | None = None,
    include_messages: bool = True,
) -> EscalationOut:
    patient = db.get(User, row.patient_id)
    name, avatar, disease = (
        _patient_display(db, patient) if patient else ("Bệnh nhân", None, [])
    )
    messages = []
    if include_messages:
        msgs = row.messages if row.messages is not None else []
        messages = [
            EscalationMessageOut(
                id=m.id,
                sender=m.sender,  # type: ignore[arg-type]
                body=m.body,
                created_at=m.created_at,
                kind=m.kind,  # type: ignore[arg-type]
            )
            for m in msgs
        ]
    return EscalationOut(
        id=row.id,
        patient_id=row.patient_id,
        doctor_id=row.doctor_id,
        patient_name=name,
        patient_avatar=avatar,
        patient_disease=disease,
        session_id=row.session_id,
        ai_message_id=row.ai_message_id,
        question_text=row.question_text or "",
        answer_text=row.answer_text or "",
        reason=row.reason,  # type: ignore[arg-type]
        patient_note=row.patient_note or "",
        status=row.status,  # type: ignore[arg-type]
        messages=messages,
        notification_id=notification_id,
        created_at=row.created_at,
        updated_at=row.updated_at,
        resolved_at=row.resolved_at,
        last_message_at=max((m.created_at for m in row.messages), default=row.created_at),
    )


def _get_open_for_patient(db: Session, patient_id: str) -> ChatEscalation | None:
    return (
        db.query(ChatEscalation)
        .options(joinedload(ChatEscalation.messages))
        .filter(
            ChatEscalation.patient_id == patient_id,
            ChatEscalation.status.in_(OPEN_STATUSES),
        )
        .order_by(ChatEscalation.updated_at.desc())
        .first()
    )


def create_escalation(db: Session, patient: User, payload: EscalationCreate) -> EscalationOut:
    if not patient.assigned_doctor_id:
        raise APIError(
            400,
            "NO_ASSIGNED_DOCTOR",
            "Bạn đang chờ bác sĩ nhận hồ sơ. Khi được gán bác sĩ, bạn có thể gửi câu hỏi này.",
        )

    stored_user, stored_ai = _load_session_turn(
        db, patient.id, payload.session_id, payload.ai_message_id
    )
    stored_payload = (stored_ai.payload or {}) if stored_ai else {}

    question = (stored_user.text if stored_user else "") or payload.question_text
    answer = (stored_ai.text if stored_ai else "") or payload.answer_text
    intent = stored_payload.get("intent") or payload.intent
    citations = stored_payload.get("citations") or payload.citations or []
    correction_reason = stored_payload.get("correction_reason") or payload.correction_reason
    unmatched = stored_payload.get("unmatched_pairs") or _unmatched_as_dicts(payload.unmatched_pairs)
    guardrail = bool(stored_payload.get("guardrail_triggered", payload.guardrail_triggered))

    reason = classify_escalation_reason(
        intent=intent,
        citations=citations if isinstance(citations, list) else [],
        correction_reason=correction_reason,
        unmatched_pairs=unmatched,
        guardrail_triggered=guardrail,
        user_text=question,
    )
    if reason is None:
        raise APIError(
            400,
            "ESCALATION_NOT_ELIGIBLE",
            "Câu trả lời này không thuộc trường hợp cần chuyển bác sĩ.",
        )

    note = (payload.note or "").strip()
    existing = _get_open_for_patient(db, patient.id)
    now = utc_now_naive()

    if existing:
        if question and question != existing.question_text:
            db.add(
                ChatEscalationMessage(
                    escalation_id=existing.id,
                    sender="patient",
                    kind="context",
                    body=(
                        f"Câu hỏi mới từ chat:\n{question.strip()}\n\n"
                        f"Câu trả lời AI:\n{(answer or '').strip() or '(trống)'}"
                    ),
                )
            )
            existing.question_text = question
            existing.answer_text = answer or existing.answer_text
            existing.ai_message_id = payload.ai_message_id
            existing.session_id = payload.session_id
            existing.reason = reason
        if note:
            db.add(
                ChatEscalationMessage(
                    escalation_id=existing.id,
                    sender="patient",
                    kind="note",
                    body=note,
                )
            )
            if not existing.patient_note:
                existing.patient_note = note
        existing.status = "waiting_doctor"
        existing.updated_at = now
        notif = _notify_sent(db, patient.id, existing)
        db.commit()
        existing = _reload(db, existing.id)
        return _to_out(db, existing, notification_id=notif.id)

    row = ChatEscalation(
        patient_id=patient.id,
        doctor_id=patient.assigned_doctor_id,
        session_id=payload.session_id,
        ai_message_id=payload.ai_message_id,
        question_text=question or "",
        answer_text=answer or "",
        reason=reason,
        patient_note=note,
        status="waiting_doctor",
    )
    db.add(row)
    db.flush()
    if note:
        db.add(
            ChatEscalationMessage(
                escalation_id=row.id,
                sender="patient",
                kind="note",
                body=note,
            )
        )
    notif = _notify_sent(db, patient.id, row)
    db.commit()
    row = _reload(db, row.id)
    return _to_out(db, row, notification_id=notif.id)


def _reload(db: Session, escalation_id: str) -> ChatEscalation:
    row = (
        db.query(ChatEscalation)
        .options(joinedload(ChatEscalation.messages))
        .filter(ChatEscalation.id == escalation_id)
        .first()
    )
    assert row is not None
    return row


def _get_owned(db: Session, escalation_id: str, patient_id: str) -> ChatEscalation:
    row = (
        db.query(ChatEscalation)
        .options(joinedload(ChatEscalation.messages))
        .filter(ChatEscalation.id == escalation_id)
        .first()
    )
    if row is None or row.patient_id != patient_id:
        raise APIError(404, "ESCALATION_NOT_FOUND", "Không tìm thấy yêu cầu hỏi bác sĩ.")
    return row


def _get_for_doctor(db: Session, escalation_id: str, doctor_id: str) -> ChatEscalation:
    row = (
        db.query(ChatEscalation)
        .options(joinedload(ChatEscalation.messages))
        .filter(ChatEscalation.id == escalation_id)
        .first()
    )
    if row is None or row.doctor_id != doctor_id:
        raise APIError(404, "ESCALATION_NOT_FOUND", "Không tìm thấy yêu cầu hỏi bác sĩ.")
    return row


def get_patient_escalation(db: Session, patient: User, escalation_id: str) -> EscalationOut:
    return _to_out(db, _get_owned(db, escalation_id, patient.id))


def add_patient_message(db: Session, patient: User, escalation_id: str, body: str) -> EscalationOut:
    row = _get_owned(db, escalation_id, patient.id)
    if row.status == "resolved":
        raise APIError(400, "ESCALATION_RESOLVED", "Cuộc trao đổi này đã kết thúc.")
    text = body.strip()
    if not text:
        raise APIError(400, "EMPTY_MESSAGE", "Nội dung không được để trống.")
    db.add(
        ChatEscalationMessage(
            escalation_id=row.id,
            sender="patient",
            kind="reply",
            body=text,
        )
    )
    row.status = "waiting_doctor"
    row.updated_at = utc_now_naive()
    db.commit()
    row = _reload(db, row.id)
    return _to_out(db, row)


def list_doctor_escalations(
    db: Session, doctor: User, status: str | None = None
) -> list[EscalationListItem]:
    query = db.query(ChatEscalation).filter(ChatEscalation.doctor_id == doctor.id)
    wanted = (status or "open").strip()
    if wanted == "open":
        query = query.filter(ChatEscalation.status.in_(OPEN_STATUSES))
    elif wanted != "all":
        query = query.filter(ChatEscalation.status == wanted)
    rows = query.order_by(ChatEscalation.updated_at.desc()).all()
    last_messages = dict(
        db.query(ChatEscalationMessage.escalation_id, func.max(ChatEscalationMessage.created_at))
        .filter(ChatEscalationMessage.escalation_id.in_([row.id for row in rows]))
        .group_by(ChatEscalationMessage.escalation_id)
        .all()
    ) if rows else {}
    items: list[EscalationListItem] = []
    for row in rows:
        patient = db.get(User, row.patient_id)
        name, avatar, disease = (
            _patient_display(db, patient) if patient else ("Bệnh nhân", None, [])
        )
        items.append(
            EscalationListItem(
                id=row.id,
                patient_id=row.patient_id,
                doctor_id=row.doctor_id,
                patient_name=name,
                patient_avatar=avatar,
                patient_disease=disease,
                question_text=row.question_text or "",
                reason=row.reason,  # type: ignore[arg-type]
                status=row.status,  # type: ignore[arg-type]
                created_at=row.created_at,
                updated_at=row.updated_at,
                last_message_at=last_messages.get(row.id) or row.created_at,
            )
        )
    return items


def get_doctor_escalation(db: Session, doctor: User, escalation_id: str) -> EscalationOut:
    return _to_out(db, _get_for_doctor(db, escalation_id, doctor.id))


def add_doctor_message(db: Session, doctor: User, escalation_id: str, body: str) -> EscalationOut:
    row = _get_for_doctor(db, escalation_id, doctor.id)
    if row.status == "resolved":
        raise APIError(400, "ESCALATION_RESOLVED", "Cuộc trao đổi này đã kết thúc.")
    text = body.strip()
    if not text:
        raise APIError(400, "EMPTY_MESSAGE", "Nội dung không được để trống.")
    db.add(
        ChatEscalationMessage(
            escalation_id=row.id,
            sender="doctor",
            kind="reply",
            body=text,
        )
    )
    row.status = "waiting_patient"
    row.updated_at = utc_now_naive()
    _notify_reply(db, row.patient_id, row, text)
    db.commit()
    row = _reload(db, row.id)
    return _to_out(db, row)


def resolve_escalation(db: Session, doctor: User, escalation_id: str) -> EscalationOut:
    row = _get_for_doctor(db, escalation_id, doctor.id)
    if row.status != "resolved":
        row.status = "resolved"
        row.resolved_at = utc_now_naive()
        row.updated_at = row.resolved_at
        db.commit()
    return _to_out(db, _reload(db, row.id))
