# AGENTS.md

Hướng dẫn ngắn cho AI coding agent trên repo **VinNutri (P-014)**.

1. Đọc [`CLAUDE.md`](CLAUDE.md) trước (MoSCoW, stack **as-built**, luật cứng).
2. Big picture: [`docs/MO_TA_HE_THONG.md`](docs/MO_TA_HE_THONG.md).
3. Specs: [`specs/`](specs/) (`01`–`13`) — mỗi file có mục **Status** (Done/Partial/Planned).
4. ADR: [`adrs/`](adrs/) (`001`–`013`) — Qdrant only (001), LangGraph (002), embedding (003), LLM provider (004), Postgres only (005), HITL guardrails (006), compliance notification (007), compliance summary (008), Food Log scope (009), metrics history superseded (010), meal plan validity (011), week slots (012), metrics time-series (013).
5. Contracts: [`contracts/agent-io-schema.md`](contracts/agent-io-schema.md) + [`contracts/api-v1.md`](contracts/api-v1.md). **Sửa contract trước, code sau.**
6. Backlog: [`tasks/roadmap-mvp.md`](tasks/roadmap-mvp.md).
7. Hạn chế thay đổi frontend đã được thiết kế.

Food Log (ADR-009) và Patient Metrics time-series (ADR-013) đã implement — xem `specs/09`, `specs/12`, contracts §12 + §14.
