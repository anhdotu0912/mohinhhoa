# API v1 Contract — VinNutri (FE ↔ BE)

**Version:** 1.30 (2026-11-17 — proxy cùng origin giữa frontend và backend được bảo vệ)
**Base URL:** tất cả endpoint dưới đây (trừ Health và URL ảnh `/static/avatars/...`) có prefix `/api/v1`.
**Nguồn sự thật:** `backend/app/api/v1/*.py`, `backend/app/main.py` (danh sách router thật được mount).
**Luật bắt buộc:** sửa contract này trước, code sau. Field/schema nhắc ở đây phải khớp `contracts/agent-io-schema.md`.
**Đánh dấu trạng thái:** endpoint không ghi gì = **as-built, đang hoạt động**. Endpoint có nhãn `[Planned]` = chưa tồn tại trong code, là thiết kế đề xuất cho spec liên quan.

**Vercel:** frontend có thể dùng cùng origin cho `/api/v1/*` và `/static/avatars/*`. Route Handler chuyển tiếp tới `BACKEND_API_URL` ở server, giữ JWT, payload, status và stream SSE; khóa `BACKEND_PROTECTION_BYPASS_SECRET` chỉ dùng ở server để xác thực lớp bảo vệ Vercel của backend. Không đưa khóa này vào bundle trình duyệt. Response không cache dữ liệu người dùng; payload API không đổi.

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
// Response 200 (doctor)
{ "id": "user_uuid", "email": "demo_doctor@example.com", "role": "doctor", "full_name": "BS. Minh", "avatar": "/static/avatars/demo_doctor.jpg", "assigned_doctor": null }
// Response 200 (patient đã được nhận)
{
  "id": "user_uuid",
  "email": "patient1@example.com",
  "role": "patient",
  "full_name": "Nguyễn Văn A",
  "avatar": null,
  "assigned_doctor": { "id": "demo_doctor", "full_name": "BS. Minh", "avatar": null }
}
```
`full_name` / `avatar` có thể `null`. `assigned_doctor` luôn `null` với role `doctor`; với patient chưa ai nhận cũng `null` (FE hiện “Đang chờ bác sĩ nhận”). Trong lúc chuyển bác sĩ chưa được nhận, `assigned_doctor` vẫn là bác sĩ cũ.

### `PATCH /auth/me` (as-built 2026-08-28)
**Role:** Bất kỳ user đã đăng nhập (`patient` hoặc `doctor`). Cập nhật tên hiển thị. Bác sĩ dùng trên `/doctor/profile`; bệnh nhân có thể dùng sau — hiện FE bệnh nhân chưa nối field này.
```json
// Request
{ "full_name": "BS. Minh" }
// Response 200 → UserMeResponse (cùng shape `GET /auth/me`)
```
`full_name` gửi `""` hoặc chỉ khoảng trắng → lưu `null`. Email / role / avatar không đổi qua endpoint này (ảnh dùng `POST /auth/me/avatar`).

### `POST /auth/me/avatar`
**Role:** Bất kỳ user đã đăng nhập (`patient` hoặc `doctor`). Multipart form upload (`file`), ảnh ≤ 2MB, mime `image/*` (png/jpg/webp/gif — kiểm tra magic bytes). Bệnh nhân tự tải ảnh đại diện trên `/patient/profile`; bác sĩ tải hộ bệnh nhân vẫn dùng `POST /doctor/patients/{id}/avatar`.
```json
// Response 200
{ "avatar": "/static/avatars/<user_id>.png" }
// Error 415 { "code": "INVALID_IMAGE", "detail": "File phải là ảnh (png/jpg/webp/gif)." }
// Error 413 { "code": "IMAGE_TOO_LARGE", "detail": "Ảnh tối đa 2MB." }
```

`GET /static/avatars/{filename}` (không có prefix `/api/v1`) trả bytes ảnh với MIME đã xác thực; không tìm thấy trả 404. Khi `AVATAR_STORAGE=database`, bytes ảnh lưu trong PostgreSQL để không mất khi function khởi động lại; URL upload không đổi. Chế độ `local` tiếp tục phục vụ file như trước.

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

Cần `SMTP_USERNAME` + `SMTP_PASSWORD` (App Password). Host Gmail mặc định trong code (xem README.md — mục Troubleshooting / Quên mật khẩu).

### `POST /auth/reset-password` (as-built 2026-08-18)
**Role:** Không cần auth, dùng token gửi qua email ở bước trên.
```json
// Request
{ "token": "reset_token_string", "new_password": "matkhaumoi123" }
// Response 200
{ "message": "Đặt lại mật khẩu thành công." }
// Error 400 { "code": "INVALID_OR_EXPIRED_TOKEN", "detail": "Token không hợp lệ hoặc đã hết hạn." }
```

### `POST /auth/change-password` (as-built 2026-08-27)
**Role:** Bất kỳ user đã đăng nhập (`patient` hoặc `doctor`). Đổi mật khẩu khi biết mật khẩu hiện tại — khác luồng quên mật khẩu. Bệnh nhân dùng form trên `/patient/profile`.
```json
// Request
{ "current_password": "matkhau123", "new_password": "matkhaumoi123" }
// Response 200
{ "message": "Đổi mật khẩu thành công." }
// Error 401 { "code": "INVALID_CREDENTIALS", "detail": "Mật khẩu hiện tại không đúng." }
// Error 400 { "code": "SAME_PASSWORD", "detail": "Mật khẩu mới phải khác mật khẩu hiện tại." }
```
`new_password` tối thiểu 8 ký tự (422 nếu thiếu). Rate-limit 5 lần thử sai / 15 phút theo `email`+IP → `429 TOO_MANY_ATTEMPTS`. JWT hiện tại vẫn còn hạn đến `exp` (prototype không thu hồi session).

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
**Field bệnh nhân ghi ngay:** `disease`, `medications`, `allergies`, chỉ số cơ thể (`bmi`/`weight`/`height`/`age`/`gender`), liên hệ, `preferences`.

`POST /profile` nhận thêm `full_name?: string | null` (tối đa 255 ký tự) và `email?: string` (email hợp lệ, tối đa 255 ký tự). Chỉ cập nhật tài khoản của bệnh nhân đang đăng nhập; bỏ qua trường không gửi, `full_name=null`/rỗng xóa tên, email không được rỗng/null. Email chuẩn hóa trim/lowercase, trùng tài khoản khác trả `409 EMAIL_EXISTS`. Lưu tài khoản và hồ sơ trong cùng transaction; lỗi không lưu dở một phần. Response vẫn `PatientProfile`; tên/email mới đọc qua `GET /auth/me`. Token theo user id tiếp tục dùng được. `/patient/profile` là nơi chỉnh thông tin cá nhân; trang chi tiết bác sĩ chỉ hiển thị thông tin này, không có form chỉnh sửa hồ sơ chung. API bác sĩ cũ còn giữ để tương thích luồng khởi tạo bệnh nhân hiện có; không sử dụng ở trang chi tiết.

**Field lâm sàng — đề xuất, không có hiệu lực tới khi bác sĩ duyệt (2026-08-29):** `target_kcal`, `restrictions`, `treatment_goals`. Nếu request khác giá trị hiệu lực đang lưu, BE ghi vào `proposed_target_kcal` / `proposed_restrictions` / `proposed_treatment_goals` và set `constraints_status="pending_doctor_review"`. Response `target_kcal`/`restrictions`/`treatment_goals` **vẫn là giá trị đã duyệt**; `proposed_*` phản ánh đề xuất. `meal_planner_agent` chỉ đọc cột hiệu lực.

### `GET /profile/me`
**Role:** `patient`. Response 200 → `PatientProfile`.

---

## 3. Clinical Constraints

Patient **đề xuất** `restrictions`/`target_kcal`/`treatment_goals` qua `POST /profile` (lưu `proposed_*`, không ghi đè cột hiệu lực). Doctor set giá trị hiệu lực qua endpoint riêng bên dưới (as-built 2026-08-16). `PUT /doctor/patients/{id}/profile` **không** nhận `target_kcal`/`restrictions`.

**Quyết định 2026-08-16 (as-built):**
- **Ràng buộc doctor UI:** `target_kcal`, `carb_per_meal`, `sodium_daily`, `salt_daily_g`, `sugar_daily_g`, `treatment_goals` — cùng bộ chỉ số với hồ sơ bệnh nhân.
- **Schema `Restrictions`:** giữ song song `carb_per_meal`/`sodium_daily` (patient) + `salt_daily_g`/`sugar_daily_g` (doctor). Meal planner dùng `effective_sodium_mg = min(sodium_daily, salt_daily_g * 400)` khi cả hai có giá trị.
- **`protein_daily_g`:** bỏ khỏi scope ràng buộc (Won't Have MVP này).

**HITL as-built (cập nhật 2026-08-29):** patient đề xuất `target_kcal`/`restrictions`/`treatment_goals` → `pending_doctor_review` + `proposed_*`; cột hiệu lực không đổi. Doctor approve chép proposed → hiệu lực; hoặc `PUT .../constraints` ghi hiệu lực ngay và hủy đề xuất.

### `PUT /doctor/patients/{patient_id}/constraints` (as-built)
**Role:** `doctor`. Partial update — chỉ field gửi lên mới bị ghi đè.
```json
// Request (flat — không bọc trong restrictions)
{
  "target_kcal": 1700,
  "carb_per_meal": 45,
  "sodium_daily": 1500,
  "salt_daily_g": 4.5,
  "sugar_daily_g": 20,
  "treatment_goals": ["Kiểm soát đường huyết ổn định (HbA1c < 7%)."]
}
// Response 200 → DoctorPatientSummary (cột hiệu lực đã cập nhật, proposed_* = null)
// Error 404 PATIENT_NOT_FOUND — bệnh nhân không tồn tại
// Error 422 — field ngoài range:
//   target_kcal 800–4000; carb_per_meal 0–200 g; sodium_daily 0–5000 mg;
//   salt_daily_g 0–15 g; sugar_daily_g 0–100 g;
//   treatment_goals: mỗi mục 3–80 ký tự, tối đa 12 mục
```

`POST /profile` dùng **cùng range** cho `target_kcal` / `restrictions` / `treatment_goals` (đề xuất). Field `null`/omit vẫn hợp lệ (onboarding không gửi lâm sàng).

### `POST /doctor/patients/{patient_id}/constraints/approve` (as-built 2026-08-18, cập nhật 2026-08-29)
**Role:** `doctor`. Áp dụng đề xuất ràng buộc mà **patient gửi** trước đó: chép `proposed_*` sang cột hiệu lực, xóa proposed, `constraints_status` `"pending_doctor_review"` → `"confirmed"`.
```json
// Request: rỗng (không cần body)
// Response 200 → PatientProfile (constraints_status="confirmed", proposed_* = null, target_kcal/restrictions/treatment_goals = giá trị vừa duyệt)
// Error 400 { "code": "NOTHING_TO_APPROVE", "detail": "Không có thay đổi nào đang chờ duyệt." } — khi constraints_status đã là "confirmed"
```

---

## 4. Meal Plans

**Luồng sản phẩm (2026-11-03):** bệnh nhân tạo bản dự thảo bằng AI từ `/patient/meal-plan` → `pending_review` → bác sĩ xem/chỉnh sửa/duyệt trong hàng việc → bác sĩ áp dụng kế hoạch đã duyệt. Bệnh nhân xem trước bản dự thảo có nhãn rõ ràng; không ghi nhận tuân thủ hay áp dụng bản chưa duyệt. Chat chỉ đọc thực đơn và dẫn tới trang tạo, không âm thầm tạo bản mới.

`MealPlanOutput.review_notes` optional (`string | null`, mặc định `null`) trả ghi chú bác sĩ từ review đã lưu, để bệnh nhân đọc lý do từ chối. Không dùng `adjustment_note` của bệnh nhân thay cho phản hồi bác sĩ. Đồng bộ agent I/O v1.15.

### `POST /meal-plans/generate`
**Role:** `patient`. Luôn sinh 7 ngày, `status` khởi tạo `"pending_review"`. **Không** materialize `meal_reminder`/`adherence_checkin` tại thời điểm này — các nhắc nhở chỉ được tạo khi doctor `apply` (xem §9).
```json
// Error 409 { "code": "PLAN_ALREADY_PENDING" | "PLAN_UNASSIGNED_APPROVED" }
```
**Giới hạn cứng (2026-08-27):** tối đa 1 plan `pending_review` và 1 plan `approved|edited` chưa có `starts_on` / mỗi bệnh nhân — phải duyệt/áp dụng/xóa trước khi tạo mới.
```json
// Request (optional body)
{ "notes": "Bệnh nhân thích ăn cá", "priorities": ["giảm natri"] }
// Response 200 → MealPlanOutput (xem contracts/agent-io-schema.md §2)
```

### `GET /meal-plans/me`
**Role:** `patient`. Ưu tiên plan đang áp dụng → sắp áp dụng → bản hiện tại chưa quá chu kỳ. Không trả bản đã vào `history_plans`; nếu chỉ có lịch sử thì `404 NO_MEAL_PLAN`. Đồng bộ nhắc vòng đời lịch như `GET /notifications`, độc lập với bản được chọn trả về.
```json
// Response 200 → MealPlanOutput
// Error 404
{ "code": "NO_MEAL_PLAN", "detail": "Bạn chưa có thực đơn nào." }
```

### `GET /meal-plans/schedule`
**Role:** `patient`. Lịch tuần thực đơn của chính mình — cùng schema với `GET /doctor/patients/{patient_id}/meal-plan-schedule` (ADR-012); `patient_id` trong response = `user_id` của patient đang đăng nhập.

`latest_plan: MealPlanOutput | null` (optional, mặc định `null`) là bản được tạo gần nhất, kể cả khi bị từ chối. Dùng theo dõi kết quả duyệt bản AI mới trong khi `active_plan` vẫn là thực đơn đang áp dụng; không thay thế `active_plan` bằng bản chưa duyệt.

`history_plans: MealPlanOutput[]` (optional, mặc định `[]`) chứa lịch đã kết thúc và bản chưa áp dụng đã quá chu kỳ 7 ngày kể từ ngày tạo tại Việt Nam (`created_at`, fallback `reviewed_at`). Các bản này được giữ nguyên nội dung/trạng thái kiểm duyệt để xem trong **Nhật ký**, không nằm trong `unassigned_plans` và không chặn `POST /meal-plans/generate`. Không tự gán ngày áp dụng cho bản chưa từng được áp dụng. Bản chờ duyệt/chờ áp dụng còn trong chu kỳ vẫn chặn tạo trùng. Trang **Tạo thực đơn** chỉ hiển thị bản hiện tại; không lấy `latest_plan` trong lịch sử làm fallback. Khi chưa có bản hiện tại, hiển thị “Bạn chưa tạo thực đơn cho chu kỳ mới” cùng hành động tạo mới và lối mở Nhật ký.

**Kết thúc chu kỳ:** lịch 7 ngày tính theo `starts_on…ends_on`, bao gồm trọn ngày cuối tại Việt Nam (UTC+7). Từ 00:00 ngày kế tiếp, plan cũ nằm trong slot `occupancy="past"`, giao diện ghi **Hoàn thành**, chỉ xem lại; không tự gia hạn, không đổi trạng thái kiểm duyệt `approved|edited`, không xóa lịch sử. Endpoint này cũng đồng bộ thông báo kết thúc chu kỳ.
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
**Role:** `doctor`. **Ngừng hỗ trợ khởi tạo từ phía bác sĩ (2026-11-03).** Sau khi kiểm tra bệnh nhân thuộc quyền quản lý, trả `403 PATIENT_GENERATION_REQUIRED`. Bác sĩ xem, chỉnh sửa và duyệt bản AI do bệnh nhân khởi tạo; endpoint được giữ để client cũ nhận thông báo rõ ràng.
```json
// Request (optional body, giống GenerateMealPlanRequest)
{ "notes": "", "priorities": [] }
// Error 403 { "code": "PATIENT_GENERATION_REQUIRED", "detail": "Bệnh nhân khởi tạo thực đơn AI. Bác sĩ kiểm tra, chỉnh sửa và duyệt bản dự thảo." }
// Error 404 { "code": "PATIENT_NOT_FOUND", "detail": "Không tìm thấy bệnh nhân." }
```

### `POST /meal-plans/request` (as-built 2026-08-24)
**Role:** `patient`. **Legacy:** lưu yêu cầu cũ trên `profiles`, không tự sinh thực đơn. Giao diện mới gọi `POST /meal-plans/generate` để bệnh nhân khởi tạo bản AI trực tiếp; không gửi thêm yêu cầu cho bác sĩ tạo.
```json
// Request (optional body)
{ "note": "Tôi mới hoàn tất hồ sơ, mong bác sĩ lập thực đơn tuần này." }
// Response 200 → MealPlanRequestOut
{
  "status": "pending",
  "note": "Tôi mới hoàn tất hồ sơ, mong bác sĩ lập thực đơn tuần này.",
  "requested_at": "2026-08-24T10:30:00Z"
}
// Error 400 { "code": "PLAN_ALREADY_PENDING", "detail": "Bạn đã có thực đơn đang chờ bác sĩ duyệt." }
```
- Cho phép khi chưa có plan đã apply (`plan_usage=none`) hoặc plan đã hết hạn (`finished`). Chặn khi đã có plan `pending_review`.
- Gửi lại khi `status=pending`: idempotent `200`, giữ `note`/`requested_at` cũ.
- Khi patient `POST /meal-plans/generate` thành công → BE tự reset cờ yêu cầu legacy `meal_plan_request_status` về `"none"`.

### `GET /meal-plans/request`
**Role:** `patient`. Trạng thái yêu cầu hiện tại của chính mình.
```json
// Response 200 → MealPlanRequestOut (status "none" | "pending")
{ "status": "none", "note": null, "requested_at": null }
```

### `POST /meal-plans/{meal_plan_id}/request-adjustment` (as-built 2026-08-18)
**Role:** `patient`, chỉ chủ plan. **Quyết định 2026-08-15:** patient có thể yêu cầu điều chỉnh 1 plan đã `approved`, nhưng yêu cầu **phải qua bác sĩ duyệt lại** — không tự động regenerate. Tái sử dụng luồng review sẵn có: set `status` plan về lại `"pending_review"` kèm `adjustment_note`, plan sẽ xuất hiện lại trong `GET /doctor/meal-plans` (default filter) để doctor xử lý qua `POST /doctor/meal-plans/{id}/review` như bình thường.
```json
// Request
{ "adjustment_note": "Tôi không ăn được nhiều rau ngót, xin đổi món khác cho ngày 3." }
// Response 200 → MealPlanOutput (status="pending_review", adjustment_note lưu lại)
// Error 400 { "code": "PLAN_NOT_APPROVED", "detail": "Chỉ yêu cầu điều chỉnh trên thực đơn đã được duyệt." } — khi plan đang pending_review/rejected/edited
```

**Ghi chú `/chat` intent `meal_plan` (read-only):** chat **không** sinh/persist thực đơn mới. Chỉ đọc plan có sẵn trong DB và trả `meal_preview` + `meal_plan_id` của plan đang xem. Bệnh nhân tạo plan qua `POST /meal-plans/generate` tại `/patient/meal-plan`.

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

**Plan lifecycle notifications (lazy):** `GET /notifications`, `GET /meal-plans/me` và `GET /meal-plans/schedule` đồng bộ `plan_expiring` cho lịch đang áp dụng và `plan_expired` cho lịch vừa hoàn thành gần nhất; không phụ thuộc vào việc có bản dự thảo mới hay đã mở `/me`. Chỉ xét plan `approved|edited` đã có `starts_on` và `ends_on`; ngày cuối vẫn là `expiring`, chỉ `expired` khi `today > ends_on` theo ngày Việt Nam. Mỗi `meal_plan_id` + type chỉ tạo một lần, kể cả đã đọc/bỏ qua. `plan_expired` có tiêu đề “Đã hoàn thành thực đơn 7 ngày”; khi chưa chuẩn bị bản kế tiếp, nội dung nhắc tạo mới và `payload` có `{action_url:"/patient/meal-plan", action_label:"Tạo thực đơn mới"}`. Nếu đã có bản mới đang chờ duyệt/chờ áp dụng hoặc lịch tiếp nối, hướng dẫn theo dõi bản đó thay vì tạo trùng. Giao diện tự cập nhật khi qua ngày và khi quay lại cửa sổ; không gửi email/push ngoài ứng dụng.
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

**Phân công 1–1 (1.14):** mỗi bệnh nhân có tối đa một `assigned_doctor_id`. Bác sĩ chỉ xem/sửa bệnh nhân đang gắn với mình. Bệnh nhân tự `POST /auth/register` → chưa gắn (hàng chờ nhận). Bác sĩ `POST /doctor/patients` → gắn ngay vào bác sĩ đó. Chuyển bác sĩ = tạo `patient_transfers` pending; quyền chỉ đổi khi bác sĩ đích `POST /doctor/transfers/{id}/accept`.

### `GET /doctor/patients`
**Role:** `doctor`. Query optional: `q`, `status` (`status_key`), `plan_usage` (`none` \| `active` \| `finished`), `meal_plan_request` (`pending` \| `all`, default `all`).
Chỉ trả bệnh nhân `assigned_doctor_id` = bác sĩ đang đăng nhập — **không** còn trả toàn bộ `role=patient`.
```json
// Response 200 → list[DoctorPatientSummary]
// DoctorPatientSummary thêm: active_plan_id, active_plan_status, plan_starts_on, plan_usage,
//   meal_plan_request_status ("none" | "pending"), meal_plan_request_note, meal_plan_requested_at,
//   pending_transfer (null | { id, to_doctor_id, to_doctor_name, created_at })
```

### `POST /doctor/patients`
**Role:** `doctor`. Tạo tài khoản bệnh nhân hộ và **gắn ngay** vào bác sĩ đang đăng nhập (`signup_channel=doctor`). Không tạo việc chờ nhận.
```json
// Request
{ "email": "new.patient@example.com", "password": "matkhau123", "full_name": "Nguyễn Văn A" }
// Response 201 → DoctorPatientSummary
// Error 409 { "code": "EMAIL_EXISTS", "detail": "Email đã được đăng ký." }
```
`full_name` optional. `password` min 8. Sau 201 bác sĩ có thể gọi tiếp `PUT .../profile` / `metrics` / `avatar` như luồng thêm hộ hiện có.

### `GET /doctor/claim-queue`
**Role:** `doctor`. Hàng chờ nhận: bệnh nhân chưa gắn (tự đăng ký + pool cũ) **và** đề xuất chuyển tới bác sĩ này.
```json
// Response 200 → list[ClaimQueueItem]
{
  "kind": "unassigned",
  "source": "self_register",
  "patient_id": "user_uuid",
  "patient": { /* DoctorPatientSummary */ },
  "transfer_id": null,
  "from_doctor_id": null,
  "from_doctor_name": null,
  "created_at": "2026-08-28T05:00:00"
}
```
`kind` ∈ `{unassigned, transfer}`. `source` ∈ `{self_register, unassigned_pool, transfer}`. Item `transfer` có `transfer_id` + `from_doctor_*`. Không cấp quyền hồ sơ cho đến khi nhận thành công.

### `POST /doctor/patients/{patient_id}/claim`
**Role:** `doctor`. Nhận bệnh nhân **chưa gắn**. Ai gọi trước thì nhận.
```json
// Response 200 → DoctorPatientSummary (đã gắn vào caller)
// Error 404 { "code": "PATIENT_NOT_FOUND", "detail": "Không tìm thấy bệnh nhân." }
// Error 409 { "code": "ALREADY_ASSIGNED", "detail": "Bệnh nhân đã được bác sĩ khác nhận." }
```
Gọi lại khi đã là bác sĩ quản lý → 200 idempotent.

### `GET /doctor/colleagues`
**Role:** `doctor`. Danh sách bác sĩ khác (để chọn khi chuyển). Không gồm chính mình.
```json
// Response 200
[{ "id": "demo_doctor_2", "full_name": "BS. Lan", "email": "demo_doctor_2@example.com", "avatar": null }]
```

### `POST /doctor/patients/{patient_id}/transfer`
**Role:** `doctor` đang quản lý bệnh nhân. Gửi đề xuất chuyển; quyền chưa đổi cho đến khi bác sĩ đích nhận.
```json
// Request
{ "to_doctor_id": "demo_doctor_2" }
// Response 200
{ "id": "xfer_uuid", "patient_id": "...", "from_doctor_id": "...", "to_doctor_id": "demo_doctor_2", "status": "pending", "to_doctor_name": "BS. Lan", "created_at": "..." }
// Error 400 { "code": "INVALID_TRANSFER", "detail": "Không thể chuyển cho chính mình." }
// Error 404 PATIENT_NOT_FOUND | DOCTOR_NOT_FOUND
```
Một bệnh nhân chỉ có **một** transfer `pending` — gửi mới sẽ huỷ pending cũ.

### `POST /doctor/transfers/{transfer_id}/accept`
**Role:** `doctor` = `to_doctor_id` của transfer pending.
```json
// Response 200 → DoctorPatientSummary (bệnh nhân đã gắn vào caller)
// Error 404 { "code": "TRANSFER_NOT_FOUND", "detail": "Không tìm thấy đề xuất chuyển." }
// Error 409 { "code": "TRANSFER_NOT_PENDING", "detail": "Đề xuất chuyển không còn hiệu lực." }
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
**Role:** `doctor` đang quản lý bệnh nhân đó. Response 200 → `DoctorPatientSummary`. Error 404 `PATIENT_NOT_FOUND` (cả khi bệnh nhân tồn tại nhưng thuộc bác sĩ khác — không lộ sự tồn tại).

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

### `GET /doctor/profile` (as-built 2026-08-29)
**Role:** `doctor`. Lấy thông tin tài khoản, hồ sơ chuyên môn và số liệu thống kê lâm sàng của bác sĩ đang đăng nhập.
```json
// Response 200 → DoctorProfileResponse
{
  "user_id": "doc_uuid",
  "email": "doctor@example.com",
  "full_name": "BS. CKI Nguyễn Văn Bình",
  "role": "doctor",
  "avatar": "/static/avatars/doc_uuid.png",
  "profile": {
    "title": "BS. CKI",
    "specialties": ["Dinh dưỡng lâm sàng", "Nội tiết & Đái tháo đường"],
    "license_number": "CCHN-012345/BYT",
    "workplace": "Khoa Dinh dưỡng & Tiết chế — Bệnh viện Đa khoa Quốc tế Vinmec",
    "years_of_experience": 12,
    "bio": "Chuyên gia dinh dưỡng lâm sàng với hơn 10 năm kinh nghiệm điều trị và xây dựng phác đồ tiết chế bệnh lý chuyển hoá.",
    "phone": "0912345678",
    "accepting_patients": true,
    "consultation_hours": "08:00 - 17:00 (Thứ 2 - Thứ 6)",
    "emergency_contact": "Khoa Cấp cứu / Trực ban Dinh dưỡng"
  },
  "stats": {
    "total_patients": 15,
    "approved_plans": 42,
    "confirmed_constraints": 18,
    "average_compliance": 82.5
  }
}
```

### `PUT /doctor/profile` (as-built 2026-08-29)
**Role:** `doctor`. Cập nhật thông tin chuyên môn và/hoặc tên hiển thị của bác sĩ đang đăng nhập.
```json
// Request (mọi field optional)
{
  "full_name": "BS. CKI Nguyễn Văn Bình",
  "title": "BS. CKI",
  "specialties": ["Dinh dưỡng lâm sàng", "Nội tiết & Đái tháo đường"],
  "license_number": "CCHN-012345/BYT",
  "workplace": "Khoa Dinh dưỡng & Tiết chế — BV Vinmec",
  "years_of_experience": 12,
  "bio": "Tiểu sử cập nhật...",
  "phone": "0912345678",
  "accepting_patients": true,
  "consultation_hours": "08:00 - 17:00 (Thứ 2 - Thứ 6)",
  "emergency_contact": "Hotline khoa"
}
// Response 200 → DoctorProfileResponse (cùng shape GET /doctor/profile)
```

---

## 9. Doctor Review

### `GET /doctor/meal-plans`
**Role:** `doctor`. Query `status` (default `"pending_review"`, dùng `"all"` để lấy hết). Chỉ thực đơn của bệnh nhân đang gắn với bác sĩ này.
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
// Request (preferred — apply_mode resolves start_date server-side)
{ "apply_mode": "from_today" }
{ "apply_mode": "after_current" }
// Legacy request
{ "start_date": "2026-08-16", "replace_active": true, "slot_key": "current" }
// apply_mode: "from_today" → start_date=today; replace_active=true nếu đang có plan active (cắt ends_on cũ = hôm qua)
// apply_mode: "after_current" → start_date = ends_on xa nhất (active/upcoming) + 1; 400 NO_CHAIN_PLAN nếu chưa có plan applied
// slot_key optional (legacy): "current" | "next" | "empty" — when set with start_date, start_date must match that slot
// Response 200 → MealPlanOutput (starts_on, ends_on, days[].date đã stamp)
// Error 400 { "code": "PLAN_NOT_APPLYABLE" | "START_DATE_IN_PAST" | "INVALID_REPLACE_DATE" | "INVALID_SLOT_START" | "NO_CHAIN_PLAN" | "APPLY_PARAMS_REQUIRED" }
// Error 409 { "code": "PLAN_DATE_OVERLAP" | "UPCOMING_EXISTS" }
```
**Giới hạn cứng:** `after_current` bị chặn (`409 UPCOMING_EXISTS`) khi đã có plan upcoming khác.
**Side-effect:** materialize `meal_reminder`/`adherence_checkin` theo `start_date` (bỏ qua slot đã qua). `replace_active: true` (hoặc `from_today` khi có active) cắt `ends_on` plan active cũ = `start_date - 1`.

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
{ "message": "Tôi bị tiểu đường, hôm nay nên ăn gì?", "session_id": null }
// Response 200 → AgentRunOutput (xem contracts/agent-io-schema.md §5.2, gồm secondary_intents[], citation_chunks[], weekly_compliance / doctor_note)
// Error 503 { "code": "AGENT_ERROR", "detail": "Lỗi xử lý agent: ..." }
```
**Multi-intent (as-built):** `intent_classifier` phát hiện ý định phụ trong câu hỏi ghép (ví dụ vừa hỏi lập thực đơn vừa hỏi tương tác thuốc) qua keyword pattern — trả về qua `secondary_intents[]`, không xử lý song song đầy đủ, chỉ để `message` gợi ý người dùng hỏi lại riêng ý định phụ đó.

`session_id` là tùy chọn (1–36 ký tự hoặc null). Khi có, server đọc tối đa 8 tin đã lưu của phiên thuộc người gọi, mỗi tin tối đa 1200 ký tự. Phiên thiếu/sai chủ sở hữu trả `404 SESSION_NOT_FOUND`; không nhận lịch sử do client tự truyền vào request. Ngữ cảnh chỉ giúp hiểu chủ thể/sở thích, không thay nguồn chứng cứ. HTTP vẫn không expose `force_intent`.

### `POST /chat/stream`
**Role:** `patient` **hoặc** `doctor`.
```json
// Request
{ "message": "Tôi bị tiểu đường, hôm nay nên ăn gì?", "session_id": null }
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

Lưu session + transcript hiển thị trên sidebar patient chat. `/chat` và `/chat/stream` có thể đọc ngữ cảnh giới hạn từ phiên thuộc người gọi qua `session_id`; không dùng lịch sử thay nguồn y khoa. Kiểm tra quyền trước khi mở SSE. FE chờ lưu các lượt trước trước khi gửi câu hỏi tiếp nối.

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
      "citation_chunks": [
        {
          "chunk_id": "dinh_duong_dai_thao_duong.md#1",
          "text": "Đoạn guideline đã retrieve và nhồi vào prompt.",
          "source": "dinh_duong_dai_thao_duong.md",
          "score": 0.8
        }
      ],
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
- `intent`, `secondary_intents[]`, `citations[]`, `citation_chunks[]` (`{chunk_id, text, source, score}` — đoạn RAG đã nhồi vào prompt; default `[]`), `guardrail_triggered`, `meal_plan_id`
- `meal_preview` (MealPreviewOut), `weekly_compliance` (WeeklyComplianceOut), `doctor_note` (DoctorNoteOut)
- `meal_plan_week` (MealPlanOutput), `show_weekly_plan`, `thinking_steps[]`, `corrected`, `correction_reason`
- `unmatched_pairs[]` (`{drug, food}` — optional, default `[]`)
- `escalation_id` (optional, `null` — id job hỏi bác sĩ gắn với lượt AI này)
- **Không persist** `is_streaming` (ephemeral lúc SSE)

### Chat escalations — hỏi bác sĩ khi AI không chắc (as-built 2026-08-31)

HITL một chiều: bệnh nhân **opt-in** (bấm nút) khi câu AI thuộc `refuse` | `unknown` (không phải cấp cứu) | `rag_qa` thiếu citation | `unmatched_kb`. Không trộn lời bác sĩ vào bong bóng AI. Một bệnh nhân tối đa **một job đang mở**; gửi thêm khi đang mở thì **nối cùng thread**.

`reason` ∈ `missing_citations | unknown | refuse | unmatched_kb`.  
`status` ∈ `waiting_doctor | waiting_patient | resolved`.

#### `POST /chat/escalations`
**Role:** `patient`.
```json
// Request
{
  "session_id": "session_uuid",
  "ai_message_id": "msg_uuid",
  "note": "optional, max 200",
  "question_text": "Câu hỏi BN (fallback nếu chưa persist session)",
  "answer_text": "Câu AI",
  "intent": "unknown",
  "citations": [],
  "correction_reason": "missing_citations",
  "unmatched_pairs": [],
  "guardrail_triggered": true
}
// Response 201 → EscalationOut (kèm messages[], notification_id của mốc "đã gửi")
// Error 400 ESCALATION_NOT_ELIGIBLE — câu AI không thuộc trường hợp không chắc / là cấp cứu
// Error 400 NO_ASSIGNED_DOCTOR — chưa được bác sĩ nhận hồ sơ
```

#### `GET /chat/escalations/{id}`
**Role:** `patient` (chỉ job của mình).
```json
// Response 200 → EscalationOut
// Error 404 ESCALATION_NOT_FOUND
```

#### `POST /chat/escalations/{id}/messages`
**Role:** `patient`. Tiếp tục thread cho tới khi `resolved`.
```json
// Request { "body": "Câu hỏi thêm, max 2000" }
// Response 200 → EscalationOut
// Error 400 ESCALATION_RESOLVED — job đã đóng
```

#### `GET /doctor/escalations`
**Role:** `doctor`. Query optional `status`: `open` (default, `waiting_doctor|waiting_patient`) | `waiting_doctor` | `waiting_patient` | `resolved` | `all`.
```json
// Response 200 → list[EscalationListItem] (không kèm messages đầy đủ)
```

#### `GET /doctor/escalations/{id}`
**Role:** `doctor` (chỉ bệnh nhân đã gán).
```json
// Response 200 → EscalationOut
```

#### `POST /doctor/escalations/{id}/messages`
**Role:** `doctor`. Tạo `Notification(type="escalation_reply")` cho bệnh nhân.
```json
// Request { "body": "Lời đáp, max 2000" }
// Response 200 → EscalationOut
```

#### `POST /doctor/escalations/{id}/resolve`
**Role:** `doctor`. Đóng job (`status=resolved`). Không xóa lịch sử.
```json
// Response 200 → EscalationOut
```

**EscalationOut**
```json
{
  "id": "esc_uuid",
  "patient_id": "user_uuid",
  "doctor_id": "doctor_uuid",
  "patient_name": "Nguyễn Văn A",
  "patient_avatar": null,
  "patient_disease": ["diabetes_t2"],
  "session_id": "session_uuid",
  "ai_message_id": "msg_uuid",
  "question_text": "...",
  "answer_text": "...",
  "reason": "unknown",
  "patient_note": "",
  "status": "waiting_doctor",
  "messages": [
    { "id": "m_uuid", "sender": "patient", "body": "ghi chú", "created_at": "...", "kind": "note" }
  ],
  "notification_id": "notif_uuid",
  "created_at": "...",
  "updated_at": "...",
  "resolved_at": null
}
```
`messages[].kind` ∈ `note | reply | context`. `notification_id` chỉ có trên `POST /chat/escalations`.

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
`slot` ∈ `"morning" | "noon" | "evening" | "snack"`. Custom log khớp KB tương tác → tạo `Alert` + `alert_ids[]`.

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
// Request (ít nhất 1 field đo được; client cũ vẫn gửi blood_pressure / blood_glucose string)
{
  "weight": 71.5,
  "waist_cm": 92,
  "systolic": 128,
  "diastolic": 78,
  "glucose_fasting": 6.2,
  "glucose_postprandial": 8.4,
  "hba1c": 6.8,
  "note": ""
}
// Response 200 → BodyMetricsEntry + optional delta_advice (MetricsDeltaAdviceOut)
// delta_advice chỉ có khi lần ghi vượt ngưỡng so với bản ghi trước (cùng ngày: so với giá trị trước khi merge)
// MetricsDeltaAdviceOut gồm field_deltas[] (mọi field đo được kèm before/after, kể cả delta nhỏ) — xem agent-io-schema v1.14
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

## 14. Guidelines (citation source)

### `GET /guidelines/{source_id}`
**Role:** `patient` hoặc `doctor` (đã đăng nhập). Đọc nội dung nguồn trích dẫn để bác sĩ/bệnh nhân xem guideline khi click citation trên thực đơn hoặc chat.

`source_id` là giá trị trong `MealPlanOutput.citations[]` hoặc `FoodItem.citations[]` (ví dụ `byt_vn_notes.md`, `ada_diabetes.md`, `food_catalog_demo#f_yen_mach`). Client phải `encodeURIComponent`.

- **Guideline file** (`*.md` nằm trong `backend/data/guidelines/`): trả toàn bộ markdown + tiêu đề lấy từ heading đầu tiên.
- **Catalog món** (id chứa `#` hoặc không phải file guideline): `kind="catalog"`, `body` giải thích nguồn catalog — không bịa nội dung y văn.
- Path traversal / id không hợp lệ → `400 INVALID_SOURCE`. File guideline không tồn tại → `404 GUIDELINE_NOT_FOUND`.

```json
// Response 200 — guideline
{
  "id": "byt_vn_notes.md",
  "kind": "guideline",
  "title": "Hướng Dẫn Bộ Y Tế Việt Nam — Quản Lý Đái Tháo Đường Type 2",
  "body": "# Hướng Dẫn Bộ Y Tế Việt Nam …\n\n…"
}
// Response 200 — catalog citation
{
  "id": "food_catalog_demo#f_yen_mach",
  "kind": "catalog",
  "title": "Nguồn catalog thực phẩm",
  "body": "Citation `food_catalog_demo#f_yen_mach` trỏ tới món trong catalog dinh dưỡng, không phải guideline lâm sàng."
}
// Error 400
{ "code": "INVALID_SOURCE", "detail": "Mã trích dẫn không hợp lệ." }
// Error 404
{ "code": "GUIDELINE_NOT_FOUND", "detail": "Không tìm thấy nguồn trích dẫn." }
```

---

## 15. Health

### `GET /health`
**Role:** không cần auth. **Không** có prefix `/api/v1` (root-level).
```json
// Response 200 (dense mode uses provider "qdrant")
{ "status": "ok", "database": { "status": "ok" }, "vector_store": { "provider": "bm25", "ready": true, "missing": [], "empty": [] } }
```

`status` là `ok` hoặc `degraded`. `RAG_RETRIEVAL_MODE=keyword` kiểm tra corpus thực phẩm/hướng dẫn đi kèm, không mở Qdrant hay tải mô hình embedding. Backend serverless vẫn dùng PostgreSQL; cơ sở dữ liệu được khởi tạo bằng tác vụ quản trị trước deploy, không thay bằng SQLite hoặc tự tạo tài khoản demo khi có request.

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
| `User.signup_channel` | `self` \| `doctor` \| `legacy` | `models/user.py` — tự đăng ký / bác sĩ tạo hộ / seed hoặc dữ liệu cũ |
| `User.assigned_doctor_id` | UUID bác sĩ hoặc `null` | `models/user.py` — phân công 1–1 |
| `PatientTransfer.status` | `pending` \| `accepted` \| `cancelled` | `models/patient_transfer.py` |
| `MealPlan.status` | `pending_review` \| `approved` \| `rejected` \| `edited` | `models/meal_plan.py`, set qua `meal_planner_agent`/`routes_doctor.review_meal_plan` |
| `Alert.severity` / `InteractionItem.severity` | `Nguy hiểm` \| `Cần chú ý` \| `An toàn` | `data/drug_food_interactions.json`, `services/meal_plan_demo.py` |
| `Notification.type` | `meal_reminder` \| `adherence_checkin` \| `plan_approved` \| `plan_expiring` \| `plan_expired` \| `interaction_followup` \| `manual_reminder` \| `escalation_sent` \| `escalation_reply` | `services/notification.py` |
| `ChatEscalation.reason` | `missing_citations` \| `unknown` \| `refuse` \| `unmatched_kb` | `models/chat_escalation.py` |
| `ChatEscalation.status` | `waiting_doctor` \| `waiting_patient` \| `resolved` | `models/chat_escalation.py` |
| `Notification.status` | `pending` \| `sent` \| `read` \| `dismissed` \| `done` \| `cancelled` | `services/notification.py`, `models/notification.py` |
| `NotificationActionRequest.adherence` | `yes` \| `partial` \| `no` | `schemas/notification.py` |
| `ReviewRequest.action` | `approve` \| `reject` \| `edit` | `schemas/doctor.py` |
| `DoctorPatientSummary.status_key` | `attention` \| `stable` \| `warning` \| `pending` | `schemas/doctor.py` |
| `PlanExpiryDemoRequest.mode` / `DoctorPatientSummary.plan_expiry` | `expiring` \| `expired` (request) — `expiring` \| `expired` \| `ok` \| `none` (summary field) | `schemas/doctor.py`, `services/plan_expiry.py` |
| Meal slot (`Meal.slot`, `Swap.slot`) | `breakfast` \| `lunch` \| `dinner` \| `snack` | `schemas/meal_plan.py` — **khác** `FoodLogEntry.slot` (xem dòng dưới) |
| Agent intent (`AgentRunOutput.intent`) | `meal_plan` \| `interaction_check` \| `food_log` \| `rag_qa` \| `refuse` \| `unknown` \| `weekly_compliance` \| `doctor_note` \| `metrics_delta_advice` | `agents/nodes/intent_classifier.py::VALID_INTENTS` |
| `AgentRunOutput.secondary_intents[]` | cùng enum intent phía trên, dạng mảng | As-built, đáp ứng multi-intent (`intent_classifier.py`) |
| `FoodLogEntry.type` | `as_planned` \| `custom` | `schemas/food_log.py` |
| `FoodLogEntry.status` | `logged` \| `adjusted` | `adrs/009-food-log-scope-strategy.md` |
| `FoodLogEntry.slot` | `morning` \| `noon` \| `evening` \| `snack` | ADR-009 (supersede 2026-08-27), 4 slot |
| `BodyMetricsEntry.recorded_by` | `patient` \| `doctor` | `models/body_metrics.py` |
| `PatientProfile.constraints_status` | `confirmed` \| `pending_doctor_review` | As-built, `specs/04-clinical-constraints.md` |
| `MealPlanRequestOut.status` / `DoctorPatientSummary.meal_plan_request_status` | `none` \| `pending` | `profiles` table, as-built 2026-08-24 |

---

## Versioning

- **Changelog 1.29 → 1.30 (2026-11-17):** thêm proxy frontend cùng origin cho API và avatar trên Vercel. JWT vẫn được backend kiểm tra; chuyển tiếp SSE/multipart và giữ nguyên HTTP status. Không bỏ lớp bảo vệ Vercel khi sao chép hồ sơ local lên cloud.
- **Changelog 1.28 → 1.29 (2026-11-17):** thêm lưu avatar trong PostgreSQL cho serverless, giữ URL `/static/avatars/{filename}`; health báo đúng chế độ BM25/Qdrant. Entry point Vercel dùng dependency nhẹ, corpus sẵn có và không ghi file runtime; schema/tài khoản được khởi tạo qua CLI quản trị trước deploy. Không đổi payload đăng nhập/chat/thực đơn.
- **Changelog 1.27 → 1.28 (2026-11-16):** bệnh nhân sửa `full_name`/`email` qua `POST /profile`, cùng transaction hồ sơ, kiểm tra định dạng/trùng email. Trang bác sĩ bỏ form sửa hồ sơ chung; bệnh nhân chỉnh tại `/patient/profile`. Không đổi response.
- **Changelog 1.26 → 1.27 (2026-11-16):** `POST /chat` và `/chat/stream` nhận `session_id?: string | null` (tối đa 36 ký tự). Server kiểm tra chủ sở hữu, đọc tối đa 8 tin gần nhất để hiểu câu hỏi tiếp nối; session không tồn tại/không thuộc người gọi trả 404 trước khi mở SSE. Không tự ghi hồ sơ sức khỏe hay tạo thực đơn từ chat. Chế độ không LLM hỗ trợ tra cứu thực phẩm/công thức có nguồn, so sánh trên cùng cơ sở định lượng, gợi ý theo nguyên liệu/sở thích và hỏi lại khi mơ hồ; thêm intent `clarify` cho câu hỏi làm rõ không chứa kết luận y khoa, không hứa trả lời mọi chủ đề chưa có dữ liệu.

- **Changelog 1.24 → 1.25 (2026-11-16):** `MealPlanScheduleOut.history_plans[]` mặc định `[]`; tách lịch sử khỏi `unassigned_plans`. Bản chưa áp dụng quá chu kỳ tạo được lưu vào Nhật ký, không khóa tạo mới. `/meal-plans/me` trả `404 NO_MEAL_PLAN` nếu chỉ còn lịch sử; dùng schedule để xem lịch sử.

- **Vận hành local (2026-11-03):** RAG có chế độ BM25 `RAG_RETRIEVAL_MODE=keyword` và fallback khi thiếu bộ nhớ; không đổi schema chat/citations. Sự kiện SSE `error.message` dùng thông báo tiếng Việt cho người dùng, không trả nguyên lỗi hệ điều hành hoặc đường dẫn nội bộ.

- **Changelog 1.23 → 1.24 (2026-11-03):** giao diện bệnh nhân khởi tạo AI qua `/meal-plans/generate`, xem trước bản `pending_review` và theo dõi duyệt. Doctor chỉ kiểm tra/chỉnh sửa/duyệt/áp dụng; endpoint tạo cũ của doctor trả `403 PATIENT_GENERATION_REQUIRED` (thay đổi quyền khởi tạo có chủ đích). Các URL tạo cũ chuyển về hàng việc/danh sách duyệt.

- Version hiện tại: **1.28**.
- **Changelog 1.25 → 1.26 (2026-11-16):** Chat/SSE `interaction_check` có thể trả `citation_chunks` cho kiến thức dinh dưỡng của đúng món hỏi, sau kiểm tra dị ứng/tương tác; không dùng câu trả lời cache của món khác, không gắn tài liệu tiền sản/điều trị không liên quan. Đồng bộ agent I/O 1.16, giữ nguyên schema.
- **Changelog 1.22 → 1.23 (2026-08-31):** `POST /metrics` / chat `metrics_delta_advice` — `MetricsDeltaAdviceOut` thêm `field_deltas[]` (mọi field đo được kèm `before`/`after`/`changed`, kể cả delta nhỏ dưới ngưỡng) để FE render bảng so sánh chỉ số trong chat. Không breaking — field mới optional default `[]`. Đồng bộ `contracts/agent-io-schema.md` v1.14, `specs/12`.
- **Changelog 1.21 → 1.22 (2026-08-31):** `AgentRunOutput.citation_chunks[]` và `ChatMessageOut.citation_chunks[]` — đoạn RAG (`text`) đã dùng để gen câu chat. `citations[]` vẫn là id nguồn. Đồng bộ `contracts/agent-io-schema.md` v1.13. Không breaking.
- **Changelog 1.20 → 1.21 (2026-08-31):** Chat escalation HITL — `POST/GET /chat/escalations`, `POST .../messages`; `GET/POST /doctor/escalations` + `.../resolve`. Notification type mới `escalation_sent` | `escalation_reply` (`related_ids.escalation_id`). `AgentRunOutput.unmatched_pairs[]` optional. `ChatMessageOut` thêm `unmatched_pairs[]`, `escalation_id`. Không breaking.
- **Changelog 1.19 → 1.20 (2026-08-30):** thêm `GET /guidelines/{source_id}` (role `patient`|`doctor`) — đọc nội dung file guideline RAG hoặc ghi chú catalog khi click citation trên UI duyệt thực đơn. Không breaking.
- **Changelog 1.18 → 1.19 (2026-08-29):** validate range ràng buộc lâm sàng thống nhất FE+BE (`target_kcal` 800–4000, `carb_per_meal` 0–200, `sodium_daily` 0–5000, `salt_daily_g` 0–15, `sugar_daily_g` 0–100, `treatment_goals` 3–80 ký tự / tối đa 12). UI bác sĩ và hồ sơ BN dùng thanh kéo trong các khoảng này. 422 nếu vượt range. Không breaking với payload trong range cũ (trừ `target_kcal` < 800 hoặc muối > 15 / đường > 100).
- **Changelog 1.17 → 1.18 (2026-08-29):** `PUT /doctor/patients/{id}/constraints` nhận thêm `carb_per_meal`, `sodium_daily`, `treatment_goals` (cùng bộ chỉ số với hồ sơ BN). Onboarding bệnh nhân không gửi field lâm sàng. Không breaking — field mới optional.
- **Changelog 1.16 → 1.17 (2026-08-29):** HITL ràng buộc lâm sàng — `POST /profile` không còn áp `target_kcal`/`restrictions`/`treatment_goals` ngay; lưu `proposed_*` tới khi doctor `approve` (chép sang cột hiệu lực) hoặc `PUT .../constraints` (ghi hiệu lực, hủy đề xuất). `PatientProfile` / `DoctorPatientSummary` thêm `proposed_*` optional. Meal planner chỉ đọc giá trị đã duyệt. Đồng bộ `contracts/agent-io-schema.md` v1.11. Không breaking — field mới default `null`.
- **Changelog 1.15 → 1.16 (2026-08-29):** thêm `GET /doctor/profile` và `PUT /doctor/profile` (lấy/cập nhật hồ sơ chuyên môn bác sĩ: danh xưng/học vị, chuyên khoa, số CCHN, cơ quan, số năm kinh nghiệm, bio, trạng thái nhận bệnh, giờ tư vấn, liên hệ khẩn cấp kèm thống kê KPI lâm sàng). Không breaking change.
- **Changelog 1.14 → 1.15 (2026-08-28):** `PATCH /auth/me` (`full_name`) cho user đã đăng nhập. Chat intent `doctor_note`: `DoctorNoteOut` thêm `doctor_avatar`, `notes[]` (list `manual_reminder`, mới → cũ, cap 10, `has_more`), tên/ảnh lấy từ bác sĩ được gán — không còn default cứng `"Bác sĩ điều trị"`. Không còn fallback `adjustment_note`. Field `note`/`created_at`/`tags` giữ là bản ghi mới nhất để tương thích. Đồng bộ `contracts/agent-io-schema.md` v1.10.
- **Changelog 1.13 → 1.14 (2026-08-28):** phân công bác sĩ ↔ bệnh nhân 1–1. `GET /doctor/patients` (và mọi endpoint doctor theo `patient_id` / meal-plan) chỉ còn phạm vi bệnh nhân đã gắn. Thêm `POST /doctor/patients`, `GET /doctor/claim-queue`, `POST /doctor/patients/{id}/claim`, `GET /doctor/colleagues`, `POST /doctor/patients/{id}/transfer`, `POST /doctor/transfers/{id}/accept`. `GET /auth/me` thêm `assigned_doctor`. `DoctorPatientSummary` thêm `pending_transfer`. **Breaking** với client giả định 1 bác sĩ thấy mọi bệnh nhân.
- **Changelog 1.12 → 1.13 (2026-08-27):** thêm `POST /auth/change-password` (user đã đăng nhập đổi mật khẩu bằng `current_password` + `new_password`). Không breaking — endpoint mới.
- **Changelog 1.11 → 1.12 (2026-08-27):** `FoodLogEntry.slot` thêm `"snack"`. Không breaking — client cũ vẫn gửi 3 slot. Đồng bộ `contracts/agent-io-schema.md` v1.9.
- **Changelog 1.10 → 1.11 (2026-08-26):** `POST /metrics` nhận field lâm sàng optional (`waist_cm`, `systolic`, `diastolic`, `glucose_fasting`, `glucose_postprandial`, `hba1c`); response thêm `delta_advice` optional. Intent chat `metrics_delta_advice`. Không breaking — field mới default `null`. Đồng bộ `contracts/agent-io-schema.md` v1.8.
- **Changelog 1.9 → 1.10 (2026-08-24):** thêm `POST /meal-plans/request` + `GET /meal-plans/request` (patient yêu cầu bác sĩ tạo thực đơn, cờ trên `profiles`, không dùng bảng `notifications`); `DoctorPatientSummary` thêm `meal_plan_request_status`, `meal_plan_request_note`, `meal_plan_requested_at`; filter `GET /doctor/patients?meal_plan_request=pending`. Không breaking change (field mới optional/default).
- **Changelog 1.8 → 1.9 (2026-08-24):** thêm `POST /auth/me/avatar` (user đã đăng nhập tự upload ảnh đại diện, cùng rule 2MB / png-jpg-webp-gif với endpoint doctor). Không breaking change.
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
