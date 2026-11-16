# P-014 — VinNutri — AI Agent Trợ Lý Dinh Dưỡng & Lối Sống Theo Bệnh Lý

Prototype giúp bệnh nhân đái tháo đường Type 2 nhận thực đơn 7 ngày cá nhân hoá, cảnh báo tương tác thuốc–thực phẩm, nhắc tuân thủ (compliance), và dashboard cho bác sĩ/chuyên gia dinh dưỡng duyệt thực đơn.

Tài liệu chi tiết: [`CLAUDE.md`](CLAUDE.md) · [`docs/MO_TA_HE_THONG.md`](docs/MO_TA_HE_THONG.md) · [`tasks/roadmap-mvp.md`](tasks/roadmap-mvp.md)

**🔗 Live Demo:** [https://c014-vinnutri.vercel.app/](https://c014-vinnutri.vercel.app/)
**🎥 Video Demo:** [Google Drive](https://drive.google.com/drive/folders/1YrySh5rVyVGAyLuNVVEDhZjmaoVwaKv5?usp=drive_link)
**📊 Pitch Deck:** [Google Drive](https://drive.google.com/drive/folders/1q6dLVxHxKL_8zdsNF4rW-St1f3dEmW6w?usp=drive_link)

---

## Vấn đề (Problem)

Bệnh nhân mắc bệnh mãn tính (đái tháo đường Type 2 và các bệnh lý liên quan) phải tự lập thực đơn hàng ngày phù hợp với bệnh lý, thuốc đang dùng và dị ứng — nhưng thường thiếu công cụ hỗ trợ, dễ ăn nhầm thực phẩm tương tác nguy hiểm với thuốc (vd. rượu bia với Metformin) và không có ai nhắc nhở tuân thủ giữa các lần tái khám. Bác sĩ/chuyên gia dinh dưỡng thì không đủ thời gian soạn thực đơn cá nhân hoá cho từng bệnh nhân.

## Giải pháp (Solution)

**VinNutri** là AI Agent trợ lý dinh dưỡng lâm sàng: sinh thực đơn 7 ngày cá nhân hoá dựa trên hồ sơ bệnh lý (RAG trên guideline y khoa Việt Nam + ADA), tự động kiểm tra tương tác thuốc–thực phẩm và dị ứng, cảnh báo khi vi phạm. Mọi thực đơn AI sinh ra đều phải qua bác sĩ duyệt trước khi đến tay bệnh nhân (Human-in-the-Loop bắt buộc), và mọi số liệu tư vấn đều có nguồn trích dẫn để tránh hallucination. Bệnh nhân nhận nhắc nhở tuân thủ (Compliance Notification), ghi nhật ký ăn uống và theo dõi chỉ số sức khoẻ theo thời gian; bác sĩ có dashboard quản lý hàng đợi duyệt và theo dõi tuân thủ của bệnh nhân.

---

## Yêu cầu

| Thành phần | Phiên bản |
|---|---|
| Python | 3.11+ |
| Node.js | 18+ |
| Docker + Docker Compose | Khuyến nghị (Postgres nằm trong stack) |
| PostgreSQL | Chỉ cần cài tay nếu chạy backend **không** dùng Docker |

---

## Tech stack

| Layer | Công nghệ |
|---|---|
| Backend | FastAPI, SQLAlchemy, JWT |
| AI | LangGraph, LangChain, Gemini embedding, Qdrant |
| Frontend | Next.js 16, Tailwind, Zustand |
| Database | PostgreSQL (dev + prod, chạy trong Docker Compose) |
| Deploy | Docker Compose, Nginx + Let's Encrypt (VPS) |

---

## Cấu trúc thư mục

Luồng thực đơn hiện tại: bệnh nhân vào **Tạo thực đơn của tôi** (`/patient/meal-plan`), thêm ghi chú và bấm **Tạo thực đơn bằng AI**. AI tạo bản 7 ngày ở trạng thái **Chờ bác sĩ duyệt**. Bác sĩ kiểm tra/chỉnh sửa/duyệt trong **Hàng việc**, rồi áp dụng lịch. Bản chưa duyệt chỉ để xem trước; không dùng để ghi nhận bữa ăn. Bác sĩ không khởi tạo thực đơn mới.

```
P-014/
├── backend/app/          # FastAPI + agents + RAG
├── backend/data/         # food_db_vn.json, drug_food_interactions.json, guidelines/
├── backend/qdrant_db/    # Qdrant index snapshot (tracked — zero-setup demo)
├── frontend/             # Next.js App Router
├── deploy/               # bootstrap.sh, nginx, certbot
├── docker-compose.yml    # Local dev stack
├── docker-compose.prod.yml
├── specs/                # Business specs 01–13
├── contracts/            # API + agent I/O schemas
└── .env.example          # Env template (copy → .env)
```

---

## Quick start — local dev

### 1. Chuẩn bị môi trường (bắt buộc)

```bash
cp .env.example .env
```

File `.env` ở **root repo** là bắt buộc — `docker-compose.yml` đọc `env_file: .env`. Thiếu file này, `docker compose up` sẽ fail.

**LLM / embedding (tùy chọn):** điền `DEEPSEEK_API_KEY` hoặc `OPENAI_API_KEY`, và `GEMINI_API_KEY` (RAG embedding). Thiếu key → sinh thực đơn vẫn chạy (xoay vòng catalog, không gọi LLM).

```bash
# Ví dụ DeepSeek
LLM_PROVIDER=deepseek
LLM_MODEL=deepseek-chat
DEEPSEEK_API_KEY=sk-...

# Embedding Gemini — nhiều key cách nhau bởi dấu phẩy, xoay khi hết quota / 429
GEMINI_API_KEY=key-1,key-2,key-3
```

File `.env` của project **ghi đè** biến môi trường Windows cùng tên. Có thể dùng thêm `backend/.env` nếu cần override cục bộ.

### 2. Chạy full stack bằng Docker (khuyến nghị)

Postgres được tạo tự động trong stack — không cần cài hay khởi động Postgres riêng.

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Swagger: http://localhost:8000/docs
- Health: http://localhost:8000/health

### 3. Chạy tay (không Docker)

**Bước 1 — PostgreSQL phải chạy trước.** Backend gọi `init_db()` ngay khi khởi động; thiếu Postgres → crash.

```bash
# Cách nhanh nhất: chỉ bật Postgres từ Docker Compose
docker compose up postgres -d
```

Hoặc dùng Postgres cài sẵn trên máy — sửa `DATABASE_URL` trong `.env` cho khớp (mặc định: `postgresql://p014:p014@localhost:5432/p014`).

**Bước 2 — Backend:**

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Bước 3 — Frontend** (terminal mới):

```bash
cd frontend
npm ci
npm run dev
```

Frontend mặc định gọi API tại `http://localhost:8000` — không bắt buộc tạo `frontend/.env.local` trừ khi backend chạy ở URL khác.

### 4. Index RAG (nếu vector store trống)

```bash
cd backend
python -m app.rag.indexer
```

Vector store duy nhất: **Qdrant** (`QDRANT_PERSIST_DIR`, mặc định `./qdrant_db`; dùng `QDRANT_URL`/`QDRANT_API_KEY` cho Qdrant Server/Cloud).

---

## Demo accounts

Backend **không** tự tạo demo khi khởi động. Dùng CLI (local hoặc trên VPS sau khi bạn dọn DB):

```bash
cd backend
python -m scripts.create_demo_accounts
```

Non-interactive (CI / script):

```bash
python -m scripts.create_demo_accounts --password 'your-secret-min-8' --reset-passwords -y
```

| Role | Email |
|---|---|
| Bác sĩ 1 | `demo_doctor@example.com` |
| Bác sĩ 2 | `demo_doctor_2@example.com` |
| Bệnh nhân 1–4 | `demo_patient_1@example.com` … `demo_patient_4@example.com` (gắn sẵn BS. Minh) |
| Bệnh nhân 5 | `demo_patient_5@example.com` (chưa gắn — demo Hàng việc) |

Mật khẩu chỉ hiện trên terminal khi chạy CLI — **không** ghi vào repo. Production: chỉ chạy khi chủ đích (staging/chấm điểm); dọn account demo trên VPS bằng tay khi không cần.

---

## Deploy production — VPS

Chi tiết đầy đủ: [`docs/DEPLOY_VPS.md`](docs/DEPLOY_VPS.md)

### Yêu cầu

- VPS có Docker + Docker Compose
- Domain trỏ DNS về VPS (cho HTTPS)
- File `.env` production (copy từ `.env.example`)

### Biến môi trường bắt buộc (prod)

| Biến | Mô tả |
|---|---|
| `APP_ENV` | `production` |
| `JWT_SECRET` | Chuỗi ngẫu nhiên mạnh (≠ `change-me-dev-only`) |
| `POSTGRES_PASSWORD` | Mật khẩu Postgres |
| `DOMAIN` | Tên miền (vd. `app.example.com`) |
| `NEXT_PUBLIC_API_BASE_URL` | URL public (vd. `https://app.example.com`) |
| `CORS_ORIGINS` | Origin frontend (thường cùng domain) |
| `LLM_PROVIDER` + API key | `openai` / `deepseek` + key tương ứng |
| `GEMINI_API_KEY` | Embedding RAG (hoặc `EMBEDDING_PROVIDER=local`) |

### Bootstrap một lệnh

```bash
cp .env.example .env
# Chỉnh .env với giá trị production
bash deploy/bootstrap.sh
```

Script sẽ:
1. Build + start Postgres, backend, frontend
2. Đợi backend `/health`
3. Chạy `python -m app.rag.indexer`
4. Setup Nginx + Let's Encrypt (nếu `DOMAIN` đã set)

### Deploy frontend riêng (Vercel)

GitHub Actions workflow `.github/workflows/deploy.yml` deploy frontend khi push `main`/`dev`. Cần secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Set `NEXT_PUBLIC_API_BASE_URL` trên Vercel trỏ về backend public.

---

## Kiểm tra & CI

```bash
# Backend lint + test
cd backend
ruff check app/ tests/
pytest tests/ -v

# Frontend lint + build
cd frontend
npm run lint
npm run build
```

GitHub Actions (`.github/workflows/ci.yml`) chạy cả backend và frontend trên push/PR.

**Tài liệu kiểm thử đầy đủ** (kịch bản test theo từng spec, kết quả, coverage): [`tasks/test/README.md`](tasks/test/README.md). Kết quả đánh giá chất lượng (golden dataset, LLM-as-a-judge): [`eval/results/report.md`](eval/results/report.md).

---

## Troubleshooting

### Chat báo thiếu bộ nhớ / Windows error 1455

Máy ít RAM có thể không đủ bộ nhớ ảo để nạp mô hình embedding local. Đặt `RAG_RETRIEVAL_MODE=keyword` trong `.env`, rồi khởi động lại backend: chat sẽ dùng BM25 trên cùng tài liệu, giữ nguồn trích dẫn và không tải PyTorch/model cho truy vấn. Chế độ này tìm theo từ khóa, khả năng hiểu gần nghĩa thấp hơn dense. Khi đủ RAM hoặc có Gemini key hợp lệ, dùng lại `RAG_RETRIEVAL_MODE=dense`. Giao diện production (`docker compose up -d --no-deps frontend` sau khi build) nhẹ hơn `next dev`.

### Backend crash khi khởi động — không kết nối được Postgres

PostgreSQL chưa chạy hoặc `DATABASE_URL` sai. Chạy `docker compose up postgres -d` trước khi `uvicorn`, hoặc kiểm tra Postgres cài sẵn đang lắng nghe đúng host/port.

### `/health` trả `degraded` — vector store chưa sẵn sàng

```bash
docker compose exec backend python -m app.rag.indexer
# hoặc local:
cd backend && python -m app.rag.indexer
```

Index Qdrant persist tại `./backend/qdrant_db` (dev, đã tracked sẵn trong git) hoặc volume `qdrant_data` (prod — xem `docker-compose.prod.yml`).

### Backend không start ở production

`JWT_SECRET` vẫn là `change-me-dev-only` khi `APP_ENV=production` → app fail-fast. Đặt secret mạnh trong `.env`.

### Frontend gọi API sai URL

`NEXT_PUBLIC_API_BASE_URL` là **build-time** variable. Sau khi đổi, rebuild image frontend:

```bash
docker compose up --build frontend
```

### Quên mật khẩu (SMTP)

Luồng: `/forgot-password` → BE tạo mật khẩu tạm → gửi SMTP → đăng nhập bằng mật khẩu trong email.

Thêm vào `.env` (root repo hoặc `backend/.env`):

```bash
SMTP_USERNAME=ban@gmail.com
SMTP_PASSWORD="xxxx xxxx xxxx xxxx"
```

**Gmail:** bật xác minh 2 bước, tạo [App Password](https://myaccount.google.com/apppasswords) 16 ký tự. Bọc trong dấu ngoặc kép; code tự bỏ khoảng trắng. Sửa `.env` xong phải **restart uvicorn** (reload không theo dõi file `.env`).

Nếu chưa cấu hình SMTP, API trả `503 EMAIL_NOT_CONFIGURED`.

Rate-limit đăng nhập: sau 5 lần sai / 15 phút → `429 TOO_MANY_ATTEMPTS`.

---

## Team

| Thành viên | Vai trò |
|---|---|
| Nguyễn Thiên Tài | AI Engineer |
| Hoàng Văn Quang | Backend Engineer |
| Đỗ Tú Anh | Frontend Engineer |
| Thiều Thị Ngọc Ánh | Clinical QA & AI Evaluator |

---

## Liên quan

- Specs nghiệp vụ: [`specs/`](specs/)
- ADR kiến trúc: [`adrs/`](adrs/)
- Contract API: [`contracts/api-v1.md`](contracts/api-v1.md)
- Sơ đồ kiến trúc: [`ARCHITECTURE.md`](ARCHITECTURE.md) · [`docs/architecture_diagram.md`](docs/architecture_diagram.md)
- Tài liệu kiểm thử: [`tasks/test/README.md`](tasks/test/README.md)
- Kết quả đánh giá (eval): [`eval/results/report.md`](eval/results/report.md)
- Nhật ký tuần: [`JOURNAL.md`](JOURNAL.md) · Worklog hàng ngày: [`WORKLOG.md`](WORKLOG.md)
- AI Logs: [`.ai-log/`](.ai-log/)
