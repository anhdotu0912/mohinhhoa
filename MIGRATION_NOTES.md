# Migration Notes: fe_old/be_old -> frontend/backend

Bắt đầu: 2026-08-08

- [Baseline] Backend test failed: `collected 0 items`. There are no tests in `backend/tests` or pytest didn't find them.
- [Baseline] Frontend build failed: Type error `Module '"../../store/useProfileStore"' has no exported member 'useProfileStore'` in `app/onboarding/page.tsx`.

## Giai đoạn 1: Kiểm kê

### Phân tích `be_old`
- **Loại code chủ yếu**: APIs, agents (food log, meal planner, interaction checker), models (SQLAlchemy), schemas (Pydantic), services, và thư mục `rag`.
- **Dependencies mới**: `be_old` yêu cầu `rank-bm25` và `unidecode` (chưa có trong `backend/requirements.txt`).
- **Secret/Config**: File `.env.example` trong `be_old` không chứa secret nhạy cảm (chỉ chứa các giá trị placeholder).

### Phân tích `fe_old`
- **Danh sách màn hình**:
  - **Bác sĩ (Expert)**: `/expert` (Dashboard), `/expert/login`, `/expert/menus`, `/expert/patients`, `/expert/register`, `/expert/warnings`.
  - **Bệnh nhân (Patient)**: `/patient` (Dashboard), `/patient/alerts`, `/patient/chat`, `/patient/log-meal`, `/patient/login`, `/patient/menus`, `/patient/onboarding`, `/patient/register`, `/patient/reports`.
- **UI Components**: Không có thư mục chứa UI component dùng chung. Các page đang dùng inline styling hoặc CSS cơ bản.
- **Nối API**: Hiện tại các màn hình chỉ là giao diện tĩnh (mock data), chưa gọi API backend.

### Phân loại File (be_old vs backend)
| Trạng thái | Danh sách File (ví dụ) | Hành động |
|---|---|---|
| **NEW** | `app/agents/__init__.py`, `app/api/v1/routes_alerts.py`, ... | Copy trực tiếp sang `backend/` |
| **CONFLICT** | `app/main.py`, `requirements.txt`, `app/models/user.py`, `Dockerfile`, ... | Cần đối chiếu và merge thủ công |
| **SKIP** | Các file đã bị ignore (`__pycache__`, `.venv`) | Không di chuyển |

### Phân loại File (fe_old vs frontend)
| Trạng thái | Danh sách File (ví dụ) | Hành động |
|---|---|---|
| **NEW** | Tất cả file trong `src/app/expert/*` và `src/app/patient/*` | Chuyển đổi theo cấu trúc mới |
| **CONFLICT** | `package.json`, `tsconfig.json` | Cần đối chiếu và merge |
| **SKIP** | `next.config.ts`, `eslint.config.mjs`, `README.md` | Bỏ qua do `frontend` đã có |
