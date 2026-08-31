"""citation_chunks maps the RAG prompt slice, not leftover retrieve hits."""

from __future__ import annotations

from app.agents.graph import build_agent_run_output
from app.agents.nodes.rag_tool import RAG_PROMPT_CHUNK_LIMIT


def test_maps_only_prompt_chunks():
    extra = "SHOULD NOT APPEAR IN OUTPUT"
    out = build_agent_run_output(
        {
            "intent": "rag_qa",
            "answer": "HbA1c mục tiêu dưới 7%.",
            "citations": ["byt_qd_5481_t2d.md"],
            "rag_context": [
                {
                    "chunk_id": "c1",
                    "text": "Mục tiêu HbA1c < 7%.",
                    "source": "byt_qd_5481_t2d.md",
                    "score": 0.91,
                },
                {
                    "chunk_id": "c2",
                    "text": "Carb 50–60% năng lượng.",
                    "source": "byt_qd_5481_t2d.md",
                    "score": 0.8,
                },
                {
                    "chunk_id": "c3",
                    "text": extra,
                    "source": "ada_diabetes.md",
                    "score": 0.7,
                },
            ],
            "secondary_intents": [],
            "guardrail_flags": [],
        }
    )

    assert RAG_PROMPT_CHUNK_LIMIT == 2
    assert len(out.citation_chunks) == 2
    assert out.citation_chunks[0].text == "Mục tiêu HbA1c < 7%."
    assert out.citation_chunks[1].text == "Carb 50–60% năng lượng."
    assert all(extra not in chunk.text for chunk in out.citation_chunks)
    assert out.citation_chunks[0].source == "byt_qd_5481_t2d.md"
    assert out.citation_chunks[0].score == 0.91


def test_drops_chunks_when_citations_cleared():
    out = build_agent_run_output(
        {
            "intent": "rag_qa",
            "answer": "Không đủ nguồn.",
            "citations": [],
            "rag_context": [
                {
                    "chunk_id": "c1",
                    "text": "Đoạn không được phép lộ.",
                    "source": "byt_qd_5481_t2d.md",
                    "score": 1.0,
                }
            ],
            "secondary_intents": [],
            "guardrail_flags": ["missing_citations"],
        }
    )

    assert out.citation_chunks == []
    assert out.guardrail_triggered is True


def test_meal_plan_citations_have_no_chunks():
    out = build_agent_run_output(
        {
            "intent": "meal_plan",
            "answer": "Thực đơn hôm nay...",
            "citations": ["byt_vn_notes.md"],
            "rag_context": [],
            "secondary_intents": [],
            "guardrail_flags": [],
        }
    )

    assert out.citations == ["byt_vn_notes.md"]
    assert out.citation_chunks == []
