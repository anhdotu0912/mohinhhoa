# API v1 Contract — VMEC-10 (FE ↔ BE)

**Version:** 1.8 (2026-08-24 — Food Log/`GET /compliance*` dùng ngày lịch Asia/Ho_Chi_Minh; `logged_at` timezone-aware. Xem changelog ở mục Versioning cuối file)
**Base URL:** tất cả endpoint dưới đây (trừ mục Health) có prefix `/api/v1`.
**Nguồn sự thật:** `backend/app/api/v1/*.py`, `backend/app/main.py` (danh sách router thật được mount).
**Luật bắt buộc:** sửa contract này trước, code sau. Field/schema nhắc ở đây phải khớp `contracts/agent-io-schema.md`.
**Đánh dấu trạng thái:** endpoint không ghi gì = **as-built, đang hoạt động**. Endpoint có nhãn `[Planned]` = chưa tồn tại trong code, là thiết kế đề xuất cho spec liên quan.

---

## 1. Auth

### `POST /auth/register`
**Role:** Không cần auth (public). Dùng cho cả patient tự đăng ký lẫn doctor tạo hộ tài khoản patient.
```json
// Request
{ "email": "patient1@example.com", "password": "matkhau123", "role": "patient", "full_name": "Nguyễn Văn A" }
// Response 201
{ "id": "user_uuid", "email": "patient1@example.com", "role": "patient", "full_name": "Nguyễn Văn A" }
// Error 409
{ "code": "EMAIL_EXISTS", "detail": "Email đã được đăng ký." }
```
`role` ∈ `{"patient","doctor"}`, default `"patient"`. `full_name` optional.

### `POST /auth/login`
**Role:** Không cần auth.
```json
// Request
{ "email": "patient1@example.com", "password": "matkhau123" }
// Response 200
{ "access_token": "eyJ...", "token_type": "bearer", "role": "patient", "user_id": "user_uuid" }
// Error 401
{ "code": "INVALID_CREDENTIALS", "detail": "Email hoặc mật khẩu không đúng." }
```

### `GET /auth/me`
**Role:** Bất kỳ user đã đăng nhập (`patient` hoặc `doctor`).
```json
// Response 200
{ "id": "user_uuid", "email": "demo_doctor@example.com", "role": "doctor", "full_name": "BS. Minh", "avatar": "/static/avatars/demo_doctor.jpg" }
```
`full_name` / `avatar` có thể `null`.

### `POST /auth/forgot-password` (as-built 2026-08-18)
**Role:** Không cần auth. **Quyết định 2026-08-18:** gửi **mật khẩu mới** qua SMTP tới email đã đăng ký (không in token ra log). Nếu email không tồn tại vẫn trả 200 cùng message — tránh lộ thông tin tồn tại email. Mật khẩu cũ chỉ bị thay khi gửi email thành công.
```json
// Request
{ "email": "patient1@example.com" }
// Response 200 (luôn 200 dù email có tồn tại hay không — tránh lộ thông tin tồn tại email)
{ "message": "Nếu email tồn tại, mật khẩu mới đã được gửi tới email của bạn." }
// Error 503 { "code": "EMAIL_NOT_CONFIGURED", "detail": "Chưa cấu hình gửi email (SMTP). Liên hệ quản trị viên." }
// Error 502 { "code": "EMAIL_AUTH_FAILED", "detail": "Gmail từ chối đăng nhập SMTP. ..." }
// Error 500 { "code": "EMAIL_SEND_FAILED", "detail": "Không gửi được email. Vui lòng thử lại sau." }
```

Cần `SMTP_USERNAME` + `SMTP_PASSWORD` (App Password). Host Gmail mặc định trong code (xem `how_to_run.md`).

### `POST /auth/reset-password` (as-built 2026-08-18)
**Role:** Không cần auth, dùng token gửi qua email ở bước trên.
```json
// Request
{ "token": "reset_token_string", "new_password": "matkhaumoi123" }
// Response 200
{ "message": "Đặt lại mật khẩu thành công." }
// Error 400 { "code": "INVALID_OR_EXPIRED_TOKEN", "detail": "Token không hợp lệ hoặc đã hết hạn." }
```

**Rate-limit `POST /auth/login` (as-built 2026-08-18):** giới hạn 5 lần thử sai / 15 phút theo `email`+IP → `429 TOO_MANY_ATTEMPTS`.

---

## 2. Profile

### `POST /profile`
**Role:** `patient`. Upsert (1 user – 1 profile).
```json
// Request (mọi field optional/default, xem contracts/agent-io-schema.md §1)
{ "disease": ["diabetes_t2"], "medications": ["metformin"], "allergies": ["hải sản"], "bmi": 26.5, "weight": 72, "height": 170, "target_kcal": 1800, "restrictions": { "carb_per_meal": 45, "sodium_daily": 1500 }, "preferences": ["thích ăn cơm"] }
// Response 200 → PatientProfile (xem contracts/agent-io-schema.md §1)
```
**`constraints_status` (as-built 2026-08-18):** nếu request thay đổi `target_kcal`/`restrictions` so với giá trị đang lưu, BE set `constraints_status="pending_doctor_review"` (giá trị mới vẫn áp dụng ngay cho lần generate kế tiếp).

### `GET /profile/me`
**Role:** `patient`. Response 200 → `PatientProfile`.

---

## 3. Clinical Constraints

Patient tự set `restrictions`/`target_kcal` qua `POST /profile` (as-built). Doctor set qua endpoint riêng bên dưới (as-built 2026-08-16). `PUT /doctor/patients/{id}/profile` **không** nhận `target_kcal`/`restrictions`.

**Quyết định 2026-08-16 (as-built):**
- **Ràng buộc doctor UI:** `target_kcal`, `salt_daily_g`, `sugar_daily_g` — khớp trang `frontend/app/doctor/patients/constraints/page.tsx`.
- **Schema `Restrictions`:** giữ song song `carb_per_meal`/`sodium_daily` (patient) + `salt_daily_g`/`sugar_daily_g` (doctor). Meal planner dùng `effective_sodium_mg = min(sodium_daily, salt_daily_g * 400)` khi cả hai có giá trị.
- **`protein_daily_g`:** bỏ khỏi scope ràng buộc (Won't Have MVP này).

**HITL as-built (2026-08-18):** patient tự sửa `target_kcal`/`restrictions` → `pending_doctor_review`; doctor approve qua endpoint bên dưới.

### `PUT /doctor/patients/{patient_id}/constraints` (as-built)
**Role:** `doctor`. Partial update — chỉ field gửi lên mới bị ghi đè.
```json
// Request (flat — không bọc trong restrictions)
{
  "target_kcal": 1700,
  "salt_daily_g": 4.5,
  "sugar_daily_g": 20
}
// Response 200 → DoctorPatientSummary (target_kcal + salt_daily_g + sugar_daily_g đã cập nhật)
// Error 404 PATIENT_NOT_FOUND — bệnh nhân không tồn tại
// Error 422 — target_kcal/salt/sugar ngoài range validation
```

### `POST /doctor/patients/{patient_id}/constraints/approve` (as-built 2026-08-18)
**Role:** `doctor`. Xác nhận thay đổi ràng buộc mà **patient tự sửa** trước đó (không đổi giá trị, chỉ chuyển `constraints_status` từ `"pending_doctor_review"` → `"confirmed"`).
```json
// Request: rỗng (không cần body)
// Response 200 → PatientProfile (constraints_status="confirmed")
// Error 400 { "code": "NOTHING_TO_APPROVE", "detail": "Không có thay đổi nào đang chờ duyệt." } — khi constraints_status đã là "confirmed"
```

---

## 4. Meal Plans

### `POST /meal-plans/generate`
**Role:** `patient`. Luôn sinh 7 ngày, `status` khởi tạo `"pending_review"`. **Không** materialize `meal_reminder`/`adherence_checkin` tại thời điểm này — các nhắc nhở chỉ được tạo khi doctor `approve` (xem §9 side-effect `approve`).
```json
// Request (optional body)
{ "notes": "Bệnh nhân thích ăn cá", "priorities": ["giảm natri"] }
// Response 200 → MealPlanOutput (xem contracts/agent-io-schema.md §2)
```

### `GET /meal-plans/me`
**Role:** `patient`. Trả plan mới nhất (`ORDER BY created_at DESC LIMIT 1`). Side-effect (lazy, idempotent): nếu plan mới nhất có `status` ∈ `{approved, edited}` và `plan_expiry.bucket()` trả `"expiring"` hoặc `"expired"`, BE tạo **một lần** `Notification(type="plan_expiring"|"plan_expired", status="sent")` gắn `related_ids.meal_plan_id` nếu chưa tồn tại bản ghi cùng type cho plan đó.
```json
// Response 200 → MealPlanOutput
// Error 404
{ "code": "NO_MEAL_PLAN", "detail": "Bạn chưa có thực đơn nào." }
```

### `GET /meal-plans/schedule`
**Role:** `patient`. Lịch tuần thực đơn của chính mình — cùng schema với `GET /doctor/patients/{patient_id}/meal-plan-schedule` (ADR-012); `patient_id` trong response = `user_id` của patient đang đăng nhập.
```json
// Response 200 → MealPlanScheduleOut (xem § GET /doctor/patients/{patient_id}/meal-plan-schedule)
```

### `GET /meal-plans/{meal_plan_id}`
**Role:** bất kỳ user đã đăng nhập (`get_current_user`). Patient chỉ xem plan của chính mình (403 nếu không phải chủ plan); doctor xem được plan của bất kỳ patient nào (không giới hạn ownership).
```json
// Response 200 → MealPlanOutput
// Error 403 { "code": "FORBIDDEN", "detail": "Bạn không có quyền xem thực đơn này." }
// Error 404 { "code": "MEAL_PLAN_NOT_FOUND", "detail": "Không tìm thấy thực đơn." }
```

### `POST /doctor/patients/{patient_id}/meal-plans/generate`
**Role:** `doctor`. Doctor sinh plan hộ 1 patient cụ thể — cùng pipeline với `POST /meal-plans/generate`.
```json
// Request (optional body, giống GenerateMealPlanRequest)
{ "notes": "", "priorities": [] }
// Response 200 → MealPlanOutput
// Error 404 { "code": "PATIENT_NOT_FOUND", "detail": "Không tìm thấy bệnh nhân." }
```

### `POST /meal-plans/{meal_plan_id}/request-adjustment` (as-built 2026-08-18)
**Role:** `patient`, chỉ chủ plan. **Quyết định 2026-08-15:** patient có thể yêu cầu điều chỉnh 1 plan đã `approved`, nhưng yêu cầu **phải qua bác sĩ duyệt lại** — không tự động regenerate. Tái sử dụng luồng review sẵn có: set `status` plan về lại `"pending_review"` kèm `adjustment_note`, plan sẽ xuất hiện lại trong `GET /doctor/meal-plans` (default filter) để doctor xử lý qua `POST /doctor/meal-plans/{id}/review` như bình thường.
```json
// Request
{ "adjustment_note": "Tôi không ăn được nhiều rau ngót, xin đổi món khác cho ngày 3." }
// Response 200 → MealPlanOutput (status="pending_review", adjustment_note lưu lại)
// Error 400 { "code": "PLAN_NOT_APPROVED", "detail": "Chỉ yêu cầu điều chỉnh trên thực đơn đã được duyệt." } — khi plan đang pending_review/rejected/edited
```

**Ghi chú `/chat` intent `meal_plan` (read-only):** chat **không** sinh/persist thực đơn mới. Chỉ đọc plan có sẵn trong DB và trả `meal_preview` + `meal_plan_id` của plan đang xem. Sinh plan qua `POST /meal-plans/generate` hoặc `POST /doctor/.../meal-plans/generate`.

---

## 5. Interactions

### `POST /interactions/check`
**Role:** `patient`. Kiểm tra ad-hoc (không gắn plan cụ thể).
```json
// Request
{ "medications": ["warfarin"], "foods": ["rau muống", "bưởi"], "profile_user_id": null }
// Response 200 → InteractionCheckOutput (xem contracts/agent-io-schema.md §6, gồm unmatched_pairs[])
```
Mỗi interaction phát hiện được cũng tự động tạo 1 `Alert` (persist DB) + có thể tạo `Notification(type="interaction_followup")` nếu severity ∈ `{Nguy hiểm, Cần chú ý}`. Cặp `drug`×`food` không tìm thấy dữ liệu trong KB xuất hiện trong `unmatched_pairs[]` (as-built 2026-08-18).

**Gap KB đầy đủ vs KB rút gọn (xem `contracts/agent-io-schema.md` §6):** đã được team chấp nhận là hạn chế biết trước cho vòng demo hiện tại (2026-08-15), không nằm trong backlog ưu tiên cao — xem `tasks/roadmap-mvp.md`.

---

## 6. Alerts

### `GET /alerts`
**Role:** bất kỳ user đã đăng nhập. Patient: chỉ alert của chính mình. Doctor: **bắt buộc** query `patient_id`.
```
GET /alerts                      (patient — tự động lấy alert của mình)
GET /alerts?patient_id=user_uuid (doctor)
```
```json
// Response 200 → list[Alert] (xem contracts/agent-io-schema.md §4)
// Error 400 (doctor thiếu patient_id) { "code": "PATIENT_ID_REQUIRED", "detail": "Doctor cần truyền patient_id." }
```

---

## 7. Notifications

### `GET /notifications`
**Role:** `patient` **chỉ** (doctor hiện chưa gọi được endpoint này — gap, xem §9 Doctor Compliance).

**Plan expiry notifications (lazy):** `plan_expiring` / `plan_expired` được materialize idempotent khi patient gọi `GET /meal-plans/me` và plan đang có hiệu lực (`status` ∈ `{approved, edited}`) với bucket tương ứng — không dùng cron; gọi lại nhiều lần không tạo trùng lặp cho cùng `meal_plan_id` + type.
```
GET /notifications?status=pending&type=meal_reminder
```
```json
// Response 200 → list[NotificationOut]
[
  {
    "id": "notif_uuid", "user_id": "user_uuid", "type": "meal_reminder",
    "title": "Nhắc bữa trưa — Ngày 1", "body": "Đến giờ bữa trưa...",
    "scheduled_at": "2026-08-15T11:30:00", "status": "pending",
    "related_ids": { "meal_plan_id": "plan_uuid", "day_index": 1, "slot": "lunch" },
    "payload": {}, "created_at": "2026-08-15T09:00:00", "updated_at": "2026-08-15T09:00:00"
  }
]
```

### `POST /notifications/demo/simulate`
**Role:** `patient`. Seed đúng 3 bản ghi mẫu cố định (`meal_reminder` pending, `adherence_checkin` pending, `plan_approved` sent) cho user hiện tại. **Không** bulk-flip trạng thái các bản ghi khác.
```json
// Response 200 → list[NotificationOut] (3 phần tử)
// Error 403 (khi APP_ENV=production) { "code": "DEMO_DISABLED", "detail": "Endpoint demo không khả dụng ở production." }
```
**Quyết định 2026-08-15 (Planned fix):** hành vi hiện tại khi gọi lại nhiều lần cần được xác minh/sửa lại cho hợp lý — mỗi lần gọi lại chỉ nên tạo bản ghi mẫu mới nếu **chưa có** bản ghi mẫu cùng loại đang `pending`/`sent` cho user đó (tránh nhân bản notification giả khi demo bấm nút nhiều lần). BE2 cần audit lại implementation hiện tại và điều chỉnh cho idempotent hơn.

### `POST /notifications/{notification_id}/read`
**Role:** `patient`, chỉ chủ notification. Response 200 → `NotificationOut` (status → `"read"` nếu đang `pending/sent`).

### `POST /notifications/{notification_id}/dismiss`
**Role:** `patient`, chỉ chủ notification. Response 200 → `NotificationOut` (status → `"dismissed"`).

### `POST /notifications/{notification_id}/done`
**Role:** `patient`, chỉ chủ notification.
```json
// Request (adherence bắt buộc nếu type="adherence_checkin")
{ "adherence": "partial" }
// Response 200 → NotificationOut (status → "done", payload.adherence lưu lại)
// Error 400 (thiếu adherence cho adherence_checkin) { "code": "ADHERENCE_REQUIRED", "detail": "Cần cung cấp adherence cho check-in." }
```

---

## 8. Doctor Patient Management

### `GET /doctor/patients`
**Role:** `doctor`. Query optional: `q`, `status` (`status_key`), `plan_usage` (`none` \| `active` \| `finished`).
```json
// Response 200 → list[DoctorPatientSummary]
// DoctorPatientSummary thêm: active_plan_id, active_plan_status, plan_starts_on, plan_usage
```

### `GET /doctor/patients/{patient_id}/meal-plans`
**Role:** `doctor`. Query `status` (default `"all"`).
```json
// Response 200 → list[MealPlanOutput] for one patient only
```

### `GET /doctor/patients/{patient_id}/meal-plan-schedule`
**Role:** `doctor`. Week schedule slots (ADR-012).
```json
// Response 200
{
  "patient_id": "demo_patient_1",
  "today": "2026-08-16",
  "active_plan_id": "plan_uuid",
  "active_plan": { /* MealPlanOutput or null */ },
  "unassigned_plans": [ /* pending_review / approved / edited chưa gán starts_on */ ],
  "slots": [
    {
      "slot_key": "current",
      "starts_on": "2026-08-16",
      "ends_on": "2026-08-22",
      "occupancy": "active",
      "plan": { /* MealPlanOutput */ },
      "actions": ["view", "replace"]
    },
    {
      "slot_key": "next",
      "starts_on": "2026-08-23",
      "ends_on": "2026-08-29",
      "occupancy": "empty",
      "plan": null,
      "actions": ["add"]
    }
  ]
}
```
- `unassigned_plans`: thực đơn chưa gán tuần (`pending_review` | `approved` | `edited`, `starts_on` null). Không nhét vào slot `current` — cột tuần chỉ hiện plan đã apply đúng cửa sổ ngày.
- Plan đã apply mà `ends_on` < hôm nay xuất hiện với `occupancy="past"` (dùng cho điều hướng tuần trước).

### `GET /doctor/patients/{patient_id}`
**Role:** `doctor`. Response 200 → `DoctorPatientSummary`. Error 404 `PATIENT_NOT_FOUND`.

### `PUT /doctor/patients/{patient_id}/metrics`
**Role:** `doctor`. Cập nhật weight/height, BMI tự tính lại server-side.
```json
// Request
{ "weight": 70, "height": 168 }
// Response 200
{ "weight": 70, "height": 168, "bmi": 24.8, "bmi_category": "Bình thường", "updated_at": "15/08/2026" }
```
`bmi_category` ngưỡng châu Á: `<18.5 Thiếu cân`, `<23 Bình thường`, `<25 Thừa cân nhẹ`, `≥25 Béo phì`.

**Quyết định 2026-08-15 (Planned validation):** `weight` và `height` **phải gửi đầy đủ cả 2** trong cùng 1 request — không cho phép cập nhật riêng lẻ 1 trong 2 (tránh tính BMI sai do dùng giá trị cũ/thiếu ngữ cảnh). Thiếu 1 trong 2 → `400 METRICS_INCOMPLETE`.
```json
// Error 400 (thiếu 1 trong 2 field) { "code": "METRICS_INCOMPLETE", "detail": "Cần cung cấp đầy đủ cả weight và height." }
```

### `PUT /doctor/patients/{patient_id}/goals`
**Role:** `doctor`. Thay toàn bộ danh sách mục tiêu điều trị.
```json
// Request
{ "goals": ["Giảm cân 2kg trong 1 tháng.", "Duy trì huyết áp dưới 130/80 mmHg."] }
// Response 200
{ "goals": ["Giảm cân 2kg trong 1 tháng.", "Duy trì huyết áp dưới 130/80 mmHg."] }
```

### `PUT /doctor/patients/{patient_id}/profile`
**Role:** `doctor`. Partial update (chỉ field có mặt trong request mới được ghi đè). **Không nhận `target_kcal`/`restrictions`** (xem §3 Clinical Constraints — Planned riêng).
```json
// Request (mọi field optional, chỉ field gửi lên mới đổi)
{ "full_name": "Nguyễn Văn A", "email": "a.nguyen@example.com", "age": 46, "gender": "Nam", "disease": ["diabetes_t2", "hypertension"], "allergies": ["hải sản"] }
// Response 200 → DoctorPatientSummary
// Error 409 { "code": "EMAIL_EXISTS", "detail": "Email đã được đăng ký." }
// Error 422 { "code": "INVALID_EMAIL", "detail": "Email không được để trống." }
```
`age` validate `0 ≤ age ≤ 130` (Pydantic `ge=0, le=130`) — chỉ áp dụng ở endpoint này, **không** áp dụng ở `POST /auth/register` (register không có field `age`).

### `GET /doctor/catalog`
**Role:** `doctor` hoặc `patient`. Danh mục thuốc/dị ứng/chẩn đoán dùng cho dropdown UI.
```json
// Response 200
{ "medicines": [{"id": "med_uuid", "name": "Metformin 500mg"}], "allergies": [{"id": "alg_uuid", "name": "Hải sản"}], "diagnoses": [{"code": "diabetes_t2", "name": "Tiểu đường type 2"}] }
```

### `GET /doctor/foods`
**Role:** `doctor`. Tra cứu món / thành phần dinh dưỡng từ catalog DB (`recipes` + `food_compositions`, fallback JSON demo nếu DB trống) — dùng cho UI «Thêm món» khi bác sĩ chỉnh thực đơn.
```json
// Query: q (optional, tìm theo tên), limit (default 40, max 100)
// Response 200
{
  "items": [
    {
      "id": "rcp_001",
      "name": "Ức gà hấp gừng sả",
      "portion": "1 phần theo công thức",
      "kcal": 160,
      "macros": { "carb_g": 1, "protein_g": 26, "fat_g": 5, "sodium_mg": 70 },
      "category": "thit",
      "source": "db"
    }
  ],
  "total": 1
}
```

### `POST /doctor/patients/{patient_id}/avatar`
**Role:** `doctor`. Multipart form upload (`file`), ảnh ≤ 2MB, mime `image/*`.
```json
// Response 200
{ "avatar": "/static/avatars/<patient_id>.png" }
// Error 415 { "code": "INVALID_IMAGE", "detail": "File phải là ảnh (png/jpg/webp/gif)." }
// Error 413 { "code": "IMAGE_TOO_LARGE", "detail": "Ảnh tối đa 2MB." }
```

### `DELETE /doctor/patients/{patient_id}`
**Role:** `doctor`. Xóa hoàn toàn một bệnh nhân và toàn bộ dữ liệu liên quan (hồ sơ, thực đơn, nhật ký ăn uống, thông báo, chỉ số sức khỏe, hội thoại chat).
```json
// Response 204 No Content
// Error 404 { "code": "PATIENT_NOT_FOUND", "detail": "Không tìm thấy bệnh nhân." }
```

---

## 9. Doctor Review

### `GET /doctor/meal-plans`
**Role:** `doctor`. Query `status` (default `"pending_review"`, dùng `"all"` để lấy hết).
```json
// Response 200 → list[MealPlanOutput]
```

### `DELETE /doctor/meal-plans/{meal_plan_id}`
**Role:** `doctor`. Xóa một thực đơn đã tạo (chờ duyệt, đã duyệt, hoặc đã áp dụng).
```json
// Response 204 No Content
// Error 404 { "code": "MEAL_PLAN_NOT_FOUND", "detail": "Không tìm thấy thực đơn." }
```

### `POST /doctor/meal-plans/{meal_plan_id}/review`
**Role:** `doctor`.
```json
// Request — action = "approve"
{ "action": "approve", "notes": "Thực đơn phù hợp, đã duyệt." }
// Request — action = "reject"
{ "action": "reject", "notes": "Cần điều chỉnh lượng natri bữa tối." }
// Request — action = "edit" (bắt buộc edited_plan, full replace days/swaps/citations)
{ "action": "edit", "notes": "Đã sửa bữa trưa ngày 2.", "edited_plan": { "days": [ /* DayPlan[7] đầy đủ */ ], "swaps": [], "citations": ["byt_vn_notes.md"] } }
// Response 200
{ "meal_plan_id": "plan_uuid", "status": "approved", "trust_badge": "doctor_reviewed", "reviewed_at": "2026-08-15T09:10:00+07:00", "reviewer_id": "doctor_uuid" }
// Error 400 (edit thiếu edited_plan) { "code": "EDITED_PLAN_REQUIRED", "detail": "Cần edited_plan khi action=edit." }
// Error 404 { "code": "MEAL_PLAN_NOT_FOUND", "detail": "Không tìm thấy thực đơn." }
// Error 409 (as-built — plan không còn ở pending_review) { "code": "PLAN_ALREADY_REVIEWED", "detail": "Thực đơn này đã được xử lý (status hiện tại: approved). Tải lại danh sách để xem trạng thái mới nhất." }
```
**Side-effect theo action (as-built, ADR-011):**
- `approve`: `status="approved"`, `trust_badge="doctor_reviewed"` → tạo `Notification(type="plan_approved", status="sent")` only. **Không** materialize `meal_reminder`/`adherence_checkin` — gọi `POST /doctor/meal-plans/{id}/apply` sau khi chọn ngày áp dụng.
- `reject`: `status="rejected"` (không set `trust_badge`) → cancel (set `status="cancelled"`) các `Notification` **đang `pending`** có `related_ids.meal_plan_id` khớp plan này (không đụng notification `sent/read/done`, không đụng plan khác).
- `edit`: `status="edited"`, `trust_badge="doctor_reviewed"` → tạo `plan_approved` notification; reminders khi apply.

### `POST /doctor/meal-plans/{meal_plan_id}/apply`
**Role:** `doctor`. Gán cửa sổ áp dụng 7 ngày cho plan đã `approved|edited`. Generate **không** nhận ngày.
```json
// Request
{ "start_date": "2026-08-16", "replace_active": true, "slot_key": "current" }
// slot_key optional: "current" | "next" | "empty" — when set, start_date must match that slot (empty = bất kỳ tuần trống đang add được, không chỉ tuần empty đầu tiên)
// Response 200 → MealPlanOutput (starts_on, ends_on, days[].date đã stamp)
// Error 400 { "code": "PLAN_NOT_APPLYABLE" | "START_DATE_IN_PAST" | "INVALID_REPLACE_DATE" | "INVALID_SLOT_START" }
// Error 409 { "code": "PLAN_DATE_OVERLAP" }
```
**Side-effect:** materialize `meal_reminder`/`adherence_checkin` theo `start_date` (bỏ qua slot đã qua). `replace_active: true` cắt `ends_on` plan active cũ = `start_date - 1`.

### `POST /doctor/demo/plan-expiry`
**Role:** `doctor`. Demo-only — dịch `starts_on`/`ends_on` của plan active (hoặc approved mới nhất) để giả lập expiring/expired trên `GET /doctor/patients`.
```json
// Request
{ "mode": "expiring" }
// Response 200
{ "updated": ["patient_uuid_1"], "skipped": ["patient_uuid_2"] }
// Error 403 (production) { "code": "DEMO_DISABLED", "detail": "Endpoint demo không khả dụng ở production." }
```

---

## 10. Doctor Compliance

On-the-fly aggregation từ `adherence_checkin` (done) + `Alert` (severity ∈ `{Nguy hiểm, Cần chú ý}`), không bảng tổng hợp riêng — xem `adrs/008-compliance-summary-aggregation-strategy.md`, `specs/10-doctor-compliance-view.md`.

### `GET /doctor/patients/{patient_id}/compliance`
**Role:** `doctor`. Query optional `days` (default 14, max 90).
```json
// Response 200
{
  "patient_id": "user_uuid",
  "days": 14,
  "low_threshold_pct": 50,
  "overall_adherence_pct": 75,
  "checkins_done": 10,
  "checkins_as_planned": 7,
  "daily_series": [
    { "date": "2026-08-01", "adherence_pct": 100 },
    { "date": "2026-08-02", "adherence_pct": null }
  ],
  "events": [
    { "type": "alert", "severity": "Nguy hiểm", "title": "Tương tác warfarin × rau muống", "at": "2026-08-02T12:30:00" }
  ]
}
```
- `overall_adherence_pct`: trung bình các ngày có `adherence_pct` không null; `null` nếu chưa có check-in `done`.
- `checkins_done` / `checkins_as_planned`: đếm check-in `adherence_checkin` status `done` trong cửa sổ (`yes` = đúng kế hoạch).
- Ngày không có check-in `done`: `adherence_pct: null` (không tính vào trung bình).

### `POST /doctor/patients/{patient_id}/compliance/remind`
**Role:** `doctor`. Gửi nhắc nhở tuân thủ thủ công tới patient — tạo `Notification(type="manual_reminder", status="sent")`.
```json
// Request
{ "message": "Bác sĩ nhắc bạn ghi nhận bữa tối hôm nay nhé." }
// Response 200 → NotificationOut (type="manual_reminder", status="sent")
```

**Ngưỡng "tuân thủ thấp":** cấu hình `COMPLIANCE_LOW_THRESHOLD_PCT` trong `backend/app/core/config.py` (default `50`).

### `GET /compliance/me` (as-built 2026-08-23)
**Role:** `patient`. Tổng hợp tuân thủ của chính mình — tái dùng `ComplianceService.get_patient_compliance` và schema `PatientComplianceOut` giống `GET /doctor/patients/{patient_id}/compliance` (§10 phía trên). Dùng cho `HealthMetricsPanel` — tránh gọi chat ngầm chỉ để lấy số liệu tuân thủ.

Query optional `days` (default `7`, min `1`, max `90`). `patient_id` trong response luôn = `current_user.id` — patient **không** xem được compliance của người khác.

```json
// Response 200 → PatientComplianceOut (cùng shape § GET /doctor/patients/{patient_id}/compliance)
{
  "patient_id": "user_uuid",
  "days": 7,
  "low_threshold_pct": 50,
  "overall_adherence_pct": 92,
  "checkins_done": 5,
  "checkins_as_planned": 4,
  "daily_series": [
    { "date": "2026-08-17", "adherence_pct": 100 },
    { "date": "2026-08-18", "adherence_pct": 80 }
  ],
  "events": [
    { "type": "checkin", "severity": "", "title": "Check-in tuân thủ", "at": "2026-08-18T20:00:00+07:00" }
  ]
}
```

**Quan hệ với chat intent `weekly_compliance`:** cả endpoint REST và node agent đều gọi cùng `ComplianceService.get_patient_compliance(patient_id, days)` — agent trả subset qua `AgentRunOutput.weekly_compliance` (`overall_adherence_pct` + `daily_series`); REST trả full `PatientComplianceOut` (kèm `events`, `checkins_*`, v.v.).

---

## 11. Chat

### `POST /chat`
**Role:** `patient` **hoặc** `doctor` (cả 2 role được phép gọi, khác với hầu hết endpoint patient-only khác).
```json
// Request
{ "message": "Tôi bị tiểu đường, hôm nay nên ăn gì?" }
// Response 200 → AgentRunOutput (xem contracts/agent-io-schema.md §5.2, gồm secondary_intents[] as-built và field optional weekly_compliance / doctor_note as-built)
// Error 503 { "code": "AGENT_ERROR", "detail": "Lỗi xử lý agent: ..." }
```
**Multi-intent (as-built):** `intent_classifier` phát hiện ý định phụ trong câu hỏi ghép (ví dụ vừa hỏi lập thực đơn vừa hỏi tương tác thuốc) qua keyword pattern — trả về qua `secondary_intents[]`, không xử lý song song đầy đủ, chỉ để `message` gợi ý người dùng hỏi lại riêng ý định phụ đó.

### `POST /chat/stream`
**Role:** `patient` **hoặc** `doctor`.
```json
// Request
{ "message": "Tôi bị tiểu đường, hôm nay nên ăn gì?" }
```
**Response 200:** `text/event-stream` (Server-Sent Events)

**Client:** phải dùng `fetch` + đọc `ReadableStream` (không dùng `EventSource` native) vì endpoint yêu cầu header `Authorization: Bearer <token>`.

Các sự kiện SSE emit theo định dạng `data: <JSON>\n\n`:

| `type` | Payload | Mô tả |
|---|---|---|
| `status` | `{ "node": "profile_loader \| intent_classifier \| rag_qa \| meal_plan \| …", "message": "Đang tải hồ sơ..." }` | Bước xử lý đang chạy (hiển thị luồng suy nghĩ trên UI) |
| `intent` | `{ "intent": "rag_qa \| meal_plan \| interaction_check \| food_log \| weekly_compliance \| doctor_note \| refuse \| unknown" }` | Intent đã phân loại |
| `token` | `{ "content": "..." }` | Một đoạn text câu trả lời (stream token thật cho `rag_qa`; chunk mô phỏng cho intent khác) |
| `status` | `{ "node": "apply_guardrails", "message": "Đang kiểm tra an toàn & nguồn trích dẫn..." }` | Guardrail hậu kiểm |
| `correction` | `{ "message": "<câu trả lời an toàn cuối>", "reason": "missing_citations \| unsafe_recommendation" }` | Chỉ emit khi guardrail thay đổi nội dung đã stream — client **thay thế** toàn bộ text đã hiển thị |
| `done` | `{ "data": AgentRunOutput }` | Kết thúc stream; `data` cùng schema với `POST /chat` — khi intent `weekly_compliance`/`doctor_note`, `data.weekly_compliance` / `data.doctor_note` populated (xem `contracts/agent-io-schema.md` §5.2) |
| `error` | `{ "message": "..." }` | Lỗi trong generator (response HTTP vẫn 200) |

Ví dụ chuỗi sự kiện:
```
data: {"type": "status", "node": "profile_loader", "message": "Đang tải hồ sơ..."}
data: {"type": "status", "node": "intent_classifier", "message": "Đang phân loại yêu cầu..."}
data: {"type": "intent", "intent": "rag_qa"}
data: {"type": "status", "node": "rag_qa", "message": "Đang tìm tài liệu tham khảo..."}
data: {"type": "token", "content": "Dựa "}
data: {"type": "token", "content": "trên "}
data: {"type": "status", "node": "apply_guardrails", "message": "Đang kiểm tra an toàn & nguồn trích dẫn..."}
data: {"type": "done", "data": { ...AgentRunOutput }}
```

**As-built:** `POST /chat` (sync JSON) vẫn giữ nguyên để tương thích; FE assistant ưu tiên `/chat/stream`.

### Chat Sessions (persist lịch sử UI — as-built 2026-08-23)

Lưu session + transcript hiển thị trên sidebar patient chat. **Không** đưa transcript vào `run_agent` — mỗi lượt `/chat` vẫn stateless.

**Role:** `patient` only (doctor `403`).

#### `GET /chat/sessions`
```json
// Response 200 → list[ChatSessionSummary]
[
  {
    "id": "session_uuid",
    "title": "Hôm nay tôi nên ăn gì?",
    "pinned": false,
    "message_count": 4,
    "created_at": "2026-08-23T10:00:00Z",
    "updated_at": "2026-08-23T10:05:00Z"
  }
]
```

#### `POST /chat/sessions`
```json
// Request (optional)
{ "title": "Cuộc trò chuyện mới" }
// Response 201 → ChatSessionOut (messages=[], applied_plans={})
```

#### `GET /chat/sessions/{id}`
```json
// Response 200 → ChatSessionOut
{
  "id": "session_uuid",
  "title": "Hôm nay tôi nên ăn gì?",
  "pinned": false,
  "applied_plans": { "plan_uuid": true },
  "messages": [ /* ChatMessageOut[] */ ],
  "created_at": "2026-08-23T10:00:00Z",
  "updated_at": "2026-08-23T10:05:00Z"
}
// Error 404 { "code": "SESSION_NOT_FOUND", "detail": "Không tìm thấy cuộc trò chuyện." }
```

#### `PATCH /chat/sessions/{id}`
```json
// Request — ít nhất một field
{ "title": "Tư vấn thực đơn", "pinned": true, "applied_plans": { "plan_uuid": true } }
// Response 200 → ChatSessionOut (metadata + messages hiện tại)
```

#### `DELETE /chat/sessions/{id}`
```json
// Response 204 (no body)
// Error 404 SESSION_NOT_FOUND
```

#### `DELETE /chat/sessions`
Xóa toàn bộ session của user hiện tại.
```json
// Response 204 (no body)
```

#### `PUT /chat/sessions/{id}/messages`
Thay toàn bộ mảng tin nhắn (snapshot sau khi stream `done`/`error`).
```json
// Request
{
  "messages": [
    {
      "id": "msg_uuid",
      "sender": "user",
      "text": "Hôm nay tôi nên ăn gì?"
    },
    {
      "id": "msg_uuid_2",
      "sender": "ai",
      "text": "Dựa trên hồ sơ của bạn...",
      "intent": "meal_plan",
      "secondary_intents": [],
      "citations": ["dinh_duong_dai_thao_duong.md"],
      "guardrail_triggered": false,
      "meal_plan_id": "plan_uuid",
      "meal_preview": { /* MealPreviewOut */ },
      "weekly_compliance": null,
      "doctor_note": null,
      "meal_plan_week": null,
      "show_weekly_plan": false,
      "thinking_steps": [{ "node": "profile_loader", "message": "...", "status": "done" }],
      "corrected": false,
      "correction_reason": null
    }
  ]
}
// Response 200 → ChatSessionOut
```

**ChatMessageOut** — field optional (snake_case):
- `id`, `sender` ∈ `user|ai`, `text`
- `intent`, `secondary_intents[]`, `citations[]`, `guardrail_triggered`, `meal_plan_id`
- `meal_preview` (MealPreviewOut), `weekly_compliance` (WeeklyComplianceOut), `doctor_note` (DoctorNoteOut)
- `meal_plan_week` (MealPlanOutput), `show_weekly_plan`, `thinking_steps[]`, `corrected`, `correction_reason`
- **Không persist** `is_streaming` (ephemeral lúc SSE)

---

## 12. Food Log

Theo `adrs/009-food-log-scope-strategy.md`, `specs/09-food-log-adherence.md`.

### `POST /food-log`
**Role:** `patient`.
```json
// Request
{ "meal_plan_id": "plan_uuid", "day_index": 3, "slot": "noon", "type": "custom", "note": "Ăn phở bò ngoài quán" }
// Response 200 → FoodLogEntry (xem contracts/agent-io-schema.md §3)
// Error 422 — custom thiếu note
```
`slot` ∈ `"morning" | "noon" | "evening"`. Custom log khớp KB tương tác → tạo `Alert` + `alert_ids[]`.

**Một user / một ngày lịch Asia/Ho_Chi_Minh / một slot = một log** (upsert): lần ghi sau trong cùng ngày VN + cùng slot cập nhật row hiện có (giữ `id`), không tạo bản ghi trùng. `logged_at` trên response là ISO-8601 timezone-aware (UTC `Z` hoặc offset). Timestamp naive trong DB được coi là UTC.

### `GET /food-log`
**Role:** `patient`. Query optional `date` (YYYY-MM-DD = ngày dương lịch **Asia/Ho_Chi_Minh**, không phải ngày UTC của container), `meal_plan_id`.
```json
// Response 200 → list[FoodLogEntry]
```
`date` không hợp lệ → bỏ qua filter ngày, không lỗi. `logged_at` timezone-aware như `POST`.

---

## 13. Patient Metrics History

Theo `adrs/013-patient-metrics-time-series.md`, `specs/12-patient-metrics-tracking.md`.

### `POST /metrics`
**Role:** `patient`. Upsert entry theo ngày lịch **Asia/Ho_Chi_Minh** + cập nhật snapshot `profiles`.
- Mỗi user tối đa **1** entry `recorded_by=patient` trong cùng ngày VN.
- Lần ghi đầu trong ngày → insert row mới.
- Lần ghi sau trong ngày → **cập nhật cùng row** (giữ `id`); field có trong request được ghi đè, field không gửi giữ nguyên giá trị entry hiện tại; `recorded_at` cập nhật thời điểm ghi cuối.
- Endpoint doctor `PUT /doctor/patients/{id}/metrics` vẫn insert entry riêng mỗi lần gọi.
```json
// Request (ít nhất 1 trong weight/blood_pressure/blood_glucose)
{ "weight": 71.5, "blood_pressure": "128/78 mmHg", "blood_glucose": "130 mg/dL", "note": "" }
// Response 200 → BodyMetricsEntry (contracts/agent-io-schema.md §3.5)
// Error 400 METRICS_EMPTY — không có field nào
```

### `GET /metrics/history`
**Role:** `patient`. Query optional `days` (default 90, max 365).
```json
// Response 200 → list[BodyMetricsEntry] (recorded_at asc)
```

### `DELETE /metrics/{id}`
**Role:** `patient`. Xóa một bản ghi chỉ số thuộc user hiện tại.
```json
// Response 204 — no body
// Error 404 METRICS_NOT_FOUND — id không tồn tại hoặc không thuộc user
```

---

## 14. Health

### `GET /health`
**Role:** không cần auth. **Không** có prefix `/api/v1` (root-level).
```json
// Response 200
{ "status": "ok" }
```

### `GET /`
**Role:** không cần auth. Root check.
```json
// Response 200
{ "Hello": "World" }
```

---

## Enum tham chiếu dùng chung

| Enum | Giá trị | Nguồn |
|---|---|---|
| `User.role` | `patient` \| `doctor` | `models/user.py`, `schemas/auth.py::RegisterRequest.role` |
| `MealPlan.status` | `pending_review` \| `approved` \| `rejected` \| `edited` | `models/meal_plan.py`, set qua `meal_planner_agent`/`routes_doctor.review_meal_plan` |
| `Alert.severity` / `InteractionItem.severity` | `Nguy hiểm` \| `Cần chú ý` \| `An toàn` | `data/drug_food_interactions.json`, `services/meal_plan_demo.py` |
| `Notification.type` | `meal_reminder` \| `adherence_checkin` \| `plan_approved` \| `plan_expiring` \| `plan_expired` \| `interaction_followup` \| `manual_reminder` | `services/notification.py` |
| `Notification.status` | `pending` \| `sent` \| `read` \| `dismissed` \| `done` \| `cancelled` | `services/notification.py`, `models/notification.py` |
| `NotificationActionRequest.adherence` | `yes` \| `partial` \| `no` | `schemas/notification.py` |
| `ReviewRequest.action` | `approve` \| `reject` \| `edit` | `schemas/doctor.py` |
| `DoctorPatientSummary.status_key` | `attention` \| `stable` \| `warning` \| `pending` | `schemas/doctor.py` |
| `PlanExpiryDemoRequest.mode` / `DoctorPatientSummary.plan_expiry` | `expiring` \| `expired` (request) — `expiring` \| `expired` \| `ok` \| `none` (summary field) | `schemas/doctor.py`, `services/plan_expiry.py` |
| Meal slot (`Meal.slot`, `Swap.slot`) | `breakfast` \| `lunch` \| `dinner` \| `snack` | `schemas/meal_plan.py` — **khác** `FoodLogEntry.slot` (xem dòng dưới) |
| Agent intent (`AgentRunOutput.intent`) | `meal_plan` \| `interaction_check` \| `food_log` \| `rag_qa` \| `refuse` \| `unknown` \| `weekly_compliance` \| `doctor_note` | `agents/nodes/intent_classifier.py::VALID_INTENTS` — 2 intent cuối as-built Phase 2 |
| `AgentRunOutput.secondary_intents[]` | cùng enum intent phía trên, dạng mảng | As-built, đáp ứng multi-intent (`intent_classifier.py`) |
| `FoodLogEntry.type` | `as_planned` \| `custom` | `schemas/food_log.py` |
| `FoodLogEntry.status` | `logged` \| `adjusted` | `adrs/009-food-log-scope-strategy.md` |
| `FoodLogEntry.slot` | `morning` \| `noon` \| `evening` | ADR-009, khớp UI 3-slot |
| `BodyMetricsEntry.recorded_by` | `patient` \| `doctor` | `models/body_metrics.py` |
| `PatientProfile.constraints_status` | `confirmed` \| `pending_doctor_review` | As-built, `specs/04-clinical-constraints.md` |

---

## Versioning

- Version hiện tại: **1.8**.
- **Changelog 1.7 → 1.8 (2026-08-24):** Food Log + compliance dùng ngày lịch **Asia/Ho_Chi_Minh** — `GET /food-log?date=` lọc theo cửa sổ UTC của ngày VN; `POST /food-log` upsert 1 log / user / ngày VN / slot; `FoodLogEntry.logged_at` serialize timezone-aware (naive DB = UTC). `GET /compliance/me` và `GET /doctor/patients/{id}/compliance` lấy `today` + gán food-log vào ngày VN (không còn `date.today()` UTC của container). Không đổi request shape / enum slot.
- **Changelog 1.6 → 1.7 (2026-08-23):** `POST /metrics` đổi từ insert-only sang upsert 1 entry patient/ngày (Asia/Ho_Chi_Minh); lần ghi sau merge field vào cùng `id`. Không đổi request/response shape — behavior change có chủ đích cho UI ghi chỉ số hàng ngày.
- **Changelog 1.5 → 1.6 (2026-08-23):** thêm Chat Sessions (`GET|POST /chat/sessions`, `GET|PATCH|DELETE /chat/sessions/{id}`, `DELETE /chat/sessions`, `PUT /chat/sessions/{id}/messages`) — role `patient` only; persist transcript UI + card payload trên Postgres; agent `/chat` vẫn stateless. Không breaking change cho client cũ (endpoint mới).
- **Changelog 1.4 → 1.5 (2026-08-23):** thêm as-built `GET /compliance/me?days=7` (role `patient`, response `PatientComplianceOut`) cho patient tự xem tuân thủ — tái dùng `ComplianceService` doctor; mở rộng enum intent chat/SSE với `weekly_compliance` | `doctor_note`; tham chiếu field `AgentRunOutput.weekly_compliance` / `.doctor_note` trong §11 Chat. Đồng bộ với `contracts/agent-io-schema.md` v1.5. Không breaking change.
- **Changelog 1.3 → 1.4 (2026-08-22):** dọn tag `[Planned]` còn sót trong body cho các mục đã as-built từ các đợt trước — `409 PLAN_ALREADY_REVIEWED` (optimistic lock review), `AgentRunOutput.secondary_intents[]`, `PatientProfile.constraints_status` (bảng Enum tham chiếu). Không đổi shape/behavior nào, chỉ sửa mô tả trạng thái cho khớp code.
- **Changelog 1.2 → 1.3 (2026-08-17):** thêm `DELETE /metrics/{id}` (patient xóa bản ghi chỉ số của mình); response 204, lỗi 404 `METRICS_NOT_FOUND`.
- **2026-08-18 (auth):** `POST /auth/forgot-password` gửi mật khẩu mới qua SMTP; `503 EMAIL_NOT_CONFIGURED` / `500 EMAIL_SEND_FAILED`. Rate-limit login as-built.
- **Changelog 1.1 → 1.2 (2026-08-17):** Food Log §12 as-built; thêm Patient Metrics History §13 (`POST /metrics`, `GET /metrics/history`); Health chuyển §14. `GET .../meal-plan-schedule`: `unassigned_plans` gồm cả `pending_review`; slot `past` cho plan đã hết tuần.
- **Changelog 1.0 → 1.1 (lịch sử, đã Done — không còn Planned):** khi phát hành 1.1 (2026-08-15), 9 mục dưới đây được đánh dấu `[Planned]`; tính đến 1.4 (2026-08-22) toàn bộ đã as-built, giữ lại nguyên văn để tham khảo lịch sử quyết định:
  1. `POST /auth/forgot-password`, `POST /auth/reset-password` + rate-limit `POST /auth/login` — Done.
  2. `PUT /doctor/patients/{id}/constraints` — Done; `POST /doctor/patients/{id}/constraints/approve` + `constraints_status` HITL — Done.
  3. `POST /meal-plans/{id}/request-adjustment` — Done. (Quyết định "persist meal plan sinh qua `/chat`" đã bị đảo — chat `meal_plan` chốt lại là read-only theo thiết kế, xem `specs/05` §5.)
  4. `InteractionCheckOutput.unmatched_pairs[]` — Done.
  5. `POST /doctor/meal-plans/{id}/review` optimistic lock + `409 PLAN_ALREADY_REVIEWED` — Done.
  6. `POST /doctor/patients/{id}/compliance/remind` với type `manual_reminder` — Done; threshold tuân thủ thấp vẫn là giá trị minh hoạ, chưa chốt số chính thức.
  7. `POST /chat` `secondary_intents[]` — Done.
  8. `POST /food-log` slot 3-giá-trị `morning|noon|evening` — Done.
  9. `PUT /doctor/patients/{id}/metrics` validation bắt buộc gửi đủ `weight`+`height` — Done.
  10. `POST /notifications/demo/simulate` idempotent theo `existing_types` — Done.
  11. `GET /doctor/foods` — Done (tra cứu món từ nutrition catalog DB cho UI chỉnh thực đơn).
  - Toàn bộ đều optional/không breaking với client hiện tại → minor bump (1.0 → 1.1) tại thời điểm đó.
- Mọi thay đổi endpoint/response phải bump version + note lý do, đồng bộ với `contracts/agent-io-schema.md` khi field Agent bị ảnh hưởng.
- Luật cứng: sửa contract trước, code sau.
