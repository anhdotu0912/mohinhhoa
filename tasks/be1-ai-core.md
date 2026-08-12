# BE1 — AI Core (ownership rút gọn)

> Modules: `agents/`, `rag/`, `guardrails/`, `services/nutrition_calculator.py`, `data/`, AI tests  
> Specs: `02`, `03`, `06` · ADRs: `001` (Chroma), `002`, `003`  
> Backlog chi tiết: [`roadmap-gap-closure.md`](roadmap-gap-closure.md)

## Trách nhiệm

- Index/retrieve **ChromaDB**, embedding MiniLM (local)
- LangGraph: profile_loader → intent → meal_plan / interaction / rag_qa / refuse / food_log stub
- MealPlannerAgent + NutritionCalculator
- InteractionCheckerAgent + KB `drug_food_interactions.json`
- Guardrails `rules.py` / `source_check.py` (TASK-04 — hiện placeholder)
- Eval: RAG, meal planner, interaction tests

## Không làm (trừ khi nhờ)

- JWT/migrations chi tiết, notification persistence, FE components

## Focus hiện tại

- TASK-02: ổn định nhánh `DEMO_MOCK=false` (persist plan từ agent)
- TASK-03: đã chốt giữ Chroma (ADR-001 superseded)
- TASK-04: implement guardrails thật
