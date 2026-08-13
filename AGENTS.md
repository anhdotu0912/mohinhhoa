# AGENTS.md

Hướng dẫn ngắn cho AI coding agent trên repo **P-014**.

1. Đọc [`CLAUDE.md`](CLAUDE.md) trước (MoSCoW, stack **as-built**, luật cứng).
2. Big picture: [`docs/MO_TA_HE_THONG.md`](docs/MO_TA_HE_THONG.md).
3. Specs: [`specs/`](specs/) (`01`–`06`) — mỗi file có mục **Status** (as-built vs to-be).
4. ADR: [`adrs/`](adrs/) — Chroma (001 superseded), LangGraph, MiniLM, compliance event-driven, `DEMO_MOCK`, SQLite.
5. Contracts: [`contracts/agent-io-schema.md`](contracts/agent-io-schema.md) + [`contracts/api-v1.md`](contracts/api-v1.md). **Sửa contract trước, code sau.**
6. Backlog: [`tasks/roadmap-gap-closure.md`](tasks/roadmap-gap-closure.md).
7. Hạn chế thay đổi frontend đã được thiết kế.

**Không** implement Food Log trong MVP (nav đã ẩn). Ưu tiên demo North Star mượt hơn thêm feature.
