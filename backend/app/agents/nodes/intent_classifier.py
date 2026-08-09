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
    "meal_plan",
    "interaction_check",
    "food_log",
    "rag_qa",
    "refuse",
    "unknown",
}

# Keyword patterns for rule-based fallback
_INTENT_PATTERNS = {
    "meal_plan": [
        r"thực đơn", r"meal\s*plan", r"lên kế hoạch ăn", r"kế hoạch dinh dưỡng",
        r"gợi ý bữa ăn", r"7 ngày", r"bữa sáng.*bữa trưa.*bữa tối",
        r"ăn gì", r"nên ăn gì", r"lập thực đơn", r"chế độ ăn",
    ],
    "interaction_check": [
        r"tương tác.*thuốc", r"thuốc.*thực phẩm", r"drug.*food",
        r"interaction", r"warfarin", r"uống thuốc.*ăn",
        r"kiểm tra tương tác", r"có ăn được không.*đang uống",
    ],
    "food_log": [
        r"ghi lại", r"log", r"hôm nay ăn", r"sáng nay ăn", r"tối qua ăn",
        r"vừa ăn", r"bữa.*ăn.*xong",
    ],
    "refuse": [
        r"đổi thuốc", r"thay thuốc", r"đổi liều", r"tăng liều", r"giảm liều",
        r"ngưng thuốc", r"bỏ thuốc", r"kê thuốc", r"kê đơn",
        r"chẩn đoán", r"xét nghiệm",
    ],
}


def _classify_by_keywords(message: str) -> str:
    """Fallback: classify intent using keyword patterns."""
    message_lower = message.lower()

    for intent, patterns in _INTENT_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, message_lower):
                return intent

    return "rag_qa"  # Default to RAG Q&A for general questions


def _classify_by_llm(message: str) -> str:
    """Classify intent using LLM (OpenAI GPT)."""
    try:
        from langchain_openai import ChatOpenAI
        from app.core.config import settings

        if not settings.OPENAI_API_KEY:
            logger.debug("No OpenAI API key, falling back to keyword classification")
            return _classify_by_keywords(message)

        llm = ChatOpenAI(
            model=settings.LLM_MODEL,
            temperature=0,
            api_key=settings.OPENAI_API_KEY,
        )

        prompt = f"""Phân loại intent của tin nhắn bệnh nhân sau vào ĐÚNG MỘT trong các loại:
- meal_plan: yêu cầu lập thực đơn, gợi ý bữa ăn, kế hoạch dinh dưỡng
- interaction_check: hỏi về tương tác thuốc-thực phẩm
- food_log: ghi lại bữa ăn đã ăn
- rag_qa: câu hỏi chung về dinh dưỡng, sức khỏe
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
    """
    # Honor force_intent if provided
    force_intent = state.get("force_intent")
    if force_intent and force_intent in VALID_INTENTS:
        logger.info("Using forced intent: %s", force_intent)
        return {**state, "intent": force_intent}

    message = state.get("message", "")
    if not message:
        return {**state, "intent": "unknown"}

    # Try LLM first, with keyword fallback
    intent = _classify_by_llm(message)
    logger.info("Classified intent: %s (message: %s)", intent, message[:50])

    return {**state, "intent": intent}
