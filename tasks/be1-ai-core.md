# BE1 — AI Core backlog

> Modules: `agents/`, `rag/`, `guardrails/`, `services/nutrition_calculator.py`, `data/`, AI tests  
> Specs: `meal-planner.md`, `interaction-checker.md`  
> ADRs: `001`, `002`, `003`

---

## Trách nhiệm

- Embedding (Gemini + rotation), index/retrieve Qdrant, hybrid dense+BM25
- LangGraph: profile_loader → intent_classifier → rag / meal_plan / interaction / refuse
- MealPlannerAgent + NutritionCalculator + SourceCheck
- InteractionCheckerAgent + KB `drug_food_interactions.json` (≥20)
- Guardrails rules (từ chối đổi thuốc/liều)
- Eval: RAG accuracy, meal planner fixtures, interaction tests

## Không làm (trừ khi được nhờ rõ)

- JWT chi tiết, SQLAlchemy migrations, notification scheduler
- Frontend components
- Dietitian review business persistence (chỉ đảm bảo output schema)

---

## Checklist theo milestone

### M1 — Data & RAG (ngày 1–4)
- [x] `food_db_vn.json` với dữ liệu VN chuẩn
- [x] Guidelines: `ada_diabetes.md`, `byt_vn_notes.md` chuẩn đái tháo đường
- [x] `embeddings.py` đọc model + multi-key từ env
- [x] `indexer.py` / `retriever.py` trên ChromaDB/BM25
- [x] Nodes skeleton + `graph.py` compile được
- [x] `tests/test_rag.py` 100% pass trên 20 câu hỏi

### M2 — Meal plan (ngày 5–7)
- [x] `meal_planner_agent.py` output đúng `MealPlanOutput`
- [x] Nutrition totals + warnings
- [x] Source check chặn số liệu không citation
- [x] 3 profile fixtures → 3 plans
- [x] `tests/test_meal_planner.py` pass
- [x] Latency note (target <15s)

### M3 — Interactions (ngày 8–10)
- [x] KB ≥20 cặp, đúng format contract
- [x] Checker match alias; no-match → `[]`
- [x] Tích hợp vào MealPlanner (`swaps[]`)
- [x] Guardrail recommendation
- [x] `tests/test_interaction_checker.py` pass

### M4 — Harden (ngày 11–14)
- [x] Fix citation gaps từ E2E
- [x] Embedding/result cache nếu cần perf
- [x] Hỗ trợ seed demo + eval report
- [x] Không thêm Food Log agent

---

## Handoff artifacts phải giao BE2/FE

| Artefact | Khi |
|---|---|
| Contract Agent sections ổn định | Trước ngày 6 |
| Sample `MealPlanOutput` JSON | Ngày 5 EOD |
| Sample `InteractionCheckOutput` + list drug demo | Ngày 10 |
| `run_agent` Python API ổn định | Ngày 4–6 |

## Commands

```bash
cd backend
pytest tests/test_rag.py tests/test_meal_planner.py tests/test_interaction_checker.py -q
```
