"""Citation guardrails — ensure RAG answers are backed by retrieved sources."""

from __future__ import annotations

NO_CITATION_MESSAGE = (
    "Tôi không tìm thấy nguồn tham khảo phù hợp để trả lời câu hỏi này một cách an toàn. "
    "Vui lòng hỏi bác sĩ hoặc thử lại với câu hỏi cụ thể hơn."
)


def enforce_citation_guardrail(
    intent: str,
    answer: str,
    citations: list[str],
) -> tuple[str, list[str], list[str]]:
    """Redact RAG answers that lack citations.

    Returns:
        (answer, flags, citations) — citations may be cleared when redacted.
    """
    if intent != "rag_qa":
        return answer, [], citations

    if citations:
        return answer, [], citations

    return NO_CITATION_MESSAGE, ["missing_citations"], []
