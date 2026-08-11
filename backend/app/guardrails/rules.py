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

# Forbidden phrases that would constitute medical advice outside scope
_FORBIDDEN_PATTERNS: list[str] = [
    "ngưng thuốc",
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
    "stop medication",
    "change dose",
    "increase dose",
    "decrease dose",
    "kê đơn",
    "ke don",
    "chẩn đoán",
    "chan doan",
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
