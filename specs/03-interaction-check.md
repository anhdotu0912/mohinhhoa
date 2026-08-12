# Spec: Kiểm tra tương tác thuốc–thực phẩm (Interaction Check)

## Status
**Partial (as-built)** — Agent + KB file (~28 cặp) có trong code BE1. HTTP `POST /interactions/check` khi `DEMO_MOCK=true` dùng **mock helper** (KB rút gọn ~2 cặp). Khi `DEMO_MOCK=false` → **501**. Guardrails file vẫn placeholder.

## 1. Mục tiêu (Why)
Phát hiện tương tác nguy hiểm giữa thuốc bệnh nhân đang dùng và thực phẩm trong thực đơn hoặc câu hỏi ad-hoc.

## 2. User story
Là **bệnh nhân**, tôi muốn được cảnh báo nếu món ăn tương tác nguy hiểm với thuốc tôi đang dùng.

## 3. Business rules
1. Hai luồng:
   - **A. Gắn meal plan:** sau generate (mock path đã chạy) → Alert + optional swap trong planner agent.
   - **B. Ad-hoc HTTP/chat:** `POST /interactions/check` hoặc intent `interaction_check`.
2. Input: `medications[]`, `foods[]`, optional `profile_user_id`.
3. Matching KB accent-insensitive + alias (agent thật trên `data/drug_food_interactions.json`).
4. Output: mechanism, severity, recommendation, sources.
5. Severity: `Nguy hiểm` | `Cần chú ý` | `An toàn`.
6. Persist `Alert` khi check qua HTTP mock path / khi generate plan.
7. Guardrail: không đề xuất đổi thuốc/liều — redirect bác sĩ (`refuse` trong graph; `rules.py` cần hoàn thiện TASK-04).

## 4. As-built vs to-be

| Đường | As-built | To-be |
|---|---|---|
| Generate + alerts | Mock interaction trên món plan | Giữ / có thể gọi agent KB đầy đủ |
| `POST /interactions/check` + `DEMO_MOCK=true` | `meal_plan_demo.check_interactions` | — |
| `POST /interactions/check` + `DEMO_MOCK=false` | **501** | Gọi `interaction_checker_agent` |
| Chat intent interaction | Graph node gọi agent | Giữ + FE wire `POST /chat` |

## 5. Luồng happy path (demo)
1. Generate plan (mock) → alerts xuất hiện.
2. Hoặc `POST /interactions/check` với `DEMO_MOCK=true` → interactions + alerts.

## 6. Edge cases
- Thuốc không có trong KB → bỏ qua, không lỗi.
- Nhiều thuốc × 1 món → as-built tạo **nhiều** Alert/item riêng.
- Mục tiêu metrics: ≥10 cặp hoạt động trong demo; KB file target ≥20 (đã ~28).

## 7. Ngoài phạm vi
- Tương tác thuốc–thuốc; điều chỉnh liều.

## 8. API
| Method | Path | Role |
|---|---|---|
| POST | `/api/v1/interactions/check` | patient (as-built require patient) |
| GET | `/api/v1/alerts` | patient/dietitian |

## 9. Liên quan
- KB: `backend/data/drug_food_interactions.json`
- ADR-005, `contracts/agent-io-schema.md` §3, gap-closure TASK-02/04
