# Spec: Bác sĩ Xem/Sửa Ràng buộc Lâm sàng (target_kcal & restrictions)

## Status
Done — **`PUT /doctor/patients/{id}/constraints`** (as-built 2026-08-16, mở rộng 2026-08-29): doctor ghi trực tiếp `target_kcal` / `carb_per_meal` / `sodium_daily` / `salt_daily_g` / `sugar_daily_g` / `treatment_goals`, áp dụng ngay cho lần generate kế tiếp. **HITL patient-đề-xuất** (`constraints_status` + `proposed_*` + `POST .../constraints/approve`): giá trị bệnh nhân gửi **không** có hiệu lực tới khi bác sĩ duyệt. **`protein_daily_g` bỏ khỏi scope.**

## 1. Mục tiêu (Why)
Bác sĩ là người có chuyên môn xác định mục tiêu calo và ngưỡng dinh dưỡng phù hợp với bệnh lý — không nên chỉ dựa vào patient tự khai. Thiếu endpoint này, bác sĩ phải yêu cầu bệnh nhân tự sửa hồ sơ theo hướng dẫn miệng, không kiểm soát được trực tiếp — rủi ro sai lệch trong luồng lâm sàng thật.

## 2. User story
- Là **bác sĩ**, tôi muốn xem và chỉnh sửa trực tiếp mục tiêu calo và ngưỡng ràng buộc dinh dưỡng của bệnh nhân, để đảm bảo thực đơn AI sinh ra tuân đúng chỉ định điều trị tôi đưa ra.
- Là **bệnh nhân**, tôi muốn tự cập nhật ràng buộc của mình khi cần (ví dụ nhận chỉ định mới từ 1 buổi khám ngoài hệ thống), nhưng hiểu rằng thay đổi đó cần bác sĩ của tôi xác nhận lại.

## 3. Business rules (as-built)
1. **`PUT /doctor/patients/{patient_id}/constraints`** — nhận `target_kcal` (int, optional) và `restrictions` (optional), cập nhật trực tiếp lên `profiles` của patient đó (cùng bảng `PatientProfile`, khác endpoint với `PUT /doctor/patients/{id}/profile`).
2. **Idempotent & partial update** — chỉ field được gửi mới bị ghi đè (khác với `POST /profile` là full-replace); field không gửi giữ nguyên giá trị cũ.
3. **Ràng buộc mới chỉ áp dụng từ lần `POST /meal-plans/generate` kế tiếp** — plan đã tồn tại **không** tự động tính lại (nhất quán với `MealPlanOutput.profile_snapshot` là bản chụp tại thời điểm generate).
4. **Mở rộng schema `Restrictions` (as-built 2026-08-16, UI đồng bộ 2026-08-29):** `salt_daily_g`/`sugar_daily_g` song song với `carb_per_meal`/`sodium_daily`. Doctor UI và hồ sơ BN cùng bộ: kcal/ngày, carb/bữa, natri/ngày, muối/ngày, đường tự do/ngày, `treatment_goals`. **`protein_daily_g` bỏ khỏi scope ràng buộc.**
5. **HITL — patient đề xuất cần bác sĩ duyệt (cập nhật 2026-08-29):**
   - **Doctor sửa** qua `PUT /doctor/patients/{patient_id}/constraints` → có hiệu lực **ngay**, xóa `proposed_*`, `PatientProfile.constraints_status="confirmed"` (doctor là người xác nhận trực tiếp).
   - **Patient gửi** `target_kcal`/`restrictions`/`treatment_goals` qua `POST /profile` (`specs/02`) → BE **không** ghi đè cột hiệu lực. Lưu `proposed_target_kcal` / `proposed_restrictions` / `proposed_treatment_goals`, `constraints_status` → `"pending_doctor_review"`. Lần `POST /meal-plans/generate` kế tiếp vẫn dùng giá trị bác sĩ (hoặc default hệ thống) đã duyệt.
   - Bác sĩ áp dụng đề xuất qua `POST /doctor/patients/{patient_id}/constraints/approve` (chép proposed → hiệu lực, xóa proposed, `"confirmed"`) — hoặc ghi đè bằng `PUT .../constraints` (hủy đề xuất).
   - Đây là ứng dụng của nguyên tắc HITL (`adrs/006-hitl-guardrails-strategy.md` rule 4): "mọi thay đổi ảnh hưởng điều trị do patient tự thực hiện phải được bác sĩ xác nhận lại" — cờ `constraints_status` là **cổng kiểm duyệt**, không chỉ badge hiển thị.
6. Response trả về `PatientProfile` đầy đủ sau khi update (giống pattern `POST /profile`) để FE cập nhật UI ngay không cần gọi lại `GET /profile/me`.
7. `GET /doctor/patients/{patient_id}` trả kèm `target_kcal`/`restrictions`/`constraints_status` hiện tại để doctor biết có đang chờ duyệt hay không (FE hiển thị badge "Chờ bác sĩ xác nhận" nếu `pending_doctor_review`, `frontend/app/doctor/patients/constraints/page.tsx`).

## 4. Luồng chính (happy path)

**Doctor tự sửa (áp dụng ngay):**
1. Doctor mở trang chi tiết bệnh nhân → xem `target_kcal`/`restrictions`/`constraints_status` hiện tại (`GET /doctor/patients/{id}`).
2. Doctor sửa giá trị → `PUT /doctor/patients/{patient_id}/constraints`.
3. BE cập nhật `profiles`, `constraints_status="confirmed"`, trả lại `PatientProfile` mới.
4. Lần `POST /meal-plans/generate` kế tiếp dùng giá trị mới.

**Patient đề xuất (cần duyệt — chưa có hiệu lực):**
1. Patient gửi `target_kcal`/`restrictions`/`treatment_goals` qua `POST /profile`.
2. BE lưu `proposed_*`, `constraints_status="pending_doctor_review"`; cột hiệu lực không đổi.
3. Doctor thấy badge "chờ xác nhận" ở `GET /doctor/patients` kèm `proposed_*` → `POST .../constraints/approve` (áp dụng đề xuất) hoặc `PUT .../constraints` (ghi giá trị khác, hủy đề xuất).

## 5. Edge cases
- Doctor gửi `target_kcal` âm hoặc bằng 0 → nên `422 Validation Error` (ràng buộc tối thiểu hợp lý, ví dụ `>=800`) — giá trị ngưỡng cụ thể vẫn là quyết định chuyên môn dinh dưỡng, chưa chốt số trong tài liệu này.
- Doctor sửa ràng buộc cho patient không tồn tại → `404 PATIENT_NOT_FOUND` (nhất quán với `specs/03`).
- Patient chưa từng có profile (chưa qua onboarding) → doctor vẫn set được, BE tạo `PatientProfile` mới với các field khác giữ default.
- Gọi `POST .../constraints/approve` khi `constraints_status` đã là `"confirmed"` (không có đề xuất) → `400 NOTHING_TO_APPROVE`.
- Patient tiếp tục gửi `target_kcal`/`restrictions` nhiều lần trong lúc `"pending_doctor_review"` → ghi đè `proposed_*` (chỉ 1 bộ đề xuất), giữ `"pending_doctor_review"`. Cột hiệu lực vẫn không đổi.

## 6. Ngoài phạm vi (Out of scope)
- Lịch sử thay đổi ràng buộc (audit log ai sửa khi nào, giá trị trước/sau) — không có bảng audit trong hệ thống hiện tại.
- Cơ chế duyệt 2 cấp (doctor sửa cần approve bởi doctor khác) — không có trong yêu cầu MVP.
- Ngưỡng validate y khoa cụ thể cho `target_kcal`/từng field `restrictions` (ví dụ giới hạn min/max theo bệnh lý) — do chuyên môn dinh dưỡng quyết định riêng, ngoài phạm vi tài liệu kỹ thuật này.

## 7. Schema tham chiếu
```json
// PUT /doctor/patients/{patient_id}/constraints — request (flat, as-built)
{
  "target_kcal": 1600,
  "carb_per_meal": 40,
  "sodium_daily": 1200,
  "salt_daily_g": 5,
  "sugar_daily_g": 20,
  "treatment_goals": ["Kiểm soát đường huyết ổn định (HbA1c < 7%)."]
}
// POST /doctor/patients/{patient_id}/constraints/approve — request rỗng
```
Toàn bộ chi tiết + response mẫu tại `contracts/api-v1.md` §3 (Clinical Constraints); `constraints_status` enum tại `contracts/agent-io-schema.md` §1.

## 8. API liên quan
| Method | Path | Role |
|---|---|---|
| PUT | `/doctor/patients/{patient_id}/constraints` | doctor |
| POST | `/doctor/patients/{patient_id}/constraints/approve` | doctor |

## 9. Liên quan
- `specs/02-patient-profile-onboarding.md` — patient gửi kcal/restrictions qua `POST /profile` như đề xuất (`proposed_*`), không ghi đè cột hiệu lực.
- `specs/03-doctor-patient-management.md` — endpoint doctor liên quan khác (`profile`/`metrics`/`goals`), phân biệt rõ không trùng phạm vi.
- `specs/05-meal-plan-generation.md` — nơi ràng buộc này được áp dụng thực tế.
- `adrs/006-hitl-guardrails-strategy.md` §4 — nguyên tắc HITL mở rộng.
- `contracts/api-v1.md` §3, `contracts/agent-io-schema.md` §1.
