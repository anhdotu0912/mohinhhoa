# VinNutri trên Vercel Hobby và Neon Free

Frontend và backend là hai project Vercel trong cùng repo. Tài khoản, hồ sơ,
thực đơn, hội thoại và ảnh đại diện nằm trong PostgreSQL Neon; không dùng
filesystem tạm của function để lưu dữ liệu người dùng.

## 1. Tạo PostgreSQL miễn phí

Trong Vercel Storage/Marketplace, chọn Neon và gói Free (hoặc tạo project Free
trong Neon). Dùng connection string **pooled**, có `sslmode=require`. Không
chọn nâng cấp trả phí. Free tier có hạn mức; không cần VPS cho cấu hình này.

## 2. Chuẩn bị schema và dữ liệu mẫu

Copy `deploy/vercel/backend.env.example` thành `.env.vercel` ở gốc repo
(đã được Git bỏ qua). Điền `DATABASE_URL` và `JWT_SECRET` ngẫu nhiên đủ mạnh.
Không đưa nội dung file vào GitHub hoặc chat.

Từ gốc repo, dùng môi trường Python đã cài dependencies backend:

```powershell
python backend/scripts/bootstrap_cloud.py --env-file .env.vercel
```

Muốn dùng các tài khoản demo tổng hợp, đặt `DEMO_PASSWORD` trong file và chạy:

```powershell
python backend/scripts/bootstrap_cloud.py --env-file .env.vercel --with-demo
```

Đây là tác vụ quản trị chạy một lần. Backend không tự seed tài khoản khi có
request. Dữ liệu thật trên máy không được tự động chuyển lên cloud. Mật khẩu
demo trên màn hình đăng nhập chỉ đúng nếu được chọn giống khi seed.

## 3. Tạo project Vercel cho backend

- Repo: `anhdotu0912/mohinhhoa`.
- Branch: `feature/fe-patient-meal-plan-flow`.
- Đặt tên riêng, ví dụ `mohinhhoa-api`.
- Root Directory: để trống hoặc `./` (gốc repo, **không phải frontend**).
- Framework: **FastAPI**. Không điền lệnh build/install npm cho backend.
- Python: 3.12, theo `pyproject.toml`.
- Thêm các biến trong `deploy/vercel/backend.env.example` vào Preview/Production.
  `DEMO_PASSWORD` không cần đưa vào runtime. Lấy secret từ file riêng, không
  đặt secret trong `vercel.json`.
- `CORS_ORIGINS`: các origin frontend được phép truy cập, phân tách bằng dấu
  phẩy. Nếu kiểm tra bằng một URL Preview, thêm đúng origin đó. Không dùng `*`.
- Nếu Vercel Authentication chặn project backend, bỏ bảo vệ cho deployment API
  cần công khai. Các endpoint bệnh nhân/bác sĩ vẫn kiểm tra JWT của ứng dụng.
- Deploy, kiểm tra `/health` trả database `ok` và provider `bm25` ready.

`vercel_backend.py` trỏ đến cùng FastAPI app với bản local. Dependency ở
`pyproject.toml` là bộ nhẹ, không cài torch/sentence-transformers, Qdrant local,
pytest hay ruff. Dữ liệu tra cứu có nguồn vẫn được đóng gói trong function.
Chế độ hiện tại chạy được khi không có khóa LLM; đây không phải mô hình hội
thoại tổng quát và không hứa trả lời những dữ liệu chưa có.

## 4. Nối frontend

Project frontend giữ Root Directory `frontend` và Framework Next.js. Đặt:

```text
NEXT_PUBLIC_API_BASE_URL=https://TEN-PROJECT-BACKEND.vercel.app
```

Giá trị chỉ gồm origin, không thêm `/api/v1`. Áp dụng cho cả Preview/Production
đang dùng rồi tạo deployment frontend mới từ commit mới nhất; biến này được
đóng vào bundle lúc build. Thử đăng nhập, lưu hồ sơ, chat, tạo thực đơn và tải
ảnh. Kiểm tra trên domain production sau khi promote deployment tương ứng.

## Tài liệu nhà cung cấp

- FastAPI: https://vercel.com/docs/frameworks/backend/fastapi
- Python dependencies/giới hạn function: https://vercel.com/docs/functions/runtimes/python
- Hobby: https://vercel.com/docs/plans/hobby
- Neon Free: https://neon.com/docs/introduction/plans
