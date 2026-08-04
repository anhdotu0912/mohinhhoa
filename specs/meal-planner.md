# Spec: Meal Planner

> Owner: **BE1 (AI Core)** · Consumer API: **BE2** · UI: **FE**  
> Contract: `/contracts/agent-io-schema.md` → `MealPlannerAgent`  
> ADR liên quan: `002-langgraph-vs-chain.md`, `001-vector-db-choice.md`

---

## 1. Mục tiêu

Tạo **thực đơn 7 ngày** cá nhân hoá theo hồ sơ bệnh lý (tiểu đường, tim mạch, gout...), tôn trọng dị ứng / hạn chế dinh dưỡng / preference, và **mọi món & số liệu dinh dưỡng phải có nguồn** từ RAG (guideline + CSDL thực phẩm VN).

## 2. Vì sao (problem)

Bệnh nhân khó tự xây thực đơn phù hợp bệnh + thuốc. Chuyên gia dinh dưỡng thiếu thời gian soạn thực đơn base. MVP cần một meal plan “đủ tin để demo + để BS duyệt”, không cần tối ưu tuyệt đối.

## 3. Phạm vi MVP

**In scope**
- Input: patient profile (disease, medications, allergies, BMI, target_kcal, restrictions, preferences)
- Output: 7 ngày × (sáng / trưa / tối [+ snack optional]) kèm kcal/macro ước tính + citations
- Dùng RAG lấy guideline (ADA/AHA/ACR/BYT) + food DB VN
- NutritionCalculator kiểm tra tổng kcal/ngày vs `target_kcal` (±10% chấp nhận được cho demo)
- InteractionChecker **được gọi** trên danh sách món đề xuất trước khi finalize (severity `Nguy hiểm` → thay món)
- Guardrails: không đổi thuốc/liều; disclaimer y khoa

**Out of scope (MVP)**
- Food Log / điều chỉnh plan theo log thực tế
- Tối ưu đa mục tiêu (giá tiền, mùa vụ, siêu thị)
- Export PDF / danh sách đi chợ
- Multi-disease conflict resolver phức tạp (rule đơn giản + disclaimer là đủ)

## 4. User stories

1. Là bệnh nhân T2DM, tôi muốn nhận thực đơn 7 ngày ~1800 kcal để biết ăn gì mỗi ngày.
2. Là bệnh nhân dị ứng hải sản, tôi không muốn thấy món có hải sản trong plan.
3. Là dietitian, tôi muốn xem plan + nguồn trích dẫn để approve/edit/reject.

## 5. Business rules

| ID | Rule |
|---|---|
| MP-01 | Mỗi món phải map được tới food item trong KB hoặc guideline citation; cấm số liệu “bịa”. |
| MP-02 | Tôn trọng `allergies` tuyệt đối (hard filter). |
| MP-03 | Tôn trọng `restrictions` (vd. carb/bữa, sodium/ngày) — soft check + flag nếu vượt. |
| MP-04 | Preference là soft constraint (ưu tiên, không hard fail). |
| MP-05 | Nếu InteractionChecker = `Nguy hiểm` với medication của user → thay món, ghi `swaps[]`. |
| MP-06 | Output status ban đầu: `pending_review` (chờ dietitian). |
| MP-07 | Thời gian generate mục tiêu < 15s (p95). |

## 6. Flow (logic)

```
Profile → RAG(guidelines + foods) → Draft 7-day plan
       → NutritionCalculator validate
       → InteractionChecker filter/swap
       → SourceCheck (mọi số liệu có citation?)
       → Persist via BE2 API (meal_plan status=pending_review)
```

## 7. Acceptance criteria (DoD)

- [ ] Generate được plan cho ≥3 profile mẫu (T2DM, hypertension, gout hoặc combo)
- [ ] Mỗi ngày có đủ bữa chính; tổng kcal trong ±10% target (hoặc có `warnings[]` giải thích)
- [ ] ≥1 citation / ngày (tối thiểu); ideal: citation theo nhóm guideline + food source
- [ ] Không có món trùng allergy
- [ ] Unit test `test_meal_planner.py` pass
- [ ] Schema khớp contract `MealPlanOutput`

## 8. Dependencies & handoff

| Từ | Đến | Artefact |
|---|---|---|
| BE1 | BE2 | `MealPlanOutput` JSON để lưu DB |
| BE2 | FE | `GET/POST /api/v1/meal-plans` |
| BE1 | BE1 | Gọi InteractionChecker nội bộ trước khi return |
