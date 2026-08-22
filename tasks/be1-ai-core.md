# BE1 — AI Core

## Mục tiêu
Đảm bảo pipeline agent (LangGraph), RAG, và guardrails hoạt động đúng thiết kế, an toàn lâm sàng (không hallucinate, không tự đổi thuốc), và mọi số liệu dinh dưỡng trả về có nguồn trích dẫn thật.

## Ownership
`backend/app/agents/`, `backend/app/rag/`, `backend/app/guardrails/`, `backend/data/` (KB thuốc-thực phẩm `drug_food_interactions.json`, catalog món ăn `food_catalog_demo.json`/`food_db_vn.json`, guideline markdown).

**Không đụng:** `backend/app/api/`, `backend/app/models/`, `frontend/**` (trừ khi thống nhất với BE2/FE qua contract).

## Sub-tasks (checkbox)

### Done — Guardrails thật (→ `specs/13-ai-chat-assistant.md`, `adrs/006`)
- [x] Implement `backend/app/guardrails/rules.py` — `enforce_output_safety` + `get_refuse_message` wired vào `refuse_node` và `apply_guardrails`.
- [x] Implement `backend/app/guardrails/source_check.py` — `enforce_citation_guardrail` wired vào `apply_guardrails` (redact `rag_qa` thiếu citations).
- [x] `guardrail_triggered` trong `AgentRunOutput` set đúng theo `bool(final_state.get("guardrail_flags"))` (`graph.py::run_agent`).

### Done — `profile_loader` đọc DB thật (→ `specs/13-ai-chat-assistant.md`)
- [x] Sửa `agents/nodes/profile_loader.py` để đọc `PatientProfile` thật từ DB theo `user_id`, chỉ fallback `_DEMO_PROFILES`/default khi không có `db` hoặc không tìm thấy hồ sơ.

### Done — `POST /interactions/check` dùng agent thật (→ `specs/08-drug-food-interaction-check.md`)
- [x] `routes_interactions.py` luôn gọi `interaction_checker_agent` (KB đầy đủ 28 cặp) — không còn nhánh `DEMO_MOCK`/`501`, `services/meal_plan_demo.py` đã bị gỡ khỏi codebase.
- [x] Alert (`_persist_interaction_alerts`) cũng dùng cùng KB đầy đủ — không còn gap "2 KB khác nhau".

### Done — Mở rộng pattern `preferences` (→ `specs/02-patient-profile-onboarding.md`)
- [x] Nhận diện 5 pattern: `"không ăn thịt bò"`, `"ăn chay"`/`"chay"`, `"không ăn hải sản"`, `"không ăn heo"`/`"không ăn lợn"`, `"không ăn gà"` (`meal_planner_agent.py`).

### Done — `unmatched_pairs[]` cho interaction check (→ `specs/08-drug-food-interaction-check.md`)
- [x] `InteractionCheckOutput.unmatched_pairs[]` — mọi cặp `drug`×`food` không tìm thấy trong KB xuất hiện ở đây, không im lặng bỏ qua (`interaction_checker_agent.compute_unmatched_pairs`).

### Done — Multi-intent qua `secondary_intents[]` (→ `specs/13-ai-chat-assistant.md`)
- [x] `intent_classifier` phát hiện ý định phụ trong câu hỏi ghép qua keyword pattern, trả qua `secondary_intents[]` (`AgentRunOutput`).

### Done — Food Log đọc dữ liệu thật (→ `specs/09-food-log-adherence.md`)
- [x] `food_log_node` đọc 3 log gần nhất từ DB và tóm tắt tuân thủ (không còn stub cố định).

### Done — Migrate embedding sang Gemini Embedding API (→ `adrs/003-embedding-model-choice.md`)
- [x] Config `EMBEDDING_PROVIDER`/`GEMINI_API_KEY`/`GEMINI_EMBEDDING_MODEL="gemini-embedding-2"` trong `backend/app/core/config.py`.
- [x] Custom Embedding gọi Gemini API trong `backend/app/rag/embeddings.py`, giữ `SentenceTransformerEmbeddingFunction` local làm fallback offline.
- [x] Rotation pool API key Gemini (`GEMINI_API_KEY=key-1,key-2,…`) trước khi fallback MiniLM — `app/rag/gemini_keys.py`.

### P1 (Should) — Guardrails bổ sung (→ `specs/13`, `adrs/006`)
- [ ] Wire `validate_interaction_output` và `sanitize_recommendation` từ `rules.py` vào runtime flow (`interaction_check_node` hoặc `apply_guardrails`) — hiện đã viết đầy đủ nhưng không có nơi gọi.

### P1 (Should) — Hybrid RAG retrieval (→ `specs/13-ai-chat-assistant.md`)
- [ ] Chuyển `rag_qa_node` (`nodes/rag_tool.py`) sang dùng `retrieve_hybrid()` (BM25+dense RRF) thay vì dense-only — `retrieve_hybrid()` đã implement trong `retriever.py` nhưng chưa được gọi.

### P2 (Should) — Nâng chất lượng corpus RAG (→ `adrs/001`, `specs/13` §3 rule 7)
- [ ] Thay nội dung placeholder lặp câu mock trong `data/guidelines/byt_vn_notes.md`, `ada_diabetes.md`, `diabetes.md` bằng nội dung guideline dinh dưỡng thật (chỉ `patient_faq.md` hiện có nội dung đầy đủ). Re-index sau khi cập nhật (`python -m app.rag.indexer`).

### P3 (Should) — LLM dual-provider fallback (→ `adrs/004-llm-provider-and-fallback-strategy.md`)
- [ ] Thêm tầng fallback provider-to-provider trong `backend/app/core/llm.py`: nếu provider chính (`LLM_PROVIDER`) lỗi và provider phụ có key hợp lệ, tự động thử provider phụ trước khi rơi về rule-based. Khuyến nghị dùng LangChain `with_fallbacks()` thay vì tự viết retry logic.
- [ ] Log rõ provider thực tế đang dùng ở mỗi lần gọi (kể cả khi đã fallback).

### P3 (Should, cần quyết định trước khi làm) — Intent mới "lời khuyên khi chỉ số đổi" (→ `specs/12-patient-metrics-tracking.md`)
- [ ] Thiết kế + thêm intent mới (nếu team quyết định làm) vào `VALID_INTENTS` — nhớ cập nhật `contracts/agent-io-schema.md` §5 **trước** khi code (handoff rule). Cần thiết kế cơ chế so sánh snapshot trước/sau để phát hiện thay đổi đáng kể.

## Definition of Done
- [ ] Test liên quan pass (`pytest tests/agents`, `tests/rag`, `tests/guardrails` nếu có).
- [ ] Không có hallucination số liệu không có nguồn khi test thủ công `rag_qa`.
- [ ] Guardrail chặn đúng câu hỏi đổi thuốc/liều lượng — verify bằng test case cụ thể.
- [ ] Cập nhật `contracts/agent-io-schema.md` nếu có thay đổi field/enum.

## Owner
BE1 (AI Core).
