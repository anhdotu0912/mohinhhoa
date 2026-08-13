# Hướng dẫn khởi chạy dự án (How to Run)

Dự án này bao gồm hai phần chính: **Frontend** (Next.js) và **Backend** (FastAPI). Dưới đây là các bước để khởi chạy dự án trên môi trường phát triển (development) của bạn.

---

## 1. Khởi chạy Backend (FastAPI)

Backend được xây dựng bằng Python và FastAPI.

### Yêu cầu tiên quyết
- Cài đặt Python 3.9+ 

### Các bước thực hiện:
1. **Di chuyển vào thư mục backend:**
   ```bash
   cd backend
   ```

2. **(Tùy chọn nhưng khuyến nghị) Tạo và kích hoạt môi trường ảo (virtual environment):**
   - Trên Windows:
     ```bash
     python -m venv .venv
     .venv\Scripts\activate
     ```
   - Trên macOS/Linux:
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```

3. **Cài đặt các thư viện phụ thuộc:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Khởi chạy server FastAPI:**
   ```bash
   uvicorn app.main:app --reload
   ```

   *Server backend sẽ chạy tại địa chỉ: `http://localhost:8000`*
   *Bạn có thể xem tài liệu API (Swagger UI) tại: `http://localhost:8000/docs`*

---

## 2. Khởi chạy Frontend (Next.js)

Frontend được xây dựng bằng Next.js (React) và TypeScript.

### Yêu cầu tiên quyết
- Cài đặt Node.js (phiên bản 18.x trở lên)

### Các bước thực hiện:
1. **Mở một terminal mới và di chuyển vào thư mục frontend:**
   ```bash
   cd frontend
   ```

2. **Cài đặt các gói phụ thuộc (dependencies):**
   ```bash
   npm install
   ```

3. **Khởi chạy máy chủ phát triển (development server):**
   ```bash
   npm run dev
   ```

   *Giao diện frontend sẽ có thể truy cập được tại: `http://localhost:3000`*

---

## 3. Khởi chạy bằng Docker (Nếu có cấu hình Docker Compose)
Nếu bạn muốn chạy cả Frontend và Backend cùng lúc thông qua Docker:

1. Đảm bảo bạn đã cài đặt Docker và Docker Compose.
2. Tại thư mục gốc của dự án, chạy lệnh:
   ```bash
   docker-compose up --build
   ```
3. Sau khi build xong, hệ thống sẽ tự động khởi chạy cả hai dịch vụ.


 │ Role      │ Email                      │ Password │
  ├───────────┼────────────────────────────┼──────────┤
  │ Bệnh nhân │ demo_patient_1@example.com │ demo1234 │
  ├───────────┼────────────────────────────┼──────────┤
  │ Bác sĩ    │ demo_doctor@example.com    │ demo1234 │