"""AgentState definition for LangGraph — matches contract §2."""

from __future__ import annotations

from typing import TypedDict


class RAGContext(TypedDict, total=False):
    """A single retrieved context chunk."""
    chunk_id: str
    text: str
    source: str
    score: float


class AgentState(TypedDict, total=False):
    """Shared state flowing through the LangGraph agent graph.

    Matches the contract §2 Graph/AgentState specification.
    """
    # Input
    user_id: str
    message: str
    force_intent: str | None

    # Profile
    profile: dict  # PatientProfile as dict
    db: object | None  # SQLAlchemy Session (internal, set by run_agent from POST /chat)

    # Classification
    intent: str  # ... | weekly_compliance | doctor_note | metrics_delta_advice
    secondary_intents: list[str]  # multi-intent secondary detected intents

    # RAG
    rag_context: list[RAGContext]

    # Outputs (populated by respective nodes)
    meal_plan: dict | None
    meal_preview: dict | None
    meal_plan_id: str | None
    food_log: dict | None
    interactions: dict | None
    weekly_compliance: dict | None
    doctor_note: dict | None
    metrics_delta_advice: dict | None

    # Response
    answer: str | None
    citations: list[str]
    guardrail_flags: list[str]
    errors: list[str]
