# Spec: Interaction Checker (Drug–Food)

> Owner: **BE1 (AI Core)** · Alert persistence/API: **BE2** · UI badges: **FE**  
> Contract: `/contracts/agent-io-schema.md` → `InteractionCheckerAgent`  
> ADR liên quan: `002-langgraph-vs-chain.md`

---

## 1. Mục tiêu

Phát hiện **tương tác thuốc–thực phẩm** dựa trên KB có cấu trúc (≥20 cặp MVP), trả về mức độ nghiêm trọng + khuyến nghị an toàn (không tự ý đổi liều thuốc), và tạo **Alert** để FE/Compliance Notification sử dụng.

## 2. Vì sao

Bệnh nhân thường không biết rau xanh giàu K / rượu / grapefruit… tương tác với thuốc đang uống. Cảnh báo đúng lúc làm tăng độ tin demo và giá trị lâm sàng cảm nhận được.

## 3. Phạm vi MVP

**In scope**
- KB JSON: `backend/data/drug_food_interactions.json` (≥20 cặp)
- Input: `medications[]` + `foods[]` (tên món / ingredient)
- Matching: normalize tiếng Việt (lowercase, bỏ dấu optional) + alias đơn giản
- Output: list interactions với `severity ∈ {Nguy hiểm, Cần chú ý, An toàn}`
- Khi `Nguy hiểm` hoặc `Cần chú ý` → BE2 tạo `Alert` records
- Guardrail: recommendation **không** bảo bệnh nhân ngưng/đổi thuốc; luôn khuyên hỏi bác sĩ khi severity cao

**Out of scope**
- Pharmacokinetic model đầy đủ
- Tương tác thuốc–thuốc
- OCR toa thuốc
- Food Log real-time scanning (Food Log đã bỏ khỏi MVP)

## 4. User stories

1. Là bệnh nhân uống warfarin, tôi muốn được cảnh báo nếu thực đơn có rau muống / rau giàu vitamin K.
2. Là hệ thống meal planner, tôi muốn lọc món nguy hiểm trước khi trả plan.
3. Là bệnh nhân trên Dashboard, tôi muốn thấy danh sách alert rõ ràng theo mức độ.

## 5. Business rules

| ID | Rule |
|---|---|
| IC-01 | Chỉ trả interaction khi **cả** drug và food match KB (hoặc alias). |
| IC-02 | Severity dùng đúng 3 mức đã chốt trong CLAUDE.md. |
| IC-03 | `An toàn` có thể trả về để giải thích (optional); FE mặc định chỉ highlight 2 mức trên. |
| IC-04 | Không invent mechanism ngoài KB; nếu LLM paraphrase thì phải giữ đúng ý KB. |
| IC-05 | Câu recommendation phải pass guardrails (không đổi liều/thuốc). |
| IC-06 | Gọi từ MealPlanner **và** có thể gọi standalone qua API `POST /interactions/check`. |

## 6. KB entry format

```json
{
  "drug": "warfarin",
  "drug_aliases": ["coumadin"],
  "food": "rau muống",
  "food_aliases": ["rau muong"],
  "mechanism": "Vitamin K đối kháng tác dụng anticoagulant",
  "severity": "Nguy hiểm",
  "recommendation": "Hạn chế lượng và giữ ổn định; trao đổi với bác sĩ trước khi thay đổi chế độ ăn.",
  "sources": ["guideline_or_ref_id"]
}
```

## 7. Acceptance criteria

- [ ] KB ≥20 cặp, cover ≥5 drug phổ biến (metformin, warfarin, amlodipine, allopurinol, atorvastatin…)
- [ ] Test: warfarin + rau muống → `Nguy hiểm`
- [ ] Test: không match → list rỗng (không hallucinate)
- [ ] Test guardrail: output không chứa pattern “ngưng thuốc” / “đổi liều”
- [ ] `test_interaction_checker.py` pass
- [ ] Schema khớp `InteractionCheckOutput`

## 8. Dependencies & handoff

| Từ | Đến | Artefact |
|---|---|---|
| BE1 | BE2 | `interactions[]` → tạo `Alert` + optionally trigger Compliance Notification `interaction_followup` |
| BE2 | FE | `GET /api/v1/alerts` |
| BE1 | MealPlanner | sync function/tool trong graph |
