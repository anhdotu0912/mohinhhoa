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

4. **Cấu hình LLM (tùy chọn) trong `.env` ở root repo** (hoặc `backend/.env`):
   ```bash
   LLM_PROVIDER=deepseek
   LLM_MODEL=deepseek-chat
   DEEPSEEK_API_KEY=sk-...
   ```
   File `.env` của project **ghi đè** biến môi trường Windows cùng tên. Thiếu key → gen thực đơn vẫn chạy (xoay vòng catalog, không gọi LLM).
   OpenAI: `LLM_PROVIDER=openai`, `LLM_MODEL=gpt-4o-mini`, `OPENAI_API_KEY=sk-...`

   Embedding Gemini: nhiều key cách nhau bởi dấu phẩy — xoay khi hết quota / 429:

   ```bash
   GEMINI_API_KEY=key-1,key-2,key-3
   ```

5. **Khởi chạy server FastAPI:**
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

**Deploy lên VPS (Postgres + Nginx + HTTPS):** xem [`deploy/README.md`](deploy/README.md) và chạy `./deploy/bootstrap.sh` sau khi cấu hình `.env` production.

BÁC SĨ
Email: demo_doctor@example.com
Mật khẩu: demo1234

Bệnh nhân 1: demo_patient_1@example.com / demo1234 (Nguyễn Văn A)
Bệnh nhân 2: demo_patient_2@example.com / demo1234 (Trần Thị B)
Bệnh nhân 3: demo_patient_3@example.com / demo1234 (Lê Văn C)

### Quên mật khẩu (gửi mật khẩu mới qua email)

Luồng: `/forgot-password` → BE tạo mật khẩu tạm → gửi SMTP → mật khẩu cũ hết hiệu lực → đăng nhập bằng mật khẩu trong email.

Thêm vào `.env` (root repo hoặc `backend/.env`) — **chỉ 2 dòng**:

```bash
SMTP_USERNAME=ban@gmail.com
SMTP_PASSWORD="xxxx xxxx xxxx xxxx"
```

**Gmail:** bật xác minh 2 bước, tạo [App Password](https://myaccount.google.com/apppasswords) 16 ký tự (không dùng mật khẩu Gmail thường). Bọc trong dấu ngoặc kép; code tự bỏ khoảng trắng. Email trường (`@vnu.edu.vn`) thường bị admin chặn SMTP — nếu vẫn `EMAIL_AUTH_FAILED`, dùng Gmail cá nhân. Sửa `.env` xong phải **restart uvicorn** (reload không theo dõi file `.env`).

Nếu chưa cấu hình SMTP, API trả `503 EMAIL_NOT_CONFIGURED`. Kiểm tra cả hộp thư rác.

Rate-limit đăng nhập: sau 5 lần sai / 15 phút → `429 TOO_MANY_ATTEMPTS`.