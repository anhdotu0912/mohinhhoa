# Spec: Bác sĩ Xem/Sửa Ràng buộc Lâm sàng (target_kcal & restrictions)

## Status
Planned — **chưa có endpoint nào as-built**. Thiết kế đã được team chốt (2026-08-15) sau vòng review đầu — không còn điểm mơ hồ về field/HITL, chỉ còn chờ implement.

## 1. Mục tiêu (Why)
Bác sĩ là người có chuyên môn xác định mục tiêu calo và ngưỡng dinh dưỡng phù hợp với bệnh lý — không nên chỉ dựa vào patient tự khai. Thiếu endpoint này, bác sĩ phải yêu cầu bệnh nhân tự sửa hồ sơ theo hướng dẫn miệng, không kiểm soát được trực tiếp — rủi ro sai lệch trong luồng lâm sàng thật.

## 2. User story
- Là **bác sĩ**, tôi muốn xem và chỉnh sửa trực tiếp mục tiêu calo và ngưỡng ràng buộc dinh dưỡng của bệnh nhân, để đảm bảo thực đơn AI sinh ra tuân đúng chỉ định điều trị tôi đưa ra.
- Là **bệnh nhân**, tôi muốn tự cập nhật ràng buộc của mình khi cần (ví dụ nhận chỉ định mới từ 1 buổi khám ngoài hệ thống), nhưng hiểu rằng thay đổi đó cần bác sĩ của tôi xác nhận lại.

## 3. Business rules (đã chốt 2026-08-15)
1. **Endpoint mới `PUT /doctor/patients/{patient_id}/constraints`** — nhận `target_kcal` (int, optional) và `restrictions` (optional), cập nhật trực tiếp lên `profiles` của patient đó (cùng bảng `PatientProfile`, khác endpoint với `PUT /doctor/patients/{id}/profile`).
2. **Idempotent & partial update** — chỉ field được gửi mới bị ghi đè (khác với `POST /profile` là full-replace); field không gửi giữ nguyên giá trị cũ.
3. **Ràng buộc mới chỉ áp dụng từ lần `POST /meal-plans/generate` kế tiếp** — plan đã tồn tại **không** tự động tính lại (nhất quán với `MealPlanOutput.profile_snapshot` là bản chụp tại thời điểm generate).
4. **Mở rộng schema `Restrictions` (quyết định 2026-08-15):** thêm `salt_daily_g`/`sugar_daily_g`/`protein_daily_g` để khớp UI đã thiết kế sẵn (`frontend/app/doctor/patients/constraints/page.tsx`, dùng field `salt`/`sugar`/`protein`) — giữ **song song** với `carb_per_meal`/`sodium_daily` cũ, không xoá field cũ. Tất cả optional, `null` = không áp giới hạn đó.
5. **HITL — patient tự sửa cần bác sĩ duyệt (quyết định 2026-08-15):**
   - **Doctor sửa** qua `PUT /doctor/patients/{patient_id}/constraints` → có hiệu lực **ngay**, `PatientProfile.constraints_status="confirmed"` (doctor là người xác nhận trực tiếp, không cần bước duyệt thêm).
   - **Patient tự sửa** `target_kcal`/`restrictions` qua `POST /profile` (`specs/02`) → giá trị mới **vẫn áp dụng ngay** cho lần generate kế tiếp (không chặn patient, giữ demo flow mượt), nhưng `constraints_status` chuyển thành `"pending_doctor_review"`.
   - Bác sĩ xác nhận lại qua **endpoint mới** `POST /doctor/patients/{patient_id}/constraints/approve` (không đổi giá trị, chỉ chuyển `constraints_status` về `"confirmed"`) — hoặc tự động về `"confirmed"` nếu bác sĩ tự sửa trực tiếp bằng `PUT .../constraints` (rule 5 dòng 1).
   - Đây là ứng dụng cụ thể của nguyên tắc HITL mở rộng (`adrs/006-hitl-guardrails-strategy.md` rule 4): "mọi thay đổi ảnh hưởng điều trị do patient tự thực hiện phải được bác sĩ xác nhận lại", tương tự cách meal plan luôn cần duyệt (`specs/06`).
6. Response trả về `PatientProfile` đầy đủ sau khi update (giống pattern `POST /profile`) để FE cập nhật UI ngay không cần gọi lại `GET /profile/me`.
7. `GET /doctor/patients/{patient_id}` phải trả kèm `target_kcal`/`restrictions`/`constraints_status` hiện tại để doctor biết có đang chờ duyệt hay không (hiển thị badge "Chờ xác nhận ràng buộc mới" nếu `pending_doctor_review`).

## 4. Luồng chính (happy path)

**Doctor tự sửa (áp dụng ngay):**
1. Doctor mở trang chi tiết bệnh nhân → xem `target_kcal`/`restrictions`/`constraints_status` hiện tại (`GET /doctor/patients/{id}`).
2. Doctor sửa giá trị → `PUT /doctor/patients/{patient_id}/constraints`.
3. BE cập nhật `profiles`, `constraints_status="confirmed"`, trả lại `PatientProfile` mới.
4. Lần `POST /meal-plans/generate` kế tiếp dùng giá trị mới.

**Patient tự sửa (cần duyệt):**
1. Patient sửa `target_kcal`/`restrictions` qua `POST /profile`.
2. BE cập nhật ngay, `constraints_status="pending_doctor_review"`.
3. Doctor thấy badge "chờ xác nhận" ở `GET /doctor/patients` → xem lại giá trị mới → `POST /doctor/patients/{patient_id}/constraints/approve` (nếu đồng ý) hoặc tự sửa lại bằng `PUT .../constraints` (nếu muốn đổi giá trị khác).

## 5. Edge cases
- Doctor gửi `target_kcal` âm hoặc bằng 0 → nên `422 Validation Error` (ràng buộc tối thiểu hợp lý, ví dụ `>=800`) — giá trị ngưỡng cụ thể vẫn là quyết định chuyên môn dinh dưỡng, chưa chốt số trong tài liệu này.
- Doctor sửa ràng buộc cho patient không tồn tại → `404 PATIENT_NOT_FOUND` (nhất quán với `specs/03`).
- Patient chưa từng có profile (chưa qua onboarding) → doctor vẫn set được, BE tạo `PatientProfile` mới với các field khác giữ default.
- Gọi `POST .../constraints/approve` khi `constraints_status` đã là `"confirmed"` (không có gì để duyệt) → `400 NOTHING_TO_APPROVE`.
- Patient tiếp tục sửa `target_kcal`/`restrictions` nhiều lần trong lúc đang `"pending_doctor_review"` → giữ nguyên trạng thái `"pending_doctor_review"` (không có nhiều "phiên bản chờ duyệt" khác nhau, chỉ 1 cờ + giá trị hiện tại).

## 6. Ngoài phạm vi (Out of scope)
- Lịch sử thay đổi ràng buộc (audit log ai sửa khi nào, giá trị trước/sau) — không có bảng audit trong hệ thống hiện tại.
- Cơ chế duyệt 2 cấp (doctor sửa cần approve bởi doctor khác) — không có trong yêu cầu MVP.
- Ngưỡng validate y khoa cụ thể cho `target_kcal`/từng field `restrictions` (ví dụ giới hạn min/max theo bệnh lý) — do chuyên môn dinh dưỡng quyết định riêng, ngoài phạm vi tài liệu kỹ thuật này.

## 7. Schema tham chiếu
```json
// PUT /doctor/patients/{patient_id}/constraints — request
{
  "target_kcal": 1600,
  "restrictions": {
    "carb_per_meal": 40,
    "sodium_daily": 1200,
    "salt_daily_g": 5,
    "sugar_daily_g": 20,
    "protein_daily_g": 65
  }
}
// POST /doctor/patients/{patient_id}/constraints/approve — request rỗng
```
Toàn bộ chi tiết + response mẫu tại `contracts/api-v1.md` §3 (Clinical Constraints `[Planned]`); `constraints_status` enum tại `contracts/agent-io-schema.md` §1.

## 8. API liên quan
| Method | Path | Role |
|---|---|---|
| PUT | `/doctor/patients/{patient_id}/constraints` | doctor **[Planned]** |
| POST | `/doctor/patients/{patient_id}/constraints/approve` | doctor **[Planned]** |

## 9. Liên quan
- `specs/02-patient-profile-onboarding.md` — patient tự sửa cùng field qua `POST /profile`, kích hoạt `constraints_status="pending_doctor_review"`.
- `specs/03-doctor-patient-management.md` — endpoint doctor liên quan khác (`profile`/`metrics`/`goals`), phân biệt rõ không trùng phạm vi.
- `specs/05-meal-plan-generation.md` — nơi ràng buộc này được áp dụng thực tế.
- `adrs/006-hitl-guardrails-strategy.md` §4 — nguyên tắc HITL mở rộng.
- `contracts/api-v1.md` §3, `contracts/agent-io-schema.md` §1.
