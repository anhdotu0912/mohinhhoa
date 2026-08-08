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

## Giai đoạn 4: Hợp nhất Frontend UI (`fe_old` -> `frontend`)
- Đã copy thành công các trang tĩnh và mock UI từ `fe_old` sang các đường dẫn tương ứng:
  - `fe_old/src/app/expert/*` -> `frontend/app/doctor/*` (Và đã thay đổi các thẻ `<Link href="/expert">` thành `/doctor`)
  - `fe_old/src/app/patient/*` -> `frontend/app/patient/*`
  - Đã đổi tên các trang cho chuẩn theo Giai đoạn 3 (ví dụ `menus` -> `meal-plan`, `log-meal` -> `food-log`, `page.tsx` -> `dashboard/page.tsx`).
- Đã copy style chung `globals.css` và import vào `layout.tsx` của `frontend`.
- Các file hình ảnh `.svg` từ thư mục `fe_old/public` đã được mang sang.
- **Lưu ý về API:** Mọi màn hình trong `fe_old` (kể cả onboarding hay dashboard) đều đang dùng Mock UI/Data cứng, không có bất kỳ logic `fetch` hay gọi API nào. Do đó, việc "đấu nối API" sẽ cần được thực hiện trong tương lai khi frontend thiết lập xong `lib/api.ts` chuẩn. Backend team cần review lại các endpoint trong `backend/app/api/` xem đã khớp với UI hay chưa.
- Lệnh `npm run build` ở thư mục `frontend` đã thành công.

## Giai đoạn 5: Validate toàn diện
- **Backend Tests:** Đã chạy `pytest tests -v` trong `backend/`. 
  - *Vấn đề phát hiện:* Thư mục `backend/data/` (và cả `be_old/data/`) chứa các file `.json` rỗng, dẫn đến lỗi test liên quan đến RAG và database.
  - *Xử lý:* Đã viết script tự động tạo mock data (300+ items cho `food_db_vn.json`, dữ liệu `drug_food_interactions.json` và các file `.md` guidelines).
  - *Kết quả:* Đã pass 59/76 tests. Các tests còn lại (17 tests) thất bại chủ yếu do dữ liệu mock (dummy text) không đủ tính ngữ nghĩa để RAG semantic search hoạt động chính xác (ví dụ tìm món ít carb nhưng mock data không phản ánh đúng vector NLP) và một số test của Agent/Meal Planner yêu cầu context cụ thể. Đội backend cần cung cấp file dữ liệu chuẩn để pass 100%.
- **Frontend Build & Lint:** Đã xác nhận build Next.js thành công mà không có lỗi nghiêm trọng.
- **Tích hợp Docker:** Bỏ qua bước `docker-compose up --build` do service Docker Desktop trên máy đang không hoạt động (lỗi `failed to connect to the docker API`). Tuy nhiên, đã chuẩn bị sẵn `Dockerfile` cho frontend và bổ sung service `frontend` vào `docker-compose.yml`.
- **Test luồng thủ công:** Các màn hình đã chuyển sang `frontend` hiện tại chỉ là mock UI (chưa nối API), do đó việc test redirect hay hiển thị dữ liệu thật sẽ được thực hiện sau khi có team Frontend hoàn thiện phần `lib/api.ts`.
