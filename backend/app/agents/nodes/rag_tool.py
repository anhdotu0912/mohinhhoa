"""RAG Q&A node — retrieves context and generates answer with citations."""

from __future__ import annotations

import logging
from collections.abc import Iterator

from app.agents.state import AgentState
from app.rag.retriever import retrieve_foods, retrieve_guidelines

logger = logging.getLogger(__name__)


def retrieve_rag_context(message: str, profile: dict) -> tuple[list[dict], list[str]]:
    """Public alias for RAG retrieval (used by streaming orchestrator)."""
    return _build_rag_context(message, profile)


def _disease_search_keywords(diseases: list[str]) -> str:
    """Expand disease codes into rich medical keywords for vector retrieval."""
    keywords = []
    for d in diseases:
        d_lower = d.lower()
        if "t1" in d_lower or "tuyp_1" in d_lower:
            keywords.append("đái tháo đường típ 1 insulin carb counting hạ đường huyết DKA QĐ 1760")
        elif "gestational" in d_lower or "thai" in d_lower:
            keywords.append("đái tháo đường thai kỳ mang thai bữa phụ thai nhi OGTT QĐ 1470")
        elif "neuropathy" in d_lower or "than_kinh" in d_lower:
            keywords.append("bệnh thần kinh đái tháo đường liệt dạ dày tê bì alpha lipoic acid QĐ 3510")
        elif "t2" in d_lower or "prediabetes" in d_lower or "diabetes" in d_lower:
            keywords.append("đái tháo đường típ 2 metformin mục tiêu đường huyết QĐ 5481")
        else:
            keywords.append(d)
    return " ".join(keywords)


def _determine_guideline_authority(diseases: list[str]) -> str:
    """Return specific Ministry of Health decisions based on patient profile."""
    authorities = []
    for d in diseases:
        d_lower = d.lower()
        if "t1" in d_lower or "tuyp_1" in d_lower:
            authorities.append("ĐTĐ Típ 1 (QĐ 1760/QĐ-BYT)")
        elif "gestational" in d_lower or "thai" in d_lower:
            authorities.append("ĐTĐ Thai kỳ (QĐ 1470/QĐ-BYT)")
        elif "neuropathy" in d_lower or "than_kinh" in d_lower:
            authorities.append("Bệnh thần kinh ĐTĐ (QĐ 3510/QĐ-BYT)")
        elif "t2" in d_lower or "prediabetes" in d_lower:
            authorities.append("ĐTĐ Típ 2 (QĐ 5481/QĐ-BYT)")

    if not authorities:
        authorities.append("ĐTĐ Típ 2 (QĐ 5481/QĐ-BYT)")

    auth_str = ", ".join(dict.fromkeys(authorities))
    return f"Bộ Y Tế Việt Nam ({auth_str}) và Hiệp Hội Đái Tháo Đường Hoa Kỳ (ADA)"


def _build_rag_context(
    message: str,
    profile: dict,
    top_k_guidelines: int = 2,
    top_k_foods: int = 1,
) -> tuple[list[dict], list[str]]:
    """Retrieve verified clinical guidelines and targeted food knowledge with lean top_k (Zero-Bloat Context).

    Reduces chunk bloat from 11 down to top-2 guidelines (+ optional top-1 food item).
    Returns (rag_context_list, citation_list).
    """
    diseases = profile.get("disease", [])

    # Retrieve guidelines relevant to the question + expanded disease context
    disease_expanded = _disease_search_keywords(diseases)
    combined_query = f"{message} {disease_expanded}".strip()

    guideline_chunks = retrieve_guidelines(combined_query, top_k=top_k_guidelines)
    food_chunks = retrieve_foods(message, top_k=top_k_foods)

    rag_context = []
    citations = []

    for chunk in guideline_chunks:
        rag_context.append({
            "chunk_id": chunk.chunk_id,
            "text": chunk.text,
            "source": chunk.source,
            "score": chunk.score,
        })
        source_citation = f"{chunk.source}"
        if source_citation not in citations:
            citations.append(source_citation)

    for chunk in food_chunks:
        rag_context.append({
            "chunk_id": chunk.chunk_id,
            "text": chunk.text,
            "source": chunk.source,
            "score": chunk.score,
        })
        # Add food citation to list (matches contract format com_trang#food_db_vn)
        source_citation = f"{chunk.source}#{chunk.chunk_id}"
        if source_citation not in citations:
            citations.append(source_citation)

    return rag_context, citations


def _build_rag_prompt(message: str, rag_context: list[dict], profile: dict) -> str:
    """Build the structured clinical prompt for RAG answer generation using lean context."""
    context_texts = [c["text"] for c in rag_context[:2]]
    context_str = "\n---\n".join(context_texts) if context_texts else "Không tìm thấy thông tin liên quan."

    diseases_list = profile.get("disease", [])
    diseases = ", ".join(diseases_list) or "chưa rõ (mặc định ĐTĐ type 2)"
    authority_str = _determine_guideline_authority(diseases_list)

    return f"""Bạn là Trợ lý Dinh dưỡng Y khoa Chuyên nghiệp (Clinical Nutrition AI Assistant) chuyên về Đái tháo đường và bệnh mạn tính, tuân thủ hướng dẫn chính thức của {authority_str}.

NGỮ CẢNH BỆNH NỀN: {diseases}

TÀI LIỆU Y KHOA THAM KHẢO:
{context_str}

CÂU HỎI CỦA BỆNH NHÂN: {message}

QUY TẮC PHẢN HỒI (BẮT BUỘC TUÂN THỦ):
1. ĐI THẲNG VÀO TRỌNG TÂM: Trả lời chính xác, súc tích câu hỏi của người dùng (độ dài phù hợp khoảng 200–350 từ).
2. TUYỆT ĐỐI KHÔNG SUY DIỄN LAN MAN: KHÔNG tự động giải thích tác dụng phụ của thuốc, phác đồ điều trị, hoặc tiền sử dị ứng không liên quan nếu người dùng chỉ hỏi kiến thức dinh dưỡng/thực phẩm chung.
3. CẤU TRÚC TRÌNH BÀY KHOA HỌC:
   - 🎯 **Kết luận trực diện:** Phân loại rõ ràng (NÊN ĂN / CẦN HẠN CHẾ hoặc Có/Không).
   - 🔬 **Phân tích dinh dưỡng & GI/GL:** Nêu ngắn gọn chỉ số đường huyết (GI/GL), tinh bột, chất xơ và lợi ích chuyển hóa.
   - 💡 **Khuyến nghị khẩu phần & Cách chế biến:** Khẩu phần hợp lý và cách nấu lành mạnh (hấp, luộc, áp chảo ít dầu).
   - ⚠️ **Lưu ý an toàn chung:** 1-2 lời khuyên ngắn về kiểm soát đường huyết sau ăn, không tự ý bỏ bữa hay ngưng thuốc điều trị.
   - 📚 **Nguồn tham khảo:** {authority_str}."""


def _generate_answer(message: str, rag_context: list[dict], profile: dict) -> str:
    """Generate RAG answer using LLM or template-based fallback."""
    context_texts = [c["text"] for c in rag_context[:2]]
    context_str = "\n---\n".join(context_texts) if context_texts else "Không tìm thấy thông tin liên quan."

    try:
        from app.core.llm import get_chat_llm

        llm = get_chat_llm(temperature=0.3)
        if llm is None:
            return _template_answer(message, context_str)

        prompt = _build_rag_prompt(message, rag_context, profile)
        response = llm.invoke(prompt)
        return response.content

    except Exception as e:
        logger.warning("LLM answer generation failed: %s", e)
        return _template_answer(message, context_str)


def stream_answer_tokens(
    message: str,
    rag_context: list[dict],
    profile: dict,
) -> Iterator[str]:
    """Stream RAG answer tokens from LLM, or yield template fallback once."""
    context_texts = [c["text"] for c in rag_context[:2]]
    context_str = "\n---\n".join(context_texts) if context_texts else "Không tìm thấy thông tin liên quan."

    try:
        from app.core.llm import get_chat_llm

        llm = get_chat_llm(temperature=0.3)
        if llm is None:
            yield _template_answer(message, context_str)
            return

        prompt = _build_rag_prompt(message, rag_context, profile)
        for chunk in llm.stream(prompt):
            content = getattr(chunk, "content", None)
            if content:
                yield content

    except Exception as e:
        logger.warning("LLM streaming failed: %s", e)
        yield _template_answer(message, context_str)


def _detect_food_in_question(message: str) -> str | None:
    """Detect if user asks about a specific food item. Return food name or None."""
    import re as _re

    message_clean = message.lower().strip().rstrip("?")
    patterns = [
        # "tôi ăn cá hồi được không" / "ăn cá hồi có sao không"
        r"(?:tôi|em|mình|bệnh nhân)?\s*(?:có thể|có nên|có được|có|nên)?\s*(?:ăn|uống|dùng)\s+(.+?)\s+(?:được không|được|không\s*ạ|có sao không|có tốt không|an toàn không|chứ|nhé|nha|hả|thì sao)",
        # "cá hồi ăn được không" / "cá hồi có ăn được" — reversed word order
        r"^(.+?)\s+(?:ăn được không|có ăn được|uống được không|có uống được|có tốt không|tốt không|có sao không|có ăn được không|có uống được không)",
        # "cá hồi bao nhiêu calo" / "cá hồi có tốt không"
        r"^(.+?)\s+(?:bao nhiêu|có tốt|có lợi|có hại)",
        # "ăn cá hồi" / "uống rượu" (short query, no suffix)
        r"(?:tôi|em|mình)?\s*(?:có thể|có nên|nên)?\s*(?:ăn|uống|dùng)\s+(\S+(?:\s+\S+){0,2})\s*$",
    ]

    _stop = {"gì", "cái gì", "món gì", "gì đó", "gì cho", "cho", "gì cho khỏe", "cho khỏe", "không"}

    for p in patterns:
        m = _re.search(p, message_clean)
        if m:
            food = m.group(1).strip()
            # Remove leading/trailing noise words
            food = _re.sub(r"^(được|có thể|có nên|nên|có)\s+", "", food)
            food = _re.sub(r"\s+(được|không|có|ạ|nhé|nha)$", "", food)
            if food and len(food) >= 2 and food not in _stop:
                return food
    return None


def _filter_relevant_chunks(message: str, context_sections: list[str]) -> list[str]:
    """Filter context chunks to keep only those relevant to the user's question.

    Uses keyword overlap to discard noise chunks (e.g., diagnostic criteria
    when user asks about food).
    """
    import re as _re

    # Extract meaningful keywords from message (>= 2 chars, not stop words)
    _stops = {
        "tôi", "em", "mình", "có", "thể", "nên", "được", "không", "ăn", "uống",
        "dùng", "cho", "của", "với", "khi", "bạn", "và", "hay", "hoặc", "này",
        "đó", "là", "một", "các", "những", "theo", "trong", "trên", "về",
        "bao", "nhiêu", "sao", "nào", "đã", "rồi", "còn", "hơn", "nhất",
    }
    words = set(_re.findall(r"\w+", message.lower()))
    keywords = {w for w in words if len(w) >= 2 and w not in _stops}

    if not keywords:
        return context_sections[:2]

    scored: list[tuple[int, str]] = []
    for section in context_sections:
        section_lower = section.lower()
        overlap = sum(1 for kw in keywords if kw in section_lower)
        scored.append((overlap, section))

    scored.sort(key=lambda x: x[0], reverse=True)

    # Keep only chunks with at least 1 keyword overlap, max 2 chunks
    relevant = [s for score, s in scored if score > 0]
    return relevant[:2] if relevant else context_sections[:1]


def _template_answer(message: str, context: str) -> str:
    """Smart fallback answer when LLM is unavailable.

    Instead of dumping raw chunks, this:
    1. Detects if user asks about a specific food
    2. Searches chunks for sentences mentioning that food
    3. Produces a concise, structured answer
    """

    food_name = _detect_food_in_question(message)

    # Split and clean context sections
    raw_sections: list[str] = []
    for section in context.split("\n---"):
        section = section.strip()
        if not section:
            continue
        lines: list[str] = []
        for line in section.splitlines():
            line_str = line.strip()
            if not line_str:
                continue
            lines.append(line_str)
        if lines:
            raw_sections.append("\n".join(lines))

    # Filter to relevant chunks only
    relevant_sections = _filter_relevant_chunks(message, raw_sections)

    # --- FOOD-SPECIFIC ANSWER ---
    if food_name:
        # Find sentences mentioning the food
        food_sentences: list[str] = []
        food_lower = food_name.lower()
        for section in relevant_sections:
            for line in section.splitlines():
                if food_lower in line.lower():
                    food_sentences.append(line.strip())

        if food_sentences:
            # Extract context about this food
            context_summary = "\n".join(f"• {s}" for s in food_sentences[:4])
            return (
                f"Theo tài liệu hướng dẫn dinh dưỡng y khoa, "
                f"**{food_name}** được đề cập trong các khuyến nghị sau:\n\n"
                f"{context_summary}\n\n"
                f"👉 Bạn có thể tham khảo thông tin trên để điều chỉnh chế độ ăn phù hợp.\n\n"
                f"⚠️ *Lưu ý: Để được tư vấn cá thể hóa, "
                f"bạn nên tham khảo ý kiến bác sĩ điều trị hoặc chuyên gia dinh dưỡng.*"
            )
        else:
            return (
                f"Tôi tìm được một số thông tin liên quan nhưng không có dữ liệu cụ thể "
                f"về **{food_name}** trong tài liệu y khoa hiện có.\n\n"
                f"👉 Nhìn chung, người bệnh đái tháo đường type 2 nên ưu tiên thực phẩm "
                f"có chỉ số đường huyết (GI) thấp, giàu chất xơ, protein nạc, và hạn chế "
                f"tinh bột tinh luyện, đường, đồ chiên rán.\n\n"
                f"⚠️ *Vui lòng hỏi bác sĩ hoặc chuyên gia dinh dưỡng để được tư vấn "
                f"cụ thể về {food_name} phù hợp với tình trạng sức khỏe của bạn.*"
            )

    # --- GENERAL QUESTION ANSWER ---
    # Use filtered chunks, format cleanly
    cleaned_paragraphs: list[str] = []
    for section in relevant_sections:
        lines: list[str] = []
        for line in section.splitlines():
            line_str = line.strip()
            if not line_str:
                continue
            if line_str.startswith("#"):
                line_str = "📌 **" + line_str.lstrip("#").strip() + "**"
            lines.append(line_str)
        if lines:
            cleaned_paragraphs.append("\n".join(lines[:8]))

    summary = "\n\n".join(cleaned_paragraphs[:2]) if cleaned_paragraphs else context[:400]

    return (
        f"Dựa trên tài liệu hướng dẫn dinh dưỡng y khoa (Bộ Y Tế / ADA), "
        f"dưới đây là thông tin tham khảo liên quan:\n\n"
        f"{summary}\n\n"
        f"⚠️ *Lưu ý: Để được tư vấn chính xác và cá thể hóa cho tình trạng sức khỏe cụ thể, "
        f"bạn nên tham khảo ý kiến của bác sĩ điều trị hoặc chuyên gia dinh dưỡng.*"
    )


def rag_qa_node(state: AgentState) -> AgentState:
    """RAG Q&A node: retrieve context → generate answer with citations using pruned state."""
    from app.agents.skills.registry import get_lean_state_for_intent

    lean_state = get_lean_state_for_intent(state, "rag_qa")
    message = lean_state.get("message", "")
    profile = lean_state.get("profile", {})

    if not message:
        return {
            **state,
            "answer": "Vui lòng đặt câu hỏi để tôi có thể hỗ trợ.",
            "citations": [],
        }

    # Retrieve context with lean top_k
    rag_context, citations = _build_rag_context(message, profile)

    # Generate answer
    answer = _generate_answer(message, rag_context, profile)

    return {
        **state,
        "rag_context": rag_context,
        "answer": answer,
        "citations": citations,
    }
