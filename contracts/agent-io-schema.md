# Contracts — Agent & API I/O Schema

> **Luật:** Sửa file này TRƯỚC khi đổi code Agent / Pydantic `AgentRun*` / meal-plan agent shapes.  
> Owners: BE1 (Agent sections) · BE2 (HTTP mirror trong `contracts/api-v1.md`) · FE (consume qua API)  
> **Contract version:** `2026-08-12.asbuilt.1`  
> **Khớp code:** `backend/app/schemas/meal_plan.py`, `graph.run_agent`  
> HTTP chi tiết FE↔BE: [`contracts/api-v1.md`](api-v1.md) (nếu lệch Swagger → ưu tiên Swagger rồi cập nhật api-v1).

---

## 0. Conventions

- Thời gian: ISO-8601, timezone `Asia/Ho_Chi_Minh` trừ khi noted.
- ID: UUID string (demo seed có thể dùng id cố định kiểu `demo_patient_1`).
- Error HTTP envelope:

```json
{
  "detail": "Human-readable message",
  "code": "OPTIONAL_MACHINE_CODE"
}
```

- Severity enum: `"Nguy hiểm" | "Cần chú ý" | "An toàn"`
- Roles: `"patient" | "dietitian"` (FE map `dietitian` → shell `/doctor/*`)
- Macro object dùng chung:

```json
{ "carb_g": 0, "protein_g": 0, "fat_g": 0, "sodium_mg": 0 }
```

---

## 1. Core schemas

### 1.1 PatientProfile

```json
{
  "id": "uuid",
  "user_id": "uuid",
  "disease": ["diabetes_t2", "hypertension"],
  "medications": ["metformin", "amlodipine"],
  "allergies": ["hải sản"],
  "bmi": 26.5,
  "target_kcal": 1800,
  "restrictions": {
    "carb_per_meal": 45,
    "sodium_daily": 1500
  },
  "preferences": ["thích ăn cơm", "không ăn thịt bò"]
}
```

**HTTP:** `POST /api/v1/profile`, `GET /api/v1/profile/me` — xem `api-v1.md`.

### 1.2 MealPlanOutput

Agent MealPlanner / mock builder **PHẢI** trả đúng shape này. `days` luôn có đúng **7** phần tử (`day_index` 1..7).

```json
{
  "id": "uuid",
  "variant_group_id": "uuid | null",
  "variant_index": "int | null",
  "total_variants": "int | null",
  "user_id": "uuid",
  "profile_snapshot": {},
  "days": [
    {
      "day_index": 1,
      "date": "YYYY-MM-DD | null",
      "meals": [
        {
          "slot": "breakfast | lunch | dinner | snack",
          "items": [
            {
              "name": "Cơm trắng",
              "portion": "1 chén (~150g)",
              "kcal": 200,
              "macros": { "carb_g": 45, "protein_g": 4, "fat_g": 0.5, "sodium_mg": 5 },
              "food_id": "food_db_id_or_null",
              "citations": ["food_db_vn#com_trang"]
            }
          ]
        }
      ],
      "totals": {
        "kcal": 1750,
        "carb_g": 180,
        "protein_g": 70,
        "fat_g": 55,
        "sodium_mg": 1400
      },
      "warnings": ["sodium gần ngưỡng"]
    }
  ],
  "swaps": [
    {
      "day_index": 2,
      "slot": "lunch",
      "from": "Rau muống xào",
      "to": "Rau ngót luộc",
      "reason": "interaction:warfarin"
    }
  ],
  "citations": ["ada_diabetes.md"],
  "status": "pending_review"
}
```

**Status:** `pending_review | approved | rejected | edited`

**MealPlannerAgent input (nội bộ BE1):** `{ "profile": PatientProfile, "days": 7, "locale": "vi-VN" }`

### 1.3 FoodLogEntry (Won't Have MVP)

Schema / stub agent / FE route có thể còn trong repo nhưng **không** thuộc demo MVP. Không mount HTTP food-log trong `main.py`. Nav FE không được hiện mục Ghi nhận.

### 1.4 Alert

```json
{
  "id": "uuid",
  "user_id": "uuid",
  "drug": "warfarin",
  "food": "rau muống",
  "mechanism": "Vitamin K đối kháng tác dụng anticoagulant",
  "severity": "Nguy hiểm",
  "recommendation": "Hạn chế và giữ ổn định lượng rau giàu K; trao đổi với bác sĩ.",
  "sources": ["drug_food_interactions#warfarin_rau_muong"],
  "meal_plan_id": "uuid | null",
  "food_log_id": "uuid | null",
  "created_at": "ISO-8601"
}
```

---

## 2. Graph / AgentState (BE1)

```json
{
  "user_id": "uuid",
  "message": "string | null",
  "force_intent": "meal_plan | interaction_check | food_log | rag_qa | null",
  "intent": "meal_plan | interaction_check | food_log | rag_qa | refuse | unknown",
  "profile": {},
  "rag_context": [],
  "meal_plan": "MealPlanOutput | null",
  "food_log": null,
  "interactions": "InteractionCheckOutput | null",
  "answer": "string | null",
  "citations": ["string"],
  "guardrail_flags": ["string"],
  "errors": ["string"]
}
```

**Facade:** `run_agent(input: AgentRunInput) -> AgentRunOutput`

### AgentRunInput (khớp Pydantic hiện tại)

```json
{
  "user_id": "uuid",
  "message": "string",
  "force_intent": "meal_plan | interaction_check | food_log | rag_qa | null"
}
```

**As-built:** BE2 **không** truyền `profile` vào facade. `profile_loader` node load profile (demo map / DB theo implementation hiện tại).  
**To-be (gap):** nên để BE2 inject profile từ DB — ghi trong `tasks/roadmap-gap-closure.md`; khi đổi phải bump version contract này trước.

### AgentRunOutput (khớp Pydantic hiện tại)

```json
{
  "intent": "meal_plan | interaction_check | food_log | rag_qa | refuse | unknown",
  "message": "string",
  "meal_plan_id": "uuid | null",
  "food_log_id": "uuid | null",
  "alert_ids": ["uuid"],
  "citations": ["string"],
  "guardrail_triggered": false
}
```

**Lưu ý persist:** `meal_plan_id` chỉ có ý nghĩa khi plan đã được BE2 ghi DB. Nhánh `DEMO_MOCK=true` persist trong `meal_plan_service`; nhánh agent thật còn gap persist (xem gap-closure TASK-02).

Chat HTTP trả đúng `AgentRunOutput` (field `message`, không phải `reply`).

---

## 3. InteractionCheckerAgent

### Input

```json
{
  "medications": ["warfarin"],
  "foods": ["rau muống", "cơm trắng"],
  "profile_user_id": "uuid | null"
}
```

### Output — InteractionCheckOutput

```json
{
  "interactions": [
    {
      "drug": "warfarin",
      "food": "rau muống",
      "mechanism": "...",
      "severity": "Nguy hiểm",
      "recommendation": "...",
      "sources": ["drug_food_interactions#warfarin_rau_muong"]
    }
  ]
}
```

**As-built HTTP:** khi `DEMO_MOCK=true`, `POST /api/v1/interactions/check` dùng helper mock (`meal_plan_demo.check_interactions`, KB rút gọn). Khi `DEMO_MOCK=false` route trả **501** (chưa wire agent thật). Agent + KB đầy đủ (`data/drug_food_interactions.json`, ~28 cặp) dùng trong graph / meal planner.

---

## 4. Compliance Notification (BE2 — không phải LangGraph node)

Shape + event table: xem `api-v1.md` và `specs/04-compliance-notification.md`.

`POST /notifications/demo/simulate` **as-built:** insert vài notification mẫu (seed), **không** bulk-flip mọi `pending → sent`.

---

## 5. Dietitian Review

Request/response: xem `api-v1.md`. Body as-built:

```json
{
  "action": "approve | reject | edit",
  "notes": "string",
  "edited_plan": { "$ref": "MealPlanOutput | null" }
}
```

---

## 6. Auth / Chat

- Auth: `api-v1.md`
- Chat: `POST /api/v1/chat` → `AgentRunOutput`

---

## 7. Versioning

- Breaking change Agent I/O: bump **Contract version** + ACK BE1/BE2.
- Bản này đồng bộ **as-built code** (`message` / `meal_plan_id`), thay bản WT lệch (`reply` / embedded `meal_plan`) từng gây handoff sai.
