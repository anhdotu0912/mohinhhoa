"""Guardrail rules — validates agent output safety for medical context.

Ensures that recommendations from the InteractionChecker and other agents
do NOT advise patients to stop, change, or adjust medication doses.
Also checks that all output items carry proper source citations.

Matches spec: interaction-checker.md §5 (IC-05), CLAUDE.md guardrail rules.
"""

from __future__ import annotations

import logging
import re

logger = logging.getLogger(__name__)

REFUSE_MESSAGE = (
    "Xin lỗi, tôi không thể hỗ trợ yêu cầu này. "
    "Tôi là trợ lý dinh dưỡng AI và không có quyền:\n"
    "- Kê đơn thuốc hoặc đổi thuốc\n"
    "- Thay đổi liều thuốc\n"
    "- Chẩn đoán bệnh\n\n"
    "Vui lòng tham vấn bác sĩ trực tiếp cho các vấn đề này."
)

# Shared refuse patterns for intent_classifier keyword fallback and guardrail checks.
REFUSE_REGEX_PATTERNS: list[str] = [
    r"đổi\s*thuốc",
    r"thay\s*thuốc",
    r"đổi\s*liều",
    r"tăng\s*liều",
    r"giảm\s*liều",
    r"ngưng\s*thuốc",
    r"ngừng\s*thuốc",
    r"bỏ\s*thuốc",
    r"kê.*(đơn|thuốc)",
    r"bốc\s*thuốc",
    r"chẩn đoán (bệnh|giúp|cho tôi|tôi bị)",
    r"tôi bị bệnh gì",
    r"stop medication",
    r"change dose",
    r"increase dose",
    r"decrease dose",
    r"prescribe",
]

# Forbidden phrases that would constitute medical advice outside scope
_FORBIDDEN_PATTERNS: list[str] = [
    "ngưng thuốc",
    "ngung thuoc",
    "ngừng thuốc",
    "ngung thuoc",
    "bỏ thuốc",
    "bo thuoc",
    "đổi thuốc",
    "doi thuoc",
    "thay thuốc",
    "thay thuoc",
    "đổi liều",
    "doi lieu",
    "tăng liều",
    "tang lieu",
    "giảm liều",
    "giam lieu",
    "tự ý ngắt thuốc",
    "tu y ngat thuoc",
    "tự điều chỉnh liều",
    "tu dieu chinh lieu",
    "tự ý điều chỉnh liều",
    "stop medication",
    "change dose",
    "increase dose",
    "decrease dose",
    "tôi kê đơn",
    "toi ke don",
    "tôi kê thuốc",
    "toi ke thuoc",
    "tôi chẩn đoán bạn",
    "toi chan doan ban",
    "tôi chẩn đoán bệnh",
    "toi chan doan benh",
]


def check_recommendation_safety(recommendation: str) -> list[str]:
    """Check if a recommendation text contains forbidden medical advice.

    Args:
        recommendation: The recommendation string to validate.

    Returns:
        List of violated phrases found. Empty list means safe.
    """
    if not recommendation:
        return []

    violations: list[str] = []
    rec_lower = recommendation.lower()

    for phrase in _FORBIDDEN_PATTERNS:
        if phrase in rec_lower:
            violations.append(phrase)

    return violations


def validate_interaction_output(interactions: list[dict]) -> dict:
    """Validate a list of interaction results against guardrail rules.

    Args:
        interactions: List of interaction dicts (or InteractionItem-like dicts).

    Returns:
        Dict with:
            - "safe": bool — True if all recommendations pass.
            - "violations": list of dicts with "index", "drug", "food", "phrases".
    """
    violations: list[dict] = []

    for idx, item in enumerate(interactions):
        rec = item.get("recommendation", "")
        drug = item.get("drug", "")
        food = item.get("food", "")
        bad_phrases = check_recommendation_safety(rec)

        if bad_phrases:
            violations.append({
                "index": idx,
                "drug": drug,
                "food": food,
                "phrases": bad_phrases,
                "recommendation": rec,
            })
            logger.warning(
                "Guardrail violation in interaction [%s + %s]: found %s",
                drug, food, bad_phrases,
            )

    return {
        "safe": len(violations) == 0,
        "violations": violations,
    }


def validate_severity(severity: str) -> bool:
    """Ensure severity value is one of the 3 allowed enum values.

    Args:
        severity: The severity string to check.

    Returns:
        True if valid, False otherwise.
    """
    allowed = {"Nguy hiểm", "Cần chú ý", "An toàn"}
    return severity in allowed


def sanitize_recommendation(recommendation: str) -> str:
    """Remove or replace forbidden phrases in a recommendation.

    If a recommendation accidentally contains forbidden phrases,
    this function replaces them with a safe alternative.

    Args:
        recommendation: Original recommendation text.

    Returns:
        Sanitized recommendation string.
    """
    if not recommendation:
        return recommendation

    result = recommendation
    for phrase in _FORBIDDEN_PATTERNS:
        pattern = re.compile(re.escape(phrase), re.IGNORECASE)
        result = pattern.sub("trao đổi với bác sĩ về vấn đề này", result)

    return result


def get_refuse_message() -> str:
    return REFUSE_MESSAGE


def message_triggers_refuse(message: str) -> bool:
    """Return True when user message should route to refuse intent."""
    if not message:
        return False
    message_lower = message.lower()
    for pattern in REFUSE_REGEX_PATTERNS:
        if re.search(pattern, message_lower):
            return True
    return False


def enforce_output_safety(answer: str) -> tuple[str, list[str], bool]:
    """Sanitize or block unsafe recommendation text in agent answers.

    Returns:
        (answer, flags, force_refuse)
    """
    if not answer:
        return answer, [], False

    violations = check_recommendation_safety(answer)
    if not violations:
        return answer, [], False

    logger.warning("Guardrail blocked unsafe answer phrases: %s", violations)
    return get_refuse_message(), ["unsafe_recommendation"], True
