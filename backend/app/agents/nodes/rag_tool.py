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
    """Build the LLM prompt for RAG answer generation."""
    context_texts = [c["text"] for c in rag_context[:5]]
    context_str = "\n---\n".join(context_texts) if context_texts else "Không tìm thấy thông tin liên quan."

    diseases = ", ".join(profile.get("disease", [])) or "chưa rõ"
    medications = ", ".join(profile.get("medications", [])) or "chưa rõ"

    return f"""Bạn là trợ lý dinh dưỡng AI cho bệnh nhân mạn tính. Trả lời câu hỏi dựa trên thông tin được cung cấp.

THÔNG TIN BỆNH NHÂN:
- Bệnh: {diseases}
- Thuốc đang dùng: {medications}

TÀI LIỆU THAM KHẢO:
{context_str}

CÂU HỎI: {message}

QUY TẮC:
1. Chỉ trả lời dựa trên tài liệu tham khảo. Nếu không có thông tin, nói rõ.
2. KHÔNG đề xuất đổi thuốc, đổi liều, hoặc kê đơn.
3. Luôn khuyên hỏi bác sĩ khi liên quan đến thuốc/bệnh nghiêm trọng.
4. Trả lời bằng tiếng Việt, ngắn gọn, dễ hiểu.
5. Ghi nguồn tham khảo ở cuối câu trả lời."""


def _generate_answer(message: str, rag_context: list[dict], profile: dict) -> str:
    """Generate RAG answer using LLM or template-based fallback."""
    context_texts = [c["text"] for c in rag_context[:5]]
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
    context_texts = [c["text"] for c in rag_context[:5]]
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
    """Fallback template-based answer when LLM is unavailable."""
    return (
        f"Dựa trên thông tin tham khảo, đây là những gì tôi tìm được liên quan đến câu hỏi của bạn:\n\n"
        f"{context[:800]}\n\n"
        f"⚠️ Lưu ý: Thông tin mang tính tham khảo. Vui lòng tham vấn bác sĩ hoặc chuyên gia dinh dưỡng "
        f"để được tư vấn phù hợp với tình trạng sức khỏe cụ thể của bạn."
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
