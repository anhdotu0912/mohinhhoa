# API v1 Contract — VMEC-10 (FE ↔ BE)

**Version:** 1.1 (2026-08-15 — bổ sung quyết định team sau vòng review đầu, xem changelog ở mục Versioning cuối file)
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

### `POST /auth/forgot-password` `[Planned]`
**Role:** Không cần auth. **Quyết định 2026-08-15:** cần trước khi mở khảo sát người dùng thật (`CLAUDE.md` Mục 11 — ≥5 responses), không chỉ demo nội bộ với tài khoản cố định.
```json
// Request
{ "email": "patient1@example.com" }
// Response 200 (luôn 200 dù email có tồn tại hay không — tránh lộ thông tin tồn tại email)
{ "message": "Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi." }
```

### `POST /auth/reset-password` `[Planned]`
**Role:** Không cần auth, dùng token gửi qua email ở bước trên.
```json
// Request
{ "token": "reset_token_string", "new_password": "matkhaumoi123" }
// Response 200
{ "message": "Đặt lại mật khẩu thành công." }
// Error 400 { "code": "INVALID_OR_EXPIRED_TOKEN", "detail": "Token không hợp lệ hoặc đã hết hạn." }
```

**Rate-limit `POST /auth/login` `[Planned]`:** quyết định 2026-08-15 — cần thêm giới hạn số lần thử đăng nhập sai (đề xuất: tối đa 5 lần/15 phút theo `email`+IP, sau đó `429 TOO_MANY_ATTEMPTS`) trước khi mở khảo sát người dùng thật.

---

## 2. Profile

### `POST /profile`
**Role:** `patient`. Upsert (1 user – 1 profile).
```json
// Request (mọi field optional/default, xem contracts/agent-io-schema.md §1)
{ "disease": ["diabetes_t2"], "medications": ["metformin"], "allergies": ["hải sản"], "bmi": 26.5, "weight": 72, "height": 170, "target_kcal": 1800, "restrictions": { "carb_per_meal": 45, "sodium_daily": 1500 }, "preferences": ["thích ăn cơm"] }
// Response 200 → PatientProfile (xem contracts/agent-io-schema.md §1)
```
**`[Planned]`, quyết định 2026-08-15:** nếu request thay đổi `target_kcal`/`restrictions` so với giá trị đang lưu, BE set `constraints_status="pending_doctor_review"` (giá trị mới vẫn áp dụng ngay cho lần generate kế tiếp, chỉ là cờ hiển thị cho doctor) — xem `contracts/agent-io-schema.md` §1 và `specs/04-clinical-constraints.md`.

### `GET /profile/me`
**Role:** `patient`. Response 200 → `PatientProfile`.

---

## 3. Clinical Constraints

Patient tự set `restrictions`/`target_kcal` qua `POST /profile` (as-built). Doctor set qua endpoint riêng bên dưới (as-built 2026-08-16). `PUT /doctor/patients/{id}/profile` **không** nhận `target_kcal`/`restrictions`.

**Quyết định 2026-08-16 (as-built):**
- **Ràng buộc doctor UI:** `target_kcal`, `salt_daily_g`, `sugar_daily_g` — khớp trang `frontend/app/doctor/patients/constraints/page.tsx`.
- **Schema `Restrictions`:** giữ song song `carb_per_meal`/`sodium_daily` (patient) + `salt_daily_g`/`sugar_daily_g` (doctor). Meal planner dùng `effective_sodium_mg = min(sodium_daily, salt_daily_g * 400)` khi cả hai có giá trị.
- **`protein_daily_g`:** bỏ khỏi scope ràng buộc (Won't Have MVP này).

**Deferred `[Planned]`:**
- **HITL `constraints_status`:** patient tự sửa → `pending_doctor_review`; doctor approve qua endpoint riêng — chưa implement trong MVP này.
- **`POST /doctor/patients/{id}/constraints/approve`:** deferred cùng HITL.

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

### `POST /doctor/patients/{patient_id}/constraints/approve` `[Planned]` (deferred)
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

### `POST /meal-plans/{meal_plan_id}/request-adjustment` `[Planned]`
**Role:** `patient`, chỉ chủ plan. **Quyết định 2026-08-15:** patient có thể yêu cầu điều chỉnh 1 plan đã `approved`, nhưng yêu cầu **phải qua bác sĩ duyệt lại** — không tự động regenerate. Tái sử dụng luồng review sẵn có: set `status` plan về lại `"pending_review"` kèm `adjustment_note`, plan sẽ xuất hiện lại trong `GET /doctor/meal-plans` (default filter) để doctor xử lý qua `POST /doctor/meal-plans/{id}/review` như bình thường.
```json
// Request
{ "adjustment_note": "Tôi không ăn được nhiều rau ngót, xin đổi món khác cho ngày 3." }
// Response 200 → MealPlanOutput (status="pending_review", adjustment_note lưu lại)
// Error 400 { "code": "PLAN_NOT_APPROVED", "detail": "Chỉ yêu cầu điều chỉnh trên thực đơn đã được duyệt." } — khi plan đang pending_review/rejected/edited
```

**Ghi chú đồng bộ persist qua `/chat` (quyết định 2026-08-15):** meal plan sinh qua `POST /chat` (intent `meal_plan`) **phải được persist** vào bảng `meal_plans` giống `POST /meal-plans/generate` (đóng gap as-built đã ghi ở `contracts/agent-io-schema.md` §5.2) — `meal_plan_id` trả về từ `/chat` phải dùng lại được với `GET /meal-plans/{id}`. Đây là thay đổi hành vi **Planned**, chưa implement.

---

## 5. Interactions

### `POST /interactions/check`
**Role:** `patient`. Kiểm tra ad-hoc (không gắn plan cụ thể).
```json
// Request
{ "medications": ["warfarin"], "foods": ["rau muống", "bưởi"], "profile_user_id": null }
// Response 200 (khi DEMO_MOCK=true) → InteractionCheckOutput (xem contracts/agent-io-schema.md §6, gồm unmatched_pairs[] [Planned])
// Error 501 (khi DEMO_MOCK=false)
{ "code": "INTERACTION_CHECK_NOT_READY", "detail": "InteractionCheckerAgent chưa sẵn sàng. Bật DEMO_MOCK hoặc chờ BE1 hoàn thiện." }
```
Mỗi interaction phát hiện được cũng tự động tạo 1 `Alert` (persist DB) + có thể tạo `Notification(type="interaction_followup")` nếu severity ∈ `{Nguy hiểm, Cần chú ý}`. **Quyết định 2026-08-15:** cặp `drug`×`food` không tìm thấy dữ liệu trong KB phải xuất hiện trong `unmatched_pairs[]` (`[Planned]`) — không im lặng bỏ qua như as-built hiện tại.

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

---

## 9. Doctor Review

### `GET /doctor/meal-plans`
**Role:** `doctor`. Query `status` (default `"pending_review"`, dùng `"all"` để lấy hết).
```json
// Response 200 → list[MealPlanOutput]
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
// Error 409 [Planned] (plan không còn ở pending_review) { "code": "PLAN_ALREADY_REVIEWED", "detail": "Thực đơn này đã được xử lý (status hiện tại: approved). Tải lại danh sách để xem trạng thái mới nhất." }
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

---

## 11. Chat

### `POST /chat`
**Role:** `patient` **hoặc** `doctor` (cả 2 role được phép gọi, khác với hầu hết endpoint patient-only khác).
```json
// Request
{ "message": "Tôi bị tiểu đường, hôm nay nên ăn gì?" }
// Response 200 → AgentRunOutput (xem contracts/agent-io-schema.md §5.2, gồm secondary_intents[] [Planned])
// Error 503 { "code": "AGENT_ERROR", "detail": "Lỗi xử lý agent: ..." }
```
**Multi-intent `[Planned]`, quyết định 2026-08-15:** `intent_classifier` cần nâng cấp để phát hiện ý định phụ trong câu hỏi ghép (ví dụ vừa hỏi lập thực đơn vừa hỏi tương tác thuốc) — trả về qua `secondary_intents[]`, không xử lý song song đầy đủ, chỉ để `message` gợi ý người dùng hỏi lại riêng ý định phụ đó.

---

## 12. Food Log `[Planned]`

Chưa tồn tại as-built (`routes_food_log.py`/`models/food_log.py` là placeholder, không mount trong `main.py`). Thiết kế đề xuất theo `adrs/009-food-log-scope-strategy.md`, xem `specs/09-food-log-adherence.md`.

### `POST /food-log` `[Planned]`
**Role:** `patient`.
```json
// Request
{ "meal_plan_id": "plan_uuid", "day_index": 3, "slot": "noon", "type": "custom", "note": "Ăn phở bò ngoài quán" }
// Response 200 → FoodLogEntry (xem contracts/agent-io-schema.md §3)
```
**Quyết định 2026-08-15:** `slot` dùng đúng 3-giá-trị theo UI (`"morning" | "noon" | "evening"`), **không** dùng 4-slot của meal plan — xem `contracts/agent-io-schema.md` §3 và `adrs/009-food-log-scope-strategy.md`.

### `GET /food-log` `[Planned]`
**Role:** `patient`. Query optional `date`/`meal_plan_id`.
```json
// Response 200 → list[FoodLogEntry]
```

---

## 13. Health

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
| Agent intent (`AgentRunOutput.intent`) | `meal_plan` \| `interaction_check` \| `food_log` \| `rag_qa` \| `refuse` \| `unknown` | `agents/nodes/intent_classifier.py::VALID_INTENTS` |
| `AgentRunOutput.secondary_intents[]` `[Planned]` | cùng enum intent phía trên, dạng mảng | Quyết định 2026-08-15, đáp ứng multi-intent |
| `FoodLogEntry.type` `[Planned]` | `as_planned` \| `custom` | Đề xuất, theo `frontend/app/patient/meals/log/page.tsx` |
| `FoodLogEntry.status` `[Planned]` | `logged` \| `adjusted` | Đề xuất, `adrs/009-food-log-scope-strategy.md` |
| `FoodLogEntry.slot` `[Planned]` | `morning` \| `noon` \| `evening` | Quyết định 2026-08-15, khớp UI 3-slot (khác 4-slot meal plan) |
| `PatientProfile.constraints_status` `[Planned]` | `confirmed` \| `pending_doctor_review` | Quyết định 2026-08-15, `specs/04-clinical-constraints.md` |

---

## Versioning

- Version hiện tại: **1.1**.
- **Changelog 1.0 → 1.1 (2026-08-15) — tổng hợp quyết định team sau vòng review đầu:**
  1. Thêm `POST /auth/forgot-password`, `POST /auth/reset-password` `[Planned]` + rate-limit `POST /auth/login` `[Planned]`.
  2. `PUT /doctor/patients/{id}/constraints` as-built (`target_kcal`, `salt_daily_g`, `sugar_daily_g`); `POST /doctor/patients/{id}/constraints/approve` + `constraints_status` HITL vẫn `[Planned]`/deferred.
  3. Thêm `POST /meal-plans/{id}/request-adjustment` `[Planned]`; ghi nhận quyết định persist meal plan sinh qua `/chat`.
  4. `InteractionCheckOutput` thêm `unmatched_pairs[]` `[Planned]`.
  5. `POST /doctor/meal-plans/{id}/review` thêm optimistic lock + `409 PLAN_ALREADY_REVIEWED` `[Planned]`.
  6. `POST /doctor/patients/{id}/compliance/remind` đổi type notification sang `manual_reminder` (mới) `[Planned]`; threshold tuân thủ thấp thành config value.
  7. `POST /chat` thêm `secondary_intents[]` `[Planned]` cho multi-intent.
  8. `POST /food-log` đổi `slot` sang 3-giá-trị `morning|noon|evening` `[Planned]`.
  9. `PUT /doctor/patients/{id}/metrics` thêm validation bắt buộc gửi đủ `weight`+`height` `[Planned]`.
  10. `POST /notifications/demo/simulate` — ghi nhận cần sửa lại cho idempotent hơn `[Planned fix]`.
  11. Thêm `GET /doctor/foods` — tra cứu món từ nutrition catalog DB cho UI chỉnh thực đơn.
  - Toàn bộ đều optional/không breaking với client hiện tại → minor bump (1.0 → 1.1).
- Mọi thay đổi endpoint/response phải bump version + note lý do, đồng bộ với `contracts/agent-io-schema.md` khi field Agent bị ảnh hưởng.
- Luật cứng: sửa contract trước, code sau.
