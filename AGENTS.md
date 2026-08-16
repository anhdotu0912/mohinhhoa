# AGENTS.md

Hướng dẫn ngắn cho AI coding agent trên repo **P-014**.

1. Đọc [`CLAUDE.md`](CLAUDE.md) trước (MoSCoW, stack **as-built**, luật cứng).
2. Big picture: [`docs/MO_TA_HE_THONG.md`](docs/MO_TA_HE_THONG.md).
3. Specs: [`specs/`](specs/) (`01`–`13`) — mỗi file có mục **Status** (Done/Partial/Planned).
4. ADR: [`adrs/`](adrs/) (`001`–`010`) — Chroma (001), LangGraph (002), embedding (003), LLM provider (004), SQLite/Postgres (005), HITL guardrails (006), compliance notification (007), compliance summary (008), Food Log scope (009), metrics history (010).
5. Contracts: [`contracts/agent-io-schema.md`](contracts/agent-io-schema.md) + [`contracts/api-v1.md`](contracts/api-v1.md). **Sửa contract trước, code sau.**
6. Backlog: [`tasks/roadmap-mvp.md`](tasks/roadmap-mvp.md).
7. Hạn chế thay đổi frontend đã được thiết kế.

**Không** implement Food Log trong MVP (nav đã ẩn). Ưu tiên demo North Star mượt hơn thêm feature.
