# ADR-003: Lựa chọn Embedding Model

## Status
Accepted — **đã triển khai** (`backend/app/core/config.py`, `backend/app/rag/embeddings.py`): provider mặc định `gemini`, model `gemini-embedding-2`, fallback local MiniLM. Sau migrate cần **re-index** Chroma (`python -m app.rag.indexer`).

## Context
Quyết định cũ (giữ local MiniLM) ưu tiên chi phí = 0 và không phụ thuộc network. Tuy nhiên, chất lượng embedding tiếng Việt của MiniLM (~118M params) bị đánh giá là giới hạn khi RAG cần độ chính xác cao hơn cho retrieval guideline dinh dưỡng/thực phẩm — đặc biệt khi dữ liệu `data/food_db_vn.json`/`data/guidelines/` được bổ sung đầy đủ hơn (xem gap chất lượng RAG đã ghi trong `specs/13-ai-chat-assistant.md` §3 rule 7).

Team quyết định đổi sang **Gemini Embedding**, cụ thể model **`gemini-embedding-2`** (model embedding đa phương thức mới nhất của Google Gemini API tại thời điểm quyết định, unify các model chuyên biệt cũ như `text-embedding-005`/`text-multilingual-embedding-002`, hỗ trợ tốt hơn 100 ngôn ngữ bao gồm tiếng Việt) — gọi qua **Gemini API** (`generativelanguage.googleapis.com`), không chạy local.

## Decision
1. **Embedding provider mới: Gemini API, model `gemini-embedding-2`.**
   - Cấu hình mới cần thêm vào `backend/app/core/config.py`: `EMBEDDING_PROVIDER: str = "gemini"` (giá trị khác: `"local"` — giữ lại để làm fallback, xem rule 3), `GEMINI_API_KEY: str = ""`, `GEMINI_EMBEDDING_MODEL: str = "gemini-embedding-2"`.
   - `backend/app/rag/embeddings.py` cần 1 custom Embedding Function (tương thích interface `chromadb.EmbeddingFunction`) gọi Gemini API (`embedContent`) thay cho `SentenceTransformerEmbeddingFunction` khi `EMBEDDING_PROVIDER=gemini`.
   - `gemini-embedding-2` không hỗ trợ `task_type` như `gemini-embedding-001` — hướng dẫn task (ví dụ "retrieval query" vs "retrieval document") phải đưa trực tiếp vào prompt/text đầu vào theo tài liệu Gemini API, không truyền qua parameter riêng.
2. **Bắt buộc re-index toàn bộ ChromaDB collection** sau khi migration — embedding space của `gemini-embedding-2` không tương thích với vector cũ từ MiniLM (khác chiều, khác không gian ngữ nghĩa). Chạy lại `app/rag/indexer.py::build_index()` cho toàn bộ `food_db_vn.json` + `data/guidelines/*.md`.
3. **Giữ local MiniLM làm fallback offline** (nhất quán với nguyên tắc "không để phụ thuộc ngoài làm crash demo" đã áp dụng cho LLM ở ADR-004) — nếu gọi Gemini API lỗi (mất mạng, hết quota, thiếu `GEMINI_API_KEY`), tự động fallback về `SentenceTransformerEmbeddingFunction` local đã có sẵn trong code, log warning rõ ràng khi đang ở fallback mode. Không để thiếu API key làm crash pipeline RAG/index.
4. Việc **index** (lúc build KB) và **query** (lúc mỗi lần `rag_qa`) cả 2 đều gọi Gemini API — cần theo dõi cost/quota nếu tần suất demo cao (khác hẳn model local cũ = 0 cost).

## Consequences
**Positive**
- Chất lượng embedding tiếng Việt/multilingual tốt hơn đáng kể so với MiniLM local (theo công bố của Google, `gemini-embedding-2`/`gemini-embedding-001` đạt state-of-the-art trên nhiều benchmark multilingual) — cải thiện độ chính xác retrieval cho `rag_qa`.
- Không cần tự quản lý/tải model local (giảm kích thước image/container khi deploy).
- Là model đa phương thức (text/image/video/audio/document) — mở khả năng mở rộng RAG sang dữ liệu hình ảnh món ăn trong tương lai (Could Have, chưa có kế hoạch cụ thể).

**Negative**
- **Thêm phụ thuộc network + cost cho mỗi lần embed** (cả index và query) — vi phạm 1 phần nguyên tắc cũ "demo không phụ thuộc external service"; cần fallback local (rule 3) để giảm rủi ro.
- **Bắt buộc re-index toàn bộ** khi migrate — tốn thời gian + gọi API nhiều lần cho toàn bộ corpus.
- Thêm độ trễ mạng cho mỗi query RAG (ảnh hưởng SLA <5s mục tiêu ở `tasks/roadmap-mvp.md`), cần đo lại sau khi migrate.
- Cần quản lý thêm 1 API key (`GEMINI_API_KEY`) ngoài `OPENAI_API_KEY`/`DEEPSEEK_API_KEY` đã có.

**Alternatives đã cân nhắc**
- Giữ nguyên local MiniLM (quyết định cũ): bị thay thế vì chất lượng multilingual bị đánh giá chưa đủ tốt khi RAG cần mở rộng dữ liệu thật.
- `gemini-embedding-001` (text-only, ổn định hơn, hỗ trợ `task_type` rõ ràng): được xem xét nhưng team chọn `gemini-embedding-2` theo yêu cầu cụ thể — lưu ý 2 model này **không tương thích embedding space với nhau**, nếu đổi lại `-001` sau này cũng phải re-index.
- `multilingual-e5-base` (đề xuất gốc trong brief cũ): không được chọn, không có ưu thế rõ so với Gemini API cho multilingual tiếng Việt và vẫn yêu cầu chạy local.

## Ghi chú migration (cho BE1)
- **Đã triển khai** — config + Gemini `EmbeddingFunction` + local fallback có trong `config.py` và `embeddings.py`. Chạy `python -m app.rag.indexer` (re-index) khi deploy môi trường mới hoặc sau thay đổi corpus/embedding model.
- Bump version `contracts/agent-io-schema.md` không cần thiết cho thay đổi này (không đổi shape input/output Agent).
