# ADR-006: Chiến lược HITL & Guardrails

## Status
Accepted — Implemented (as-built 2026-08-18). Per-recommendation guardrails wired 2026-08-31 (T01): `validate_interaction_output`/`sanitize_recommendation` chạy qua `enforce_interaction_recommendations`.

## Context
Luật cứng của dự án (`CLAUDE.md` Mục 7):
- AI **không** được tự ý khuyến nghị đổi thuốc/liều lượng — luôn redirect bác sĩ.
- Mọi kế hoạch dinh dưỡng **phải** được bác sĩ duyệt trước khi coi là chính thức (HITL bắt buộc).
- Mọi số liệu dinh dưỡng AI trả về phải có nguồn trích dẫn từ RAG/KB — không hallucinate.

Cần một vị trí kiến trúc rõ ràng cho các guardrail này trong pipeline agent, tập trung vào `backend/app/guardrails/rules.py` và `source_check.py` thay vì để rải rác trong từng node.

## Decision
1. **Vị trí kiến trúc (as-built):** guardrails chạy như một **post-processing node cuối** trong LangGraph graph — `apply_guardrails` (`agents/graph.py`), nối từ mọi node xử lý intent (`rag_qa`, `meal_plan`, `interaction_check`, `food_log`, `refuse`, `unknown`) trước khi tới `END`. Node này gọi:
   - `guardrails/rules.py::enforce_interaction_recommendations` — validate + sanitize từng `recommendation` trong `InteractionItem` (nếu state có `interactions`); patch `answer` tương ứng **trước** bước refuse toàn câu.
   - `guardrails/source_check.py::enforce_citation_guardrail(intent, answer, citations)` — kiểm tra output có citation hợp lệ hay không (chủ yếu áp dụng cho `rag_qa`), redact/thay câu trả lời nếu thiếu nguồn.
   - `guardrails/rules.py::enforce_output_safety(answer)` — quét `answer` cuối cùng theo `_UNSAFE_ACTION_PATTERNS` (đổi thuốc, tăng/giảm liều, ngưng thuốc, kê đơn, chẩn đoán...); nếu khớp, ép `intent="refuse"` và thay `answer` bằng `get_refuse_message()`.
2. **Danh sách câu AI phải từ chối — tập trung hoá (as-built):** `guardrails/rules.py::REFUSE_REGEX_PATTERNS` là **nguồn duy nhất** cho cả 2 nơi cần dùng — `intent_classifier._INTENT_PATTERNS["refuse"]` import trực tiếp từ `guardrails.rules` (không định nghĩa lại pattern riêng), và `enforce_output_safety` dùng `_FORBIDDEN_PATTERNS` (superset gần giống, dạng chuỗi để match cả có/không dấu) để hậu kiểm output. Đúng luật cứng `CLAUDE.md` Mục 7.
3. **HITL meal plan (as-built, không đổi từ thiết kế gốc):** mọi `MealPlanOutput` sinh ra qua `POST /meal-plans/generate` (patient/doctor) có `status="pending_review"` mặc định (`meal_planner_agent.py`, model `MealPlan.status`), chỉ chuyển `approved`/`edited` qua `POST /doctor/meal-plans/{id}/review` (`routes_doctor.py`, `specs/06`). Đường sinh plan qua `/chat` (`meal_plan_node`) không tạo plan mới nên không có "đường tắt" set `approved` trực tiếp (xem `adrs/002`).
4. **HITL ràng buộc lâm sàng (cập nhật 2026-08-29):** nguyên tắc "mọi thay đổi ảnh hưởng điều trị phải qua bác sĩ" áp dụng cho `target_kcal`/`restrictions`/`treatment_goals`. Khi **patient gửi** các field này qua `POST /profile`, BE lưu vào cột `proposed_*` — **không** ghi đè cột hiệu lực; `constraints_status="pending_doctor_review"` cho tới khi bác sĩ `POST .../constraints/approve` (chép proposed → hiệu lực) hoặc `PUT .../constraints` (ghi hiệu lực, hủy đề xuất). `meal_planner_agent` chỉ đọc giá trị đã duyệt. Chi tiết: `specs/04-clinical-constraints.md`.

## As-built (xác nhận qua code 2026-08-18)
- `backend/app/guardrails/rules.py` — implement đầy đủ: `REFUSE_MESSAGE`, `REFUSE_REGEX_PATTERNS`, `_UNSAFE_ACTION_PATTERNS`, `check_recommendation_safety`, `validate_interaction_output`, `validate_severity`, `sanitize_recommendation`, `enforce_interaction_recommendations`, `get_refuse_message`, `message_triggers_refuse`, `enforce_output_safety`.
- `backend/app/guardrails/source_check.py` — implement `enforce_citation_guardrail` (redact `rag_qa` answer thiếu citation).
- Cả 2 module **đã wired** vào `apply_guardrails` node trong `agents/graph.py`. T01 (2026-08-31): `validate_interaction_output`/`sanitize_recommendation` chạy qua `enforce_interaction_recommendations` trên từng `InteractionItem` (agent + skill trước khi ghép `answer`, và hậu kiểm trong `apply_guardrails`).
- `intent_classifier.py` import `REFUSE_REGEX_PATTERNS` trực tiếp từ `guardrails.rules`, không định nghĩa lại danh sách riêng.

## Consequences
**Positive**
- Guardrail tập trung 1 nơi (`apply_guardrails` + `guardrails/rules.py`/`source_check.py`) giúp audit/test dễ hơn, tránh mỗi node tự viết logic từ chối khác nhau.
- Từng `recommendation` trong `InteractionItem` được sanitize trước khi ghép `answer` — một item xấu không làm `enforce_output_safety` wipe cả câu trả lời tương tác.
- HITL kế hoạch dinh dưỡng và HITL ràng buộc lâm sàng — 2 phần quan trọng nhất về an toàn y tế — đều đã có thật và đúng thiết kế.
- Refuse-list dùng chung 1 nguồn (`REFUSE_REGEX_PATTERNS`) cho cả routing (`intent_classifier`) và hậu kiểm output (`enforce_output_safety`) — giảm rủi ro 2 nơi lệch nhau.

**Negative**
- Refuse-list hiện chỉ bắt được câu hỏi khớp regex tiếng Việt định sẵn — câu hỏi diễn đạt khác (đồng nghĩa, viết tắt, tiếng Anh ít gặp) có thể lọt qua tầng routing nhưng vẫn có cơ hội bị chặn ở tầng hậu kiểm `enforce_output_safety` nếu LLM tự sinh cụm từ vi phạm trong câu trả lời.

**Alternatives đã cân nhắc**
- Guardrail ở tầng API (BE2, sau khi Agent trả kết quả): bị loại vì tách rời khỏi ngữ cảnh state (`citations`, `guardrail_flags` đã có sẵn trong `AgentState`), sẽ phải serialize/deserialize lại thông tin không cần thiết.
- Dùng một LLM riêng làm "guardrail judge" (LLM-as-a-judge) kiểm tra output: cân nhắc cho tương lai nếu rule-based không đủ, nhưng tăng cost + latency — chưa phù hợp cho prototype demo.
