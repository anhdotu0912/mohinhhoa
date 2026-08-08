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

## Giai đoạn 2: Di chuyển Backend (be_old → backend)
- Đã copy tất cả các file NEW từ `be_old` sang `backend/app/...` đúng vị trí.
- Đã đối chiếu các file CONFLICT:
  - Tất cả các file trong `app/` (ngoại trừ vài file như `core/config.py`, `main.py`, `schemas/food_log.py`) ở `backend/` trước đó chỉ là placeholder (`"""Placeholder"""`).
  - Đã overwrite các file placeholder bằng code thực tế từ `be_old/`.
  - Cập nhật thủ công `requirements.txt` bằng cách thêm `rank-bm25` và `unidecode`.
  - Copy đè các file `app/core/config.py`, `app/main.py`, `app/schemas/food_log.py` vì chúng chứa code chi tiết hơn.
- Không có thư mục `data` trong `be_old`, giữ nguyên `backend/data`.
- Đang chạy pytest với môi trường ảo.

## Giai đoạn 3: Tái cấu trúc Frontend
- Đã tạo các thư mục phân quyền: `app/patient`, `app/doctor`, `components/patient`, `components/doctor`, `components/shared`.
- Chuyển các page hiện có vào đúng thư mục:
  - `dashboard`, `food-log`, `meal-plan`, `onboarding` -> `app/patient/`
  - `dietitian` -> `app/doctor/`
- Đã fix lỗi file `next.config.ts` (đổi thành `next.config.mjs`) và copy `eslint.config.mjs` từ `fe_old` sang để hỗ trợ lint/build.
- Sửa lại file `app/page.tsx` để có redirect link theo vai trò.
- Thêm các layout cơ bản `app/patient/layout.tsx` và `app/doctor/layout.tsx`.
- Mock store auth `useProfileStore` để fix lỗi build của trang `onboarding`.
- Kết quả: `npm run build` thành công.
