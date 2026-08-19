# Hướng dẫn deploy P-014 lên VPS

Tài liệu này mô tả cách triển khai **VMEC-10 (P-014)** lên VPS Ubuntu bằng Docker Compose.

Stack production gồm: **Postgres + Backend (FastAPI) + Frontend (Next.js) + Nginx + Certbot**. Postgres và vector store (Qdrant local) **được tạo tự động trong Docker** — bạn **không** cần cài Postgres/Qdrant riêng trên host.

---

## Mục lục

1. [Hai chế độ deploy](#1-hai-chế-độ-deploy)
2. [Yêu cầu](#2-yêu-cầu)
3. [Kiến trúc](#3-kiến-trúc)
4. [Chuẩn bị trước khi deploy](#4-chuẩn-bị-trước-khi-deploy)
5. [Cài Docker trên VPS](#5-cài-docker-trên-vps)
6. [Clone code](#6-clone-code)
7. [Cấu hình `.env`](#7-cấu-hình-env)
8. [Deploy production (domain + HTTPS)](#8-deploy-production-domain--https)
9. [Deploy IP-only (không domain)](#9-deploy-ip-only-không-domain)
10. [Kiểm tra sau deploy](#10-kiểm-tra-sau-deploy)
11. [Tài khoản demo](#11-tài-khoản-demo)
12. [Vận hành hàng ngày](#12-vận-hành-hàng-ngày)
13. [Backup & khôi phục](#13-backup--khôi-phục)
14. [SSL / gia hạn chứng chỉ](#14-ssl--gia-hạn-chứng-chỉ)
15. [Lỗi thường gặp](#15-lỗi-thường-gặp)
16. [Checklist nhanh](#16-checklist-nhanh)

---

## 1. Hai chế độ deploy

| | **Production (khuyến nghị)** | **IP-only (demo nhanh)** |
|---|---|---|
| File Compose | [`docker-compose.prod.yml`](../docker-compose.prod.yml) | [`docker-compose.yml`](../docker-compose.yml) |
| Domain | Có (HTTPS Let's Encrypt) | Không — truy cập qua `http://IP:3000` |
| Nginx / SSL | Có | Không |
| Postgres | Container Docker (tự tạo) | Container Docker (tự tạo) |
| Vector store | Qdrant local (volume Docker) | Qdrant local (volume bind) |
| Lệnh deploy | `./deploy/bootstrap.sh` | `docker compose up -d --build` |
| Template env gợi ý | `.env.example` | [`.env.vps`](../.env.vps) (copy thành `.env` trên VPS) |

**Khuyến nghị:** dùng chế độ **Production** khi có domain. Chế độ **IP-only** phù hợp test nội bộ hoặc demo tạm trước khi gắn domain.

---

## 2. Yêu cầu

| Hạng mục | Khuyến nghị |
|---|---|
| OS | Ubuntu 22.04 / 24.04 LTS |
| RAM | **4 GB** (tối thiểu 2 GB nếu giữ `EMBEDDING_PROVIDER=gemini`) |
| Disk | 40 GB |
| Domain (production) | A record trỏ về IP VPS |
| Ports mở (production) | **22**, **80**, **443** |
| Ports mở (IP-only) | **22**, **3000**, **8000** (hoặc chỉ 22 nếu sau này thêm Nginx) |
| API keys | `DEEPSEEK_API_KEY` (sinh thực đơn/chat), `GEMINI_API_KEY` (embedding RAG) |

**Không** public port **5432** (Postgres chỉ nói chuyện trong mạng Docker).

---

## 3. Kiến trúc

### Production (domain + HTTPS)

```mermaid
flowchart LR
  User[Browser] --> Nginx[Nginx_80_443]
  Nginx -->|"/"| FE[frontend_3000]
  Nginx -->|"/api /health /static"| BE[backend_8000]
  BE --> PG[(postgres_5432)]
  BE --> Qdrant[(qdrant_volume)]
  BE --> LLM[DeepSeek_or_OpenAI]
  BE --> Gemini[Gemini_embedding]
```

Frontend gọi API **cùng origin**: `https://your-domain.com/api/v1/...` — biến `NEXT_PUBLIC_API_BASE_URL` được **bake lúc build** image frontend.

### IP-only

```
Browser → http://VPS_IP:3000 (frontend)
       → http://VPS_IP:8000 (backend API trực tiếp)
       → postgres + qdrant (Docker nội bộ)
```

---

## 4. Chuẩn bị trước khi deploy

### 4.1. DNS (chỉ production)

1. Vào nhà cung cấp domain (Cloudflare, Namecheap, …).
2. Tạo bản ghi **A**:
   - **Name:** `@` hoặc subdomain (VD: `p014`)
   - **Value:** IP public VPS
3. Đợi propagate (5–30 phút).

Kiểm tra từ máy local:

```bash
ping your-domain.com
# phải trả về IP VPS
```

### 4.2. SSH vào VPS

```bash
ssh ubuntu@YOUR_VPS_IP
# hoặc ssh root@YOUR_VPS_IP
```

### 4.3. Firewall

**Production:**

```bash
sudo apt update && sudo apt upgrade -y
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

**IP-only (nếu chưa có Nginx):**

```bash
sudo ufw allow OpenSSH
sudo ufw allow 3000/tcp
sudo ufw allow 8000/tcp
sudo ufw enable
```

---

## 5. Cài Docker trên VPS

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

**Logout rồi SSH lại** để group `docker` có hiệu lực:

```bash
exit
ssh ubuntu@YOUR_VPS_IP
docker --version
docker compose version
```

---

## 6. Clone code

```bash
sudo mkdir -p /opt/p014
sudo chown $USER:$USER /opt/p014
cd /opt/p014

git clone https://github.com/YOUR_ORG/P-014.git .
# hoặc git pull nếu đã clone trước đó
```

Repo cần có:

- `docker-compose.prod.yml` — stack production
- `docker-compose.yml` — stack dev / IP-only
- `deploy/bootstrap.sh`, `deploy/init-letsencrypt.sh`
- `backend/data/` — corpus RAG (food DB + guidelines)

---

## 7. Cấu hình `.env`

Trên VPS, tạo file `.env` tại thư mục gốc repo:

```bash
cd /opt/p014
cp .env.example .env
nano .env
```

**Không commit `.env`** — file này chứa secret.

### 7.1. Tạo secret

```bash
openssl rand -hex 32          # dùng làm JWT_SECRET
openssl rand -base64 24       # dùng làm POSTGRES_PASSWORD (hoặc tự đặt)
```

### 7.2. Biến bắt buộc (production — có domain)

Thay `your-domain.com` bằng domain thật:

```bash
# ---- App ----
APP_ENV=production
JWT_SECRET=<chuỗi ngẫu nhiên, KHÔNG dùng change-me-dev-only>
CORS_ORIGINS=https://your-domain.com
FRONTEND_URL=https://your-domain.com

# ---- Postgres (Compose tự tạo DB — bạn chỉ set password) ----
POSTGRES_PASSWORD=<mật khẩu mạnh>

# ---- Frontend (BAKE lúc docker build) ----
NEXT_PUBLIC_API_BASE_URL=https://your-domain.com

# ---- Domain + SSL ----
DOMAIN=your-domain.com
CERTBOT_EMAIL=you@example.com
# CERTBOT_STAGING=1   # bật khi test SSL lần đầu

# ---- LLM ----
LLM_PROVIDER=deepseek
LLM_MODEL=deepseek-chat
DEEPSEEK_API_KEY=sk-xxxxxxxx

# ---- Embedding RAG ----
EMBEDDING_PROVIDER=gemini
GEMINI_API_KEY=key1,key2
GEMINI_EMBEDDING_MODEL=gemini-embedding-2
GEMINI_EMBEDDING_DIMENSION=768

# ---- Vector store ----
QDRANT_PERSIST_DIR=./qdrant_db
```

> `DATABASE_URL` **không cần sửa tay** cho production — `docker-compose.prod.yml` override thành  
> `postgresql://p014:${POSTGRES_PASSWORD}@postgres:5432/p014`.

> `APP_ENV=production` + `JWT_SECRET=change-me-dev-only` → backend **crash ngay** (fail-fast bảo mật).

### 7.3. Biến bắt buộc (IP-only — không domain)

Tham khảo template [`.env.vps`](../.env.vps) trên máy dev, copy lên VPS thành `.env`:

```bash
APP_ENV=production
JWT_SECRET=<chuỗi ngẫu nhiên>
POSTGRES_PASSWORD=<mật khẩu>

DATABASE_URL=postgresql://p014:YOUR_PASSWORD@postgres:5432/p014

CORS_ORIGINS=http://YOUR_VPS_IP:3000
FRONTEND_URL=http://YOUR_VPS_IP:3000
NEXT_PUBLIC_API_BASE_URL=http://YOUR_VPS_IP:8000

QDRANT_PERSIST_DIR=./qdrant_db
EMBEDDING_PROVIDER=gemini
GEMINI_API_KEY=...
DEEPSEEK_API_KEY=...
LLM_PROVIDER=deepseek
LLM_MODEL=deepseek-chat
```

**Lưu ý IP-only:** sau khi sửa `NEXT_PUBLIC_API_BASE_URL`, phải **rebuild frontend**:

```bash
docker compose up -d --build frontend
```

### 7.4. SMTP (tuỳ chọn — quên mật khẩu)

```bash
SMTP_USERNAME=you@gmail.com
SMTP_PASSWORD="xxxx xxxx xxxx xxxx"   # Gmail App Password, bọc ngoặc kép
```

---

## 8. Deploy production (domain + HTTPS)

### Bước 1 — Chạy bootstrap

```bash
cd /opt/p014
chmod +x deploy/bootstrap.sh deploy/init-letsencrypt.sh
./deploy/bootstrap.sh
```

Script thực hiện tuần tự:

| # | Việc | Ghi chú |
|---|---|---|
| 1 | Build + start Postgres | Tự tạo DB `p014`, user `p014`, volume `postgres_data` |
| 2 | Build + start backend | `init_db()` tạo bảng, seed demo, seed catalog Postgres |
| 3 | Build + start frontend | API URL bake từ `NEXT_PUBLIC_API_BASE_URL` |
| 4 | Chờ backend `/health` | Tối đa ~3 phút |
| 5 | Index Qdrant (`app.rag.indexer`) | Cần `GEMINI_API_KEY`, mất vài phút |
| 6 | Cấp SSL + start Nginx | Nếu `DOMAIN` đã set trong `.env` |

Lần đầu build có thể **10–20 phút** — đừng tắt terminal giữa chừng.

### Bước 2 — Kiểm tra nhanh

```bash
docker compose -f docker-compose.prod.yml ps
curl -s https://your-domain.com/health
# {"status":"ok"}
```

---

## 9. Deploy IP-only (không domain)

Dùng khi chưa có domain hoặc demo nội bộ qua IP.

```bash
cd /opt/p014
cp .env.vps .env    # hoặc tạo .env theo mục 7.3
nano .env           # sửa IP, secrets, API keys

docker compose up -d --build
```

Sau khi backend healthy, index RAG:

```bash
docker compose exec backend python -m app.rag.indexer
```

Truy cập:

- Frontend: `http://YOUR_VPS_IP:3000`
- API docs: `http://YOUR_VPS_IP:8000/docs`
- Health: `http://YOUR_VPS_IP:8000/health`

**Nâng cấp lên production có domain:** chuyển sang [`docker-compose.prod.yml`](../docker-compose.prod.yml), cập nhật `.env` (HTTPS URLs), chạy `./deploy/bootstrap.sh`.

---

## 10. Kiểm tra sau deploy

### 10.1. Container

```bash
# Production
docker compose -f docker-compose.prod.yml ps

# IP-only
docker compose ps
```

Kỳ vọng: `postgres`, `backend`, `frontend` đều **Up**; production thêm `nginx`, `certbot`.

### 10.2. API qua browser DevTools (F12 → Network)

Request phải dạng:

```
https://your-domain.com/api/v1/...     # production
http://YOUR_VPS_IP:8000/api/v1/...   # IP-only
```

**Không** được thấy `http://localhost:8000` — nếu thấy, rebuild frontend (mục 15).

### 10.3. Chức năng chính

1. Đăng nhập bệnh nhân / bác sĩ
2. Sinh thực đơn 7 ngày (cần `DEEPSEEK_API_KEY`)
3. Chat assistant
4. Check tương tác thuốc–thực phẩm
5. Bác sĩ duyệt thực đơn

Endpoint demo (`POST /notifications/demo/simulate`, `POST /doctor/demo/plan-expiry`) trả **403** khi `APP_ENV=production`.

---

## 11. Tài khoản demo

| Role | Email | Mật khẩu |
|---|---|---|
| Bác sĩ | `demo_doctor@example.com` | `demo1234` |
| Bệnh nhân 1 | `demo_patient_1@example.com` | `demo1234` |
| Bệnh nhân 2 | `demo_patient_2@example.com` | `demo1234` |
| Bệnh nhân 3 | `demo_patient_3@example.com` | `demo1234` |

Tài khoản được seed tự động lúc backend start lần đầu.

---

## 12. Vận hành hàng ngày

### Xem log

```bash
# Production
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend
docker compose -f docker-compose.prod.yml logs -f nginx

# IP-only
docker compose logs -f backend
```

### Cập nhật code

```bash
cd /opt/p014
git pull

# Production
docker compose -f docker-compose.prod.yml up -d --build

# IP-only
docker compose up -d --build
```

### Re-index RAG (sau đổi embedding hoặc corpus)

```bash
# Production
docker compose -f docker-compose.prod.yml exec backend python -m app.rag.indexer

# IP-only
docker compose exec backend python -m app.rag.indexer
```

### Rebuild frontend khi đổi domain / API URL

```bash
# Sửa NEXT_PUBLIC_API_BASE_URL trong .env trước
docker compose -f docker-compose.prod.yml up -d --build frontend
```

---

## 13. Backup & khôi phục

### Postgres

```bash
cd /opt/p014
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U p014 p014 > backup-$(date +%F).sql
```

### Qdrant volume (production)

```bash
docker run --rm -v p014_qdrant_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/qdrant-$(date +%F).tar.gz -C /data .
```

> Tên volume có prefix tên thư mục project. Kiểm tra: `docker volume ls | grep qdrant`.

### Cảnh báo

```bash
docker compose -f docker-compose.prod.yml down -v
```

Lệnh trên **xóa toàn bộ** volume Postgres + Qdrant — chỉ dùng khi cố ý reset.

---

## 14. SSL / gia hạn chứng chỉ

Container `certbot` tự renew mỗi 12 giờ. Gia hạn thủ công:

```bash
docker compose -f docker-compose.prod.yml run --rm --entrypoint certbot certbot renew
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

Cron trên host (tuỳ chọn):

```cron
0 3 * * * cd /opt/p014 && docker compose -f docker-compose.prod.yml run --rm --entrypoint certbot certbot renew && docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

Test SSL staging (tránh hết quota Let's Encrypt khi thử):

```bash
# Thêm vào .env: CERTBOT_STAGING=1
./deploy/init-letsencrypt.sh
```

---

## 15. Lỗi thường gặp

| Triệu chứng | Nguyên nhân | Cách xử lý |
|---|---|---|
| Backend crash / restart loop | `JWT_SECRET` còn `change-me-dev-only` | Đổi secret + restart |
| FE gọi `localhost:8000` | Build frontend khi chưa set `NEXT_PUBLIC_API_BASE_URL` | Sửa `.env` → rebuild frontend |
| CORS error | `CORS_ORIGINS` không khớp URL trình duyệt | Thêm đúng scheme + host (http/https, IP/domain) |
| Nginx 502 | Backend chưa healthy | `docker compose ... logs backend` |
| Certbot fail | DNS chưa trỏ / port 80 chặn | `ping domain`, `ufw status`, thử `CERTBOT_STAGING=1` |
| RAG / meal plan kém | Chưa index Qdrant | Chạy lại `python -m app.rag.indexer` |
| OOM / container killed | RAM thấp + fallback embedding local | Nâng RAM 4GB; giữ `EMBEDDING_PROVIDER=gemini` |
| `database is locked` | Không áp dụng — prod dùng Postgres | — |
| Postgres connection refused | Postgres chưa healthy | `docker compose ... ps postgres`; đợi healthcheck |

---

## 16. Checklist nhanh

### Production (domain + HTTPS)

```
[ ] VPS Ubuntu, RAM ≥ 2GB (khuyến nghị 4GB)
[ ] Domain A record → IP VPS
[ ] UFW: 22, 80, 443
[ ] Docker + Compose cài xong
[ ] git clone vào /opt/p014
[ ] .env: APP_ENV=production, JWT_SECRET mới, POSTGRES_PASSWORD
[ ] .env: NEXT_PUBLIC_API_BASE_URL=https://domain
[ ] .env: CORS_ORIGINS + FRONTEND_URL = https://domain
[ ] .env: DOMAIN, CERTBOT_EMAIL, DEEPSEEK_API_KEY, GEMINI_API_KEY
[ ] ./deploy/bootstrap.sh chạy xong
[ ] curl https://domain/health → {"status":"ok"}
[ ] Login demo OK, Network tab không còn localhost:8000
```

### IP-only

```
[ ] UFW: 22, 3000, 8000
[ ] .env từ .env.vps, sửa IP + secrets + API keys
[ ] docker compose up -d --build
[ ] docker compose exec backend python -m app.rag.indexer
[ ] http://IP:3000 mở được, login demo OK
```

---

## Tài liệu liên quan

- Chạy local dev: [`how_to_run.md`](../how_to_run.md)
- Biến môi trường mẫu: [`.env.example`](../.env.example)
- Template IP-only: [`.env.vps`](../.env.vps) (không commit secret lên git)
- ADR database: [`adrs/005-database-choice.md`](../adrs/005-database-choice.md)
- ADR vector store: [`adrs/001-vector-database-choice.md`](../adrs/001-vector-database-choice.md)
