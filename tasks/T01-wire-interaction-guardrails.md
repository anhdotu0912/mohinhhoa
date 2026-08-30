# T01 — Wire interaction guardrails runtime

**Queue ID:** T01  
**Spawned from:** [queue.md](queue.md)  
**Status:** Done  
**Owner:** BE1  
**Priority:** P1

## Mục tiêu
Gắn `validate_interaction_output` và `sanitize_recommendation` vào luồng interaction thật, chặn sớm từng `recommendation` trong `InteractionItem` trước khi ghép vào `answer`.

## Spec / ADR
- [specs/13-ai-chat-assistant.md](../specs/13-ai-chat-assistant.md)
- [adrs/006-hitl-guardrails-strategy.md](../adrs/006-hitl-guardrails-strategy.md)

## Files chạm
- `backend/app/guardrails/rules.py`
- `backend/app/agents/graph.py` (`interaction_check_node`, `apply_guardrails`)
- `backend/app/agents/interaction_checker_agent.py`
- `backend/app/agents/skills/primitive_skills.py`
- `backend/tests/test_guardrails.py`

## Không đụng
- `frontend/**`
- `backend/app/api/`

## Bước làm
1. Thêm helper runtime gọi validate + sanitize trên list interaction items.
2. Gọi helper trước khi ghép `answer` (skill + `interaction_checker_agent`).
3. Gọi lại ở `apply_guardrails` làm tầng hậu kiểm structured items.
4. Test: unsafe rec bị sanitize; disclaimer phủ định không bị đụng; KB hiện tại không regression.

## Definition of Done
- [x] Hàm được gọi trên luồng interaction thật (chat + `interaction_checker_agent`)
- [x] Test pass: `pytest tests/test_guardrails.py tests/test_interaction_checker.py` (51 passed cùng two-tier + skills)
- [x] Không regression guardrail đổi thuốc/liều

## Ghi chú / Blocker
Hoàn thành 2026-08-31. Helper `enforce_interaction_recommendations` gọi `validate_interaction_output` + `sanitize_recommendation` trên từng item. Wired vào `check_interactions`, `get_medication_known_interactions`, `interaction_checker_agent`, `check_drug_food_interaction` (trước khi ghép `answer`), `interaction_check_node` (flags), và `apply_guardrails` (hậu kiểm structured, sanitize trước `enforce_output_safety` để không wipe cả câu trả lời). `sanitize_recommendation` giữ nguyên disclaimer phủ định.
