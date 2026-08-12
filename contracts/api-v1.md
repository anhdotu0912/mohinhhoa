# Contract: API v1 (Frontend ↔ Backend)

> Nguồn sự thật cho ranh giới FE↔BE. Đổi field/response ở đây trước, code sau (Handoff rule).
> Chi tiết đầy đủ, tự-generate, tham khảo thêm: `http://localhost:8000/docs` (Swagger, luôn đồng bộ với code — nếu lệch với file này thì Swagger là nguồn đúng và file này cần cập nhật lại).

## Auth

### POST /api/v1/auth/register
**Role:** public
```json
// Request
{ "email": "string", "password": "string", "role": "patient | dietitian" }
// Response 201
{ "id": "string", "email": "string", "role": "patient | dietitian" }
```

### POST /api/v1/auth/login
**Role:** public
```json
// Request
{ "email": "string", "password": "string" }
// Response 200
{ "access_token": "string", "token_type": "bearer", "role": "patient | dietitian" }
```
Mọi API nghiệp vụ khác yêu cầu header `Authorization: Bearer <access_token>`.

## Profile

### POST /api/v1/profile
**Role:** patient — upsert
```json
// Request
{
  "disease": ["string"],
  "medications": ["string"],
  "allergies": ["string"],
  "bmi": 0.0,
  "target_kcal": 0,
  "restrictions": { "carb_per_meal": 0, "sodium_daily": 0 },
  "preferences": ["string"]
}
// Response 200 — trả lại Profile đã lưu
```

### GET /api/v1/profile/me
**Role:** patient — trả Profile hiện tại hoặc 404 nếu chưa tạo.

## Meal Plans

### POST /api/v1/meal-plans/generate
**Role:** patient (dietitian gọi qua `/doctor/patients/{id}/generate` — endpoint riêng phía dietitian, cùng contract response)
```json
// Response 201
{
  "id": "string",
  "user_id": "string",
  "status": "pending_review",
  "days": [ /* 7 phần tử, mỗi phần tử: slots breakfast/lunch/dinner[/snack] */ ],
  "swaps": [ /* các món đã bị swap do interaction nguy hiểm */ ],
  "citations": [ /* nguồn cho số liệu dinh dưỡng */ ],
  "trust_badge": null
}
```

### GET /api/v1/meal-plans/me
**Role:** patient — trả plan mới nhất của user hiện tại.

### GET /api/v1/meal-plans/{id}
**Role:** auth (patient chỉ xem plan của mình; dietitian xem plan bệnh nhân trong hàng đợi)

## Interactions

### POST /api/v1/interactions/check
**Role:** patient (as-built)
```json
// Request
{ "medications": ["string"], "foods": ["string"], "profile_user_id": "string | null" }
// Response 200 — khi DEMO_MOCK=true (mock KB rút gọn)
{
  "interactions": [
    {
      "drug": "string",
      "food": "string",
      "mechanism": "string",
      "severity": "Nguy hiểm | Cần chú ý | An toàn",
      "recommendation": "string",
      "sources": ["string"]
    }
  ]
}
```
Khi `DEMO_MOCK=false`: **501** `INTERACTION_CHECK_NOT_READY` (chưa wire agent — gap-closure TASK-02).

## Alerts

### GET /api/v1/alerts
**Role:** patient/dietitian
```json
// Response 200
[
  {
    "id": "string",
    "drug": "string",
    "food": "string",
    "severity": "Nguy hiểm | Cần chú ý | An toàn",
    "meal_plan_id": "string"
  }
]
```

## Notifications

### GET /api/v1/notifications
**Role:** patient — hỗ trợ filter query param `status`, `type`
```json
// Response 200
[
  {
    "id": "string",
    "type": "meal_reminder | interaction_followup | plan_approved | adherence_checkin",
    "status": "pending | sent | read | dismissed | done | cancelled",
    "scheduled_at": "ISO datetime",
    "related_ids": { "meal_plan_id": "string", "alert_id": "string" }
  }
]
```

### POST /api/v1/notifications/{id}/read
**Role:** patient — chuyển status → `read`

### POST /api/v1/notifications/{id}/dismiss
**Role:** patient — chuyển status → `dismissed`

### POST /api/v1/notifications/{id}/done
**Role:** patient — chỉ áp dụng cho `adherence_checkin`
```json
// Request
{ "adherence": "yes | partial | no" }
// Response 200 — status → done
```

### POST /api/v1/notifications/demo/simulate
**Role:** patient (demo) — **as-built:** insert vài notification mẫu cho user hiện tại (seed). **Không** bulk-update mọi `pending → sent`. ⚠️ Cần guard tắt / chặn ở production (TASK-06).

## Dietitian Review

### GET /api/v1/dietitian/meal-plans
**Role:** dietitian — filter `?status=pending_review`

### POST /api/v1/dietitian/meal-plans/{id}/review
**Role:** dietitian
```json
// Request (as-built ReviewRequest)
{
  "action": "approve | reject | edit",
  "notes": "string",
  "edited_plan": { /* MealPlanOutput fields — bắt buộc khi action=edit */ }
}
// Response 200 (ReviewResponse)
{
  "meal_plan_id": "string",
  "status": "approved | rejected | edited",
  "trust_badge": "dietitian_reviewed | null",
  "reviewed_at": "ISO-8601",
  "reviewer_id": "string"
}
```

## Chat

### POST /api/v1/chat
**Role:** patient
```json
// Request
{ "message": "string" }
// Response 200 — AgentRunOutput (contracts/agent-io-schema.md)
{
  "intent": "meal_plan | interaction_check | food_log | rag_qa | refuse | unknown",
  "message": "string",
  "meal_plan_id": "string | null",
  "food_log_id": "string | null",
  "alert_ids": ["string"],
  "citations": ["string"],
  "guardrail_triggered": false
}
```

## Health

### GET /health
**Role:** public
```json
{ "status": "ok" }
```

---

## Enum tham chiếu (dùng chung toàn hệ thống)
- `MealPlan.status`: `pending_review → approved | rejected | edited`
- `Alert.severity`: `Nguy hiểm | Cần chú ý | An toàn`
- `Notification.type`: `meal_reminder | interaction_followup | plan_approved | adherence_checkin`
- `Notification.status`: `pending | sent | read | dismissed | done | cancelled`
- `User.role`: `patient | dietitian`
