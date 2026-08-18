# FE — Frontend

## Mục tiêu
Đảm bảo mọi màn hình dùng đúng dữ liệu thật từ API theo `contracts/api-v1.md`, không tự bịa field/endpoint không tồn tại, và các màn hình đang mock được gắn nhãn rõ trạng thái "demo/chưa nối API" cho tới khi BE2 hoàn thành phần Planned tương ứng.

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

### P1 — Chuẩn bị UI cho Clinical Constraints (khi BE2 hoàn thành approve flow, → `specs/04`, quyết định 2026-08-15)
- [x] Field đã chốt: giữ nguyên UI hiện có (`salt`/`sugar`/`protein` ở `frontend/app/doctor/patients/constraints/page.tsx`) — BE2 sẽ mở rộng schema để khớp, **không cần đổi UI**.
- [x] Nối `PUT /doctor/patients/{patient_id}/constraints` qua `api.updateDoctorConstraints` — as-built; vẫn fallback `MOCK_PATIENTS` khi list rỗng/lỗi.
- [ ] Thêm hiển thị badge "Chờ bác sĩ xác nhận" khi `PatientProfile.constraints_status === "pending_doctor_review"` (patient tự sửa ràng buộc); thêm nút "Xác nhận" gọi `POST /doctor/patients/{patient_id}/constraints/approve` trên UI doctor (chờ BE2 implement approve endpoint).
- [ ] Persist ghi chú lâm sàng (`INITIAL_NOTES`/`notesMap`) lên backend — hiện chỉ local state.

### Done — Doctor Compliance View (→ `specs/10-doctor-compliance-view.md`)
- [x] Nối `frontend/app/doctor/patients/compliance/page.tsx` với `GET /doctor/patients/{patient_id}/compliance` thật.
- [x] Nối nút "Gửi nhắc nhở" với `POST /doctor/patients/{patient_id}/compliance/remind`.
- [ ] Dashboard `/doctor` vẫn dùng `THIS_WEEK_DATA` mock cho biểu đồ compliance — nên nối `getPatientCompliance` hoặc giữ mock có nhãn demo.

### P2 — Yêu cầu điều chỉnh plan (khi BE2 hoàn thành, → `specs/07`, quyết định 2026-08-15)
- [ ] Thêm nút "Yêu cầu điều chỉnh" trên màn xem plan đã `approved`, gọi `POST /meal-plans/{meal_plan_id}/request-adjustment`; hiển thị trạng thái "Đang chờ bác sĩ duyệt lại" khi plan quay về `pending_review` sau khi gửi yêu cầu.

### P2 — Notifications & API client gaps
- [ ] Nối `/patient/notifications` với `api.listNotifications` + mark read/dismiss/done (client đã có, trang vẫn mock 3 card tĩnh).
- [ ] Bổ sung `checkInteraction` và `simulateNotifications` vào `lib/api.ts` nếu UI cần gọi trực tiếp (hiện thiếu so với contract).

### P2 — Patient home & mock cleanup
- [ ] Nối `/patient` dashboard với API thật (hiện hardcode meals + compliance ring).
- [ ] Dọn file mock chết: `patient/meals/page.original.tsx`, `lib/plans-store.ts`, `lib/meal-logs-store.ts`, `components/patient/WeightTrendsChart.tsx` (orphan, không import).

### P3 — Auth: quên mật khẩu (khi BE2 hoàn thành, → `specs/01`, quyết định 2026-08-15)
- [ ] Thêm màn "Quên mật khẩu" gọi `POST /auth/forgot-password` + `POST /auth/reset-password` — cần trước khi mở khảo sát người dùng thật.

### Done — Food Log (→ `specs/09-food-log-adherence.md`, ADR-009)
- [x] Modal `FoodLogModal` trong `/patient/meals` — 3 slot `morning|noon|evening`, type `as_planned|custom`.
- [x] Nối `POST/GET /food-log` qua `lib/api.ts`; tóm tắt trên `/patient/history`.

## Definition of Done
- [ ] Không có request nào gọi field/endpoint không có trong `contracts/api-v1.md`.
- [ ] Demo flow North Star không bị gãy khi chạy thử end-to-end trên UI thật.
- [ ] Không lint/type error (`npm run lint`/`tsc`).

## Owner
FE (Frontend).
