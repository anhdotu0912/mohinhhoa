"""Observational advice when body metrics change beyond demo thresholds.

HITL: never diagnose, never change medication. Used by POST /metrics and
the metrics_delta_advice agent node.
"""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.orm import Session

from app.models.body_metrics import BodyMetricsEntry
from app.schemas.body_metrics import MetricsDeltaAdviceOut
from app.services.metrics_format import parse_blood_pressure, parse_glucose_mmol

logger = logging.getLogger(__name__)

THRESHOLDS: dict[str, float] = {
    "weight": 1.0,
    "glucose_fasting": 1.0,
    "glucose_postprandial": 1.0,
    "systolic": 10.0,
    "waist_cm": 2.0,
    "hba1c": 0.3,
}

FIELD_LABELS: dict[str, str] = {
    "weight": "cân nặng",
    "glucose_fasting": "đường huyết lúc đói",
    "glucose_postprandial": "đường huyết sau ăn",
    "systolic": "huyết áp tâm thu",
    "waist_cm": "vòng eo",
    "hba1c": "HbA1c",
}

FIELD_UNITS: dict[str, str] = {
    "weight": "kg",
    "glucose_fasting": "mmol/L",
    "glucose_postprandial": "mmol/L",
    "systolic": "mmHg",
    "waist_cm": "cm",
    "hba1c": "%",
}

GUIDELINE_OUTSIDE: dict[str, tuple[float | None, float | None]] = {
    "glucose_fasting": (4.4, 7.2),
    "glucose_postprandial": (None, 10.0),
    "systolic": (None, 130.0),
    "diastolic": (None, 80.0),
    "hba1c": (None, 7.0),
}


def _num(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def snapshot_from_entry(entry: BodyMetricsEntry | None) -> dict[str, Any] | None:
    if entry is None:
        return None
    systolic = entry.systolic
    diastolic = entry.diastolic
    if systolic is None or diastolic is None:
        parsed_sys, parsed_dia = parse_blood_pressure(entry.blood_pressure)
        systolic = systolic if systolic is not None else parsed_sys
        diastolic = diastolic if diastolic is not None else parsed_dia
    fasting = entry.glucose_fasting
    if fasting is None:
        fasting = parse_glucose_mmol(entry.blood_glucose)
    return {
        "weight": entry.weight,
        "waist_cm": entry.waist_cm,
        "systolic": systolic,
        "diastolic": diastolic,
        "glucose_fasting": fasting,
        "glucose_postprandial": entry.glucose_postprandial,
        "hba1c": entry.hba1c,
        "bmi": entry.bmi,
    }


def detect_changed_fields(
    previous: dict[str, Any] | None,
    current: dict[str, Any] | None,
) -> list[str]:
    if not previous or not current:
        return []
    changed: list[str] = []
    for field, threshold in THRESHOLDS.items():
        before = _num(previous.get(field))
        after = _num(current.get(field))
        if before is None or after is None:
            continue
        if abs(after - before) >= threshold:
            changed.append(field)
    return changed


def _outside_guideline(current: dict[str, Any]) -> bool:
    for field, (low, high) in GUIDELINE_OUTSIDE.items():
        value = _num(current.get(field))
        if value is None:
            continue
        if low is not None and value < low:
            return True
        if high is not None and value > high:
            return True
    return False


def _format_delta_line(field: str, previous: dict[str, Any], current: dict[str, Any]) -> str:
    unit = FIELD_UNITS[field]
    label = FIELD_LABELS[field]
    before = _num(previous.get(field))
    after = _num(current.get(field))
    return f"{label} {before:g} → {after:g} {unit}"


def _template_message(
    changed: list[str],
    previous: dict[str, Any],
    current: dict[str, Any],
) -> str:
    lines = [_format_delta_line(field, previous, current) for field in changed]
    joined = "; ".join(lines)
    return (
        f"Các chỉ số sau thay đổi rõ so với lần ghi trước: {joined}. "
        "Đây là diễn biến cần theo dõi cùng bác sĩ — không phải chẩn đoán."
    )


def _llm_message(
    changed: list[str],
    previous: dict[str, Any],
    current: dict[str, Any],
) -> str | None:
    try:
        from app.core.llm import get_chat_llm

        llm = get_chat_llm(temperature=0.2)
        if llm is None:
            return None
        details = "; ".join(_format_delta_line(f, previous, current) for f in changed)
        prompt = (
            "Bạn là trợ lý dinh dưỡng lâm sàng. Viết 1–2 câu tiếng Việt nhận xét "
            "khi chỉ số cơ thể của bệnh nhân đái tháo đường type 2 vừa thay đổi.\n"
            f"Thay đổi: {details}\n"
            "Quy tắc bắt buộc:\n"
            "- Chỉ quan sát xu hướng, không chẩn đoán, không kê/đổi/ngưng thuốc, không đổi liều.\n"
            "- Không hứa kết quả điều trị.\n"
            "- Nếu cần hành động, khuyên trao đổi với bác sĩ.\n"
            "- Tối đa 2 câu, không dùng emoji."
        )
        response = llm.invoke(prompt)
        content = (getattr(response, "content", None) or "").strip()
        return content or None
    except Exception as exc:
        logger.warning("metrics_delta_advice LLM failed: %s", exc)
        return None


def build_metrics_delta_advice(
    previous: dict[str, Any] | None,
    current: dict[str, Any] | None,
    *,
    require_threshold: bool = True,
) -> MetricsDeltaAdviceOut | None:
    if not current:
        return None
    changed = detect_changed_fields(previous, current)
    if require_threshold and not changed:
        return None
    if not changed:
        return MetricsDeltaAdviceOut(
            message=(
                "Chỉ số mới nhất chưa đổi rõ so với lần trước. "
                "Tiếp tục ghi nhận đều để theo dõi xu hướng."
            ),
            changed_fields=[],
            citations=[],
            ask_doctor=_outside_guideline(current),
        )

    message = _llm_message(changed, previous, current) or _template_message(
        changed, previous, current
    )
    return MetricsDeltaAdviceOut(
        message=message,
        changed_fields=changed,
        citations=[],
        ask_doctor=_outside_guideline(current),
    )


def advice_from_latest_entries(db: Session, user_id: str) -> MetricsDeltaAdviceOut | None:
    rows = (
        db.query(BodyMetricsEntry)
        .filter(BodyMetricsEntry.user_id == user_id)
        .order_by(BodyMetricsEntry.recorded_at.desc())
        .limit(2)
        .all()
    )
    if not rows:
        return None
    current = snapshot_from_entry(rows[0])
    previous = snapshot_from_entry(rows[1]) if len(rows) > 1 else None
    return build_metrics_delta_advice(previous, current, require_threshold=False)
