# Task 1.7–1.11 — Xây dựng 4 Card Generative-UI trong Chat

> **Thư mục:** [`tasks/patient-chat-redesign/phase-1/`](README.md)  
> **Phụ thuộc:** Hoàn thành [`task-3-chat-home-page.md`](task-3-chat-home-page.md).

---

## 1. Mục tiêu
Xây dựng 4 loại card Generative-UI hiển thị trực tiếp trong bong bóng chat của AI khi nhận câu hỏi tương ứng:
1. **`MealSuggestionCard`:** Slider ngang 3 bữa ăn (Sáng/Trưa/Tối) — **Dữ liệu thật** từ `mealPreview`.
2. **`IngredientMapCard`:** Bản đồ gợi ý điểm bán nguyên liệu — **Mock Phase 1**.
3. **`WeeklyComplianceCard`:** Biểu đồ SVG % tuân thủ tuần 7 ngày — **Mock Phase 1**.
4. **`DoctorNoteCard`:** Bento card lời dặn & cảnh báo của bác sĩ — **Mock Phase 1**.

---

## 2. Danh sách File tác động

- **[NEW]** `frontend/lib/patient-chat-mock-intents.ts` (T1.7: Detector nhận diện câu hỏi cho 3 card mock)
- **[NEW]** `frontend/lib/patient-chat-mock-data.ts` (Dữ liệu mẫu cho map, chart, doctor note)
- **[NEW]** `frontend/components/patient-chat/cards/MealSuggestionCard.tsx` (T1.8)
- **[NEW]** `frontend/components/patient-chat/cards/IngredientMapCard.tsx` (T1.9)
- **[NEW]** `frontend/components/patient-chat/cards/WeeklyComplianceCard.tsx` (T1.10)
- **[NEW]** `frontend/components/patient-chat/cards/DoctorNoteCard.tsx` (T1.11)

---

## 3. Hướng dẫn chi tiết từng Task

### T1.7 — Mock Intent Detector & Mock Data
Tạo `frontend/lib/patient-chat-mock-intents.ts`:
```ts
// TODO(phase2): Thay bằng intent thật từ backend, xoá detector này ở Phase 3.
export type MockCardIntent = "grocery_list" | "weekly_compliance" | "doctor_note" | null;

export function detectMockCardIntent(message: string): MockCardIntent {
  const m = message.toLowerCase();
  if (/đi chợ|mua (nguyên liệu|thực phẩm|đồ ăn)|siêu thị|chợ gần|mua ở đâu/.test(m)) {
    return "grocery_list";
  }
  if (/tuân thủ.*tuần|tuần này.*tuân thủ|báo cáo tuân thủ|tỉ lệ tuân thủ/.test(m)) {
    return "weekly_compliance";
  }
  if (/bác sĩ dặn|lời nhắc bác sĩ|ghi chú bác sĩ|bác sĩ có dặn/.test(m)) {
    return "doctor_note";
  }
  return null;
}
```

Tạo `frontend/lib/patient-chat-mock-data.ts` chứa dữ liệu mẫu chuẩn theo mockup:
- `MOCK_GROCERY_DATA`: Area "Quận 3", 2 điểm bán "Co.opmart", "Chợ Vườn Chuối".
- `MOCK_COMPLIANCE_DATA`: `overallPct: 92`, `dailyPct: [80, 85, 88, 90, 90, 95, 95]`.
- `MOCK_DOCTOR_NOTE_DATA`: Bác sĩ Minh Nguyễn, Khoa Tim mạch, Quote "Hãy duy trì việc đi bộ 30p mỗi ngày và hạn chế tinh bột trắng.", tags "Hạn chế muối" (warning), "Tái khám 2 tuần" (info).

---

### T1.8 — `MealSuggestionCard` (Restyle từ mockup `meal-suggestion`)
- **File:** `frontend/components/patient-chat/cards/MealSuggestionCard.tsx`
- **Props:** `preview: MealPreviewOut`, `onApplyPlan?: (id: string) => void`.
- **UI:**
  - Slider ngang cuộn mượt (`overflow-x-auto no-scrollbar`) chứa các thẻ bữa ăn (Sáng/Trưa/Tối).
  - Mỗi thẻ: Thumbnail ảnh món, badge thời điểm bữa ăn ("Sáng", "Trưa", "Tối"), tên món ăn, lượng kcal (`local_fire_department`), 2 badge dinh dưỡng (ví dụ: `High Protein`, `Low GI`, `Omega-3`).
  - Phần chân card: Khung tổng dinh dưỡng (Tổng Calo, Đạm, Đường, Béo) + nút "Áp dụng thực đơn này" + link "Xem chi tiết tại Thực đơn".

---

### T1.9 — `IngredientMapCard` (Mockup `ingredient-map`)
- **File:** `frontend/components/patient-chat/cards/IngredientMapCard.tsx`
- **UI:**
  - Khung bản đồ `rounded-[20px]` bo tròn với ảnh bản đồ nền.
  - Marker vị trí trung tâm nhấp nháy (`animate-ping`).
  - Hộp card nổi góc trên phải: Header "GẦN BẠN NHẤT", danh sách 2–3 điểm bán kèm số thứ tự (1, 2).
  - Nút tròn "Xem bản đồ lớn" ở giữa phía dưới.

---

### T1.10 — `WeeklyComplianceCard` (Mockup `weekly-compliance-dock`)
- **File:** `frontend/components/patient-chat/cards/WeeklyComplianceCard.tsx`
- **UI:**
  - Khung bo tròn `rounded-[20px] bg-white border border-outline-variant/30 p-6`.
  - Header: Số lớn `92%` màu xanh chính + nhãn "TUÂN THỦ TRUNG BÌNH TUẦN".
  - Biểu đồ đường SVG 7 ngày: Đường vẽ stroke `#006c49` nối 7 điểm (T2 đến CN) kèm vùng gradient mờ phía dưới và các nhãn % tại mỗi điểm.
  - Legend 3 màu: Đúng thực đơn (xanh), Thực đơn khác (xanh dương), Thiếu dữ liệu (xám).
  - Action link: "Xem báo cáo chi tiết ->" (khi bấm gọi `usePatientPanel().openPanel("menu")` để mở Side Panel Thực đơn).

---

### T1.11 — `DoctorNoteCard` (Mockup `doctor-note`)
- **File:** `frontend/components/patient-chat/cards/DoctorNoteCard.tsx`
- **UI:**
  - Bento card kính mờ `rounded-2xl p-6 border border-white/40 shadow-sm relative overflow-hidden`.
  - Header: Avatar BS. Minh Nguyễn + Khoa Tim mạch + Thời gian "08:15 AM".
  - Khung Quote: Icon `format_quote` màu xanh + văn bản in nghiêng `"Hãy duy trì việc đi bộ 30p mỗi ngày và hạn chế tinh bột trắng."`.
  - Action Chips: 1 pill đỏ cảnh báo `Hạn chế muối` (`bg-error-container text-on-error-container`), 1 pill xanh `Tái khám 2 tuần`.

---

## 4. Tiêu chí Hoàn thành
- [x] Gõ "Hôm nay ăn gì" -> Hiển thị đúng slider ngang món ăn từ API thật.
- [x] Gõ "Mua nguyên liệu ở đâu" -> Hiển thị card bản đồ `IngredientMapCard`.
- [x] Gõ "Tuân thủ tuần này thế nào" -> Hiển thị card `WeeklyComplianceCard`, bấm "Xem báo cáo chi tiết" mở panel Thực đơn.
- [x] Gõ "Bác sĩ dặn gì" -> Hiển thị card `DoctorNoteCard`.

