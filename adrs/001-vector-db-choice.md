# ADR 001 — Vector DB Choice

- **Status:** Accepted
- **Date:** 2026-08-04
- **Deciders:** BE1 (AI Core), BE2 (Platform)

## Context

Cần vector store cho RAG (guideline y tế + CSDL thực phẩm VN), tiếng Việt, prototype 2 tuần, deploy Railway. Trước đó boilerplate từng mặc định ChromaDB.

## Decision

Dùng **Qdrant** làm Vector DB chính cho MVP và demo.

## Options considered

| Option | Pros | Cons |
|---|---|---|
| ChromaDB | Setup cực nhanh, local-friendly | Ít “prod-like”; filter/payload kém linh hoạt hơn khi scale |
| Pinecone | Managed, nhanh | Chi phí / vendor lock; overkill 2 tuần |
| FAISS | Nhẹ | Tự quản metadata/filter; kém DX cho hybrid |
| **Qdrant** | Filter payload mạnh, Docker/cloud dễ, hybrid-friendly | Cần thêm service trong compose |

## Consequences

- `docker-compose` thêm service `qdrant`; data dir `qdrant_data/` gitignore.
- BE1 sở hữu indexer/retriever; BE2 chỉ cần health/env (`QDRANT_URL`, collection names).
- Plan B: Qdrant Cloud free tier nếu Railway disk/memory chật.

## Notes

Hybrid dense + BM25: dense trên Qdrant; BM25 có thể in-process (rank_bm25) rồi fusion — chi tiết implementation thuộc BE1.
