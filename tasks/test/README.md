# Testing Docs — VinNutri (P-014)

> Tài liệu kiểm thử: chiến lược test, kịch bản (test scenarios) theo từng spec, cách chạy và kết quả gần nhất.
> Đây là deliverable **"Tài liệu kiểm thử (Testing Docs)"** nộp BTC — tổng hợp từ `backend/tests/` (unit/integration) + `eval/` (golden dataset + LLM-judge).

---

## 1. Chiến lược kiểm thử

Hai tầng kiểm thử độc lập:

1. **Unit & Integration test (pytest)** — `backend/tests/`, chạy nhanh, dùng SQLite in-memory + mock LLM khi cần, kiểm tra logic API/service/agent node đúng theo `contracts/`.
2. **Golden Dataset Evaluation (LLM-as-a-judge)** — `eval/golden_dataset.json` (100 câu hỏi/kịch bản lâm sàng), chạy qua agent thật rồi chấm bằng LLM giám khảo trên 4 tiêu chí: **Correctness, Safety, Faithfulness, Relevance**. Đánh giá chất lượng đầu ra thực tế, không chỉ đúng schema.

## 2. Cách chạy

```bash
# Unit & integration test
cd backend
pytest tests/ -v

# Riêng 1 module (vd. compliance)
pytest tests/test_doctor_compliance.py -v

# Golden dataset eval (LLM-as-a-judge) — cần LLM_API_KEY hợp lệ
cd backend
python -m eval.run_eval   # hoặc script tương ứng trong eval/, xem eval/README nếu có
```

## 3. Ánh xạ Spec ↔ Test file (kịch bản test)

| Spec | Chức năng | Test file chính | Số test case |
|---|---|---|---|
| `01-account-auth` | Đăng ký/đăng nhập JWT, rate-limit | `test_auth_and_polish.py`, `test_api.py` (auth flow) | 12+ |
| `02-patient-profile-onboarding` | Hồ sơ bệnh nhân upsert | `test_api.py` (profile flow) | — |
| `03-doctor-patient-management` | Bác sĩ thêm/quản lý bệnh nhân | `test_assignment.py`, `test_doctor_profile.py` | 10 |
| `04-clinical-constraints` | Ràng buộc lâm sàng (calo/carb/sodium) | `test_clinical_constraints.py`, `test_constraint_input_validation.py`, `test_constraints_and_adjustment.py` | 18 |
| `05-meal-plan-generation` | Sinh thực đơn 7 ngày | `test_meal_planner.py`, `test_plan_expiry.py`, `test_plan_schedule.py`, `test_plan_limits.py`, `test_meal_plan_request.py` | 47 |
| `06-meal-plan-review` | Duyệt/từ chối/sửa (doctor) | `test_doctor_review.py`, `test_plan_apply.py` | 23 |
| `07-patient-meal-plan-view` | Bệnh nhân xem thực đơn | `test_meal_preview.py` | 10 |
| `08-drug-food-interaction-check` | Kiểm tra tương tác thuốc–thực phẩm | `test_interaction_checker.py` | 14 |
| `09-food-log-adherence` | Nhật ký ăn uống 3-slot | `test_food_log.py` | 8 |
| `10-doctor-compliance-view` | Dashboard tuân thủ cho bác sĩ | `test_doctor_compliance.py` | 15 |
| `11-compliance-notification-delivery` | Notification event-driven | `test_compliance_notification.py`, `test_demo_seed_guard.py` | 10 |
| `12-patient-metrics-tracking` | Chỉ số cơ thể theo thời gian | `test_metrics.py`, `test_datetime_vn.py` | 14 |
| `13-ai-chat-assistant` | Chat/RAG, intent routing | `test_rag.py`, `test_patient_chat_intents.py`, `test_chat_stream.py`, `test_chat_history.py`, `test_chat_escalation.py`, `test_citation_chunks.py` | 70 |
| ADR-006 (Guardrails) | Chốt chặn an toàn y khoa 2 tầng | `test_guardrails.py`, `test_two_tier_safety_guardrail.py` | 14 |
| Hạ tầng (RAG/agent/CI) | Key rotation, cost tier, skills, context pruning | `test_gemini_key_rotation.py`, `test_5_tier_cost_optimization.py`, `test_skills_modular.py`, `test_skill_descriptions.py`, `test_zero_bloat_context.py`, `test_agent_skills_eval_metrics.py`, `test_behavior_matrix_eval.py`, `test_startup_checks.py`, `test_create_demo_accounts_cli.py` | 71 |

**Tổng:** 39 file test, **445 test case** trong `backend/tests/` (chạy pytest thực tế 2026-09-01) — tăng đáng kể so với mốc 76 test ghi trong `eval/results/report.md` (chụp ngày 2026-08-24), do các module Testing/Compliance/Chat/Guardrails được bổ sung nhiều ở Tuần 4.

## 4. Kết quả gần nhất

### 4.1 Unit & Integration (pytest)

```
pytest tests/ -q
444 passed, 1 failed → sau khi sửa test lỗi thời (test_citation_chunks.py, RAG_PROMPT_CHUNK_LIMIT đổi 2→3): 445 passed, 0 failed
Thời gian chạy: ~522s (8m42s), chạy đầy đủ ngày 2026-09-01
```

Chi tiết bug đã fix: `test_maps_only_prompt_chunks` giả định `RAG_PROMPT_CHUNK_LIMIT == 2`, nhưng code đã tăng lên `3` trong đợt cải thiện RAG faithfulness (commit `fix(agents): cải thiện safety escalation, RAG faithfulness và routing interaction_check`, 2026-09-01). Đã cập nhật test khớp hành vi mới, giữ nguyên mục đích kiểm thử gốc (citation_chunks không được lộ chunk ngoài giới hạn prompt).

### 4.2 Golden Dataset — LLM-as-a-judge (100 kịch bản lâm sàng)

Nguồn: [`eval/results/llm_judge_report.md`](../../eval/results/llm_judge_report.md) — chấm bằng LLM giám khảo (cùng model với agent, xem giới hạn trong báo cáo gốc).

| Metric | Pass rate | Passed/Scored |
|---|---|---|
| Correctness | 85.53% | 65/76 |
| Safety | 98.0% | 98/100 |
| Faithfulness | 91.3% | 42/46 |
| Relevance | 96.05% | 73/76 |

Safety riêng nhóm kịch bản HITL bắt buộc (`hitl=true`, 41 câu): **95.12%** (39/41).

## 5. Đầu việc còn mở (không chặn nộp BTC nhưng nên biết)

- Rà lại các câu Correctness fail (11/76) trong `llm_judge_report.json` để xác định có phải lỗi hệ thống lặp lại hay case biên hiếm gặp.
