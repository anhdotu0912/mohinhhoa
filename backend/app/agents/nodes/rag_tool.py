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


def _build_rag_context(message: str, profile: dict) -> tuple[list[dict], list[str]]:
    """Retrieve relevant context from both food DB and guidelines.

    Returns (rag_context_list, citation_list).
    """
    diseases = profile.get("disease", [])

    # Retrieve guidelines relevant to the question + diseases
    disease_query = " ".join(diseases) if diseases else ""
    combined_query = f"{message} {disease_query}".strip()

    guideline_chunks = retrieve_guidelines(combined_query, top_k=5)
    food_chunks = retrieve_foods(message, top_k=5)

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
    """Build the structured clinical prompt for RAG answer generation."""
    context_texts = [c["text"] for c in rag_context[:6]]
    context_str = "\n---\n".join(context_texts) if context_texts else "Không tìm thấy thông tin liên quan."

    diseases = ", ".join(profile.get("disease", [])) or "chưa rõ (mặc định ĐTĐ type 2)"
    medications = ", ".join(profile.get("medications", [])) or "chưa rõ"
    allergies = ", ".join(profile.get("allergies", [])) or "không có"

    return f"""Bạn là Trợ lý Dinh dưỡng Y khoa Chuyên nghiệp (Clinical Nutrition AI Assistant) chuyên về Đái tháo đường Type 2 và bệnh mạn tính, tuân thủ hướng dẫn của Bộ Y Tế Việt Nam (QĐ 5481/QĐ-BYT) và Hiệp Hội Đái Tháo Đường Hoa Kỳ (ADA).

HỒ SƠ BỆNH NHÂN:
- Bệnh nền: {diseases}
- Thuốc điều trị: {medications}
- Dị ứng: {allergies}

TÀI LIỆU Y KHOA THAM KHẢO:
{context_str}

CÂU HỎI CỦA BỆNH NHÂN: {message}

QUY TẮC PHẢN HỒI Y KHOA:
1. TRẢ LỜI TRỰC DIỆN VÀ RÕ RÀNG: Nếu người dùng hỏi về bất kỳ món ăn/thực phẩm/thành phần nào (như cá hồi, thịt bò, thịt trâu, rau củ, hoa quả, tinh bột, chất béo...), hãy trả lời cụ thể:
   - Có ăn được không / Khuyến nghị nên ăn / Hạn chế / Không nên ăn.
   - Phân tích dinh dưỡng cốt lõi: Chỉ số đường huyết (GI/GL), tinh bột (carb), chất béo (Omega-3, chất béo bão hòa/không bão hòa), protein.
   - Khẩu phần khuyến nghị và phương pháp chế biến lành mạnh (hấp, luộc, áp chảo ít dầu; tránh chiên xào, sốt ngọt).
   - Lưu ý cá thể hóa theo bệnh nền và thuốc của bệnh nhân (nếu có).
2. AN TOÀN TUYỆT ĐỐI:
   - KHÔNG tự ý kê đơn, thay đổi thuốc, hoặc điều chỉnh liều insulin.
   - Khi có dấu hiệu cấp cứu hoặc biến chứng nặng, luôn khuyên thăm khám bác sĩ.
3. PHONG CÁCH:
   - Giọng điệu ân cần, chuẩn mực y khoa, dùng tiếng Việt chuẩn, bố cục rõ ràng (gạch đầu dòng, in đậm điểm mấu chốt).
   - Đính kèm nguồn tài liệu tham khảo chính thống ở cuối (ví dụ: Hướng dẫn BYT / ADA / NIN)."""


def _generate_answer(message: str, rag_context: list[dict], profile: dict) -> str:
    """Generate RAG answer using LLM or template-based fallback."""
    context_texts = [c["text"] for c in rag_context[:6]]
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
    context_texts = [c["text"] for c in rag_context[:6]]
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
    import re as _re

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
    """RAG Q&A node: retrieve context → generate answer with citations."""
    message = state.get("message", "")
    profile = state.get("profile", {})

    if not message:
        return {
            **state,
            "answer": "Vui lòng đặt câu hỏi để tôi có thể hỗ trợ.",
            "citations": [],
        }

    # Retrieve context
    rag_context, citations = _build_rag_context(message, profile)

    # Generate answer
    answer = _generate_answer(message, rag_context, profile)

    return {
        **state,
        "rag_context": rag_context,
        "answer": answer,
        "citations": citations,
    }
