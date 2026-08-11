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

1. Là bệnh nhân uống metformin, tôi muốn được cảnh báo nếu thực đơn có rượu/bia nguy hiểm.
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
  "drug": "metformin",
  "drug_aliases": ["glucophage"],
  "food": "rượu",
  "food_aliases": ["ruou", "alcohol"],
  "mechanism": "Rượu làm tăng nguy cơ nhiễm toan lactic khi dùng cùng metformin.",
  "severity": "Nguy hiểm",
  "recommendation": "Tránh uống rượu khi đang dùng metformin; trao đổi với bác sĩ.",
  "sources": ["guideline_or_ref_id"]
}
```

## 7. Acceptance criteria

- [x] KB ≥20 cặp, tập trung hoàn toàn vào tiểu đường và biến chứng (metformin, glipizide, insulin...)
- [x] Test: metformin + rượu → `Nguy hiểm`
- [x] Test: không match → list rỗng (không hallucinate)
- [x] Test guardrail: output không chứa pattern “ngưng thuốc” / “đổi liều”
- [x] `test_interaction_checker.py` pass
- [x] Schema khớp `InteractionCheckOutput`

## 8. Dependencies & handoff

| Từ | Đến | Artefact |
|---|---|---|
| BE1 | BE2 | `interactions[]` → tạo `Alert` + optionally trigger Compliance Notification `interaction_followup` |
| BE2 | FE | `GET /api/v1/alerts` |
| BE1 | MealPlanner | sync function/tool trong graph |
