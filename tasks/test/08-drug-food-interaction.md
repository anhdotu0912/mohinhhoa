# 08 — Drug–food interaction

| | |
|---|---|
| **Spec** | [`specs/08-drug-food-interaction-check.md`](../../specs/08-drug-food-interaction-check.md) |
| **Contract** | [`contracts/api-v1.md`](../../contracts/api-v1.md) §5–6 |
| **Owner** | BE1 + BE2 + FE |
| **Môi trường** | docker-compose |

**Tài khoản:** `demo_patient_1@example.com` (metformin); có thể dùng patient 2 (nhiều thuốc).

**Surface UI:** Chat `/patient`; dock food log custom; alerts trên notifications (nếu có).

---

## Happy path — HTTP

| # | Việc | Bước | Kỳ vọng | Pass |
|---|---|---|---|:---:|
| 1 | Check ad-hoc | API hoặc UI wrapper: metformin + rượu | Severity "Nguy hiểm" hoặc "Cần chú ý"; recommendation có | [ ] |
| 2 | Persist alert | Sau check | Alert xuất hiện `GET /alerts` patient | [ ] |
| 3 | Doctor xem alert | Login doctor `GET /alerts?patient_id=...` | Cùng alert | [ ] |
| 4 | `unmatched_pairs` | Cặp thuốc/thực phẩm không trong KB | Liệt kê trong response, không im lặng | [ ] |

---

## Happy path — Chat & generate

| # | Việc | Bước | Kỳ vọng | Pass |
|---|---|---|---|:---:|
| 5 | Chat interaction | "uống metformin có được uống rượu không?" | Intent `interaction_check`; KB ~28 cặp | [ ] |
| 6 | Generate plan | Plan có món xung đột | Swap nguy hiểm hoặc cảnh báo trên plan | [ ] |
| 7 | Food log custom | Ghi custom note chứa từ khóa cặp nguy hiểm | Tạo Alert + có thể notification followup | [ ] |

---

## Edge cases

| # | Việc | Bước | Kỳ vọng | Pass |
|---|---|---|---|:---:|
| 8 | 1 KB duy nhất | So sánh generate vs `/interactions/check` vs chat | Cùng nguồn `drug_food_interactions.json` | [ ] |
| 9 | Severity An toàn | Cặp an toàn | Không tạo alert followup nguy hiểm | [ ] |

---

## Pytest đã có

- `test_interactions_check_persists_alerts` ([`test_api.py`](../../backend/tests/test_api.py))
- [`test_interaction_checker.py`](../../backend/tests/test_interaction_checker.py)
- [`test_food_log.py`](../../backend/tests/test_food_log.py) (custom + alert)

**Gap tự động:** `validate_interaction_output`/`sanitize_recommendation` chưa wire runtime (B1).

---

## Không phải bug / N/A

- Không còn nhánh `DEMO_MOCK` / 501 trên interaction check.
