# 12 — Patient metrics (ADR-013)

| | |
|---|---|
| **Spec** | [`specs/12-patient-metrics-tracking.md`](../../specs/12-patient-metrics-tracking.md) |
| **Contract** | [`contracts/api-v1.md`](../../contracts/api-v1.md) §13 |
| **Owner** | BE2 + FE |
| **Môi trường** | docker-compose |

**Tài khoản:** `demo_patient_1@example.com`; doctor cho metrics BS.

**Surface UI:** `/patient` dock **Chỉ số sức khỏe** (`HealthMetricsPanel`); `/patient/profile`; chart BS.

---

## Happy path — Patient

| # | Việc | Bước | Kỳ vọng | Pass |
|---|---|---|---|:---:|
| 1 | Ghi cân | Dock Chỉ số → nhập weight | `POST /metrics`; BMI tính server nếu có height profile | [ ] |
| 2 | Ghi lâm sàng | HA, đường lúc đói/sau ăn, vòng eo, HbA1c | Field optional lưu đúng | [ ] |
| 3 | Lịch sử | Xem chart `GET /metrics/history?days=90` | Điểm theo thời gian ASC | [ ] |
| 4 | Upsert cùng ngày VN | Ghi 2 lần cùng ngày | Merge/overwrite 1 bản ghi/ngày | [ ] |
| 5 | Xóa bản ghi | Delete 1 entry | `DELETE /metrics/{id}` | [ ] |
| 6 | Vòng tuân thủ overlay | Dock có `GET /compliance/me` | Hiển thị cùng compliance service | [ ] |
| 7 | delta_advice | Tăng cân đột biến (ví dụ +5kg) | Response `delta_advice` hoặc chat `metrics_delta_advice` | [ ] |

---

## Happy path — Doctor

| # | Việc | Bước | Kỳ vọng | Pass |
|---|---|---|---|:---:|
| 8 | BS cập nhật metrics | Chart BN → cân/cao | `PUT /doctor/patients/{id}/metrics` — **append** entry mới | [ ] |
| 9 | Snapshot profile | Sau update | `profiles` snapshot + history row | [ ] |

---

## Edge cases

| # | Việc | Bước | Kỳ vọng | Pass |
|---|---|---|---|:---:|
| 10 | Không field nào | POST metrics rỗng | `400` validation | [ ] |
| 11 | Metrics incomplete doctor | Chỉ weight, không height | `400 METRICS_INCOMPLETE` | [ ] |
| 12 | Delete not found | DELETE id sai | `404` | [ ] |

---

## Pytest đã có

- [`test_metrics.py`](../../backend/tests/test_metrics.py)
- `test_metrics_incomplete`, `test_update_patient_metrics` ([`test_api.py`](../../backend/tests/test_api.py))
- [`test_patient_chat_intents.py`](../../backend/tests/test_patient_chat_intents.py) (`metrics_delta_advice`)

**Gap tự động:** Chart overlay FE; doctor append vs patient upsert trên UI.

---

## Không phải bug / N/A

- Phân tích xu hướng AI tuần/tháng ngoài `delta_advice` — Planned mở rộng.
