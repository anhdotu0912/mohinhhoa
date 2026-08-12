# Spec: Hồ sơ bệnh nhân (Patient Profile)

## Status
**Partial** — API upsert/get + seed demo profiles hoạt động. As-built: thiếu profile khi generate → default `target_kcal=1800` (không hard-fail như rule 6 to-be). FE onboarding chưa chắc wire JWT.

## 1. Mục tiêu (Why)
Thu thập thông tin y tế/dinh dưỡng cá nhân hoá, làm input chuẩn cho mọi Agent (MealPlanner, InteractionChecker, RAG Q&A).

## 2. User story
Là **bệnh nhân**, tôi muốn nhập hồ sơ bệnh lý, thuốc đang dùng, dị ứng và mục tiêu kcal, để hệ thống sinh thực đơn và cảnh báo phù hợp với tình trạng của tôi.

## 3. Business rules
1. Mỗi user chỉ có **1 Profile** (quan hệ 1–1 với User) — thao tác là **upsert**, không tạo bản ghi mới mỗi lần sửa.
2. Field bắt buộc: `disease[]`, `medications[]`, `allergies[]`, `bmi`, `target_kcal`.
3. Field tuỳ chọn: `restrictions` (vd: `carb_per_meal`, `sodium_daily`), `preferences[]` (dạng free-text, vd: "thích ăn cơm", "không ăn thịt bò").
4. `allergies` là **hard filter** — bất kỳ món nào trong thực đơn sinh ra sau này chứa allergen phải bị loại bỏ hoàn toàn (không phải "hạn chế").
5. `preferences` là **soft filter** — ưu tiên áp dụng nhưng có thể bị bỏ qua nếu xung đột với ràng buộc dinh dưỡng.
6. Profile là điều kiện tiên quyết để gọi `POST /meal-plans/generate` — nếu chưa có Profile, API phải trả lỗi rõ ràng thay vì sinh plan với dữ liệu rỗng. *(hành vi lỗi cụ thể — mã lỗi, message — [CẦN XÁC NHẬN])*

## 4. Luồng chính (happy path)
1. Bệnh nhân vào `/patient/onboarding`.
2. Nhập: `disease`, `medications`, `allergies`, `bmi`, `target_kcal`, `restrictions`, `preferences`.
3. FE gọi `POST /api/v1/profile` (upsert).
4. Backend lưu vào bảng `Profile` (FK `user_id`).
5. FE gọi `GET /api/v1/profile/me` để xác nhận đã lưu, hiển thị lại form.

## 5. Edge cases
- User gọi generate meal plan trước khi có Profile → cần response lỗi có ý nghĩa (không phải 500) — *[CẦN XÁC NHẬN mã lỗi]*.
- `bmi` hoặc `target_kcal` nhập giá trị âm/0 → validate ở Pydantic schema, reject với 422.
- `medications[]` chứa tên thuốc không có trong KB tương tác (`drug_food_interactions.json`) → hệ thống vẫn lưu bình thường, InteractionChecker chỉ bỏ qua thuốc không match được (không raise lỗi).
- Sửa Profile sau khi đã có MealPlan tồn tại → **không** tự động re-generate plan cũ; user phải chủ động generate lại. *(xác nhận UX mong muốn — [CẦN XÁC NHẬN])*

## 6. Ngoài phạm vi (Out of scope)
- Không có Food Log nhập lịch sử ăn uống thực tế (đã quyết định Won't Have cho MVP).
- Không hỗ trợ nhiều Profile/hồ sơ theo thời gian (lịch sử thay đổi Profile) trong MVP.

## 7. Schema tham chiếu
```json
{
  "disease": ["diabetes_t2", "hypertension"],
  "medications": ["metformin", "amlodipine"],
  "allergies": ["hải sản"],
  "bmi": 26.5,
  "target_kcal": 1800,
  "restrictions": { "carb_per_meal": 45, "sodium_daily": 1500 },
  "preferences": ["thích ăn cơm", "không ăn thịt bò"]
}
```

## 8. API liên quan
| Method | Path | Role |
|---|---|---|
| POST | `/api/v1/profile` | patient |
| GET | `/api/v1/profile/me` | patient |
