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
- [ ] `food_db_vn.json` ≥300 items (hoặc USDA-map có tên VN)
- [ ] Guidelines: `ada_diabetes.md`, `aha_cardiovascular.md`, `acr_gout.md`, `byt_vn_notes.md`
- [ ] `embeddings.py` đọc model + multi-key từ env
- [ ] `indexer.py` / `retriever.py` trên Qdrant
- [ ] Nodes skeleton + `graph.py` compile được
- [ ] `tests/test_rag.py` ≥80% pass trên 20 câu

### M2 — Meal plan (ngày 5–7)
- [ ] `meal_planner_agent.py` output đúng `MealPlanOutput`
- [ ] Nutrition totals + warnings
- [ ] Source check chặn số liệu không citation
- [ ] 3 profile fixtures → 3 plans
- [ ] `tests/test_meal_planner.py` pass
- [ ] Latency note (target <15s)

### M3 — Interactions (ngày 8–10)
- [ ] KB ≥20 cặp, đúng format contract
- [ ] Checker match alias; no-match → `[]`
- [ ] Tích hợp vào MealPlanner (`swaps[]`)
- [ ] Guardrail recommendation
- [ ] `tests/test_interaction_checker.py` pass

### M4 — Harden (ngày 11–14)
- [ ] Fix citation gaps từ E2E
- [ ] Embedding/result cache nếu cần perf
- [ ] Hỗ trợ seed demo + eval report
- [ ] Không thêm Food Log agent

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
