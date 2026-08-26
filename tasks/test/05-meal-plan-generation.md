# 05 — Meal plan generation

| | |
|---|---|
| **Spec** | [`specs/05-meal-plan-generation.md`](../../specs/05-meal-plan-generation.md) |
| **Contract** | [`contracts/api-v1.md`](../../contracts/api-v1.md) §4 |
| **Owner** | BE1 (agent) + BE2 (API) + FE |
| **Môi trường** | docker-compose (Qdrant + Postgres); generate có thể chậm 10–15s |

**Tài khoản:** `demo_doctor@example.com` → BN A (`demo_patient_1`).

**Surface UI:** `/doctor/patients/{id}/generate`, QueueDrawer; inbox "Yêu cầu tạo TD".

---

## Happy path

| # | Việc | Bước | Kỳ vọng | Pass |
|---|---|---|---|:---:|
| 1 | Generate hộ BN | Mở generate → Start | `POST .../meal-plans/generate`; job queue hoàn tất | [ ] |
| 2 | Plan 7 ngày | Xem plan vừa tạo | `days.length === 7`; `status=pending_review` | [ ] |
| 3 | Citation | Mở chi tiết món | Mỗi món có nguồn trích dẫn (guideline/catalog) | [ ] |
| 4 | Dị ứng hard filter | BN có allergy "hải sản" — kiểm tra món | Không có hải sản trong plan (patient 1) | [ ] |
| 5 | Interaction trong generate | BN metformin — plan có món liên quan rượu/cồn | Swap "Nguy hiểm" hoặc cảnh báo; `swaps[]` nếu swap | [ ] |
| 6 | Yêu cầu từ BN | Login patient → yêu cầu TD khi chưa có plan | `POST /meal-plans/request`; inbox doctor | [ ] |
| 7 | Generate xóa cờ request | Doctor generate sau request | `meal_plan_request_status` → `none` | [ ] |
| 8 | Persist | `GET /meal-plans/{id}` | Plan lưu DB, retrievable | [ ] |

---

## Edge cases

| # | Việc | Bước | Kỳ vọng | Pass |
|---|---|---|---|:---:|
| 9 | Request khi pending_review | BN request khi đã có plan chờ duyệt | Bị chặn theo API (`test_request_blocked_when_plan_pending_review`) | [ ] |
| 10 | `unmatched_pairs` | Plan/check có cặp không trong KB | Xuất hiện trong output interaction, không im lặng | [ ] |
| 11 | Sau generate — notifications | Patient notifications | **Không** có meal_reminder (chờ approve + apply) | [ ] |
| 12 | Alerts interaction | `GET /alerts` patient | Có thể có alert followup nếu severity đủ | [ ] |

---

## Pytest đã có

- `test_north_star_flow` (generate); [`test_meal_planner.py`](../../backend/tests/test_meal_planner.py)
- [`test_meal_plan_request.py`](../../backend/tests/test_meal_plan_request.py)

**Gap tự động:** LLM live latency; chất lượng guideline placeholder; UI QueueDrawer.

---

## Không phải bug / N/A

- Chat intent `meal_plan` **không** generate/persist plan mới.
- `POST /meal-plans/generate` patient API còn nhưng UI chính là yêu cầu bác sĩ.
