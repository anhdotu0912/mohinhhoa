# Spec: AI Chat Assistant (Entry point `/chat`)

## Status
Partial — routing intent hoạt động; `meal_plan`/`interaction_check`/`rag_qa` có logic thật, `food_log` là stub, guardrail citation cho `rag_qa` mô tả ở đây là **kỳ vọng thiết kế**, việc chặn cứng thật (`guardrails/rules.py`, `guardrails/source_check.py`) **hiện là placeholder trống**.

## 1. Mục tiêu (Why)
Chat là điểm chạm tự nhiên nhất cho bệnh nhân hỏi bất kỳ điều gì (lập thực đơn, hỏi tương tác thuốc, hỏi kiến thức dinh dưỡng) mà không cần nhớ đúng màn hình/nút bấm nào — LangGraph agent tự phân loại ý định và định tuyến tới logic xử lý phù hợp.

## 2. User story
Là **bệnh nhân**, tôi muốn gõ 1 câu hỏi tự nhiên (ví dụ "hôm nay tôi nên ăn gì?" hoặc "tôi uống warfarin có ăn được rau muống không?"), để AI hiểu đúng ý tôi muốn gì và trả lời/hành động phù hợp, không cần tôi tự chọn đúng chức năng.

## 3. Business rules
1. **Pipeline cố định:** `POST /chat` → `run_agent()` → LangGraph graph: `profile_loader → intent_classifier → route theo intent`.
2. **`profile_loader` dùng hồ sơ demo hard-code** (`_DEMO_PROFILES` theo `user_id` cố định, hoặc profile default nếu không khớp) — **không** đọc `PatientProfile` thật từ DB khi gọi qua `/chat`. Đây là gap thật cần biết: patient đã điền hồ sơ thật qua `POST /profile` nhưng khi chat, AI vẫn dùng hồ sơ demo cứng nếu `user_id` không khớp danh sách demo — ảnh hưởng trực tiếp tới độ chính xác cá nhân hoá của mọi intent (đặc biệt `meal_plan`, `interaction_check`).
3. **Danh sách intent hợp lệ, đúng 6, không hơn:** `meal_plan | interaction_check | food_log | rag_qa | refuse | unknown`. Phân loại bằng LLM trước, fallback rule-based theo từ khoá (`keyword patterns`) nếu LLM không khả dụng/lỗi.
4. **`food_log` là stub cứng** — luôn trả cố định *"Tính năng ghi nhận bữa ăn chưa khả dụng trong phiên bản này."*, không đọc/viết gì (xem `specs/09-food-log-adherence.md`).
5. **`refuse`** — dùng khi câu hỏi thuộc danh sách phải từ chối & redirect bác sĩ (theo `CLAUDE.md` Mục 7: "AI không được tự ý khuyến nghị đổi thuốc/liều lượng — luôn redirect bác sĩ"). Danh sách câu cụ thể phải định nghĩa trong `backend/app/guardrails/rules.py` — **hiện file này là placeholder trống**, nghĩa là logic refuse thật (nếu có) đang nằm ở mức prompt LLM/intent classifier, chưa có tầng guardrail code cứng độc lập kiểm tra lại. **Đây là gap ưu tiên cao** (xem `tasks/roadmap-mvp.md` P1).
6. **Guardrail cứng kỳ vọng cho `rag_qa`** (thiết kế, chưa có code enforcement độc lập): mọi số liệu trả lời phải có `citations[]` không rỗng trỏ tới nguồn thật (`rag_context` lấy từ ChromaDB); nếu không tìm được nguồn phù hợp, AI phải redact/từ chối phần đó thay vì bịa số liệu — `backend/app/guardrails/source_check.py` là nơi **dự kiến** implement việc kiểm tra này, hiện đang trống.
7. **Chất lượng dữ liệu RAG hiện tại yếu:** `data/food_db_vn.json` (indexed vào ChromaDB) chứa phần lớn dữ liệu placeholder; thư mục `data/guidelines/` (nguồn guideline markdown dự kiến index) **không tồn tại** trong repo tại thời điểm audit. Nghĩa là câu trả lời `rag_qa` hiện tại có rủi ro cao **không tìm được context phù hợp** — cần lưu ý khi demo trực tiếp intent này, nên test trước với câu hỏi cụ thể đã biết có dữ liệu, tránh demo câu hỏi ngẫu nhiên. **Liên quan (2026-08-15):** team đã quyết định migrate embedding sang Gemini Embedding qua API (`adrs/003-embedding-model-choice.md`) để cải thiện chất lượng retrieval — migration này **không** tự động sửa gap thiếu dữ liệu KB, cần bổ sung `data/guidelines/*.md` song song.
8. `AgentRunOutput.message` (không phải `reply`) luôn là field chứa câu trả lời hiển thị cho người dùng, bất kể intent nào. `secondary_intents[]` (`[Planned]`) là field mới bổ sung cho multi-intent (rule Edge case §5).
9. **LLM dual-provider (2026-08-15, Planned):** khi cả 2 provider (OpenAI + DeepSeek) được cấu hình, node LLM (`meal_plan_node`, `rag_qa_node`, `intent_classifier`) sẽ tự thử provider phụ trước khi rơi về fallback rule-based, thay vì rơi thẳng về rule-based khi provider chính lỗi — xem `adrs/004-llm-provider-and-fallback-strategy.md`.

## 4. Luồng chính (happy path)
1. Patient/doctor gõ câu hỏi → `POST /chat` với `{message}`.
2. `profile_loader` load hồ sơ (demo hard-code, xem rule 2) vào `AgentState`.
3. `intent_classifier` phân loại 1 trong 6 intent.
4. Route tới node tương ứng (`meal_plan_node`/`interaction_check_node`/`rag_qa_node`/`food_log_node`/`refuse_node`/`unknown_node`).
5. Trả `AgentRunOutput` với `message`, `citations[]` (nếu có), `guardrail_triggered` (bool).

## 5. Edge cases
- **Multi-intent ambiguous — đã quyết định (2026-08-15): cần nâng cấp.** Câu hỏi chứa cả yêu cầu lập thực đơn **và** hỏi tương tác thuốc trong 1 câu (ví dụ "lập thực đơn cho tôi và cho biết tôi uống warfarin có kiêng gì không") — as-built hiện tại `intent_classifier` chỉ trả **1 intent duy nhất** (không có multi-label), 1 trong 2 ý định bị bỏ qua hoàn toàn. **Quyết định: nâng cấp classifier** để phát hiện thêm ý định phụ, trả qua `secondary_intents[]` (`[Planned]`, xem `contracts/agent-io-schema.md` §5.2) — vẫn chỉ xử lý đầy đủ 1 intent chính trong lượt trả lời, nhưng `message` phải gợi ý rõ người dùng hỏi lại riêng ý định phụ đã phát hiện (không xử lý song song đầy đủ nhiều intent, tránh rearchitect quá lớn cho phạm vi demo).
- Intent `meal_plan` qua chat sinh plan **không persist** — xem gap đã ghi ở `specs/05-meal-plan-generation.md` §5 và `contracts/agent-io-schema.md` §5.2.
- LLM không khả dụng (thiếu API key/timeout) → fallback rule-based theo từ khoá cho `intent_classifier`; các node xử lý sau đó (`meal_plan_node` etc.) cũng có nhánh rule-based riêng nếu không có LLM (xem `adrs/004-llm-provider-and-fallback-strategy.md`).
- Câu hỏi hoàn toàn không khớp 5 intent còn lại → `unknown`, `unknown_node` trả câu trả lời chung hướng dẫn người dùng hỏi lại rõ hơn (không phải lỗi hệ thống).

## 6. Ngoài phạm vi (Out of scope)
- Lưu lịch sử hội thoại nhiều lượt (context giữa các lượt chat) — mỗi request `/chat` độc lập, không có session/thread lưu trạng thái hội thoại trước đó.
- Đa ngôn ngữ — chỉ tiếng Việt, Won't Have cố định.
- Voice input/output — không có.

## 7. Schema tham chiếu
- `AgentRunInput`, `AgentRunOutput`, `AgentState`, `VALID_INTENTS` — `contracts/agent-io-schema.md` §5.

## 8. API liên quan
| Method | Path | Role |
|---|---|---|
| POST | `/chat` | patient, doctor |

## 9. Liên quan
- `specs/05-meal-plan-generation.md` — intent `meal_plan`.
- `specs/08-drug-food-interaction-check.md` — intent `interaction_check`.
- `specs/09-food-log-adherence.md` — intent `food_log` (stub).
- `adrs/002-agent-orchestration-langgraph.md`, `adrs/004-llm-provider-and-fallback-strategy.md`, `adrs/006-hitl-guardrails-strategy.md`.
- `contracts/agent-io-schema.md` §5.
