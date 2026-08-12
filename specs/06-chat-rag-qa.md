# Spec: Chat / RAG Q&A dinh dưỡng

## Status
**Partial** — `POST /api/v1/chat` → `run_agent` có trên BE; response = `AgentRunOutput` (`message`, không `reply`). FE `/patient/assistant` vẫn mock timeout. Food Log intent = stub; **không** hiện nav Ghi nhận (Won't Have).

## 1. Mục tiêu (Why)
Cho phép bệnh nhân hỏi tự do về dinh dưỡng/tương tác thuốc–thực phẩm qua chat, được trả lời có căn cứ (citation) từ guideline/food KB thay vì AI tự bịa.

## 2. User story
Là **bệnh nhân**, tôi muốn hỏi trợ lý AI các câu hỏi dinh dưỡng liên quan đến bệnh lý của mình, để nhận câu trả lời đáng tin cậy có nguồn trích dẫn.

## 3. Business rules
1. Entry point duy nhất: `POST /api/v1/chat` → thin wrapper gọi `run_agent`.
2. Graph xử lý: load profile → classify intent → route theo intent.
3. Intent routing (theo `intent_classifier`):
   - `meal_plan` → tái sử dụng MealPlannerAgent.
   - `interaction_check` → tái sử dụng InteractionCheckerAgent.
   - `rag_qa` → retrieve guideline/food chunks từ Vector Store → LLM trả lời kèm citations.
   - `refuse` → intent ngoài phạm vi y khoa (vd: hỏi đổi thuốc, đổi liều) → guardrail chặn, trả message hướng dẫn gặp bác sĩ.
   - `food_log` → hiện là **stub node**, ngoài phạm vi MVP.
   - `unknown` → fallback, trả message hướng dẫn.
4. Guardrail cứng áp dụng cho `rag_qa`: mọi số liệu dinh dưỡng trả lời **phải có citation**; không có nguồn → không được trả số liệu đó (redact hoặc từ chối phần đó).

## 4. Luồng chính (happy path)
1. Bệnh nhân gửi message tại `/patient/assistant`.
2. `POST /api/v1/chat`.
3. Graph: `profile_loader` → `intent_classifier`.
4. Route theo intent (xem bảng trên).
5. Trả kết quả kèm citation (với `rag_qa`) hoặc kết quả từ agent tương ứng.

## 5. Edge cases
- Câu hỏi mơ hồ, match nhiều intent cùng lúc (vd: vừa hỏi tương tác vừa hỏi xin đổi thuốc) → *[CẦN XÁC NHẬN: intent classifier có multi-label hay chỉ chọn 1 intent chính?]*
- `rag_qa` không tìm được chunk liên quan trong Vector Store → phải trả lời rõ "không tìm thấy thông tin đáng tin cậy" thay vì để LLM tự sinh không citation.
- User hỏi bằng ngôn ngữ khác tiếng Việt → *[CẦN XÁC NHẬN: MVP có hỗ trợ đa ngôn ngữ không — theo §2.3 tài liệu hệ thống, multi-language thuộc Won't Have.]*

## 6. Ngoài phạm vi (Out of scope)
- `food_log` intent — stub, không implement đầy đủ trong MVP.
- Multi-turn context dài hạn / memory hội thoại (Should/Could).

## 7. API liên quan
| Method | Path | Role |
|---|---|---|
| POST | `/api/v1/chat` | patient |

## 8. Liên quan
- Contract: `contracts/agent-io-schema.md`
- ADR: `002-langgraph-orchestration.md`, `003-embedding-model.md`
