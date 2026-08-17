# BE1 — AI Core

## Mục tiêu
Đảm bảo pipeline agent (LangGraph), RAG, và guardrails hoạt động đúng thiết kế, an toàn lâm sàng (không hallucinate, không tự đổi thuốc), và mọi số liệu dinh dưỡng trả về có nguồn trích dẫn thật.

## Ownership
`backend/app/agents/`, `backend/app/rag/`, `backend/app/guardrails/`, `backend/data/` (KB thuốc-thực phẩm `drug_food_interactions.json`, catalog món ăn `food_catalog_demo.json`/`food_db_vn.json`, guideline markdown).

**Không đụng:** `backend/app/api/`, `backend/app/models/`, `frontend/**` (trừ khi thống nhất với BE2/FE qua contract).

## Sub-tasks (checkbox)

### P0 — Guardrails thật (→ `specs/13-ai-chat-assistant.md`)
- [ ] Implement `backend/app/guardrails/rules.py` — danh sách câu AI phải từ chối & redirect bác sĩ (theo `CLAUDE.md` Mục 7), tích hợp vào `refuse_node`.
- [ ] Implement `backend/app/guardrails/source_check.py` — kiểm tra `citations[]` không rỗng trước khi trả kết quả `rag_qa_node`; nếu thiếu nguồn → redact/từ chối phần đó thay vì bịa số liệu.
- [ ] Set `guardrail_triggered=true` trong `AgentRunOutput` đúng khi guardrail thực sự can thiệp (hiện tại field này tồn tại nhưng logic set giá trị cần audit lại cùng lúc implement 2 file trên).

### P0 — `profile_loader` đọc DB thật (→ `specs/13-ai-chat-assistant.md`)
- [ ] Sửa `agents/nodes/profile_loader.py` để đọc `PatientProfile` thật từ DB theo `user_id`, chỉ fallback `_DEMO_PROFILES`/default khi không tìm thấy hồ sơ nào (thay vì luôn ưu tiên demo hard-code).

### P0 — Ổn định `DEMO_MOCK=false` cho interaction check (→ `specs/08-drug-food-interaction-check.md`)
- [ ] Wire `interaction_checker_agent` (KB đầy đủ 28 cặp) vào `POST /interactions/check` khi `DEMO_MOCK=false` (hiện trả `501`).
- [ ] **Không cần** đồng bộ Alert dùng KB đầy đủ ngay — quyết định 2026-08-15: chấp nhận gap "Alert dùng KB rút gọn 2 cặp" cho vòng demo hiện tại, hạ khỏi P0 (xem `tasks/roadmap-mvp.md`).

### P1 — Đồng bộ persist meal plan qua chat (→ `specs/05-meal-plan-generation.md`, quyết định 2026-08-15)
- [ ] Sửa `meal_plan_node` để persist `MealPlanOutput` vào bảng `meal_plans` giống `POST /meal-plans/generate` (tái sử dụng service persist của BE2), để `meal_plan_id` trả từ `/chat` luôn dùng lại được với `GET /meal-plans/{id}`.

### P2 — Mở rộng pattern `preferences` (→ `specs/02-patient-profile-onboarding.md`, quyết định 2026-08-15)
- [ ] Thêm nhận diện các câu phổ biến khác ngoài `"không ăn thịt bò"`: tối thiểu `"ăn chay"`/`"chay"`, `"không ăn hải sản"`, `"không ăn heo"`/`"không ăn lợn"`, `"không ăn gà"` — xử lý overlap hợp lý với `allergies` khi cùng ý nghĩa.

### P2 — `unmatched_pairs[]` cho interaction check (→ `specs/08-drug-food-interaction-check.md`, quyết định 2026-08-15)
- [ ] Sửa output `InteractionCheckOutput` để mọi cặp `drug`×`food` không tìm thấy trong KB xuất hiện ở `unmatched_pairs[]`, không im lặng bỏ qua như hiện tại.

### P2 — Multi-intent qua `secondary_intents[]` (→ `specs/13-ai-chat-assistant.md`, quyết định 2026-08-15)
- [ ] Nâng cấp `intent_classifier` để phát hiện ý định phụ trong câu hỏi ghép, trả qua `secondary_intents[]` (`AgentRunOutput`) — không xử lý song song đầy đủ, chỉ gợi ý người dùng hỏi lại riêng.

### Should — Intent mới cho "lời khuyên khi chỉ số đổi" (→ `specs/12-patient-metrics-tracking.md`)
- [ ] Thiết kế + thêm intent mới (nếu team quyết định làm) vào `VALID_INTENTS` — nhớ cập nhật `contracts/agent-io-schema.md` §5 **trước** khi code (handoff rule).

### P3 — Migrate embedding sang Gemini Embedding API (→ `adrs/003-embedding-model-choice.md`, quyết định 2026-08-15)
- [ ] Thêm config `EMBEDDING_PROVIDER`/`GEMINI_API_KEY`/`GEMINI_EMBEDDING_MODEL="gemini-embedding-2"` vào `backend/app/core/config.py`.
- [ ] Viết custom `EmbeddingFunction` gọi Gemini API trong `backend/app/rag/embeddings.py`, giữ `SentenceTransformerEmbeddingFunction` local làm fallback offline khi Gemini API lỗi/thiếu key.
- [ ] Re-index toàn bộ ChromaDB collection sau khi đổi embedding (`app/rag/indexer.py::build_index()`), đo lại SLA RAG.

### P3 — LLM dual-provider fallback (→ `adrs/004-llm-provider-and-fallback-strategy.md`, quyết định 2026-08-15)
- [ ] Thêm tầng fallback provider-to-provider trong `backend/app/core/llm.py`: nếu provider chính (`LLM_PROVIDER`) lỗi và provider phụ có key hợp lệ, tự động thử provider phụ trước khi rơi về rule-based. Khuyến nghị dùng LangChain `with_fallbacks()` thay vì tự viết retry logic.
- [ ] Log rõ provider thực tế đang dùng ở mỗi lần gọi (kể cả khi đã fallback).

### Should — Nâng chất lượng RAG (→ `specs/13-ai-chat-assistant.md` §3 rule 7)
- [ ] Bổ sung dữ liệu thật cho `data/food_db_vn.json` (hiện phần lớn placeholder) hoặc xác nhận không cần vì meal planner dùng `food_catalog_demo.json` riêng.
- [ ] Tạo `data/guidelines/*.md` (hiện thư mục không tồn tại) — nội dung guideline dinh dưỡng Việt Nam thật để index vào ChromaDB, phục vụ intent `rag_qa`.

### Done — Food Log (→ `specs/09-food-log-adherence.md`)
- [x] `food_log_node` đọc log gần nhất từ DB và tóm tắt tuân thủ.

## Definition of Done
- [ ] Test liên quan pass (`pytest tests/agents`, `tests/rag`, `tests/guardrails` nếu có).
- [ ] Không có hallucination số liệu không có nguồn khi test thủ công `rag_qa`.
- [ ] Guardrail chặn đúng câu hỏi đổi thuốc/liều lượng — verify bằng test case cụ thể.
- [ ] Cập nhật `contracts/agent-io-schema.md` nếu có thay đổi field/enum.

## Owner
BE1 (AI Core).
