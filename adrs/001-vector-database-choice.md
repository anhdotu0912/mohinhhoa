# ADR-001: Lựa chọn Vector Database (ChromaDB dev / Qdrant·Pinecone prod)

## Status
Accepted (Qdrant Dual Support Implemented)

## Context
VMEC-10 cần một vector store để RAG trên hai nguồn dữ liệu: `food_db_vn.json` (food items) và `data/guidelines/*.md` (hướng dẫn dinh dưỡng lâm sàng), phục vụ node `rag_qa` trong LangGraph (`backend/app/agents/nodes/rag_tool.py` → `app/rag/retriever.py`).

## Decision
- **Mặc định Deploy & Production:** Tích hợp **Qdrant** làm provider mặc định (`VECTOR_DB_PROVIDER=qdrant`).
  - Hỗ trợ local embedded persistence (`./qdrant_db`) cho môi trường dev/local không cần cài đặt server Docker phức tạp.
  - Hỗ trợ kết nối Qdrant Server / Qdrant Cloud cho môi trường Production thực tế qua các biến môi trường `QDRANT_URL` và `QDRANT_API_KEY`.
- **Duy trì Tương thích:** Giữ nguyên hỗ trợ **ChromaDB** (`VECTOR_DB_PROVIDER=chroma`) như một lựa chọn fallback linh hoạt.
- **Tầng trừu tượng:** Interface truy vấn (`retrieve_foods`, `retrieve_guidelines`, `retrieve_hybrid`) ở tầng `app/rag/retriever.py` tự động nhận diện client Qdrant hoặc ChromaDB để không ảnh hưởng đến logic của AI Agent.

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
