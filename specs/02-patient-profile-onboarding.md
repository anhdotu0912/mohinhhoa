# Spec: Hồ sơ Bệnh nhân & Onboarding

## Status
Done — `POST /profile` (upsert) và `GET /profile/me` hoạt động đúng thiết kế; không có bước "hoàn tất onboarding" tách biệt ở backend (chỉ là 1 form upsert). **Cập nhật 2026-08-22:** rule 4 (mở rộng pattern `preferences`) đã **Done**. **Cập nhật 2026-08-29:** rule 7 — HITL `target_kcal`/`restrictions`/`treatment_goals` là cổng kiểm duyệt thật (`proposed_*`, không áp dụng ngay).

## 1. Mục tiêu (Why)
Hồ sơ bệnh nhân (bệnh lý, thuốc, dị ứng, mục tiêu dinh dưỡng) là input bắt buộc để AI sinh thực đơn cá nhân hoá và kiểm tra tương tác thuốc–thực phẩm đúng. Không có hồ sơ, AI chỉ dùng giá trị mặc định chung (`target_kcal=1800`, không bệnh lý/dị ứng) — không sai kỹ thuật nhưng vô nghĩa lâm sàng.

## 2. User story
Là **bệnh nhân**, tôi muốn khai báo bệnh lý, thuốc đang dùng, dị ứng, mục tiêu calo và sở thích ăn uống, để AI lập thực đơn phù hợp và an toàn với tình trạng của tôi.

## 3. Business rules
1. **1 user – 1 profile** (upsert theo `user_id`, không có nhiều hồ sơ/user) — `POST /profile` tạo mới nếu chưa có, ghi đè toàn bộ field nếu đã có (không phải patch từng field).
2. Không có field nào bị Pydantic validate bắt buộc (mọi field default) — nhưng về nghiệp vụ: `disease/medications/allergies/bmi/target_kcal` **nên** được điền đầy đủ trước khi bấm "Lập thực đơn" để kết quả có ý nghĩa (business rule khuyến nghị ở FE, không phải validation cứng ở BE).
3. **`allergies` = hard filter** — món ăn khớp bất kỳ allergy nào **bị loại tuyệt đối** khỏi thực đơn và khỏi danh sách món thay thế (`meal_planner_agent._is_allergic`, áp dụng cả khi lọc catalog gốc lẫn khi lọc `alternatives[]` sau khi sinh). Không có ngoại lệ, không có "cảnh báo nhưng vẫn cho chọn".
4. **`preferences` = soft filter — as-built (2026-08-22):** `meal_planner_agent.py` (`_is_preference_excluded` và tương đương) nhận diện 5 pattern: `"không ăn thịt bò"` (loại món có `"bò"` trong tên), `"ăn chay"`/`"chay"` (loại món thuộc nhóm `thit`/`hai_san`/`trung_sua` hoặc tên chứa từ khoá thịt/hải sản/trứng/sữa), `"không ăn hải sản"` (loại nhóm `hai_san` hoặc món chứa tôm/cua/cá/mực/nghêu/hải sản), `"không ăn heo"`/`"không ăn lợn"` (loại món chứa heo/lợn/ba rọi/sườn heo), `"không ăn gà"` (loại món chứa gà). Overlap với `allergies` không cần xử lý đặc biệt — cả 2 tầng filter đều loại món tương ứng, kết quả giống nhau dù trùng ý nghĩa. Các câu preference khác ngoài 5 pattern trên vẫn chỉ được lưu, không ảnh hưởng logic sinh thực đơn.
5. Điều kiện tiên quyết để `POST /meal-plans/generate` có kết quả tốt: đã có ít nhất `target_kcal` (luôn có default 1800) — **không** có validation chặn generate nếu chưa điền `disease`/`allergies`; hệ thống vẫn chạy, chỉ kém cá nhân hoá.
6. `restrictions.carb_per_meal`/`restrictions.sodium_daily` optional; nếu điền, được dùng để tạo `warnings[]` trong `DayPlan.totals` khi vượt ngưỡng (không chặn sinh plan, chỉ cảnh báo). `restrictions.salt_daily_g`/`sugar_daily_g` (doctor-only, xem `specs/04`) đã **as-built** — meal planner quy đổi `salt_daily_g` → natri hiệu lực (`effective_sodium_mg = min(sodium_daily, salt_daily_g * 400)`) khi cả hai có giá trị. `protein_daily_g` đã bị loại khỏi scope ràng buộc (Won't Have MVP này).
7. **HITL cho ràng buộc lâm sàng (cập nhật 2026-08-29):** `POST /profile` cho phép bệnh nhân **đề xuất** `target_kcal`/`restrictions`/`treatment_goals` từ trang hồ sơ. Onboarding **không** gửi các field lâm sàng — hệ thống giữ default (`target_kcal=1800`, `restrictions` rỗng) cho tới khi bác sĩ đặt. BE **không** ghi đè cột hiệu lực khi bệnh nhân đề xuất — lưu `proposed_*` và `constraints_status="pending_doctor_review"`. `meal_planner_agent` chỉ đọc giá trị đã duyệt. Doctor `POST /doctor/patients/{id}/constraints/approve` chép proposed → hiệu lực; `PUT .../constraints` ghi hiệu lực ngay và hủy đề xuất. `disease`/`medications`/`allergies`/`preferences`/chỉ số cơ thể vẫn do bệnh nhân ghi ngay (tự khai + hard filter dị ứng / tương tác thuốc).

## 4. Luồng chính (happy path)
1. Patient đăng nhập, được redirect tới onboarding (FE `frontend/app/patient/onboarding/page.tsx`).
2. FE gọi `POST /profile` với thông tin cá nhân, chỉ số, bệnh lý/thuốc/dị ứng và sở thích — **không** gửi `target_kcal`/`restrictions`/`treatment_goals`.
3. BE upsert vào bảng `profiles`, trả lại `PatientProfile` đã lưu.
4. FE có thể gọi lại `GET /profile/me` bất kỳ lúc nào để hiển thị/sửa hồ sơ (ví dụ ở trang cài đặt).
5. Sau khi có hồ sơ, patient có thể sang `POST /meal-plans/generate` (`specs/05-meal-plan-generation.md`).

## 5. Edge cases
- Patient gọi `GET /profile/me` trước khi từng `POST /profile` → BE trả `PatientProfile` với toàn field default (`target_kcal=1800`, list rỗng), **không** trả lỗi 404 (khác với `GET /meal-plans/me` khi chưa có plan, endpoint này không raise lỗi — xem `services/meal_plan_service.get_profile`).
- Patient sửa hồ sơ (`POST /profile` lần 2) sau khi đã có 1+ meal plan cũ → plan cũ **không** tự động cập nhật (mỗi `MealPlanOutput.profile_snapshot` là bản chụp tại thời điểm generate, không tham chiếu động tới `profiles` hiện tại).
- Patient gửi `target_kcal`/`restrictions` nhiều lần trước khi doctor duyệt → `proposed_*` bị ghi đè (1 bộ đề xuất), `constraints_status` giữ `"pending_doctor_review"`, cột hiệu lực không đổi.
- Field `bmi` do patient tự nhập tay (không tự tính từ `weight/height` ở endpoint patient, khác với endpoint doctor `PUT /doctor/patients/{id}/metrics` có tự tính) — patient có thể nhập `bmi` không khớp `weight/height` đã nhập, không có validation chéo.

## 6. Ngoài phạm vi (Out of scope)
- Validate lâm sàng nội dung `disease`/`medications` (không kiểm tra tên bệnh/thuốc có hợp lệ theo danh mục — patient tự nhập text tự do; doctor có danh mục chuẩn hoá riêng qua `GET /doctor/catalog`, xem `specs/03`).
- Onboarding nhiều bước có wizard/progress bar ở BE — đây là chi tiết UI của FE, backend chỉ có 1 endpoint upsert duy nhất.
- Lịch sử thay đổi hồ sơ (chỉ lưu bản mới nhất, xem `adrs/010-patient-metrics-history-strategy.md` cho phần chỉ số cơ thể).

## 7. Schema tham chiếu
- `PatientProfile`/`ProfileUpsert`/`Restrictions` — `contracts/agent-io-schema.md` §1.

## 8. API liên quan
| Method | Path | Role |
|---|---|---|
| POST | `/profile` | patient |
| GET | `/profile/me` | patient |

## 9. Liên quan
- `specs/05-meal-plan-generation.md` — dùng `PatientProfile` làm input chính.
- `specs/04-clinical-constraints.md` — phần bác sĩ sửa/duyệt `restrictions`/`target_kcal` (Done, workflow HITL đầy đủ).
- `adrs/006-hitl-guardrails-strategy.md` — nguyên tắc HITL mở rộng sang ràng buộc lâm sàng.
- `contracts/agent-io-schema.md` §1.
