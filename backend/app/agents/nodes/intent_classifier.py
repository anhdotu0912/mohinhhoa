"""Intent Classifier node — classifies user message into agent intents.

Uses LLM (OpenAI) for classification with fallback to keyword matching.
"""

from __future__ import annotations

import logging
import re

from app.agents.state import AgentState

logger = logging.getLogger(__name__)

# Valid intents per contract §2
VALID_INTENTS = {
    "greeting",
    "meal_plan",
    "interaction_check",
    "food_log",
    "rag_qa",
    "refuse",
    "unknown",
}

# Keyword patterns for rule-based fallback (refuse patterns shared with guardrails.rules)
from app.guardrails.rules import REFUSE_REGEX_PATTERNS

_INTENT_PATTERNS = {
    "refuse": REFUSE_REGEX_PATTERNS,
    "meal_plan": [
        r"thực đơn", r"meal\s*plan", r"lên kế hoạch ăn", r"kế hoạch dinh dưỡng",
        r"gợi ý bữa ăn", r"7 ngày", r"bữa sáng.*bữa trưa.*bữa tối",
        r"ăn gì", r"nên ăn gì", r"lập thực đơn", r"tạo thực đơn", r"chế độ ăn",
        r"hôm nay", r"sáng nay", r"trưa nay", r"tối nay",
        r"bữa sáng", r"bữa trưa", r"bữa tối", r"xem thực đơn",
    ],
    "interaction_check": [
        r"tương tác.*(thuốc|metformin|gliclazide|insulin)",
        r"(thuốc|metformin|gliclazide|insulin).*thực phẩm",
        r"drug.*food",
        r"interaction",
        r"uống\s*(thuốc|metformin|gliclazide).*ăn",
        r"kiểm tra tương tác",
        r"có ăn được không.*đang uống",
    ],
    "food_log": [
        r"ghi lại", r"log", r"vừa ăn", r"đã ăn", r"hôm nay ăn rồi",
        r"sáng nay ăn rồi", r"tối qua ăn", r"bữa.*ăn.*xong",
    ],
    "greeting": [
        r"\b(hello|hi|hey|alo|chào|xin chào|good morning|good afternoon|good evening)\b",
        r"(chào bạn|chào bác sĩ|chào bot|chào trợ lý|chào em|chào anh|chào chị|chào ad)",
        r"(bạn là ai|bạn có thể làm gì|bạn giúp được gì|chức năng của bạn|giới thiệu bản thân)",
        r"(cảm ơn|cám ơn|thank you|thanks|tks)",
        r"(tạm biệt|goodbye|bye bye|\bbye\b)",
    ],
}


def _classify_by_keywords(message: str) -> str:
    """Fallback: classify intent using keyword patterns."""
    primary, _ = _detect_intents_by_keywords(message)
    return primary


def _detect_intents_by_keywords(message: str) -> tuple[str, list[str]]:
    """Detect primary and secondary intents using keyword patterns."""
    message_lower = message.lower()
    matched: list[str] = []

    for intent, patterns in _INTENT_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, message_lower):
                if intent not in matched:
                    matched.append(intent)
                break

    if not matched:
        return "rag_qa", []

    primary = matched[0]
    secondary = [i for i in matched[1:] if i in VALID_INTENTS and i != primary and i != "refuse"]
    return primary, secondary


def _classify_by_llm(message: str) -> str:
    """Classify intent using LLM (OpenAI GPT)."""
    try:
        from app.core.llm import get_chat_llm

        llm = get_chat_llm(temperature=0)
        if llm is None:
            logger.debug("No LLM API key, falling back to keyword classification")
            return _classify_by_keywords(message)

        prompt = f"""Phân loại intent của tin nhắn bệnh nhân sau vào ĐÚNG MỘT trong các loại:
- greeting: câu chào hỏi (hello, hi, xin chào), cảm ơn, tạm biệt, hỏi bạn là ai
- meal_plan: yêu cầu lập thực đơn, gợi ý bữa ăn, kế hoạch dinh dưỡng
- interaction_check: hỏi về tương tác thuốc-thực phẩm
- food_log: ghi lại bữa ăn đã ăn
- rag_qa: câu hỏi kiến thức về dinh dưỡng, sức khỏe, bệnh tiểu đường
- refuse: yêu cầu đổi thuốc, kê đơn, chẩn đoán (ngoài phạm vi)

Tin nhắn: "{message}"

Trả lời CHỈ tên intent, không giải thích."""

        response = llm.invoke(prompt)
        intent = response.content.strip().lower().replace('"', '').replace("'", "")

        if intent in VALID_INTENTS:
            return intent

        logger.warning("LLM returned invalid intent '%s', falling back to keywords", intent)
        return _classify_by_keywords(message)

    except Exception as e:
        logger.warning("LLM classification failed: %s, using keyword fallback", e)
        return _classify_by_keywords(message)


def intent_classifier(state: AgentState) -> AgentState:
    """Classify user intent from message.

    If `force_intent` is set in state, use that directly.
    Otherwise, try LLM classification with keyword fallback.
    Extracts secondary_intents for multi-intent questions.
    """
    # Honor force_intent if provided
    force_intent = state.get("force_intent")
    if force_intent and force_intent in VALID_INTENTS:
        logger.info("Using forced intent: %s", force_intent)
        return {**state, "intent": force_intent, "secondary_intents": []}

    message = state.get("message", "")
    if not message:
        return {**state, "intent": "unknown", "secondary_intents": []}

    kw_primary, kw_secondary = _detect_intents_by_keywords(message)
    intent = _classify_by_llm(message)
    if intent not in VALID_INTENTS:
        intent = kw_primary

    secondary_intents = [s for s in kw_secondary if s != intent]

    logger.info(
        "Classified intent: %s, secondary: %s (message: %s)",
        intent,
        secondary_intents,
        message[:50],
    )

    return {**state, "intent": intent, "secondary_intents": secondary_intents}
