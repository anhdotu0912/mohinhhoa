# 📘 TÀI LIỆU MÔ TẢ HỆ THỐNG & KỊCH BẢN SỬ DỤNG
## Dự án: VMEC-10 — AI Agent Trợ Lý Dinh Dưỡng & Lối Sống Theo Bệnh Lý



## 1. Danh Mục Chức Năng Hệ Thống (System Feature Matrix)

Hệ thống phục vụ **2 vai trò chính (Actors)**: **Bệnh nhân (Patient)** và **Chuyên gia Dinh dưỡng / Bác sĩ (Dietitian/Doctor)** dưới sự điều phối của **AI Agent Core**.


![Mindmap dự án](mermaid-diagram-2026-08-13-165340.png)

### 1.1. Phân loại Tính năng Chi tiết

| ID | Tên Chức năng | Vai trò chính | Phân loại | Trạng thái Repo | Mô tả chi tiết |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **F-01** | Khai báo Hồ sơ & Ràng buộc Bệnh lý | Bệnh nhân | Cơ bản | 🟢 Đã có | Nhập chiều cao, cân nặng, bệnh lý (Tiểu đường, Tim mạch, Thận, Gout), danh sách thuốc đang dùng, dị ứng, mức độ vận động. |
| **F-02** | Sinh Thực đơn 7 ngày Y khoa | Bệnh nhân / AI Agent | Cơ bản | 🟢 Đã có | AI Agent tự động tính toán nhu cầu Kcal, Macronutrients (Carb/Protein/Fat/Sodium), tra cứu CSDL thực phẩm VN và sinh thực đơn 7 ngày có trích dẫn nguồn. |
| **F-03** | Tự động Đổi món Tương tác Thuốc (Auto-Swap) | AI Agent | Cơ bản | 🟢 Đã có | Tự động phát hiện món ăn tương tác nguy hiểm với thuốc bệnh nhân đang dùng (ví dụ: bưởi + thuốc hạ áp) và thay thế bằng món an toàn cùng nhóm. |
| **F-04** | Kiểm tra Tương tác Thuốc - Thực phẩm | Bệnh nhân / AI Agent | Cơ bản | 🟢 Đã có | Cho phép bệnh nhân tra cứu chủ động một hoặc nhiều món ăn xem có kỵ với thuốc mình đang dùng hay không. |
| **F-05** | Duyệt & Phê duyệt Thực đơn (HITL) | Bác sĩ / Chuyên gia | Cơ bản / HITL | 🟢 Đã có | Chuyên gia xem danh sách thực đơn do AI khởi tạo, phê duyệt (Approve) hoặc chỉnh sửa (Edit) trước khi áp dụng chính thức cho bệnh nhân. |
| **F-06** | Hộp thoại Chat Trợ lý AI (RAG QA) | Bệnh nhân / AI Agent | Cơ bản | 🟢 Đã có | Hỏi đáp về kiến thức dinh dưỡng y khoa grounded trên guideline y tế (ADA, Bộ Y tế). Chặn chỉ định y khoa/kê đơn. |
| **F-07** | Ghi Nhật ký Ăn uống (Food Log) | Bệnh nhân | Cơ bản | 🟢 **Đã có (core)** | Nhập tay có cấu trúc 3 slot (`morning\|noon\|evening`), type `as_planned\|custom` + ghi chú — modal trên `/patient/meals`, API `POST/GET /food-log` (ADR-009). Không chụp ảnh/NLP. |
| **F-08** | Cảnh báo Vượt ngưỡng Muối / Đường theo Bệnh lý | AI Agent | Nâng cao | 🟡 **Cần nâng cấp** | Cảnh báo đỏ khi tổng lượng Natri vượt ngưỡng cho bệnh nhân Tim mạch/Thận ($<2000\text{mg/ngày}$) hoặc lượng Đường vượt ngưỡng cho Tiểu đường. |
| **F-09** | Tạo Danh sách Đi chợ (Shopping List) | Bệnh nhân | Nâng cao | 🔴 **Cần code** | Gom tổng hợp toàn bộ nguyên liệu của thực đơn 7 ngày đã duyệt thành danh sách phân loại (Rau, Thịt, Gia vị...) để đi chợ. |
| **F-10** | Phân tích Xu hướng Dinh dưỡng (Nutrition Analytics) | Bệnh nhân / Bác sĩ | Nâng cao | 🟡 **Partial** | Time-series chỉ số cơ thể Done (`/patient/history`, ADR-013). Phân tích nâng cao so target dinh dưỡng/tuần-tháng và AI advice khi chỉ số đổi — Planned. |
| **F-11** | Memory Sở thích & Nguyên liệu Tủ lạnh | AI Agent | Nâng cao | 🔴 **Cần code** | Ghi nhớ món ăn yêu thích/ghét và tận dụng nguyên liệu đang có sẵn trong tủ lạnh (pantry) khi lập thực đơn. |
| **F-12** | Guardrail Kiểm tra Nguồn (Source Check) | AI Agent Guardrail | Nâng cao | 🟡 **Partial** | `enforce_citation_guardrail` wired — redact RAG thiếu citation; `enforce_output_safety` chặn khuyến nghị đổi thuốc. Cross-check số liệu dinh dưỡng tự động toàn phần (`validate_interaction_output`, `sanitize_recommendation`) — chưa wired runtime. |

---

## 2. Kịch Bản Sử Dụng Thực Tế (Use Case Scenarios)

### 📌 Kịch bản 1: Onboarding & Sinh Thực Đơn 7 Ngày (Bệnh nhân Bác sĩ HITL)
* **Actor**: Bệnh nhân Nguyễn Văn A (55 tuổi, Bệnh lý: **Tiểu đường Type 2 + Tim mạch**, Thuốc: **Metformin, Atorvastatin**, Dị ứng: **Hải sản**).
* **Luồng từng bước**:
  1. **Bước 1 (Nhập hồ sơ)**: Bệnh nhân đăng nhập vào hệ thống, hoàn thành Form Onboarding nhập thông tin chỉ số cơ thể, bệnh lý, thuốc đang dùng và dị ứng hải sản.
  2. **Bước 2 (Gửi yêu cầu)**: Bệnh nhân nhấn nút *"Tạo thực đơn 7 ngày chuẩn y khoa"*.
  3. **Bước 3 (AI Agent xử lý)**:
     - Agent phân tích nhu cầu Kcal ($1800\text{ kcal/ngày}$).
     - Lọc bỏ cứng các món hải sản (do dị ứng).
     - Tra CSDL thực phẩm Việt Nam chọn các món chỉ số GI thấp (Cơm gạo lứt, ức gà, rau cải...).
     - Phát hiện bưởi kỵ với Atorvastatin $\rightarrow$ Tự động đổi bưởi thành táo tây (Auto-swap).
     - Gán nhãn trích dẫn `ada_diabetes.md` và `food_db_vn#thit_ga`.
     - Đặt trạng thái thực đơn: `pending_review` (Chờ chuyên gia duyệt).
  4. **Bước 4 (Chuyên gia thẩm định - HITL)**:
     - Bác sĩ Dinh dưỡng đăng nhập vào Bảng điều khiển Chuyên gia ([`/doctor/reviews`](file:///Users/nguyenthientai/Documents/VINAI/P-014/frontend/app/doctor/reviews/page.tsx)).
     - Xem chi tiết thực đơn 7 ngày của bệnh nhân A, kiểm tra cảnh báo dị ứng và món auto-swap.
     - Bác sĩ điều chỉnh giảm $10\text{g}$ cơm ở bữa tối và nhấn **"Phê duyệt (Approve)"**.
  5. **Bước 5 (Nhận kết quả)**: Thực đơn chuyển trạng thái `approved`. Bệnh nhân nhận thông báo và xem thực đơn hoàn chỉnh trên ứng dụng.

---

### 📌 Kịch bản 2: Tra Cứu Tương Tác Thuốc - Thực Phẩm Khẩn Cấp
* **Actor**: Bệnh nhân B.
* **Luồng từng bước**:
  1. Bệnh nhân B mở ứng dụng và gõ vào ô chat: *"Tôi đang uống thuốc huyết áp Amlodipine, hôm nay ăn bưởi da xanh hoặc uống nước ép bưởi có sao không?"*.
  2. Frontend gửi request tới API `/api/v1/chat`.
  3. LangGraph Intent Classifier phân loại ý định: `interaction_check`.
  4. Agent kích hoạt `InteractionCheckerAgent`:
     - Trích xuất Thuốc: `Amlodipine`, Thực phẩm: `bưởi`.
     - Tra CSDL `drug_food_interactions.json`.
     - Phát hiện tương tác mức độ **[Nguy hiểm]**: Bưởi làm tăng nồng độ Amlodipine trong máu, gây hạ huyết áp quá mức.
  5. Agent áp dụng Guardrail Rules: Đưa ra cảnh báo nguy hiểm, hướng dẫn tránh ăn bưởi gần thời gian uống thuốc, và đính kèm Disclaimer *"Vui lòng tham vấn bác sĩ nếu xuất hiện triệu chứng chóng mặt"*.

---

### 📌 Kịch bản 3: Ghi Nhật ký Ăn uống & Cảnh báo Tương tác (Food Log — as-built ADR-009)
* **Actor**: Bệnh nhân C (đang dùng thuốc có tương tác thực phẩm).
* **Luồng từng bước (as-built):**
  1. Sau bữa trưa, Bệnh nhân C mở `/patient/meals` → bấm "Ghi nhận" trên hàng bữa trưa → modal chọn **"Ăn khác"** + ghi chú tự do (VD: "bún nước lèo").
  2. `POST /api/v1/food-log` persist log với `slot=noon`, `type=custom`.
  3. BE quét ghi chú với KB tương tác thuốc–thực phẩm → nếu khớp cặp nguy hiểm → tạo `Alert` + link `food_log_id`.
  4. Bệnh nhân xem tóm tắt trên `/patient/history`; cảnh báo vượt ngưỡng Natri tự động theo dinh dưỡng thực tế — **chưa implement** (ngoài phạm vi ADR-009).

> **Lưu ý:** Kịch bản gốc (2026-08-13) mô tả NLP/ảnh và cảnh báo Natri tự động — chưa khớp as-built. Sơ đồ UML đính kèm (ảnh 2026-08-13) có thể chưa phản ánh Food Log Done và Metrics time-series (2026-08-17).

---

## 📐 3. Các Sơ đồ UML & Luồng Hoạt Động (UML Diagrams)

> **Lưu ý cập nhật (2026-08-17):** Các ảnh diagram bên dưới được export **2026-08-13**, trước khi Food Log (ADR-009), Patient Metrics time-series (ADR-013) và Doctor Compliance View (spec 10) được implement. Dùng làm tham chiếu kiến trúc tổng quan; chi tiết as-built xem `docs/MO_TA_HE_THONG.md`, `docs/architecture_diagram.md`, `specs/`.

### 3.1. Sơ đồ Use Case Tổng quan (UML Use Case Diagram)

![Use Case Diagram](mermaid-diagram-2026-08-13-164820.png)

---

### 3.2. Luồng Điều Phối AI Agent Nội Bộ (LangGraph State Machine Diagram)

![LangGraph State Machine Diagram](mermaid-diagram-2026-08-13-164422.png)

---

### 3.3. Sequence Diagram 1: Luồng Sinh Thực Đơn 7 Ngày & Phê Duyệt HITL

![Sequence Diagram 1](mermaid-diagram-2026-08-13-164938.png)

---

### 3.4. Sequence Diagram 2: Luồng Ghi Nhật Ký Ăn Uống & Cảnh Báo Vượt Ngưỡng (Food Log)

![Sequence Diagram 2](mermaid-diagram-2026-08-13-165009.png)

---

### 3.5. Activity Diagram: Luồng Kiểm Duyệt An Toàn Y Tế (Guardrails Flow)

![Activity Diagram](mermaid-diagram-2026-08-13-165045.png)

---

