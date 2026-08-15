# ADR-006: Chiến lược HITL & Guardrails

## Status
Accepted (kiến trúc) — **Implementation: Planned/Partial**, xem ghi chú As-built.

## Context
Luật cứng của dự án (`CLAUDE.md` Mục 7):
- AI **không** được tự ý khuyến nghị đổi thuốc/liều lượng — luôn redirect bác sĩ.
- Mọi kế hoạch dinh dưỡng **phải** được bác sĩ duyệt trước khi coi là chính thức (HITL bắt buộc).
- Mọi số liệu dinh dưỡng AI trả về phải có nguồn trích dẫn từ RAG/KB — không hallucinate.

Cần một vị trí kiến trúc rõ ràng cho các guardrail này trong pipeline agent, và một quyết định về việc implement thật (`backend/app/guardrails/rules.py`, `source_check.py`) so với hành vi tạm thời hiện có nằm rải rác trong code.

**As-built xác nhận khi audit:**
```python
"""Placeholder"""
```
Đây là **toàn bộ nội dung** của cả `backend/app/guardrails/rules.py` và `backend/app/guardrails/source_check.py` — chưa có logic thật nào được implement ở 2 file này.

Guardrail đang hoạt động thật hiện nay nằm **inline, rải rác**, không tập trung:
1. **HITL kế hoạch dinh dưỡng:** thực hiện đúng — mọi `MealPlanOutput` sinh ra có `status="pending_review"` mặc định (`meal_planner_agent.py`, model `MealPlan.status` default), chỉ chuyển `approved`/`edited` qua `POST /doctor/meal-plans/{id}/review` (`routes_doctor.py`). Đây là guardrail **có thật và đang chạy đúng**.
2. **Từ chối đổi thuốc/chẩn đoán:** thực hiện qua 2 lớp độc lập, không dùng `guardrails/rules.py`:
   - `intent_classifier._INTENT_PATTERNS["refuse"]` — regex tiếng Việt (`đổi thuốc`, `tăng liều`, `chẩn đoán`, `kê đơn`, ...) để route sang `refuse_node`.
   - `refuse_node` (`graph.py`) — trả câu trả lời từ chối hard-code, không gọi guardrail module nào.
   - Prompt LLM của `meal_plan_node`/`rag_qa_node` có dòng chỉ dẫn "KHÔNG khuyến nghị đổi thuốc/liều" — đây là **prompt-level guardrail**, không có kiểm tra output sau khi LLM trả lời (không có step verify LLM có tuân thủ chỉ dẫn không).
3. **Citation bắt buộc cho `rag_qa`:** `rag_qa_node` luôn gắn `citations` từ `chunk.source` của kết quả retrieve — nhưng **không có bước kiểm tra/redact** nếu retrieval trả về rỗng (which đang xảy ra trong thực tế vì corpus RAG chưa đầy đủ, xem `adrs/001-vector-database-choice.md`). Khi không có context, `_generate_answer` vẫn để LLM trả lời tự do (nếu có key) hoặc trả template chung — **không guarantee** "không có citation thì redact/từ chối" như luật cứng yêu cầu.

## Decision
1. **Vị trí kiến trúc (giữ nguyên, Accepted):** guardrails chạy như một **post-processing step cuối** trong graph, ngay trước khi node trả `answer` — tức là mỗi node xử lý intent (`rag_qa`, `meal_plan`, `interaction_check`) phải gọi qua `guardrails/source_check.py::check_citations(answer, citations)` (kiểm tra output có citation hay không, nếu không → redact phần không có nguồn hoặc trả câu từ chối chuẩn) và `guardrails/rules.py::check_refusal(message, answer)` (danh sách từ khoá/luật từ chối tập trung, dùng chung cho `intent_classifier` lẫn kiểm tra output LLM) — thay vì để rải rác trong từng node như hiện tại.
2. **Danh sách câu AI phải từ chối:** tập trung hoá vào `guardrails/rules.py` (theo đúng luật cứng CLAUDE.md Mục 7 "Danh sách câu AI phải từ chối & redirect bác sĩ → định nghĩa trong `backend/app/guardrails/rules.py`") — hiện các pattern đang nằm ở `intent_classifier._INTENT_PATTERNS["refuse"]`, cần di chuyển/tham chiếu chung khi implement thật.
3. **HITL meal plan:** giữ nguyên as-built (`pending_review` → duyệt qua doctor review endpoint) — không cần thay đổi kiến trúc, chỉ cần đảm bảo **mọi** đường sinh plan (kể cả qua `/chat` intent `meal_plan`, xem `adrs/002`) đều persist với status khởi tạo `pending_review`, không có đường tắt nào set `approved` trực tiếp.
4. **HITL mở rộng sang ràng buộc lâm sàng (mới, 2026-08-15, Planned):** nguyên tắc "mọi thay đổi ảnh hưởng điều trị phải qua bác sĩ" không chỉ áp dụng cho meal plan mà còn cho `target_kcal`/`restrictions` — khi **patient tự sửa** 2 field này (qua `POST /profile`), thay đổi phải ở trạng thái `pending_doctor_review` cho tới khi bác sĩ xác nhận; khi **doctor tự sửa** (qua `PUT /doctor/patients/{id}/constraints`), có hiệu lực ngay vì doctor là người có chuyên môn xác nhận trực tiếp. Xem thiết kế chi tiết ở `specs/04-clinical-constraints.md`.
5. **Trạng thái implementation:** việc dời logic vào `guardrails/rules.py`/`source_check.py` là **Planned**, chưa thực hiện. Mọi spec có nhắc "guardrail chặn X" phải ghi rõ đây là hành vi kỳ vọng, không phải as-built (đúng chỉ dẫn Mục 2 của brief).

## Consequences
**Positive**
- Guardrail tập trung 1 nơi giúp audit/test dễ hơn (viết `tests/guardrails/` cho riêng module này) và tránh việc mỗi node tự viết logic từ chối khác nhau.
- HITL kế hoạch dinh dưỡng — phần quan trọng nhất về an toàn y tế — đã có thật và đúng thiết kế ngay từ bây giờ.

**Negative**
- Citation-guardrail cho `rag_qa` **chưa** có thật → rủi ro thật: nếu corpus RAG rỗng, hệ thống hiện trả lời chung/mơ hồ chứ không **từ chối rõ ràng** như luật cứng mô tả — cần BE1 implement trước khi công bố demo RAG Q&A là "an toàn, có nguồn trích dẫn 100%".
- Refuse-list hiện chỉ bắt được câu hỏi khớp regex tiếng Việt định sẵn — câu hỏi diễn đạt khác (đồng nghĩa, viết tắt, tiếng Anh) có thể lọt qua và được LLM trả lời tự do (chỉ có prompt-level chỉ dẫn, không có hard block).

**Alternatives đã cân nhắc**
- Guardrail ở tầng API (BE2, sau khi Agent trả kết quả): bị loại vì tách rời khỏi ngữ cảnh state (`citations`, `guardrail_flags` đã có sẵn trong `AgentState`), sẽ phải serialize/deserialize lại thông tin không cần thiết.
- Dùng một LLM riêng làm "guardrail judge" (LLM-as-a-judge) kiểm tra output: cân nhắc cho tương lai nếu rule-based không đủ, nhưng tăng cost + latency — chưa phù hợp cho prototype demo.
