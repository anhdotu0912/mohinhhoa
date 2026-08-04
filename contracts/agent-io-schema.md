# Contracts — Agent & API I/O Schema

> **Luật:** Sửa file này TRƯỚC khi đổi code Agent/API/FE types.  
> Owners: BE1 (Agent sections) · BE2 (HTTP/API sections) · FE (consume, mirror `frontend/lib/types.ts`)  
> **Contract version:** `2026-08-04.foundation.1`

---

## 0. Conventions

- Thời gian: ISO-8601, timezone `Asia/Ho_Chi_Minh` trừ khi noted.
- ID: UUID string (một số entity legacy có thể dùng `int`).
- Error HTTP envelope:

```json
{
  "detail": "Human-readable message",
  "code": "OPTIONAL_MACHINE_CODE"
}
```

- Severity enum: `"Nguy hiểm" | "Cần chú ý" | "An toàn"`
- Roles: `"patient" | "dietitian"`
- Macro object dùng chung:

```json
{ "carb_g": 0, "protein_g": 0, "fat_g": 0, "sodium_mg": 0 }
```

---

## 1. Core schemas (nguồn sự thật — mọi Agent phải khớp)

Bốn schema dưới đây là contract lõi. Tham chiếu hồ sơ bệnh nhân theo CLAUDE.md §8.

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

**HTTP**
- `POST /api/v1/profile` — upsert (patient)
- `GET /api/v1/profile/me` — get own profile

---

### 1.2 MealPlan (7 ngày) — MealPlanOutput

Agent MealPlanner **PHẢI** trả đúng shape này. `days` luôn có đúng **7** phần tử (`day_index` 1..7).

```json
{
  "id": "uuid",
  "user_id": "uuid",
  "profile_snapshot": { "$ref": "PatientProfile" },
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
              "citations": ["food_db_vn#com_trang", "ada_diabetes.md#carb"]
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
  "citations": ["ada_diabetes.md", "byt_vn_notes.md"],
  "status": "pending_review"
}
```

**Status:** `pending_review | approved | rejected | edited`

**MealPlannerAgent input**
```json
{
  "profile": { "$ref": "PatientProfile" },
  "days": 7,
  "locale": "vi-VN"
}
```

**HTTP**
- `POST /api/v1/meal-plans/generate`
- `GET /api/v1/meal-plans/me`
- `GET /api/v1/meal-plans/{id}`

---

### 1.3 FoodLogEntry

Schema sẵn cho FoodLogAgent / API (chưa bắt buộc ship trong demo MVP). Mọi số liệu dinh dưỡng trong `items`/`totals` phải có `citations` khi Agent generate.

```json
{
  "id": "uuid",
  "user_id": "uuid",
  "raw_text": "sáng nay ăn phở bò một tô",
  "meal_type": "breakfast | lunch | dinner | snack | other",
  "items": [
    {
      "name": "Phở bò",
      "portion": "1 tô",
      "kcal": 450,
      "macros": { "carb_g": 55, "protein_g": 25, "fat_g": 12, "sodium_mg": 1200 },
      "citations": ["food_db_vn#pho_bo"]
    }
  ],
  "totals": {
    "kcal": 450,
    "carb_g": 55,
    "protein_g": 25,
    "fat_g": 12,
    "sodium_mg": 1200
  },
  "alert_ids": ["uuid"],
  "logged_at": "ISO-8601"
}
```

**FoodLogAgent I/O**
```json
// Input
{
  "user_id": "uuid",
  "raw_text": "string",
  "meal_type": "breakfast | lunch | dinner | snack | other",
  "logged_at": "ISO-8601 | null"
}

// Output
{ "$ref": "FoodLogEntry" }
```

**HTTP (khi implement)**
- `POST /api/v1/food-logs`
- `GET /api/v1/food-logs`
- `GET /api/v1/food-logs/{id}`

---

### 1.4 Alert

Khớp format cặp thuốc–thực phẩm CLAUDE.md. Severity bắt buộc một trong 3 mức.

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

**HTTP**
- `GET /api/v1/alerts` — patient own / dietitian by `patient_id` query

---

## 2. Graph / AgentState (BE1)

```json
{
  "user_id": "uuid",
  "message": "string | null",
  "intent": "meal_plan | interaction_check | food_log | rag_qa | refuse | unknown",
  "profile": { "$ref": "PatientProfile" },
  "rag_context": [
    {
      "chunk_id": "string",
      "text": "string",
      "source": "string",
      "score": 0.0
    }
  ],
  "meal_plan": { "$ref": "MealPlanOutput | null" },
  "food_log": { "$ref": "FoodLogEntry | null" },
  "interactions": { "$ref": "InteractionCheckOutput | null" },
  "answer": "string | null",
  "citations": ["string"],
  "guardrail_flags": ["string"],
  "errors": ["string"]
}
```

**Facade:** `run_agent(input: AgentRunInput) -> AgentRunOutput`

### AgentRunInput
```json
{
  "user_id": "uuid",
  "message": "string",
  "force_intent": "meal_plan | interaction_check | food_log | rag_qa | null"
}
```

### AgentRunOutput
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
      "mechanism": "Vitamin K đối kháng tác dụng anticoagulant",
      "severity": "Nguy hiểm",
      "recommendation": "Hạn chế và giữ ổn định lượng rau giàu K; trao đổi với bác sĩ.",
      "sources": ["drug_food_interactions#warfarin_rau_muong"]
    }
  ]
}
```

Mỗi phần tử `interactions[]` khi persist → tạo record `{ "$ref": "Alert" }`.

**HTTP:** `POST /api/v1/interactions/check`

---

## 4. Compliance Notification (BE2 service — không phải LangGraph agent)

```json
{
  "id": "uuid",
  "user_id": "uuid",
  "type": "meal_reminder | interaction_followup | plan_approved | adherence_checkin",
  "title": "string",
  "body": "string",
  "scheduled_at": "ISO-8601",
  "status": "pending | sent | read | dismissed | done | cancelled",
  "related_ids": {
    "meal_plan_id": "uuid | null",
    "alert_id": "uuid | null",
    "day_index": 1,
    "slot": "breakfast | lunch | dinner | snack | null"
  },
  "payload": {
    "adherence": "yes | partial | no | null"
  },
  "created_at": "ISO-8601",
  "updated_at": "ISO-8601"
}
```

**HTTP**
- `GET /api/v1/notifications?status=&type=`
- `POST /api/v1/notifications/{id}/read`
- `POST /api/v1/notifications/{id}/dismiss`
- `POST /api/v1/notifications/{id}/done` — body: `{ "adherence": "yes|partial|no" }`
- `POST /api/v1/notifications/demo/simulate` — demo only

| Event | Notifications created |
|---|---|
| Meal plan generated | `meal_reminder` × slots × days (`pending`) + optional `adherence_checkin` × 7 |
| Plan approved | `plan_approved` (`sent`) |
| Plan rejected | cancel future reminders of that plan |
| Alert severity in {Nguy hiểm, Cần chú ý} | `interaction_followup` (`sent`) |

---

## 5. Dietitian Review

`GET /api/v1/dietitian/meal-plans?status=pending_review`

`POST /api/v1/dietitian/meal-plans/{id}/review`
```json
{
  "action": "approve | reject | edit",
  "notes": "string",
  "edited_plan": { "$ref": "MealPlanOutput | null" }
}
```

```json
{
  "meal_plan_id": "uuid",
  "status": "approved | rejected | edited",
  "trust_badge": "dietitian_reviewed",
  "reviewed_at": "ISO-8601",
  "reviewer_id": "uuid"
}
```

---

## 6. Auth

- `POST /api/v1/auth/register` `{ "email", "password", "role": "patient|dietitian" }`
- `POST /api/v1/auth/login` → `{ "access_token", "token_type": "bearer", "role", "user_id" }`
- Header: `Authorization: Bearer <jwt>`

---

## 7. Chat (thin wrapper)

`POST /api/v1/chat`

```json
{ "message": "string" }
```

Response: `{ "$ref": "AgentRunOutput" }`

---

## 8. Out of contract (post-MVP)

- Push notification provider payloads (FCM/APNs) — extension của Notification object.

---

## 9. Versioning

- Breaking change: bump **Contract version** + báo cả 3 role trong PR.
- **Contract version:** `2026-08-04.foundation.1`
