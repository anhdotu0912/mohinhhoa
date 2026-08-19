# Architecture Diagram

## System Overview

```mermaid
graph TB
    User([User: Bệnh nhân/Bác sĩ]) --> UI[Frontend<br/>Next.js 16 App Router]
    UI -->|REST /api/v1| API[FastAPI Backend]
    API --> Agent[LangGraph Agent<br/>run_agent / chat stream]
    Agent --> LLM[LLM Service<br/>OpenAI GPT-4o-mini default<br/>or DeepSeek via LLM_PROVIDER]
    Agent --> RAG[RAG Retriever<br/>Qdrant dense + BM25 hybrid]
    RAG --> Embed[Gemini gemini-embedding-2<br/>fallback local MiniLM]
    Agent --> DB[(PostgreSQL)]
    API --> Services[Platform Services<br/>meal_plan, notification, compliance, metrics, food_log]
    Services --> DB
    RAG --> VS[(Qdrant persist<br/>QDRANT_PERSIST_DIR)]
```

## LangGraph Agent Flow (as-built)

```mermaid
graph LR
    START((Start)) --> ProfileLoader[profile_loader<br/>DB profile first]
    ProfileLoader --> IntentClassifier[intent_classifier<br/>LLM + keyword fallback]
    IntentClassifier --> Route{intent}
    Route -->|meal_plan| MealPlan[meal_plan<br/>read-only preview]
    Route -->|interaction_check| Interaction[interaction_check<br/>InteractionCheckerAgent]
    Route -->|food_log| FoodLog[food_log<br/>summarize recent logs]
    Route -->|rag_qa| RAGQA[rag_qa<br/>dense retrieval]
    Route -->|refuse| Refuse[refuse]
    Route -->|unknown| Unknown[unknown]
    MealPlan --> Guardrails[apply_guardrails<br/>citation + output safety]
    Interaction --> Guardrails
    FoodLog --> Guardrails
    RAGQA --> Guardrails
    Refuse --> Guardrails
    Unknown --> Guardrails
    Guardrails --> END((End))
```

**Ghi chú as-built:**
- `meal_plan` node **không** persist plan mới — chỉ preview plan đã có; generation qua `POST /meal-plans/generate`.
- `rag_qa` dùng dense retrieval; `retrieve_hybrid()` (BM25+RRF) đã có trong retriever nhưng chưa wired vào chat node.
- `POST /interactions/check` luôn gọi `interaction_checker_agent` thật (không còn cờ demo/mock).

## Component Details

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Frontend | Next.js 16 (App Router) + Tailwind + Zustand | Patient/doctor UI shells |
| Backend | FastAPI | REST API `/api/v1`, JWT auth |
| Agent | LangGraph StateGraph | Chat orchestration facade `run_agent` |
| LLM | OpenAI (`gpt-4o-mini` default) or DeepSeek | Intent classification, RAG answer, meal planner |
| Embedding | Gemini `gemini-embedding-2` + local MiniLM fallback | Qdrant vector indexing/query |
| Database | PostgreSQL (`DATABASE_URL`) | Users, profiles, meal_plans, alerts, notifications, food_logs, body_metrics_history |
| Vector Store | Qdrant (`./qdrant_db`) | RAG over food items + guidelines |
| Guardrails | `rules.py` + `source_check.py` | Citation enforcement, output safety, refuse messages |
