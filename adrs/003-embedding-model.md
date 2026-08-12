# ADR-003: Embedding Model cho RAG

## Status
Accepted — đang chạy `paraphrase-multilingual-MiniLM-L12-v2`. Gemini Embedding **chưa** implement.

## Context
Nội dung KB (food_db_vn, guidelines) chủ yếu tiếng Việt. Cần embedding model hỗ trợ tốt tiếng Việt cho dense retrieval, đồng thời cân nhắc chi phí/rate-limit nếu dùng API ngoài (so với model chạy local).

## Decision
Dùng model đa ngôn ngữ **`paraphrase-multilingual-MiniLM-L12-v2`** (SentenceTransformer local) làm mặc định qua `EMBEDDING_MODEL` trong env.

## As-built (quan trọng)
- **Gemini Embedding / API key rotation: chưa implement.** Đổi env chỉ đổi tên model SentenceTransformer local (vẫn cần re-index).
- CLAUDE.md cũ từng ghi Gemini Embedding 2 — **lỗi thời**; không coi đó là stack hiện tại.

## Consequences
- **Positive:** Demo ổn định, không phụ thuộc quota embedding API.
- **Negative:** Chất lượng tiếng Việt có thể thấp hơn embedding API lớn — eval trước khi đổi.
- **Post-demo:** nếu chuyển Gemini/OpenAI embedding → implement client mới + rotation + re-index toàn bộ Chroma.

## Lưu ý vận hành
Đổi embedding model bắt buộc **re-index** Vector Store — không tương thích ngược giữa các model.
