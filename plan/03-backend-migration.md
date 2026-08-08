# Giai đoạn 2 — Di chuyển Backend (be_old → backend)

Làm trước frontend vì ít phụ thuộc UI/UX, dễ kiểm chứng bằng `backend/tests` có sẵn.

Convention đích (theo `backend/app/`):
```
app/agents/       # logic agent (LangGraph nodes, graph.py)
app/api/v1/       # routes_*.py
app/core/         # config, security
app/db/           # session, init_db
app/guardrails/   # rules, source_check
app/models/       # SQLAlchemy/pydantic models
app/rag/          # embeddings, indexer, retriever
app/schemas/      # request/response schemas
app/services/     # business logic thuần
```

## Việc cần làm

- [ ] Với mỗi file được đánh dấu **NEW** trong `MIGRATION_be_diff.txt` (từ giai đoạn kiểm kê):
  1. Xác định đúng thư mục đích theo convention ở trên (không phải copy nguyên cấu trúc cũ của be_old).
  2. Dùng `git mv` nếu file đã được track, hoặc copy + `git add` nếu chưa:
     ```bash
     git mv be_old/<path> backend/app/<đúng-vị-trí>/<file>
     ```
  3. Sửa import path trong file vừa di chuyển cho khớp package `app.*` hiện tại.
  4. Chạy test liên quan ngay: `python -m pytest backend/tests -k <tên_liên_quan> -v`.
  5. Commit riêng: `git commit -m "feat: migrate <tên module> from be_old"`.

- [ ] Với mỗi file được đánh dấu **CONFLICT**:
  1. Diff 2 bản: `diff backend/app/<path> be_old/<path>`.
  2. Xác định phần nào trong be_old là cải tiến thực sự (không phải code cũ/thử nghiệm).
  3. Merge thủ công vào file trong `backend/`, không ghi đè toàn bộ.
  4. Ghi quyết định vào `MIGRATION_NOTES.md`: "giữ X vì Y".
  5. Chạy test, commit riêng cho từng file/module.

- [ ] Cập nhật `backend/requirements.txt` nếu be_old dùng dependency mới (đã ghi ở bước kiểm kê). Cài và test lại:
  ```bash
  cd backend && pip install -r requirements.txt && python -m pytest tests -v
  ```

- [ ] Kiểm tra `backend/data/` (guidelines, drug_food_interactions.json, food_db_vn.json) — nếu be_old có data mới/cập nhật hơn, merge có kiểm soát, không ghi đè data hiện tại mà không so sánh.

- [ ] Sau khi migrate xong toàn bộ NEW + CONFLICT của be_old, chạy full test suite:
  ```bash
  cd backend && python -m pytest tests -v
  ```
  Nếu fail, sửa trước khi sang giai đoạn tiếp theo — không mang lỗi sang frontend migration.

## Điều kiện để chuyển sang giai đoạn tiếp theo
- Toàn bộ file NEW/CONFLICT của be_old đã được xử lý (di chuyển hoặc merge, ghi log).
- `pytest backend/tests` pass 100% (hoặc các fail đã biết và được ghi rõ lý do trong `MIGRATION_NOTES.md`).
- `be_old/` chưa bị xoá (giữ lại để đối chiếu đến Giai đoạn 6).

→ Tiếp tục với `04-frontend-restructure.md`.
