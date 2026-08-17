# FE — Frontend

## Mục tiêu
Đảm bảo mọi màn hình dùng đúng dữ liệu thật từ API theo `contracts/api-v1.md`, không tự bịa field/endpoint không tồn tại, và các màn hình đang mock (Compliance, Constraints, Food Log) được gắn nhãn rõ trạng thái "demo/chưa nối API" cho tới khi BE2 hoàn thành phần Planned tương ứng.

## Ownership
Toàn bộ `frontend/**`.

**Không đụng:** Backend agent logic (`backend/app/agents/`, `backend/app/rag/`), DB migrations (`backend/app/db/`).

## Nguyên tắc bắt buộc
1. **`contracts/api-v1.md` là nguồn sự thật duy nhất** khi gọi API — không tự thêm field response không có trong contract, không tự đoán field khi backend chưa trả (nếu thiếu, báo BE2 để cập nhật contract trước).
2. Khi 1 màn hình đang dùng mock data (`MOCK_PATIENTS`, hard-code SVG chart...) mà backend endpoint tương ứng vẫn là `[Planned]` — giữ nguyên mock, **không** âm thầm coi mock là dữ liệu thật khi demo cho người ngoài xem.
3. Đổi field/shape request-response phải đối chiếu lại `contracts/api-v1.md` — nếu phát hiện lệch giữa contract và code BE thật, báo lại BE2 trước khi tự sửa FE để né lỗi tạm.

## Sub-tasks (checkbox)

### Must — Giữ North Star flow mượt
- [ ] Xác nhận toàn bộ 6 bước North Star flow (`tasks/README.md`) hoạt động không lỗi UI: đăng nhập bác sĩ → thêm/generate → duyệt → bệnh nhân xem → chat.
- [ ] Đảm bảo `lib/api.ts` có đủ method cho các endpoint đã Done (đối chiếu `contracts/api-v1.md` — đã phát hiện thiếu method cho `checkInteraction`/`simulateNotifications` khi audit, cần bổ sung nếu UI có nút gọi tới các action này).

### P1 — Chuẩn bị UI cho Clinical Constraints (khi BE2 hoàn thành, → `specs/04`, quyết định 2026-08-15)
- [ ] Field đã chốt: giữ nguyên UI hiện có (`salt`/`sugar`/`protein` ở `frontend/app/doctor/patients/constraints/page.tsx`) — BE2 sẽ mở rộng schema để khớp, **không cần đổi UI**.
- [ ] Sau khi BE2 xong, nối `PUT /doctor/patients/{patient_id}/constraints`, bỏ `MOCK_PATIENTS`/local state.
- [ ] Thêm hiển thị badge "Chờ bác sĩ xác nhận" khi `PatientProfile.constraints_status === "pending_doctor_review"` (patient tự sửa ràng buộc); thêm nút "Xác nhận" gọi `POST /doctor/patients/{patient_id}/constraints/approve` trên UI doctor.

### P1 — Chuẩn bị UI cho Doctor Compliance View (khi BE2 hoàn thành, → `specs/10`)
- [ ] Nối `frontend/app/doctor/patients/compliance/page.tsx` với `GET /doctor/patients/{patient_id}/compliance` thật, bỏ dữ liệu SVG/timeline hard-code.
- [ ] Nối nút "Gửi nhắc nhở" với `POST /doctor/patients/{patient_id}/compliance/remind` (tạo notification type mới `manual_reminder` — nếu UI patient hiển thị icon/label riêng theo type, cần thêm case cho type này).

### P2 — Yêu cầu điều chỉnh plan (khi BE2 hoàn thành, → `specs/07`, quyết định 2026-08-15)
- [ ] Thêm nút "Yêu cầu điều chỉnh" trên màn xem plan đã `approved`, gọi `POST /meal-plans/{meal_plan_id}/request-adjustment`; hiển thị trạng thái "Đang chờ bác sĩ duyệt lại" khi plan quay về `pending_review` sau khi gửi yêu cầu.

### P3 — Auth: quên mật khẩu (khi BE2 hoàn thành, → `specs/01`, quyết định 2026-08-15)
- [ ] Thêm màn "Quên mật khẩu" gọi `POST /auth/forgot-password` + `POST /auth/reset-password` — cần trước khi mở khảo sát người dùng thật.

### Done — Food Log (→ `specs/09-food-log-adherence.md`, ADR-009)
- [x] Hiện nav item "Ghi nhận bữa ăn" trỏ `/patient/meals/log`.
- [x] Nối `POST/GET /food-log` qua `lib/api.ts`; giữ UI 3-slot hiện có.

## Definition of Done
- [ ] Không có request nào gọi field/endpoint không có trong `contracts/api-v1.md`.
- [ ] Demo flow North Star không bị gãy khi chạy thử end-to-end trên UI thật.
- [ ] Không lint/type error (`npm run lint`/`tsc`).

## Owner
FE (Frontend).
