# 13 — AI chat assistant

| | |
|---|---|
| **Spec** | [`specs/13-ai-chat-assistant.md`](../../specs/13-ai-chat-assistant.md) |
| **Contract** | [`contracts/api-v1.md`](../../contracts/api-v1.md) §11 + [`agent-io-schema.md`](../../contracts/agent-io-schema.md) §5 |
| **Owner** | BE1 + FE |
| **Môi trường** | docker-compose; `OPENAI_API_KEY` tùy chọn cho LLM thật |

**Tài khoản:** `demo_patient_1@example.com` (có profile DB).

**Surface UI:** `/patient` chat-home, SSE stream, session sidebar.

---

## Happy path — Intent routing

| # | Việc | Câu mẫu | Kỳ vọng intent / hành vi | Pass |
|---|---|---|---|:---:|
| 1 | greeting | "xin chào" | `greeting`; không hallucinate số liệu | [ ] |
| 2 | meal_plan | "hôm nay tôi nên ăn gì?" | `meal_plan`; đọc plan DB; card preview | [ ] |
| 3 | interaction_check | "metformin uống rượu được không?" | `interaction_check`; KB + severity | [ ] |
| 4 | rag_qa | "BMI chuẩn châu Á là bao nhiêu?" | `rag_qa`; có `citations[]` | [ ] |
| 5 | food_log | "tôi đã ăn gì?" | `food_log`; tóm tắt log, không tạo log | [ ] |
| 6 | weekly_compliance | "tuần này tôi ăn có đúng không?" | `weekly_compliance`; khớp `GET /compliance/me` | [ ] |
| 7 | doctor_note | "bác sĩ dặn gì?" | `doctor_note`; manual_reminder / adjustment_note | [ ] |
| 8 | metrics_delta_advice | "cân tôi tăng nhiều có sao không?" | `metrics_delta_advice` hoặc lời khuyên ngưỡng | [ ] |
| 9 | refuse | "tăng liều metformin giúp tôi" | `refuse`; redirect bác sĩ | [ ] |
| 10 | unknown | câu không liên quan | `unknown`; hướng dẫn hỏi lại | [ ] |

---

## Happy path — SSE & sessions

| # | Việc | Bước | Kỳ vọng | Pass |
|---|---|---|---|:---:|
| 11 | SSE stream | Gửi tin → `POST /chat/stream` | Events: status → token → `done`; payload `AgentRunOutput` | [ ] |
| 12 | Guardrail correction | Câu có thể kích hoạt safety/citation | Event `correction` nếu answer bị sửa | [ ] |
| 13 | Tạo session | Sidebar → session mới | `POST /chat/sessions` | [ ] |
| 14 | Lưu transcript UI | Chat vài lượt → refresh | `GET /chat/sessions`, messages persist (**không** đưa vào agent turn sau) | [ ] |
| 15 | Đổi tên / xóa session | PATCH title, DELETE session | Hoạt động; isolation theo patient | [ ] |
| 16 | Doctor không session | Login doctor truy cập `/chat/sessions` | Forbidden | [ ] |

---

## Edge cases

| # | Việc | Bước | Kỳ vọng | Pass |
|---|---|---|---|:---:|
| 17 | Multi-intent | "lập thực đơn và kiểm tra warfarin với rau muống" | 1 intent chính + `secondary_intents[]` gợi ý | [ ] |
| 18 | Empty message | Gửi rỗng | `400` rejected | [ ] |
| 19 | Profile DB thật | Patient đã onboarding | `profile_loader` dùng hồ sơ DB, không demo hard-code | [ ] |
| 20 | Sync `/chat` | Gọi `POST /chat` (fallback) | Cùng schema output với stream `done` | [ ] |
| 21 | rag_qa thiếu citation | (khó tái hiện) | Redact / thông báo an toàn | [ ] |

---

## Pytest đã có

- [`test_chat_stream.py`](../../backend/tests/test_chat_stream.py)
- [`test_chat_history.py`](../../backend/tests/test_chat_history.py)
- [`test_patient_chat_intents.py`](../../backend/tests/test_patient_chat_intents.py)
- [`test_guardrails.py`](../../backend/tests/test_guardrails.py)
- [`test_rag.py`](../../backend/tests/test_rag.py)
- `test_chat_thin_wrapper` ([`test_api.py`](../../backend/tests/test_api.py))

**Gap tự động:** Hybrid RAG (`retrieve_hybrid`); dual-provider LLM; browser SSE UX.

---

## Không phải bug / N/A

- Multi-turn memory trong agent — mỗi lượt stateless (transcript chỉ UI).
- Chat không persist meal plan mới.
- `validate_interaction_output` per-recommendation — chưa wire (B1).
- Voice / đa ngôn ngữ — out of scope.
