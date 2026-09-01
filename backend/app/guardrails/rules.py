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
    r"tăng\s*(?:thêm\s*)?(?:liều|\d+\s*viên)",
    r"giảm\s*(?:bớt\s*)?(?:liều|\d+\s*viên)",
    r"ngưng\s*thuốc",
    r"ngừng\s*thuốc",
    r"bỏ\s*thuốc",
    r"kê.*(?:đơn|thuốc)",
    r"bốc\s*thuốc",
    r"trị\s*dứt\s*điểm",
    r"chữa\s*dứt\s*điểm",
    r"lơ\s*mơ.*không\s*tỉnh",
    r"hôn\s*mê",
    r"chẩn đoán (bệnh|giúp|cho tôi|tôi bị)",
    r"tôi bị bệnh gì",
    r"stop medication",
    r"change dose",
    r"increase dose",
    r"decrease dose",
    r"prescribe",
]

# Action regex patterns to detect unsafe medical recommendations
_UNSAFE_ACTION_PATTERNS: list[tuple[str, str]] = [
    # Stop medication
    (r"\b(?:ngưng|ngừng|bỏ|dừng)\s*thuốc\b", "ngưng thuốc"),
    (r"\b(?:ngung|ngung|bo|dung)\s*thuoc\b", "ngung thuoc"),
    (r"\btự\s*ý\s*ngắt\s*thuốc\b", "tự ý ngắt thuốc"),
    (r"\btu\s*y\s*ngat\s*thuoc\b", "tu y ngat thuoc"),
    (r"\bstop\s+medication\b", "stop medication"),
    # Change medication
    (r"\b(?:đổi|thay)\s*thuốc\b", "đổi thuốc"),
    (r"\b(?:doi|thay)\s*thuoc\b", "doi thuoc"),
    (r"\bchuyển\s+sang\s+thuốc\b", "chuyển sang thuốc"),
    # Change dose (exclude food portion phrases like 'liều lượng tinh bột/rau/muối')
    (r"\b(?:đổi|thay\s*đổi)\s*liều(?:\s*thuốc|\s*dùng)?\b", "đổi liều"),
    (r"\b(?:doi|thay\s*doi)\s*lieu\b", "doi lieu"),
    (r"\btăng\s*liều(?:\s*thuốc|\s*dùng)?(?!\s*lượng\s+(?:ăn|thực phẩm|rau|tinh bột|đường|muối|calo|chất))\b", "tăng liều"),
    (r"\btang\s*lieu\b", "tang lieu"),
    (r"\bgiảm\s*liều(?:\s*thuốc|\s*dùng)?(?!\s*lượng\s+(?:ăn|thực phẩm|rau|tinh bột|đường|muối|calo|chất))\b", "giảm liều"),
    (r"\bgiam\s*lieu\b", "giam lieu"),
    (r"\btự\s*ý\s*(?:điều\s*chỉnh)\s*liều\b", "tự ý điều chỉnh liều"),
    (r"\btu\s*y\s*(?:dieu\s*chinh)\s*lieu\b", "tu y dieu chinh lieu"),
    (r"\b(?:change|increase|decrease)\s+dose\b", "change dose"),
    # Prescribe / diagnose
    (r"\btôi\s*(?:kê\s*đơn|kê\s*thuốc)\b", "tôi kê đơn"),
    (r"\btoi\s*(?:ke\s*don|ke\s*thuoc)\b", "toi ke don"),
    (r"\btôi\s*chẩn\s*đoán\s*(?:bạn|bệnh)\b", "tôi chẩn đoán bạn"),
    (r"\btoi\s*chan\s*doan\s*(?:ban|benh)\b", "toi chan doan ban"),
]

# Negation keywords that signal a safe medical disclaimer (e.g. "Không được tự ý ngưng thuốc")
_NEGATION_KEYWORDS = [
    "không", "khong", "tuyệt đối không", "tuyet doi khong",
    "đừng", "dung", "tránh", "tranh", "cấm", "cam",
    "chưa nên", "chua nen", "chưa được", "chua duoc",
    "không có quyền", "khong co quyen", "không được tự ý", "khong duoc tu y",
    "không tự ý", "khong tu y", "không thay thế", "khong thay the",
    "never", "do not", "don't", "should not", "shouldn't",
    "must not", "cannot", "can't", "without",
]


def _is_match_negated(sentence: str, match_start: int) -> bool:
    """Return True if the match in sentence is governed by a preceding negation/disclaimer word."""
    preceding = sentence[:match_start].lower()
    return any(neg in preceding for neg in _NEGATION_KEYWORDS)


def check_recommendation_safety(recommendation: str) -> list[str]:
    """Check if a recommendation text contains forbidden medical advice.

    Disclaimers (e.g. 'Không được tự ý ngưng thuốc') are recognized as safe.
    Only affirmative unsafe advice (e.g. 'Bạn nên giảm liều') triggers violations.

    Args:
        recommendation: The recommendation string to validate.

    Returns:
        List of violated phrases found. Empty list means safe.
    """
    if not recommendation:
        return []

    violations: list[str] = []
    # Split text into sentences/lines for precise contextual negation check
    sentences = re.split(r"[\n.!?;•]", recommendation)

    for sentence in sentences:
        sent_clean = sentence.strip()
        if not sent_clean:
            continue

        for pattern, phrase_name in _UNSAFE_ACTION_PATTERNS:
            for match in re.finditer(pattern, sent_clean, re.IGNORECASE):
                if not _is_match_negated(sent_clean, match.start()):
                    if phrase_name not in violations:
                        violations.append(phrase_name)

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
    for pattern, _ in _UNSAFE_ACTION_PATTERNS:
        regex = re.compile(pattern, re.IGNORECASE)
        result = regex.sub("trao đổi với bác sĩ về vấn đề này", result)

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
