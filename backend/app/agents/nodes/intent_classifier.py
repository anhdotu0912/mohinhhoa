"""Intent Classifier node — classifies user message into agent intents.

Uses LLM (OpenAI) for classification with fallback to keyword matching.
"""

from __future__ import annotations

import logging
import re

from app.agents.state import AgentState
from app.guardrails.rules import REFUSE_REGEX_PATTERNS

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
    "weekly_compliance",
    "doctor_note",
    "metrics_delta_advice",
}

_RAG_QA_PATTERNS = [
    r"(?:những|các|danh sách|top|nhóm|hoa quả ngọt|trái cây ngọt)\s+(?:loại\s+)?(?:rau|củ|quả|trái cây|hoa quả|thực phẩm|thức ăn|đồ ăn|món ăn|đồ uống|hạt|thịt|cá|chất béo)",
    r"(?:loại|thực phẩm|rau|trái cây|hoa quả|thịt|cá|chất béo)\s+nào\s+(?:nên|không nên|không được|tốt|xấu|hạn chế|kiêng|tránh)",
    r"(?:bao nhiêu|chỉ số)\s+(?:calo|kcal|gi|đường huyết|carb|carbohydrate|protein|đạm|chất béo|natri|muối)",
    r"(?:tác dụng|lợi ích|ảnh hưởng|nguyên tắc)\s+(?:của|dinh dưỡng|khi bị|đối với)",
    r"(?:tiểu đường|đái tháo đường|bệnh nhân)\s+(?:nên|không nên|cần kiêng|kiêng gì|ăn được gì)",
    r"kiêng\s+(?:chất béo|đường|muối|tinh bột)\s+gì",
    r"(?:xoài|sầu riêng|hoa quả|trái cây).*(?:người tiểu đường|tiểu đường).*(?:ăn được không|nên ăn không)",
]

_INTENT_PATTERNS = {
    "refuse": REFUSE_REGEX_PATTERNS,
    "greeting": [
        r"\b(hello|hi|hey|alo|chào|xin chào|good morning|good afternoon|good evening)\b",
        r"(chào bạn|chào bác sĩ|chào bot|chào trợ lý|chào em|chào anh|chào chị|chào ad)",
        r"(bạn là ai|bạn có thể làm gì|bạn giúp được gì|chức năng của bạn|giới thiệu bản thân)",
        r"(cảm ơn|cám ơn|thank you|thanks|tks)",
        r"(tạm biệt|goodbye|bye bye|\bbye\b)",
    ],
    "weekly_compliance": [
        r"tuân thủ.*(tuần|gần đây|này|bao nhiêu)",
        r"tuần này.*(?:tuân thủ|ăn uống có chuẩn không|kế hoạch)",
        r"báo cáo tuân thủ",
        r"tỉ lệ tuân thủ",
        r"tỷ lệ tuân thủ",
        r"tuân thủ của tôi",
    ],
    "food_log": [
        r"^(?:ghi lại|ghi nhận|nhật ký|log)\b",
        r"ghi lại", r"ghi nhận", r"nhật ký", r"log", r"vừa ăn", r"đã ăn",
        r"hôm nay ăn rồi", r"sáng nay ăn rồi", r"tối qua.*ăn", r"đã ăn xong", r"ăn.*xong rồi",
        r"ăn đúng theo thực đơn",
    ],
    "doctor_note": [
        r"bác sĩ.*(dặn|nhắc|khuyên|lời dặn|lời nhắc|ghi chú|lưu ý)",
        r"lời nhắc.*bác sĩ",
        r"lời dặn.*bác sĩ",
        r"ghi chú.*bác sĩ",
        r"lời khuyên.*bác sĩ",
    ],
    "metrics_delta_advice": [
        r"chỉ số.*(sức khỏe|cơ thể|của tôi|thế nào|dạo này)",
        r"(cân nặng|đường huyết|huyết áp|bmi|hb\s*a1c|vòng eo).*(thế nào|xu hướng|tăng|giảm|nguy hiểm|theo dõi)",
        r"xu hướng.*(cân|đường huyết|huyết áp|chỉ số)",
        r"(theo dõi|dự đoán).*(cân|chỉ số)",
        r"\bđường\s+\d+",
        r"chỉ số mới",
    ],
    "unknown": [
        r"đói cồn cào",
        r"run lẩy bẩy",
        r"vã mồ hôi",
        r"muốn ngất xỉu",
        r"mất ý thức",
        r"nôn mửa liên tục",
        r"hoa mắt chóng mặt",
        r"đường huyết.*dưới 3\.0",
        r"mệt mỏi.*chán nản",
        r"kiêng khem nhiều quá",
    ],
    "meal_plan": [
        r"thực đơn", r"meal\s*plan", r"lên kế hoạch ăn", r"kế hoạch dinh dưỡng",
        r"gợi ý bữa ăn", r"7 ngày", r"bữa sáng.*bữa trưa.*bữa tối",
        r"ăn gì", r"nên ăn gì", r"lập thực đơn", r"tạo thực đơn", r"chế độ ăn",
        r"(?:hôm nay|sáng nay|trưa nay|tối nay)\s+(?:ăn gì|nên ăn gì|có món gì|thực đơn)",
        r"(?:hôm nay|sáng nay|trưa nay|tối nay)\s+ăn\s+.+?(?:được không|hay|không)",
        r"(?:thực đơn|món gì|ăn gì)\s+.*(?:hôm nay|sáng nay|trưa nay|tối nay|tuần này)",
        r"(?:trưa nay|sáng nay|tối nay)\s+nên\s+ăn\s+gì",
        r"bữa sáng", r"bữa trưa", r"bữa tối", r"xem thực đơn",
        r"thực đơn.*(tuần|7 ngày|cả tuần|này)",
        r"(xem|cho tôi xem|lịch ăn|kế hoạch ăn|xem lại).*thực đơn",
        r"thực đơn của tôi|thực đơn tuần này|tuần này ăn gì",
        r"(có|đã có|bác sĩ.*(đã|vừa)?\s*(tạo|lập|cho|lên))\s*(thực đơn|món)",
        r"(tôi|mình)\s*(đã)?\s*có\s*(thực đơn|kế hoạch ăn)\s*(chưa|nào)",
        r"(xem|kiểm tra)\s*(thực đơn|món ăn|bữa ăn)",
        r"món ăn.*(hôm nay|tuần này|bác sĩ)",
    ],
    "interaction_check": [
        r"tương tác.*(?:thuốc|metformin|gliclazide|glipizide|insulin|sitagliptin|atorvastatin|chống đông|hạ đường|thuốc mỡ máu)",
        r"(?:thuốc|metformin|gliclazide|glipizide|insulin|sitagliptin|atorvastatin|chống đông|hạ đường|thuốc mỡ máu).*(?:thực phẩm|ăn|uống|kiêng|kỵ|kị|rượu|bia|bưởi|tỏi|gừng|rau muống)",
        r"(?:kiêng|ăn|uống).*(?:tỏi|gừng|bưởi|rau muống|rượu|bia).*(?:khi|đang|dùng|thuốc)",
        r"drug.*food",
        r"interaction",
        r"uống\s*(?:thuốc|metformin|gliclazide|glipizide|insulin|statin|atorvastatin).*ăn",
        r"kiểm tra tương tác",
        r"có ăn được không.*đang (?:uống|dùng)",
        r"đang (?:uống|dùng).*(?:ăn|uống)\s+.*(?:được không|có sao không)",
        # Asking safety about a specific queried food item (e.g. "tôi ăn cá hồi được không", "uống rượu có sao không")
        r"(?:tôi|em|mình)?\s*(?:có thể|có nên|có)?\s*ăn\s+[^?.,!]+.*(?:được không|không ạ|có sao không|an toàn không)",
        r"[^?.,!\s]+(?:\s+[^?.,!\s]+){0,2}\s+(?:ăn được không|có ăn được không|uống được không|có uống được không)",
        r"(?:tôi|em|mình)?\s*(?:có thể|có nên|có)?\s*ăn\s+[^?.,!]+.*(?:khi|đang)\s*(?:uống|dùng)",
        r"(?:khi|đang)\s*(?:uống|dùng)\s+[^?.,!]+.*(?:ăn|uống|dùng)",
        r"uống\s+[^?.,!]+.*(?:có|được)\s*(?:ăn|uống)\s+[^?.,!]+.*(?:không|sao không)",
    ],
}

# Shopping/grocery queries — FE-only mock card; not a backend intent.
_GROCERY_PATTERNS = [
    r"đi chợ",
    r"siêu thị",
    r"mua nguyên liệu",
    r"danh sách đi chợ",
    r"nguyên liệu cần mua",
]


def _classify_by_keywords(message: str) -> str:
    """Fallback: classify intent using keyword patterns."""
    primary, _ = _detect_intents_by_keywords(message)
    return primary


def _detect_intents_by_keywords(message: str) -> tuple[str, list[str]]:
    """Detect primary and secondary intents using keyword patterns with positional disambiguation."""
    message_lower = message.lower().strip()

    # Priority 1: Refuse guardrails (unsafe medication requests must ALWAYS be refused first)
    for pat in REFUSE_REGEX_PATTERNS:
        if re.search(pat, message_lower):
            return "refuse", []

    for pattern in _GROCERY_PATTERNS:
        if re.search(pattern, message_lower):
            return "rag_qa", []

    # Priority check: If query starts with explicit action like "Ghi nhận...", prioritize food_log
    if re.match(r"^(?:ghi lại|ghi nhận|nhật ký|log)\b", message_lower):
        primary = "food_log"
        secondary = []
        for pattern in _RAG_QA_PATTERNS:
            if re.search(pattern, message_lower):
                secondary.append("rag_qa")
                break
        return primary, secondary

    # Check if asking meal advice for next slot ("trưa nay nên ăn gì", "sáng nay nên ăn gì")
    if re.search(r"(?:trưa nay|sáng nay|tối nay|hôm nay)\s+nên\s+ăn\s+gì", message_lower):
        primary = "meal_plan"
        secondary = []
        if re.search(r"lỡ ăn|đã ăn", message_lower):
            secondary.append("food_log")
        return primary, secondary

    # Check explicit general nutrition list queries first (prevent false positive interaction_check)
    has_explicit_drug = bool(
        re.search(r"tương tác|thuốc|metformin|gliclazide|glipizide|insulin|sitagliptin|atorvastatin|statin", message_lower)
    )
    if not has_explicit_drug:
        for pattern in _RAG_QA_PATTERNS:
            if re.search(pattern, message_lower):
                return "rag_qa", []

    matched_positions: list[tuple[int, str]] = []

    for intent, patterns in _INTENT_PATTERNS.items():
        if intent == "refuse":
            continue
        for pattern in patterns:
            m = re.search(pattern, message_lower)
            if m:
                matched_positions.append((m.start(), intent))
                break

    if not matched_positions:
        return "rag_qa", []

    # Sort matches by appearance in text to determine primary vs secondary clause
    matched_positions.sort(key=lambda x: x[0])
    ordered_intents: list[str] = []
    for _, intent in matched_positions:
        if intent not in ordered_intents:
            ordered_intents.append(intent)

    primary = ordered_intents[0]
    secondary = [i for i in ordered_intents[1:] if i in VALID_INTENTS and i != primary and i != "refuse"]
    return primary, secondary


def _classify_by_llm(message: str) -> str:
    """Classify intent using LLM (OpenAI GPT) empowered by Description Engineering & Negative Constraints."""
    try:
        from app.agents.skills.registry import format_intent_classification_prompt_snippet
        from app.core.llm import get_chat_llm

        llm = get_chat_llm(temperature=0)
        if llm is None:
            logger.debug("No LLM API key, falling back to keyword classification")
            return _classify_by_keywords(message)

        skill_descriptions_block = format_intent_classification_prompt_snippet()
        valid_intents_list = ", ".join(sorted(VALID_INTENTS))

        prompt = f"""Bạn là bộ định tuyến ý định (Intent Classifier) chính xác cao cho Trợ lý Y tế & Dinh dưỡng Đái Tháo Đường P-014.
Nhiệm vụ của bạn là phân loại tin nhắn của bệnh nhân vào ĐÚNG MỘT intent phù hợp nhất dựa trên các quy chuẩn Kỹ năng (Skills) và Ràng buộc Phủ định (Negative Constraints) dưới đây:

{skill_descriptions_block}

QUY TẮC RÀNG BUỘC PHỦ ĐỊNH QUAN TRỌNG (NEGATIVE CONSTRAINTS):
1. `rag_qa` vs `interaction_check`:
   - "những loại rau nào tôi không được ăn?" / "hoa quả nào tốt?" → `rag_qa` (Hỏi DANH SÁCH kiến thức dinh dưỡng tổng quát)
   - "tôi bị tiểu đường nên kiêng gì?" → `rag_qa` (Hỏi KIẾN THỨC chung về kiêng khem dinh dưỡng)
   - "ăn bưởi có được không?" / "tôi ăn cá hồi có sao không?" → `interaction_check` (Hỏi an toàn của MỘT THỰC PHẨM CỤ THỂ)
   - "uống metformin có uống rượu được không?" → `interaction_check` (Hỏi TƯƠNG TÁC THUỐC cụ thể)
2. `meal_plan` vs `rag_qa`:
   - "hôm nay ăn gì" / "thực đơn sáng nay" → `meal_plan` (Xem thực đơn bữa ăn cụ thể trong app)
   - "ăn gì tốt cho đường huyết" → `rag_qa` (Tư vấn kiến thức nhóm thực phẩm)
3. `food_log` vs `meal_plan`:
   - "sáng nay tôi đã ăn phở bò" / "vừa ăn xong" → `food_log` (Ghi nhận bữa ăn ĐÃ ĂN)
   - "sáng nay nên ăn gì" → `meal_plan` (Xem thực đơn SẼ ĂN)
4. `emergency_triage` vs `refuse` / `metrics_delta_advice`:
   - Dấu hiệu cấp cứu hạ đường huyết (run tay, vã mồ hôi, đói cồn cào, lơ mơ) → `unknown` (để kích hoạt triage cấp cứu)
   - Yêu cầu kê đơn thuốc mới, đổi thuốc, chỉnh liều → `refuse` (chặn theo quy chuẩn an toàn y tế)

Tin nhắn của bệnh nhân: "{message}"

Trả lời CHỈ DUY NHẤT một từ là tên intent hợp lệ ({valid_intents_list}), tuyệt đối không kèm giải thích."""

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
