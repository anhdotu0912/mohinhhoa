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


def _template_answer(message: str, context: str) -> str:
    """General fallback template-based answer when LLM is unavailable."""
    del message
    cleaned_paragraphs: list[str] = []
    for section in context.split("\n---"):
        section = section.strip()
        if not section:
            continue
        lines: list[str] = []
        for line in section.splitlines():
            line_str = line.strip()
            if not line_str:
                continue
            if line_str.startswith("#"):
                line_str = "📌 **" + line_str.lstrip("#").strip() + "**"
            lines.append(line_str)
        if lines:
            cleaned_paragraphs.append("\n".join(lines[:6]))

    summary = "\n\n".join(cleaned_paragraphs[:3]) if cleaned_paragraphs else context[:600]

    return (
        f"Dựa trên tài liệu hướng dẫn dinh dưỡng y khoa lâm sàng (Bộ Y Tế / ADA), "
        f"dưới đây là thông tin tham khảo liên quan đến yêu cầu của bạn:\n\n"
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
