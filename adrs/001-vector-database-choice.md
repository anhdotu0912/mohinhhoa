# ADR-001: Lựa chọn Vector Database (Qdrant only)

## Status
Accepted — **Update 2026-08-19: Qdrant là vector store DUY NHẤT.** ChromaDB fallback đã bị gỡ bỏ hoàn toàn khỏi codebase (không còn `VECTOR_DB_PROVIDER`, không còn `chromadb` trong `requirements.txt`) để đơn giản hoá stack theo yêu cầu "chỉ dùng 2 database: Qdrant + Postgres" (xem ADR-005 cho phần Postgres).

## Context
VinNutri cần một vector store để RAG trên hai nguồn dữ liệu: `food_db_vn.json` (food items) và `data/guidelines/*.md` (hướng dẫn dinh dưỡng lâm sàng), phục vụ node `rag_qa` trong LangGraph (`backend/app/agents/nodes/rag_tool.py` → `app/rag/retriever.py`).

## Decision
- **Vector store duy nhất: Qdrant.**
  - Hỗ trợ local embedded persistence (`./qdrant_db`, mặc định `QDRANT_PERSIST_DIR`) cho môi trường dev/local không cần cài đặt server Docker phức tạp.
  - Hỗ trợ kết nối Qdrant Server / Qdrant Cloud cho môi trường Production thực tế qua các biến môi trường `QDRANT_URL` và `QDRANT_API_KEY`.
- **Đã gỡ bỏ (2026-08-19):** ChromaDB không còn là lựa chọn fallback. `app/rag/indexer.py` và `app/rag/retriever.py` chỉ còn code path Qdrant; `app/main.py`'s `/health` chỉ kiểm tra Qdrant readiness.
- Local MiniLM embedding fallback (`EMBEDDING_MODEL`) vẫn giữ nguyên nhưng nay dùng trực tiếp `sentence-transformers` thay vì `chromadb.utils.embedding_functions` wrapper.

## Consequences
**Positive**
- Zero infra cost, zero network latency, chạy tốt trên máy dev / container demo không cần internet.
- Hybrid dense+BM25 đã có sẵn, không phụ thuộc hoàn toàn vào chất lượng embedding.
- Một vector store duy nhất → giảm surface area, giảm nhánh code cần test/maintain, giảm 1 dependency (`chromadb`) khỏi image production.

**Negative**
- Không có replication/HA — nếu thư mục `qdrant_db/` mất hoặc corrupt phải re-index từ đầu (`python -m app.rag.indexer`).
- Không scale cho nhiều instance backend chạy song song khi dùng local file persistence (local file lock) — cần chuyển sang Qdrant Server/Cloud (`QDRANT_URL`) nếu scale-out.
- Corpus dữ liệu hiện tại chưa đủ chất lượng cho demo RAG thật — cần BE1 hoàn thiện `data/guidelines/*.md` và làm sạch `data/food_db_vn.json` (xem `specs/13-ai-chat-assistant.md`, `tasks/be1-ai-core.md`).

**Alternatives đã cân nhắc**
- Giữ ChromaDB làm fallback: bị loại (2026-08-19) vì tăng surface area/maintenance cho một prototype 2 tuần, trong khi Qdrant local file mode đã đủ ổn định làm mặc định duy nhất.
- Qdrant self-host từ đầu: bị loại vì thêm 1 container/service phải vận hành trong 2 tuần, không đáng cho quy mô demo.
- Pinecone free tier: bị loại vì cần network + API key ngoài, tăng rủi ro khi demo offline/local.
- FAISS in-memory: bị loại vì không persist giữa các lần restart backend, mất toàn bộ index sau mỗi lần deploy lại.
