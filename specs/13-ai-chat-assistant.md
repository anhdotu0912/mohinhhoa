# Spec: AI Chat Assistant (Entry point `/chat`)

## Status
Done (core) — routing intent, guardrails (đã wired, gồm per-recommendation T01), `profile_loader` đọc DB thật, `food_log` đọc dữ liệu thật, `secondary_intents[]`, và `POST /chat/stream` (SSE) đều as-built. Còn Planned thật: hybrid RAG (BM25+dense) chưa wire vào `rag_qa_node` (vẫn dense-only), LLM dual-provider fallback.

## 1. Mục tiêu (Why)
Chat là điểm chạm tự nhiên nhất cho bệnh nhân hỏi bất kỳ điều gì (lập thực đơn, hỏi tương tác thuốc, hỏi kiến thức dinh dưỡng) mà không cần nhớ đúng màn hình/nút bấm nào — LangGraph agent tự phân loại ý định và định tuyến tới logic xử lý phù hợp.

## 2. User story
Là **bệnh nhân**, tôi muốn gõ 1 câu hỏi tự nhiên (ví dụ "hôm nay tôi nên ăn gì?" hoặc "tôi uống warfarin có ăn được rau muống không?"), để AI hiểu đúng ý tôi muốn gì và trả lời/hành động phù hợp, không cần tôi tự chọn đúng chức năng.

## 3. Business rules (as-built)
1. **Pipeline cố định:** `POST /chat` → `run_agent()` → LangGraph graph (`agents/graph.py`): `profile_loader → intent_classifier → route theo intent → apply_guardrails`.
2. **`profile_loader` đọc DB thật trước (as-built):** `profile_loader` (`agents/nodes/profile_loader.py`) gọi `get_profile_row(db, user_id)` để load `PatientProfile` thật từ Postgres nếu patient đã có hồ sơ (qua `POST /profile`, `specs/02`). Chỉ khi **không** có `db` session hoặc **không tìm thấy** profile trong DB, mới fallback sang 1 trong 3 hồ sơ demo hard-code (`_DEMO_PROFILES`, khớp `user_id` cố định `demo_patient_1/2/3`) hoặc profile default (`target_kcal=1800`, mọi list rỗng) nếu `user_id` không khớp demo nào. Nghĩa là patient thật đã onboarding sẽ luôn được cá nhân hoá đúng hồ sơ của mình khi chat.
3. **Danh sách intent hợp lệ, đúng 6, không hơn:** `meal_plan | interaction_check | food_log | rag_qa | refuse | unknown`. Phân loại bằng LLM trước (`_classify_by_llm`), fallback rule-based theo từ khoá (`_INTENT_PATTERNS`, `intent_classifier.py`) nếu LLM không khả dụng/lỗi hoặc trả về intent không hợp lệ.
4. **`food_log` đọc dữ liệu thật (as-built)** — `food_log_node` (`agents/graph.py`) truy vấn 3 `FoodLog` gần nhất của `user_id` từ DB và tóm tắt theo slot (Bữa sáng/trưa/tối, "đã ăn theo kế hoạch" hoặc "ăn khác — `<note>`"). Chỉ khi không có `db` hoặc `user_id`, hoặc patient chưa từng log, mới trả câu cố định hướng dẫn mở mục Ghi nhận bữa ăn (xem `specs/09-food-log-adherence.md`).
5. **`refuse` — guardrail 2 tầng đã wired (as-built):** danh sách pattern refuse (`REFUSE_REGEX_PATTERNS`, `backend/app/guardrails/rules.py`) được dùng **cả** ở `intent_classifier` (fallback rule-based, `_INTENT_PATTERNS["refuse"]`) **và** ở tầng hậu kiểm `apply_guardrails` (`enforce_output_safety`, kiểm tra `answer` cuối cùng có chứa cụm từ vi phạm — ví dụ "đổi thuốc", "tăng liều" — bất kể intent nào đã route; nếu có, ép `intent="refuse"` và thay `answer` bằng `get_refuse_message()`). Đây là guardrail cứng theo `CLAUDE.md` Mục 7: "AI không được tự ý khuyến nghị đổi thuốc/liều lượng — luôn redirect bác sĩ".
6. **Guardrail citation cho `rag_qa` (as-built):** `apply_guardrails` gọi `enforce_citation_guardrail` (`guardrails/source_check.py`) — nếu intent `rag_qa` trả `answer` không kèm `citations[]` hợp lệ, hệ thống redact/thay câu trả lời bằng thông báo an toàn thay vì để lộ số liệu không có nguồn (nhất quán `CLAUDE.md` Mục 7).
7. **Dữ liệu RAG (as-built):** `data/guidelines/` đã tồn tại với 5 file guideline (`byt_vn_notes.md`, `ada_diabetes.md`, `aha_cardiovascular.md`, `acr_gout.md`, `diabetes.md`, `patient_faq.md`) được index vào Qdrant qua `rag/indexer.py`. `rag_qa_node` hiện chỉ dùng **dense retrieval** (`retriever.py::retrieve`) — hàm `retrieve_hybrid` (dense+BM25 RRF fusion) đã có sẵn trong `rag/retriever.py` nhưng **chưa được gọi** từ `rag_qa_node` — đây là gap Planned thật (xem `tasks/be1-ai-core.md`).
8. `AgentRunOutput.message` (không phải `reply`) luôn là field chứa câu trả lời hiển thị cho người dùng, bất kể intent nào. `secondary_intents[]` (as-built) — `intent_classifier` luôn chạy song song cả phân loại LLM (intent chính) và rule-based keyword (`_detect_intents_by_keywords`) để phát hiện ý định phụ khớp pattern khác intent chính, populate vào `secondary_intents[]` (xem Edge case §5).
9. **LLM dual-provider (Planned):** khi cả 2 provider (OpenAI + DeepSeek) được cấu hình, node LLM (`meal_plan_node`, `rag_qa_node`, `intent_classifier`) sẽ tự thử provider phụ trước khi rơi về fallback rule-based, thay vì rơi thẳng về rule-based khi provider chính lỗi — as-built hiện tại chỉ single-provider qua `LLM_PROVIDER`, xem `adrs/004-llm-provider-and-fallback-strategy.md`.
10. **`validate_interaction_output`/`sanitize_recommendation` đã wired (as-built, T01):** `enforce_interaction_recommendations` (`guardrails/rules.py`) validate + sanitize từng `recommendation` trong `InteractionItem` trước khi ghép vào `answer` (`check_drug_food_interaction`, `interaction_checker_agent`) và hậu kiểm lại trong `apply_guardrails` (sửa item + patch `answer`, rồi mới chạy `enforce_output_safety` để không wipe cả câu). Flag `unsafe_interaction_recommendation` khi có item bị sửa. Disclaimer phủ định (ví dụ "Không được tự ý ngưng thuốc") được giữ nguyên.
11. **`meal_plan` qua chat là read-only theo thiết kế (as-built, không phải gap):** `meal_plan_node` chỉ đọc plan đã tồn tại của patient (`build_meal_preview`) để hiển thị `meal_preview` trong hội thoại — **không generate/persist plan mới** qua chat. Muốn tạo plan chính thức, dùng `POST /meal-plans/generate` (`specs/05`). Nếu patient chưa có plan nào, trả thông báo hướng dẫn thay vì tự sinh 1 plan không được lưu.
12. **Hỏi bác sĩ khi AI không chắc (as-built 2026-08-31):** CTA chỉ hiện khi `refuse` | `unknown` (không phải cấp cứu 115) | `rag_qa` thiếu citation | `unmatched_kb`. Bệnh nhân opt-in → job Hàng việc `chat_escalation` + `Notification(type=escalation_sent)`. Bác sĩ trả lời thread → `escalation_reply`. Một BN một job đang mở; gửi thêm thì nối thread. Không nhét lời bác sĩ vào bong bóng AI. Contract `api-v1` §11 Chat escalations.

## 4. Luồng chính (happy path)
1. Patient/doctor gõ câu hỏi → `POST /chat` với `{message}` (hoặc `POST /chat/stream` cho phiên bản streaming).
2. `profile_loader` load hồ sơ — DB thật nếu có, fallback demo/default nếu không (rule 2).
3. `intent_classifier` phân loại 1 trong 6 intent (LLM ưu tiên, fallback keyword) + phát hiện `secondary_intents[]`.
4. Route tới node tương ứng (`meal_plan_node`/`interaction_check_node`/`rag_qa_node`/`food_log_node`/`refuse_node`/`unknown_node`).
5. `apply_guardrails` hậu kiểm: sanitize từng `recommendation` (nếu có `interactions`), enforce citation cho `rag_qa`, enforce output safety cho mọi intent (có thể ép về `refuse`).
6. Trả `AgentRunOutput` với `message`, `citations[]` (nếu có), `secondary_intents[]`, `guardrail_triggered` (bool).

**`POST /chat/stream` (SSE, as-built):** FE nhận luồng event gồm status steps (hiển thị "đang suy nghĩ"/"đang tra cứu"...), token stream thật cho `rag_qa` (chunk mô phỏng cho intent khác), và event `correction` khi `apply_guardrails` thay đổi câu trả lời so với bản gốc (`agents/streaming.py`).

## 5. Edge cases
- **Multi-intent (as-built):** câu hỏi chứa cả yêu cầu lập thực đơn **và** hỏi tương tác thuốc trong 1 câu (ví dụ "lập thực đơn cho tôi và cho biết tôi uống warfarin có kiêng gì không") — hệ thống chỉ xử lý đầy đủ **1 intent chính** trong lượt trả lời (không xử lý song song đầy đủ nhiều intent, tránh rearchitect lớn cho phạm vi demo), nhưng ý định phụ được phát hiện qua keyword pattern và trả về trong `secondary_intents[]` để FE có thể gợi ý người dùng hỏi lại riêng.
- Intent `meal_plan` qua chat chỉ đọc plan sẵn có, không persist plan mới — xem rule 11 và `specs/05-meal-plan-generation.md` §5.
- LLM không khả dụng (thiếu API key/timeout) → fallback rule-based theo từ khoá cho `intent_classifier`; các node xử lý sau đó (`meal_plan_node`, `interaction_check_node`, `rag_qa_node`) cũng có nhánh rule-based riêng nếu không có LLM.
- Câu hỏi hoàn toàn không khớp 5 intent còn lại → `unknown`, `unknown_node` trả câu trả lời chung hướng dẫn người dùng hỏi lại rõ hơn (không phải lỗi hệ thống).
- Câu trả lời sinh ra (ở bất kỳ intent nào, kể cả `rag_qa`/`meal_plan`) vô tình chứa cụm từ vi phạm guardrail (ví dụ do LLM tự sinh) → `apply_guardrails` chặn lại, ép về `refuse`, trả `get_refuse_message()` (rule 5).

## 6. Ngoài phạm vi (Out of scope)
- **Multi-turn agent memory** — mỗi request `/chat` vẫn độc lập; transcript trước đó **không** được đưa vào `run_agent`. (As-built 2026-08-23: FE persist session + tin nhắn hiển thị qua `GET|PUT /chat/sessions/*` trên Postgres — chỉ phục vụ sidebar/lịch sử UI, xem `contracts/api-v1.md` §11 Chat Sessions.)
- Đa ngôn ngữ — chỉ tiếng Việt, Won't Have cố định.
- Voice input/output — không có.
- Xử lý đầy đủ song song nhiều intent trong 1 lượt trả lời (chỉ gợi ý qua `secondary_intents[]`, xem rule 8).

## 7. Schema tham chiếu
- `AgentRunInput`, `AgentRunOutput`, `AgentState`, `VALID_INTENTS` — `contracts/agent-io-schema.md` §5.

## 8. API liên quan
| Method | Path | Role |
|---|---|---|
| POST | `/chat` | patient, doctor |
| POST | `/chat/stream` | patient, doctor |
| GET, POST | `/chat/sessions` | patient |
| GET, PATCH, DELETE | `/chat/sessions/{id}` | patient |
| DELETE | `/chat/sessions` | patient |
| PUT | `/chat/sessions/{id}/messages` | patient |
| POST, GET | `/chat/escalations`, `/chat/escalations/{id}`, `.../messages` | patient |
| GET, POST | `/doctor/escalations`, `.../{id}/messages`, `.../resolve` | doctor |

## 9. Liên quan
- `specs/05-meal-plan-generation.md` — intent `meal_plan` (read-only qua chat).
- `specs/08-drug-food-interaction-check.md` — intent `interaction_check`.
- `specs/09-food-log-adherence.md` — intent `food_log` (đọc dữ liệu thật).
- `adrs/002-agent-orchestration-langgraph.md`, `adrs/004-llm-provider-and-fallback-strategy.md`, `adrs/006-hitl-guardrails-strategy.md`.
- `contracts/agent-io-schema.md` §5.
