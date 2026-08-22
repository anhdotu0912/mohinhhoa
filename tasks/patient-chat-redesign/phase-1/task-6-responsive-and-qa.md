# Task 1.15 & 1.16 — Rà soát Responsive & Checklist QA Nghiệm thu Phase 1

> **Thư mục:** [`tasks/patient-chat-redesign/phase-1/`](README.md)  
> **Phụ thuộc:** Hoàn thành tất cả các task từ [`task-1-tokens-and-provider.md`](task-1-tokens-and-provider.md) đến [`task-5-side-panels.md`](task-5-side-panels.md).

---

## Phần 1: T1.15 — Rà soát Responsive Mobile & Bottom Sheet

### 1. Mục tiêu
Đảm bảo toàn bộ hệ thống giao diện mới hoạt động hoàn hảo trên cả màn hình Desktop (`>=768px`) và Mobile (`<768px`):
1. **Side Panels chuyển thành Bottom Sheet:**
   - Trên mobile (`<768px`), các panel trượt từ cạnh phải chuyển thành **Bottom Sheet** trượt từ dưới lên (`rounded-t-[32px] w-full max-h-[90vh]`).
   - Có "drag handle" đặc trưng ở đỉnh sheet: `<div class="w-12 h-1 bg-gray-300 rounded-full mx-auto my-2 md:hidden"></div>`.
2. **Dock điều hướng chuyển thành Bottom Navigation Bar:**
   - Trên mobile, ẩn dock bên phải (`hidden md:flex`), hiển thị Bottom Navigation Bar cố định ở đáy màn hình.
   - Nút Thông báo ở giữa được nhô lên nhẹ (`-translate-y-2`) tạo điểm nhấn.
3. **Khoá cuộn nền (Scroll Lock):**
   - Khi bất kỳ Panel hoặc Modal nào đang mở, khoá cuộn `document.body` (`overflow: hidden`) để người dùng không bị cuộn kẹt trang chat phía sau.
4. **Không đè vùng nhập liệu:**
   - Đảm bảo thanh chat input ở đáy màn hình có khoảng đệm (`padding-bottom`) hợp lý, không bị Bottom Navigation Bar che khuất.

---

## Phần 2: T1.16 — Checklist QA Click-through Nghiệm thu Giai đoạn 1

Thực hiện tuần tự 8 bước kiểm thử thực tế trên trình duyệt để nghiệm thu toàn bộ Giai đoạn 1:

| Bước | Hành động | Kết quả mong đợi | Trạng thái |
|---|---|---|:---:|
| **1** | Đăng nhập tài khoản bệnh nhân (`demo_patient_1` hoặc user bệnh nhân) | Vào thẳng `/patient`, hiển thị đúng màn hình `chat-home` (Avatar AI nổi, Greeting chào buổi sáng, 4 Chip gợi ý, Input bo tròn). | [x] |
| **2** | Bấm Chip 1 ("Hôm nay ăn gì?") hoặc gõ "Hôm nay tôi nên ăn gì?" | Nhận câu trả lời stream từ AI kèm card `MealSuggestionCard` dạng slider ngang 3 bữa ăn (Sáng/Trưa/Tối). | [x] |
| **3** | Gõ "Mua nguyên liệu ở đâu quanh đây?" | AI trả về card bản đồ `IngredientMapCard` với 2 điểm bán "Co.opmart" và "Chợ Vườn Chuối". | [x] |
| **4** | Gõ "Tuân thủ của tôi tuần này thế nào?" | AI trả về card `WeeklyComplianceCard` với biểu đồ SVG 92% và legend 3 màu. Bấm "Xem báo cáo chi tiết" mở ngay panel Thực đơn. | [x] |
| **5** | Gõ "Bác sĩ có dặn gì tôi không?" | AI trả về card `DoctorNoteCard` (Bento glass, quote lời khuyên, 2 tag "Hạn chế muối" và "Tái khám 2 tuần"). | [x] |
| **6** | Bấm nút **"Thực đơn"** trên dock phải | Panel trượt mở ra mượt mà từ bên phải. Thấy 3 bữa hôm nay. Bấm "Ăn đúng" -> Trạng thái đổi thành "Đã ghi nhận", dữ liệu lưu vào DB. | [x] |
| **7** | Bấm nút **"Thông báo"** -> Click 1 thông báo | Panel danh sách mở ra -> Click thông báo duyệt thực đơn -> Modal chi tiết mở -> Nút "Xem thực đơn tuần mới" hoạt động -> Bấm đóng quay lại chat. | [x] |
| **8** | Bấm nút **"Chỉ số sức khỏe"** -> "Ghi nhận chỉ số" | Panel mở ra -> Thấy sparkline & vitals -> Bấm "Ghi nhận chỉ số" chuyển sang Form -> Nhập Cân nặng 68kg, HA 120/80 -> Bấm Lưu -> Quay lại dock cập nhật số mới. | [x] |
| **9** | Thu nhỏ trình duyệt về kích thước Mobile (`<768px`) | Dock chuyển thành Bottom Nav Bar, Panel mở thành Bottom Sheet có drag handle, thao tác mượt mà không vỡ layout. | [x] |
| **10** | Đăng nhập tài khoản Bác sĩ (`demo_doctor`) -> Vào `/doctor` | **Xác nhận giao diện Bác sĩ (Sidebar, Dashboard, Bệnh nhân, Duyệt thực đơn) hoàn toàn KHÔNG THAY ĐỔI.** | [x] |


---

## 3. Lệnh Kiểm tra Tự động trước khi Chốt Giai đoạn 1

Chạy các lệnh sau trong terminal để đảm bảo codebase sạch sẽ:

```powershell
# 1. Kiểm tra lỗi cú pháp và kiểu dữ liệu TypeScript
cd frontend
npx tsc --noEmit

# 2. Kiểm tra linter
npm run lint

# 3. Build thử nghiệm sản phẩm
npm run build
```

> **Khi tất cả các tiêu chí trên đạt yêu cầu -> Hoàn tất Giai đoạn 1 và sẵn sàng chuyển sang Giai đoạn 2 (Backend & Contract Integration).**
