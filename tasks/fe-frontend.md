# FE — Frontend

## Mục tiêu
Đảm bảo mọi màn hình dùng đúng dữ liệu thật từ API theo `contracts/api-v1.md`, không tự bịa field/endpoint không tồn tại, và các màn hình đang mock được gắn nhãn rõ trạng thái "demo/chưa nối API" cho tới khi nối API thật.

## Ownership
Toàn bộ `frontend/**`.

**Không đụng:** Backend agent logic (`backend/app/agents/`, `backend/app/rag/`), DB migrations (`backend/app/db/`).

## Nguyên tắc bắt buộc
1. **`contracts/api-v1.md` là nguồn sự thật duy nhất** khi gọi API — không tự thêm field response không có trong contract, không tự đoán field khi backend chưa trả (nếu thiếu, báo BE2 để cập nhật contract trước).
2. Khi 1 màn hình đang dùng mock data (`MOCK_PATIENTS`, hard-code SVG chart...) mà backend endpoint tương ứng vẫn chưa có — giữ nguyên mock, **không** âm thầm coi mock là dữ liệu thật khi demo cho người ngoài xem.
3. Đổi field/shape request-response phải đối chiếu lại `contracts/api-v1.md` — nếu phát hiện lệch giữa contract và code BE thật, báo lại BE2 trước khi tự sửa FE để né lỗi tạm.

## Sub-tasks (checkbox)

### Must — Giữ North Star flow mượt
- [ ] Xác nhận toàn bộ 6 bước North Star flow (`tasks/README.md`) hoạt động không lỗi UI: đăng nhập bác sĩ → thêm/generate → duyệt → bệnh nhân xem → chat.
- [x] `lib/api.ts` đã có method cho các endpoint đã Done, bao gồm `checkInteraction` và `simulateNotifications` (đối chiếu `contracts/api-v1.md`).

### Done — Clinical Constraints HITL (→ `specs/04`)
- [x] Field khớp UI hiện có (`salt`/`sugar` ở `frontend/app/doctor/patients/constraints/page.tsx`, đã bỏ `protein` theo scope mới).
- [x] Nối `PUT /doctor/patients/{patient_id}/constraints` qua `api.updateDoctorConstraints`; vẫn fallback `MOCK_PATIENTS` khi list rỗng/lỗi.
- [x] Hiển thị badge "Chờ bác sĩ xác nhận" khi `constraintsStatus === "pending_doctor_review"`; nút "Xác nhận" gọi `api.approveDoctorConstraints(patientId)`.
- [ ] Persist ghi chú lâm sàng (`INITIAL_NOTES`/`notesMap`) lên backend — hiện chỉ local state (không có endpoint tương ứng, cần BE2 thiết kế trước nếu muốn làm).

### Done — Doctor Compliance View (→ `specs/10-doctor-compliance-view.md`)
- [x] Nối `frontend/app/doctor/patients/compliance/page.tsx` với `GET /doctor/patients/{patient_id}/compliance` thật.
- [x] Nối nút "Gửi nhắc nhở" với `POST /doctor/patients/{patient_id}/compliance/remind`.
- [ ] Dashboard `/doctor` vẫn dùng dữ liệu mock (`THIS_WEEK_DATA`/tương tự) cho biểu đồ compliance — nên nối `getPatientCompliance` hoặc giữ mock có nhãn demo.

### P1 (Should) — Yêu cầu điều chỉnh plan (→ `specs/07`)
- [ ] Thêm nút "Yêu cầu điều chỉnh" trên màn xem plan đã `approved`, gọi `POST /meal-plans/{meal_plan_id}/request-adjustment` (**backend đã Done**, FE chưa có UI/gọi API này) — hiển thị trạng thái "Đang chờ bác sĩ duyệt lại" khi plan quay về `pending_review` sau khi gửi yêu cầu.

### Done — Notifications (→ `specs/11`)
- [x] `/patient/notifications` đã nối `api.listNotifications()` + mark read/dismiss/done thật (không còn 3 card tĩnh mock).

### Done — Patient chat-home redesign (→ `tasks/patient-chat-redesign/`)
- [x] `/patient` là chat-home nối `api.chatStream` (Phase 1–2); mock đi chợ xoá (Phase 3).
- [x] Dock panels + generative cards (compliance, doctor note, weekly plan) dùng API thật.

### P2 (Could) — Doctor dashboard mock cleanup
- [ ] Nối phần còn mock của `/doctor` dashboard (`frontend/app/doctor/page.tsx`) — hiện pha trộn API thật + `MOCK_PATIENTS` cho vài phần.

### P3 (Could) — Auth: quên mật khẩu (→ `specs/01`)
- [ ] Thêm màn "Quên mật khẩu" gọi `POST /auth/forgot-password` + `POST /auth/reset-password` (**backend đã Done**, cần xác nhận FE đã có UI hay chưa trước khi mở khảo sát người dùng thật).

### Done — Food Log (→ `specs/09-food-log-adherence.md`, ADR-009)
- [x] Modal `FoodLogModal` trong `/patient/meals` — 3 slot `morning|noon|evening`, type `as_planned|custom`.
- [x] Nối `POST/GET /food-log` qua `lib/api.ts`; tóm tắt trên `/patient/history`.

### Ngoài phạm vi hiện tại (chưa có spec/backend)
- `frontend/app/doctor/messages/**` — hoàn toàn mock, chưa có backend messaging feature nào tồn tại (chưa từng có spec) — cần quyết định có làm hay bỏ trước khi động vào, không tự thiết kế API.

### P3 (Could) — Lint debt (phát hiện 2026-08-22, xem `tasks/roadmap-mvp.md` B10)
`npm run lint` (`"lint": "next lint"`) không chạy được kể từ khi lên Next 16 (`next lint` đã bị gỡ khỏi Next CLI) — đã sửa script sang `"lint": "eslint ."` (2026-08-22) để lint chạy được trở lại lần đầu. Kết quả: 47 lỗi + 15 warning, cần dọn dần khi có dịp sửa các trang liên quan (không bulk-fix trong 1 lần vì đụng nhiều trang đã thiết kế):
- [ ] 47 lỗi `react-hooks/set-state-in-effect` — pattern `useEffect(() => setHydrated(true), [])` (hydration guard) lặp lại ở nhiều trang `doctor/history/*`, `doctor/patients/*`, `(auth)/reset-password`, v.v. Cách sửa khuyến nghị theo React docs: dùng `useState(() => ...)` lazy init hoặc đưa logic vào event handler thay vì effect, tuỳ từng trường hợp — cần xem từng trang, không áp dụng máy móc.
- [ ] 15 warning `no-unused-vars`/`exhaustive-deps` rải rác (bao gồm `lib/plan-expiry.ts`) — dọn kèm khi làm B6 (dead code cleanup). `RightFloatingBar.tsx` đã xoá Phase 3.

## Definition of Done
- [ ] Không có request nào gọi field/endpoint không có trong `contracts/api-v1.md`.
- [ ] Demo flow North Star không bị gãy khi chạy thử end-to-end trên UI thật.
- [x] `npm run build`/`tsc` sạch (đã xác nhận 2026-08-22). `npm run lint` (`eslint .`) hiện còn 47 lỗi + 15 warning tồn đọng (xem mục Lint debt trên) — không chặn build/demo, nhưng chưa đạt "0 lint error".

## Owner
FE (Frontend).
