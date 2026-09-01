# ADR-004: LLM Provider và Fallback Strategy

## Status
Accepted — **§ "Decision (mới)"** bổ sung quyết định 2026-08-15 (dual-provider fallback OpenAI ↔ DeepSeek), chưa implement trong code (Planned). Phần Context/Decision gốc (single-provider qua `LLM_PROVIDER` + fallback rule-based) vẫn đúng as-built hiện tại.

## Context
Nhiều node trong agent graph dùng LLM: `intent_classifier` (phân loại intent), `meal_plan_node` → `_try_llm_plan` (soạn thực đơn từ catalog), `rag_qa_node` → `_generate_answer` (trả lời câu hỏi có RAG context). Rủi ro:
- API key có thể thiếu/hết hạn khi demo (mất mạng, hết quota).
- Team muốn linh hoạt đổi provider (OpenAI vs DeepSeek) theo chi phí mà không đổi code node.
- Guideline "ưu tiên demo mượt hơn đầy đủ tính năng" (CLAUDE.md Mục 1) đòi hỏi hệ thống **không được crash** khi LLM không khả dụng.

As-built (`backend/app/core/llm.py`, `backend/app/core/config.py`):
- `LLM_PROVIDER` = `openai` (default) | `deepseek`, đọc từ env.
- API key resolution: ưu tiên `LLM_API_KEY` chung; nếu trống, dùng `OPENAI_API_KEY` hoặc `DEEPSEEK_API_KEY` tương ứng theo provider.
- `llm_configured()` = `bool(llm_api_key())` — nếu không có key nào, `get_chat_llm()` trả `None`.
- `llm_model()`: default `gpt-4o-mini` (openai) hoặc `deepseek-chat` (deepseek); nếu `LLM_MODEL` bắt đầu bằng `gpt-` nhưng provider là `deepseek`, tự sửa về `deepseek-chat` (tránh cấu hình sai giữa 2 provider).
- `llm_base_url()`: tự set `https://api.deepseek.com` khi provider = deepseek (OpenAI-compatible API), hoặc dùng `LLM_BASE_URL` nếu set.
- Client dùng chung `langchain_openai.ChatOpenAI` cho cả 2 provider (DeepSeek expose OpenAI-compatible endpoint) — không cần SDK riêng.

**Fallback khi không có LLM (mỗi node tự định nghĩa fallback riêng, không dùng chung 1 cơ chế):**
| Node | Fallback khi `get_chat_llm()` trả `None` hoặc lỗi |
|---|---|
| `intent_classifier` | `_classify_by_keywords()` — regex tiếng Việt theo intent, default `rag_qa` nếu không khớp pattern nào |
| `meal_plan_node` (`_try_llm_plan`) | `_rule_based_days()` — rotation xoay vòng theo `day_index` trên catalog đã lọc dị ứng/preference |
| `rag_qa_node` (`_generate_answer`) | `_template_answer()` — trả nguyên context RAG (≤800 ký tự) kèm câu nhắc "tham vấn bác sĩ" |

## Decision (gốc, as-built)
- Giữ nguyên kiến trúc provider-agnostic qua `app/core/llm.py` làm single entry point (`get_chat_llm`, `llm_configured`) cho mọi node cần LLM — không gọi trực tiếp `ChatOpenAI`/SDK provider trong node.
- Mỗi node **bắt buộc** có fallback rule-based/keyword/template riêng khi `llm_configured() == False` hoặc khi LLM invoke lỗi (try/except quanh mọi lệnh gọi LLM) — không để thiếu key làm crash toàn graph.
- Provider chính cho demo: `openai` (`gpt-4o-mini`) trừ khi team đổi `LLM_PROVIDER=deepseek` vì lý do chi phí.

## Decision (mới, 2026-08-15 — Planned, chưa code)
Team quyết định dùng **cả 2 nhà cung cấp** (OpenAI + DeepSeek) trong cùng 1 luồng, không chỉ chọn 1 qua `LLM_PROVIDER` như trước — thêm 1 tầng **fallback provider-to-provider** ở giữa LLM thật và fallback rule-based:

1. **3 tầng fallback theo thứ tự** (thay cho 2 tầng cũ "LLM thật → rule-based"):
   - **Tầng 1 — Provider chính:** theo `LLM_PROVIDER` (`openai` mặc định).
   - **Tầng 2 — Provider phụ:** nếu gọi provider chính lỗi (timeout, hết quota, key invalid) → tự động thử lại với provider còn lại (`openai ↔ deepseek`) trước khi rơi về rule-based. Cần cấu hình sẵn cả `OPENAI_API_KEY` và `DEEPSEEK_API_KEY` để tầng này có tác dụng — nếu chỉ có 1 key, tầng 2 tự bỏ qua (coi như không có provider phụ).
   - **Tầng 3 — Rule-based/keyword/template:** giữ nguyên như Decision gốc, dùng khi cả 2 provider đều lỗi/không có key.
2. **Không đổi interface `app/core/llm.py`** cho node gọi (`get_chat_llm`) — logic thử-provider-phụ nằm **trong** `llm.py`, node không cần biết đang dùng provider nào ở lần gọi cụ thể.
3. **Không retry vô hạn** — mỗi tầng chỉ thử 1 lần (không có exponential backoff); nếu tầng 2 cũng lỗi, chuyển thẳng sang tầng 3 ngay, tránh làm chậm response khi cả 2 provider đều down.
4. **Log rõ provider đang dùng thực tế** mỗi lần gọi (bao gồm khi đã fallback sang tầng 2/3) — khắc phục điểm yếu "không có cảnh báo tập trung" đã ghi ở Negative bên dưới của Decision gốc.

## Consequences
**Positive (Decision gốc)**
- Demo chạy được ngay cả khi không set API key nào (100% fallback rule-based) — an toàn cho tình huống mất mạng khi pitch.
- Đổi provider chỉ cần đổi env, không sửa code node.

**Positive (Decision mới)**
- Tăng độ sẵn sàng: 1 provider down (ví dụ OpenAI rate-limit giữa lúc demo) không làm rơi thẳng về chất lượng rule-based thấp — vẫn còn DeepSeek làm phương án 2 trước khi hạ cấp.
- Có thể chọn provider chính theo chi phí (DeepSeek rẻ hơn) mà vẫn có OpenAI làm lưới an toàn chất lượng cao hơn, hoặc ngược lại.

**Negative (Decision gốc, vẫn còn)**
- Chất lượng fallback rule-based thấp hơn nhiều so với LLM thật (ví dụ: `_classify_by_keywords` chỉ nhận diện được các câu hỏi khớp pattern định sẵn; thực đơn rule-based kém đa dạng hơn LLM).

**Negative (Decision mới)**
- Cần cấu hình + trả phí cho **2 API key** đồng thời để tầng 2 phát huy tác dụng (tốn thêm chi phí vận hành so với chỉ 1 provider).
- Độ trễ tổng thể tăng khi tầng 1 lỗi — phải chờ timeout tầng 1 rồi mới thử tầng 2, rồi mới rơi về tầng 3 (cần đặt timeout ngắn hợp lý cho mỗi tầng để không làm chậm demo).
- 2 provider có thể trả kết quả khác nhau về văn phong/format cho cùng 1 prompt — cần test kỹ để đảm bảo output vẫn khớp schema mong đợi (`MealPlanOutput`, `AgentRunOutput`) bất kể provider nào trả lời.

**Alternatives đã cân nhắc**
- Bắt buộc có API key khi start server (fail-fast): bị loại vì vi phạm nguyên tắc "demo mượt hơn đầy đủ" — thà chạy ở chất lượng thấp hơn còn hơn crash.
- LangChain `with_fallbacks()` chain-level fallback: phù hợp để implement tầng 2 mới (provider-to-provider) — khuyến nghị dùng cơ chế này của LangChain thay vì tự viết retry logic thủ công, ghi vào backlog `tasks/be1-ai-core.md`.
- Chạy song song cả 2 provider rồi chọn kết quả tốt hơn (ensemble): bị loại — tốn gấp đôi chi phí/độ trễ cho mỗi lần gọi, không cần thiết cho quy mô demo, chỉ cần 1 provider phụ dự phòng khi provider chính lỗi.
