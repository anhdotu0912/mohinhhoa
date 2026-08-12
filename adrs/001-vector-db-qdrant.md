# ADR-001: Vector Database cho RAG

## Status
**Superseded (prototype)** — giữ **ChromaDB** cho MVP/demo. Qdrant không còn là target bắt buộc trong khung 2 tuần.

## Context
Cần vector store cho RAG (guideline + food DB VN). Boilerplate và code hiện tại dùng ChromaDB persist local (`chroma_db/`), gắn `docker-compose` 2 service (backend + frontend), không thêm process.

ADR cũ chọn Qdrant làm target lâu dài (filter payload, hybrid-friendly, Docker/cloud). Với scope prototype và North Star demo, chi phí migrate (đổi indexer/retriever, re-index, thêm service compose) **không** đáng so với lợi ích trước Demo Day.

## Decision
1. **Giữ ChromaDB** làm Vector DB cho prototype / MVP demo.
2. Qdrant (hoặc pgvector) chỉ xét lại **post-demo** nếu cần scale / filter phức tạp.
3. CLAUDE.md và docs vận hành phải mô tả **Chroma** là stack hiện tại — không liệt kê Qdrant như đã chạy.

## Consequences
- **Positive:** Không chặn demo; code `rag/indexer.py` / `retriever.py` giữ nguyên.
- **Negative:** Nợ kỹ thuật nếu sau này cần Qdrant — cần abstraction client nếu migrate.
- **Alternatives:** Qdrant Cloud / Docker service — hoãn; Pinecone — overkill.

## Liên quan
- Config: `CHROMA_PERSIST_DIR` (`backend/app/core/config.py`)
- Gap task migrate đã đóng theo hướng “giữ Chroma”: `tasks/roadmap-gap-closure.md` TASK-03
