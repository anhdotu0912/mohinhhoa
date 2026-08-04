# ADR 003 — Embedding Model

- **Status:** Accepted
- **Date:** 2026-08-04
- **Deciders:** BE1 (AI Core)

## Context

Cần embedding đa ngữ, tiếng Việt tốt, chi phí thấp, có thể xoay vòng API key khi rate-limit. Trước đó từng cân nhắc `multilingual-e5-base` self-host.

## Decision

Dùng **Gemini Embedding 2** (tên model cụ thể cấu hình qua env, vd. `EMBEDDING_MODEL`), có **API key rotation**.

## Options considered

| Option | Pros | Cons |
|---|---|---|
| multilingual-e5-base (local) | Free, offline | RAM/CPU trên Railway; ops nặng prototype |
| OpenAI text-embedding-3 | Chất lượng ổn | Cost; tiếng Việt không phải điểm mạnh nhất |
| **Gemini Embedding 2** | API managed, VN ổn, khớp stack Gemini keys | Rate-limit → cần rotation + cache |

## Consequences

- Env bắt buộc: `EMBEDDING_MODEL`, `GEMINI_API_KEYS` (list/CSV) hoặc cơ chế rotation tương đương.
- Cache embedding theo hash(chunk) để giảm cost/latency khi re-index.
- Indexer (BE1) fail-soft: hết quota → log rõ, không silent empty index.
- Không đổi Vector DB khi đổi embedding model — **phải re-index** toàn bộ nếu đổi model.

## Non-goals

Fine-tune embedding. Cross-encoder rerank (Could Have nếu còn thời gian ngày 12–13).
