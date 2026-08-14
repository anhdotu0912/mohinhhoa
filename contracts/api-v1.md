# Contract: API v1 (Frontend ↔ Backend)

> Nguồn sự thật cho ranh giới FE↔BE. Đổi field/response ở đây trước, code sau (Handoff rule).
> Chi tiết đầy đủ, tự-generate, tham khảo thêm: `http://localhost:8000/docs` (Swagger, luôn đồng bộ với code — nếu lệch với file này thì Swagger là nguồn đúng và file này cần cập nhật lại).

## Auth

### POST /api/v1/auth/register
**Role:** public
```json
// Request
{ "email": "string", "password": "string", "role": "patient | doctor", "full_name": "string | null" }
// Response 201
{ "id": "string", "email": "string", "role": "patient | doctor", "full_name": "string | null" }
```
> `full_name` là optional (nullable) — dùng khi doctor tạo tài khoản patient từ dashboard; nếu bỏ trống, tên hiển thị suy ra từ email.

### POST /api/v1/auth/login
**Role:** public
```json
// Request
{ "email": "string", "password": "string" }
// Response 200
{ "access_token": "string", "token_type": "bearer", "role": "patient | doctor" }
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
  "weight": 0.0,
  "height": 0.0,
  "age": 0,
  "gender": "Nam | Nữ | Khác",
  "phone": "string | null",
  "address": "string | null",
  "blood_pressure": "string | null",
  "blood_glucose": "string | null",
  "target_kcal": 0,
  "restrictions": { "carb_per_meal": 0, "sodium_daily": 0 },
  "preferences": ["string"],
  "treatment_goals": ["string"]
}
// Response 200 — trả lại Profile đã lưu
```

### GET /api/v1/profile/me
**Role:** patient — trả Profile hiện tại hoặc 404 nếu chưa tạo.

## Meal Plans

### POST /api/v1/meal-plans/generate
**Role:** patient (doctor gọi `POST /api/v1/doctor/patients/{patient_id}/meal-plans/generate` — cùng body + response)
```json
// Request (tùy chọn, body rỗng vẫn hợp lệ)
{ "notes": "ưu tiên hấp luộc", "priorities": ["Đa dạng món ăn"] }
// Response 200
{
  "id": "string",
  "user_id": "string",
  "status": "pending_review",
  "days": [ /* 7 phần tử; FoodItem có alternatives[] (món thay thế) */ ],
  "swaps": [ /* món đã bị swap do interaction nguy hiểm */ ],
  "citations": [ /* nguồn cho số liệu dinh dưỡng */ ],
  "trust_badge": null
}
```
Luôn 1 plan / 7 ngày. `notes` + `priorities` đưa vào prompt LLM (catalog mock). Thiếu API key (`LLM_API_KEY` / `DEEPSEEK_API_KEY` / `OPENAI_API_KEY` tùy `LLM_PROVIDER`) → fallback rule-based cùng catalog.

### GET /api/v1/meal-plans/me
**Role:** patient — trả plan mới nhất của user hiện tại.

### GET /api/v1/meal-plans/{id}
**Role:** auth (patient chỉ xem plan của mình; doctor xem plan bệnh nhân trong hàng đợi)

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
**Role:** patient/doctor
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
**Role:** patient (demo) — **as-built:** insert vài notification mẫu cho user hiện tại (seed). **Không** bulk-update mọi `pending → sent`. ✅ Guard production đã implement (TASK-06): `APP_ENV=production` → `403 {"detail": "...", "code": "DEMO_DISABLED"}`.

## Doctor Review

### GET /api/v1/doctor/patients
**Role:** doctor — danh sách bệnh nhân (+ profile tóm tắt, trạng thái plan/alert)
```json
// Query optional: ?q=keyword&status=attention|warning|stable|pending|all
// Response 200 — DoctorPatientSummary[]
[
  {
    "id": "demo_patient_1",
    "email": "demo_patient_1@example.com",
    "name": "Nguyễn Văn A",
    "disease": ["diabetes_t2", "hypertension"],
    "condition_label": "Tiểu đường type 2, Tăng huyết áp",
    "status": "Cảnh báo | Cần chú ý | Ổn định | Chờ duyệt",
    "status_key": "warning | attention | stable | pending",
    "latest_plan_id": "string | null",
    "latest_plan_status": "pending_review | approved | ...",
    "plan_pending": 0,
    "plan_total": 0,
    "alert_count": 0,
    "bmi": 26.5,
    "weight": 72.5,
    "height": 170,
    "age": 45,
    "gender": "Nam",
    "phone": "0901 234 567",
    "address": "Quận 1, TP. Hồ Chí Minh",
    "blood_pressure": "130/80 mmHg",
    "blood_glucose": "135 mg/dL",
    "treatment_goals": ["string"],
    "last_update": "12/08/2026",
    "avatar": "string",
    "plan_end_date": "16/08/2026 | null",
    "plan_days_left": 2,
    "plan_expiry": "expiring | expired | ok | none"
  }
]
```
> `plan_pending` / `plan_total`: số thực đơn chưa duyệt (`pending_review`) và tổng số thực đơn của bệnh nhân — dùng cho cột "Thực đơn" (`plan_pending/plan_total`) trên màn danh sách.
>
> **Hạn thực đơn (mới)** — `plan_end_date` / `plan_days_left` / `plan_expiry` chỉ có ý nghĩa khi `latest_plan_status == "approved"` (plan đang có hiệu lực):
> - Thời lượng = số ngày trong `days` (mặc định 7); ngày bắt đầu = `reviewed_at` (fallback `created_at`); `plan_days_left = (end_date − hôm nay).days`
> - `plan_expiry`: `expiring` (còn ≤ 2 ngày — sắp ăn xong) · `expired` (đã hết hạn, bệnh nhân không còn thực đơn) · `ok` (còn nhiều ngày) · `none` (chưa có plan approved / không xác định được)
> - FE dùng cho card cảnh báo "sắp/đã ăn xong" trên Dashboard bác sĩ → bấm "Tạo thực đơn mới".

### GET /api/v1/doctor/patients/{patient_id}
**Role:** doctor — chi tiết 1 bệnh nhân (cùng schema DoctorPatientSummary)

### PUT /api/v1/doctor/patients/{patient_id}/metrics
**Role:** doctor — cập nhật chỉ số cơ thể (inline edit)
```json
// Request
{ "weight": 72.5, "height": 170 }
// Response 200
{
  "weight": 72.5,
  "height": 170.0,
  "bmi": 25.1,
  "bmi_category": "Thừa cân nhẹ",
  "updated_at": "12/10/2023"
}
```
> Validate: `weight > 0`, `height > 0` (sai → 422). BMI do backend tính lại: `weight(kg) / (height(m))^2`, làm tròn 1 chữ số thập phân. `bmi_category` chuẩn Châu Á: <18.5 Thiếu cân · 18.5–22.9 Bình thường · 23–24.9 Thừa cân nhẹ · ≥25 Béo phì.

### PUT /api/v1/doctor/patients/{patient_id}/goals
**Role:** doctor — cập nhật danh sách mục tiêu điều trị (thay toàn bộ)
```json
// Request
{ "goals": ["Kiểm soát đường huyết (HbA1c < 7%).", "Giảm cân 2kg trong 1 tháng."] }
// Response 200
{ "goals": ["string"] }
```

### PUT /api/v1/doctor/patients/{patient_id}/profile
**Role:** doctor — cập nhật thông tin chung của bệnh nhân (tên, avatar, email, tuổi, giới tính, liên hệ, chẩn đoán, thuốc, dị ứng, dinh dưỡng, mục tiêu)
```json
// Request — field KHÔNG gửi → giữ nguyên; field gửi null → xóa (avatar/full_name → mặc định)
{
  "full_name": "Nguyễn Văn A",
  "email": "nguyenvana@gmail.com",
  "avatar": "https://.../avatar.png",
  "age": 45,
  "gender": "Nam",
  "phone": "0901 234 567",
  "address": "Quận 1, TP. Hồ Chí Minh",
  "blood_pressure": "130/80 mmHg",
  "blood_glucose": "135 mg/dL",
  "disease": ["diabetes_t2", "hypertension"],
  "medications": ["metformin"],
  "allergies": ["hải sản"],
  "preferences": ["thích ăn cơm", "không ăn thịt bò"],
  "treatment_goals": ["Kiểm soát đường huyết (HbA1c < 7%)."]
}
// Response 200 — DoctorPatientSummary (mới nhất)
```
> Email trùng tài khoản khác → 409 `EMAIL_EXISTS`. `age` ngoài 0–130 → 422.

### GET /api/v1/doctor/catalog
**Role:** doctor, patient — danh mục có sẵn để chọn tags (thuốc, dị ứng, chẩn đoán)
```json
// Response 200
{
  "medicines": [{ "id": "uuid", "name": "Metformin 500mg" }],
  "allergies": [{ "id": "uuid", "name": "Hải sản" }],
  "diagnoses": [{ "code": "diabetes_t2", "name": "Tiểu đường type 2" }]
}
```

### POST /api/v1/doctor/patients/{patient_id}/avatar
**Role:** doctor — upload ảnh đại diện (multipart/form-data, field `file`, ảnh ≤ 2MB, png/jpg/webp/gif)
```json
// Response 200
{ "avatar": "/static/avatars/{patient_id}.png" }
```
> File không phải ảnh → 415 `INVALID_IMAGE`; quá 2MB → 413 `IMAGE_TOO_LARGE`.

### POST /api/v1/doctor/patients/{patient_id}/meal-plans/generate
**Role:** doctor — tạo 1 thực đơn 7 ngày (kèm `alternatives[]` trên từng món). Body tùy chọn giống patient generate: `{ "notes", "priorities" }`.

### GET /api/v1/doctor/meal-plans
**Role:** doctor — filter `?status=pending_review` (mặc định) hoặc `?status=all` (tất cả plan); response `MealPlanOutput` (thêm `created_at: "ISO-8601 | null"`)

### POST /api/v1/doctor/meal-plans/{id}/review
**Role:** doctor
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
  "trust_badge": "doctor_reviewed | null",
  "reviewed_at": "ISO-8601",
  "reviewer_id": "string"
}
```

### POST /api/v1/doctor/demo/plan-expiry
**Role:** doctor — demo: giả lập thực đơn sắp/đã hết hạn (đẩy `reviewed_at` của plan approved mới nhất mỗi bệnh nhân về quá khứ). Chỉ khả dụng ngoài production (guard `DEMO_DISABLED`).
```json
// Request (PlanExpiryDemoRequest — optional body)
{ "mode": "expiring | expired" }  // mặc định "expired"
// Response 200 (PlanExpiryDemoOut)
{
  "updated": ["demo_patient_1"],   // patient có plan approved đã bị backdate
  "skipped": ["demo_patient_2"]    // patient không có plan approved
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
- `User.role`: `patient | doctor`
