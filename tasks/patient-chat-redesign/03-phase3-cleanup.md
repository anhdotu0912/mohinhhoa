# Giai đoạn 3 — Dọn code thừa

> Đọc [`00-overview.md`](00-overview.md), [`01-phase1-ui-shell-mockdata.md`](01-phase1-ui-shell-mockdata.md), [`02-phase2-backend-integration.md`](02-phase2-backend-integration.md) trước. Chỉ thực hiện Giai đoạn 3 **sau khi** Giai đoạn 2 đã xong và ổn định (đã demo thử ít nhất 1 lần đầy đủ luồng). Nguyên tắc: **refactor thành shared component trước khi xoá**, không xoá logic còn giá trị — chỉ xoá phần thật sự trùng lặp/chết.

## T3.1 — Tách nội dung trang cũ thành component dùng chung trước khi xoá route

**File liên quan:** `frontend/app/patient/meals/page.tsx`, `frontend/app/patient/history/page.tsx`, `frontend/app/patient/notifications/page.tsx`

- Với mỗi trang trên, kiểm tra phần UI/logic đã được copy sang panel tương ứng ở Giai đoạn 1 (`MealLogPanel`, `HealthMetricsPanel`/`RecordMetricsFormPanel`, `NotificationsPanel`/`NotificationDetailModal`):
  - Nếu trang cũ **vẫn cần giữ** làm "full page fallback" (deep-link từ notification detail, ví dụ `/patient/meals?plan_id=...` dùng ở T2.10) → tách phần render nội dung (không phải phần layout `AppShell` bọc ngoài) thành 1 component dùng chung, ví dụ `frontend/components/patient-chat/shared/MealPlanWeekView.tsx`, rồi cho cả trang `/patient/meals` và panel gọi cùng component này — tránh 2 bản logic hiển thị thực đơn tuần khác nhau.
  - Nếu trang cũ **không còn ai trỏ tới** (không còn link/nav/redirect nào dẫn tới) sau khi kiểm tra kỹ (`grep` toàn repo `frontend/` tìm chuỗi route path) → xoá thẳng file trang, không cần tách component.
- Việc quyết định "giữ làm fallback" hay "xoá" cho từng trang nên chốt dựa trên kết quả `grep` thực tế (bước T3.3), không giả định trước.

## T3.2 — Xoá route đã merge/không còn dùng

**File:**
- `frontend/app/patient/assistant/page.tsx` — đã redirect về `/patient` từ T1.6; nếu xác nhận không còn nav item, không còn liên kết ngoài nào trỏ tới, có thể xoá thư mục `frontend/app/patient/assistant/` hoàn toàn (Next.js sẽ 404 tự nhiên, không cần giữ redirect vĩnh viễn) — hoặc giữ redirect nếu muốn an toàn cho bookmark cũ của người dùng thật (khuyến nghị **giữ redirect**, rủi ro thấp, chi phí gần như 0).
- `frontend/app/patient/messages/page.tsx` — hiện chỉ `redirect("/patient")` (route rác từ trước, không có UI). Xác nhận không có nav item nào trỏ tới (`nav-config.ts`) rồi xoá thư mục này.

**Cách kiểm tra an toàn trước khi xoá (áp dụng mọi bước xoá trong file này):**

```bash
grep -rn "/patient/assistant" frontend --include="*.tsx" --include="*.ts"
grep -rn "/patient/messages" frontend --include="*.tsx" --include="*.ts"
```

Chỉ xoá khi kết quả grep không còn tham chiếu nào ngoài chính file định xoá.

## T3.3 — Dọn `app/patient/page.tsx` khỏi phần dashboard cũ

- Sau khi T1.5 (Giai đoạn 1) đã thay hoàn toàn nội dung `app/patient/page.tsx` bằng chat-home, xác nhận không còn đoạn code cũ nào sót lại dạng dead code (import không dùng, hàm tính `weeklyAdherence`/rows dashboard cũ không còn gọi tới) — dọn sạch bằng ESLint (`no-unused-vars`) + `tsc --noEmit` để bắt import chết.
- Nếu `weeklyAdherence`/hàm tính tuân thủ cũ đã được thay bằng `api.getMyCompliance()` (T2.9), xoá hẳn hàm tính client-side cũ trong file này (không giữ 2 cách tính song song).

## T3.4 — Dọn `frontend/lib/nav-config.ts`

- Xoá các mục trong `NAV_BY_ROLE.patient` không còn được `Sidebar`/bất kỳ component nào render nữa (sau khi patient đã chuyển hẳn sang `PatientChatShell` + dock, `Sidebar.tsx` không còn được dùng cho role `patient` — xem T1.4).
- **Giữ nguyên tuyệt đối** `NAV_BY_ROLE.doctor` — không đổi bất kỳ dòng nào liên quan doctor.
- Nếu có logic mobile fallback nào (ví dụ menu hamburger cũ) còn đọc `NAV_BY_ROLE.patient`, cập nhật nơi đó trước khi xoá, hoặc giữ lại đúng phần còn dùng.

## T3.5 — Rà soát `frontend/components/patient/*` cũ

**File cần kiểm tra:** `PatientMealPlanUI.tsx`, `ChatThinkingSteps.tsx`, `MetricsProgressChart.tsx`, `FoodLogModal.tsx`, và các file khác trong thư mục này.

- Với mỗi file, `grep` toàn bộ `frontend/` tìm import từ đường dẫn đó:
  ```bash
  grep -rn "components/patient/FoodLogModal" frontend --include="*.tsx"
  grep -rn "components/patient/ChatThinkingSteps" frontend --include="*.tsx"
  grep -rn "components/patient/MetricsProgressChart" frontend --include="*.tsx"
  grep -rn "components/patient/PatientMealPlanUI" frontend --include="*.tsx"
  ```
- File còn được `components/patient-chat/**` import (dự kiến: `FoodLogModal` dùng trong `MealLogPanel`, `ChatThinkingSteps` dùng trong trang chat `/patient`, `MetricsProgressChart` có thể dùng trong `HealthMetricsPanel`) → **giữ nguyên**, không xoá, không cần di chuyển vị trí file trừ khi muốn dọn tên thư mục (không bắt buộc).
- File không còn import ở đâu (chỉ dùng bởi trang/route đã xoá ở T3.1–T3.2) → xoá.

## T3.6 — Xoá mock trigger tạm của Giai đoạn 1

**File:** `frontend/lib/patient-chat-mock-intents.ts` (tạo ở T1.7, comment `// TODO(phase2)` đánh dấu sẵn)

- Xác nhận Giai đoạn 2 (T2.8) đã chuyển `app/patient/page.tsx` sang dùng hoàn toàn field thật (`grocery_list`/`weekly_compliance`/`doctor_note`) từ `AgentRunOutput`/SSE `done` event, không còn nơi nào gọi `detectMockCardIntent()`.
- Xoá file `patient-chat-mock-intents.ts` và mọi import của nó.
- Xoá field tạm `mockCard` trên type `Message` trong `app/patient/page.tsx` nếu còn sót.
- Mock data tĩnh dùng riêng cho hiển thị (ví dụ danh sách địa điểm gợi ý tĩnh cho `grocery_list`, xem `02-phase2-backend-integration.md` T2.1.1) **không** thuộc phạm vi xoá ở đây — đó là quyết định sản phẩm chấp nhận (không có bản đồ thật), không phải mock tạm che giấu thiếu backend.

## T3.7 — Kiểm tra lint/build cuối cùng

- Chạy tuần tự, xử lý hết lỗi trước khi coi Giai đoạn 3 hoàn thành:
  ```bash
  cd frontend && npm run lint
  cd frontend && npx tsc --noEmit
  cd frontend && npm run build
  ```
- Chạy lại `pytest backend/tests/` (đảm bảo không có refactor backend nào ở Giai đoạn 3 làm hỏng test — thường Giai đoạn 3 không đổi backend, nhưng nếu có dọn service trùng lặp ở BE thì phải test lại).
- Grep toàn repo lần cuối tìm import chết còn sót:
  ```bash
  grep -rn "patient-chat-mock-intents" frontend
  grep -rn "/patient/assistant" frontend --include="*.tsx" --include="*.ts"
  ```

## T3.8 — Checklist hoàn tất cuối cùng (Definition of Done toàn bộ redesign)

Đối chiếu với `CLAUDE.md` mục 12 (Definition of Done):

- [ ] `npm run build` (frontend) không lỗi, không warning import chết liên quan redesign.
- [ ] `pytest backend/tests/` pass toàn bộ.
- [ ] Không còn file/route nào thuộc diện "mock tạm Giai đoạn 1" (`patient-chat-mock-intents.ts`, field `mockCard`) còn sót trong code.
- [ ] `frontend/app/doctor/**` không bị chỉnh sửa qua toàn bộ 3 giai đoạn (đối chiếu bằng `git diff` giữa nhánh redesign và `main` trên phạm vi thư mục này — phải rỗng).
- [ ] `contracts/agent-io-schema.md` và `contracts/api-v1.md` đã phản ánh đúng 100% những gì code thật đang làm (3 intent mới, field mới trong `AgentRunOutput`).
- [ ] Demo lại toàn bộ luồng North Star (`tasks/roadmap-mvp.md`) + toàn bộ luồng chat-centric mới (mục 3 trong `00-overview.md`) không crash.
- [ ] Cập nhật `tasks/roadmap-mvp.md` / `tasks/fe-frontend.md` nếu redesign này đóng luôn 1 số backlog item đang mở (ví dụ nếu `grocery_list`/`weekly_compliance` từng được liệt kê là "Could Have — chưa làm" ở đâu đó, đánh dấu Done).
