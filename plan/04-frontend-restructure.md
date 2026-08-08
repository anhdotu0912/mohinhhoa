# Giai đoạn 3 — Tái cấu trúc Frontend theo Doctor / Patient

Mục tiêu: tách frontend hiện tại (chưa đụng đến fe_old) thành route-based `/doctor/*` và `/patient/*`, dùng chung components. Làm bước này TRƯỚC khi merge fe_old vào, để có khung sườn rõ ràng.

## Cấu trúc đích

```
frontend/app/
├── (auth)/
│   └── login/page.tsx
├── patient/
│   ├── layout.tsx          # guard role="patient" + nav riêng bệnh nhân
│   ├── dashboard/page.tsx
│   ├── food-log/page.tsx
│   ├── meal-plan/page.tsx
│   └── onboarding/page.tsx
├── doctor/
│   ├── layout.tsx          # guard role="doctor" + nav riêng bác sĩ
│   ├── dashboard/page.tsx
│   ├── patients/
│   │   └── [id]/page.tsx
│   └── dietitian/page.tsx
├── layout.tsx               # providers chung (auth/theme)
└── page.tsx                  # redirect theo role sau login

frontend/components/
├── ui/        # giữ nguyên, dùng chung
├── shared/    # chat, alerts nếu dùng chung cả 2 role
├── patient/   # component riêng food-log, meal-plan, onboarding
└── doctor/    # component riêng dietitian, quản lý bệnh nhân
```

## Việc cần làm

- [ ] Tạo cấu trúc thư mục mới (chưa xoá thư mục cũ):
  ```bash
  mkdir -p frontend/app/patient frontend/app/doctor frontend/app/\(auth\)/login
  mkdir -p frontend/components/patient frontend/components/doctor frontend/components/shared
  ```

- [ ] Di chuyển các page hiện có vào đúng khu vực role, dùng `git mv` để giữ history:
  - `app/dashboard/page.tsx` → xác định đây là dashboard cho ai (mặc định: bệnh nhân) → `app/patient/dashboard/page.tsx`
  - `app/food-log/page.tsx` → `app/patient/food-log/page.tsx`
  - `app/meal-plan/page.tsx` → `app/patient/meal-plan/page.tsx`
  - `app/onboarding/page.tsx` → `app/patient/onboarding/page.tsx`
  - `app/dietitian/page.tsx` → `app/doctor/dietitian/page.tsx`
  Nếu không chắc 1 trang thuộc role nào, ghi vào `MIGRATION_NOTES.md` và hỏi người dùng, đừng đoán.

- [ ] Tạo `app/patient/layout.tsx` và `app/doctor/layout.tsx`:
  - Mỗi layout kiểm tra role của user (dựa vào cơ chế auth hiện có trong `frontend/lib/api.ts` hoặc store).
  - Nếu role không khớp → redirect về trang phù hợp hoặc trang lỗi 403.
  - Nav/menu riêng cho từng role trong layout tương ứng.

- [ ] Cập nhật `app/page.tsx` (root) để sau khi login, redirect user theo role (`/patient/dashboard` hoặc `/doctor/dashboard`).

- [ ] Phân loại `components/alerts`, `components/chat`, `components/food-log`, `components/meal-plan`:
  - Component chỉ dùng bởi 1 role → di chuyển vào `components/patient/` hoặc `components/doctor/`.
  - Component dùng chung (ví dụ `chat` nếu cả 2 role đều chat với AI) → giữ ở `components/shared/`.
  - Nếu không chắc, mặc định để ở `components/shared/` và ghi chú lại — dễ tách sau hơn là gộp sai.

- [ ] Cập nhật lại toàn bộ import path bị vỡ sau khi di chuyển file (dùng tìm-thay thế hàng loạt, ví dụ `grep -rl "from '@/components/food-log" frontend/app frontend/components`).

- [ ] Cập nhật `frontend/store/` nếu cần tách state theo role (ví dụ `useProfileStore` có thể cần biết role hiện tại).

- [ ] Build và lint sau khi tái cấu trúc xong:
  ```bash
  cd frontend && npm run build && npm run lint
  ```
  Sửa lỗi import/type trước khi commit.

- [ ] Commit theo từng cụm nhỏ (ví dụ: 1 commit cho di chuyển patient pages, 1 commit cho doctor pages, 1 commit cho layout/guard).

## Điều kiện để chuyển sang giai đoạn tiếp theo
- `npm run build` và `npm run lint` pass.
- Mỗi page/component đã có vị trí rõ ràng trong cấu trúc doctor/patient/shared.
- Không còn import path bị vỡ.

→ Tiếp tục với `05-frontend-merge.md`.
