# ADR-001: Lựa chọn Vector Database (ChromaDB dev / Qdrant·Pinecone prod)

## Status
Accepted

## Context
VMEC-10 cần một vector store để RAG trên hai nguồn dữ liệu: `food_db_vn.json` (food items) và `data/guidelines/*.md` (hướng dẫn dinh dưỡng lâm sàng), phục vụ node `rag_qa` trong LangGraph (`backend/app/agents/nodes/rag_tool.py` → `app/rag/retriever.py`).

Ràng buộc prototype 2 tuần:
- Không có budget cho managed vector DB (Qdrant Cloud/Pinecone) trong giai đoạn demo.
- Team nhỏ (3 người), không có SRE riêng để vận hành thêm một service ngoài.
- SQLite (ADR-005) đã là lựa chọn "dev-local-first" — vector store nên đồng nhất triết lý.

As-built xác nhận trong code: `backend/app/rag/retriever.py` và `backend/app/rag/indexer.py` dùng `chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)` (mặc định `./chroma_db`), 2 collection `food_items` và `guidelines`, hybrid retrieval dense (Chroma) + BM25 (`rank_bm25`) qua Reciprocal Rank Fusion. Đây là lựa chọn **đã triển khai**, không phải đề xuất.

**Lưu ý vận hành quan trọng phát hiện khi audit code (không nằm trong phạm vi quyết định của ADR này, nhưng ảnh hưởng hiệu quả của nó):** `backend/data/food_db_vn.json` hiện là dữ liệu placeholder (`"Thực phẩm 0"`, `"Thực phẩm 1"`, ... lặp tới `f299`, chỉ có ~10 bản ghi thật ở cuối file) và `backend/data/guidelines/` **không tồn tại trên đĩa**. Nếu chưa chạy `indexer.build_index()` với corpus thật, hai collection Chroma trống hoặc chứa dữ liệu vô nghĩa → `retrieve_foods`/`retrieve_guidelines` trả về `[]` hoặc nhiễu. Đây là gap dữ liệu (xem `tasks/be1-ai-core.md`), không phải gap kiến trúc vector DB.

## Decision
- **Dev/demo:** giữ **ChromaDB** (`PersistentClient`, local file-based, persist tại `backend/chroma_db/`, gitignored). Không cần server riêng, không cần API key, chạy được offline — tối ưu cho demo 2 tuần.
- **Production (khi có):** migrate sang **Qdrant** (self-host hoặc Qdrant Cloud) hoặc **Pinecone** (managed) khi có nhu cầu concurrent write, multi-instance backend, hoặc corpus > vài chục nghìn chunk. Chưa có timeline cụ thể — nằm trong backlog gap-closure, không chặn demo North Star.
- Interface truy vấn (`retrieve_foods`, `retrieve_guidelines`, `retrieve_hybrid`) được giữ generic ở tầng `app/rag/retriever.py` để việc đổi backend vector DB không lan sang `agents/nodes/rag_tool.py`.

## Consequences
**Positive**
- Zero infra cost, zero network latency, chạy tốt trên máy dev / container demo không cần internet.
- Hybrid dense+BM25 đã có sẵn, không phụ thuộc hoàn toàn vào chất lượng embedding.

**Negative**
- Không có replication/HA — nếu file `chroma_db/` mất hoặc corrupt phải re-index từ đầu.
- Không scale cho nhiều instance backend chạy song song (local file lock).
- Chroma reflect đúng những gì được index; corpus dữ liệu hiện tại (xem ghi chú trên) chưa đủ chất lượng cho demo RAG thật — cần BE1 hoàn thiện `data/guidelines/*.md` và làm sạch `data/food_db_vn.json` (xem `specs/13-ai-chat-assistant.md`, `tasks/be1-ai-core.md`).

**Alternatives đã cân nhắc**
- Qdrant self-host từ đầu: bị loại vì thêm 1 container/service phải vận hành trong 2 tuần, không đáng cho quy mô demo.
- Pinecone free tier: bị loại vì cần network + API key ngoài, tăng rủi ro khi demo offline/local.
- FAISS in-memory: bị loại vì không persist giữa các lần restart backend, mất toàn bộ index sau mỗi lần deploy lại.
