# Mô tả chức năng — VMEC-10 (P-014)

> Tài liệu này chuyển hoá sơ đồ Use Case + bảng tác nhân trong `UML_VinMec_10.docx` thành đặc tả chức năng chi tiết, có luồng hoạt động (step-by-step) cho từng use case, để AI coding agent hoặc dev đọc và triển khai trực tiếp.
> Đối chiếu với repo hiện tại: `CLAUDE.md` (nguồn sự thật stack + MoSCoW), `specs/01-13` (đặc tả nghiệp vụ, mỗi file có Status), `contracts/api-v1.md` + `agent-io-schema.md`.
> Quy ước Status mỗi use case: `New` (chưa có trong specs hiện tại — cần agent thiết kế mới) · `Đã có spec` (trỏ tới file spec tương ứng, dùng tài liệu này để bổ sung góc nhìn use-case) · `Ngoài MVP` (không làm ở bản demo này, giữ nav ẩn / stub).

---

## 0. Tác nhân hệ thống

| Tác nhân | Vai trò |
|---|---|
| **Bác sĩ / Chuyên gia dinh dưỡng** (`role=doctor`) | Quản lý bệnh nhân, duyệt thực đơn AI sinh ra, theo dõi tuân thủ, quản lý ràng buộc lâm sàng |
| **Bệnh nhân** (`role=patient`) | Khai báo hồ sơ, tương tác với AI để nhận thực đơn/tư vấn, ghi nhận chỉ số & tuân thủ |
| **AI** (tác nhân hệ thống, không phải actor login) | LangGraph Agent: RAG, sinh thực đơn, kiểm tra tương tác thuốc–thực phẩm, tính toán dinh dưỡng, cảnh báo, guardrails HITL |
| **Chức năng dùng chung** | Đăng nhập, Đăng ký, Liên hệ — không phân role |

**Nguyên tắc HITL bắt buộc (từ đề bài, khớp CLAUDE §7):** AI không được tự chẩn đoán bệnh, không tự ý khuyến nghị đổi thuốc/liều lượng. Mọi kế hoạch dinh dưỡng cho bệnh nhân **phải** qua bác sĩ/chuyên gia duyệt trước khi coi là chính thức. Mọi số liệu AI trả về phải grounded + có citation từ RAG, không hallucinate.

---

## 1. Sơ đồ luồng use case tổng quan

```mermaid
flowchart TB
  subgraph Shared[Chức năng dùng chung]
    Register[Đăng ký]
    Login[Đăng nhập]
    Contact[Liên hệ]
  end

  subgraph Doctor[Bác sĩ]
    D1[Quản lý bệnh nhân]
    D2[Quản lý thực đơn]
    D3[Xem tuân thủ]
    D4[Quản lý ràng buộc lâm sàng]
    D5[Cập nhật & theo dõi chỉ số]
  end

  subgraph Patient[Bệnh nhân]
    P1[Đăng ký hồ sơ ban đầu]
    P2[Cập nhật & theo dõi chỉ số]
    P3[Quản lý nhật ký ăn uống *]
    P4[Xem thực đơn]
    P5[Tương tác với AI]
  end

  subgraph AI[AI Agent]
    A1[Cảnh báo dị ứng & tương tác]
    A2[Sinh/duyệt thực đơn]
  end

  Login --> D1 & D2 & D3 & D4 & D5
  Login --> P2 & P3 & P4 & P5
  Register --> P1
  D2 -->|include| A2
  P5 -->|include| A1
  D2 -->|include| A1
  D2 -->|include| D3
  P4 -->|include| A1
```

*`Quản lý nhật ký ăn uống` (Food Log) nằm trong đề bài gốc nhưng đang là **Won't Have** trong MoSCoW hiện tại của repo (CLAUDE §2, §7) — xem mục 5.3 để biết cách xử lý lệch pha này.*

---

## 2. Nhóm chức năng: Bác sĩ / Chuyên gia dinh dưỡng

### 2.1 Quản lý bệnh nhân
**Status:** Đã có spec → `specs/02-patient-profile-onboarding.md` (khai báo hồ sơ bệnh nhân) + `specs/03-doctor-patient-management.md` (góc nhìn bác sĩ quản lý danh sách).

| Use case | Mô tả |
|---|---|
| Thêm bệnh nhân | Bác sĩ tạo hồ sơ bệnh nhân mới, nhập: thông tin tài khoản cơ bản, hồ sơ bệnh lý (disease, medications), dị ứng & không dung nạp, mục tiêu cân nặng/dinh dưỡng |
| Cập nhật thông tin bệnh nhân | Sửa hồ sơ đã có |
| Điều chỉnh mục tiêu dinh dưỡng | Sửa `target_kcal`, `restrictions` — qua endpoint constraints riêng (`specs/04`), không qua `PUT .../profile` |

**Luồng chính — Thêm bệnh nhân:**
1. Bác sĩ vào `/doctor/patients` → bấm "Thêm bệnh nhân".
2. Nhập tài khoản cơ bản (email, họ tên) → hệ thống gọi `POST /api/v1/auth/register` với `role=patient`, sau đó `PUT /doctor/patients/{id}/profile` để bổ sung chi tiết — **đã chốt không làm** endpoint riêng `POST /api/v1/doctor/patients` (`specs/03` rule 2).
3. Nhập hồ sơ bệnh lý + dị ứng + mục tiêu → map vào schema Profile chuẩn (CLAUDE §8: `disease`, `medications`, `allergies`, `bmi`, `target_kcal`, `restrictions`, `preferences`). Lưu ý: `target_kcal`/`restrictions` chỉ sửa qua endpoint constraints (`specs/04`), không qua `PUT .../profile`.
4. Lưu → Profile persist, patient xuất hiện trong danh sách `GET /api/v1/doctor/patients`.

**Edge case:**
- Trùng email khi đăng ký → trả lỗi rõ ràng, không tạo bản ghi trùng.
- Thiếu trường bắt buộc (disease/medications) → cho phép lưu nháp nhưng cảnh báo "chưa đủ dữ liệu để sinh thực đơn an toàn" (chặn ở bước generate, không chặn ở bước tạo hồ sơ).

### 2.2 Quản lý thực đơn
**Status:** Đã có spec → `specs/05-meal-plan-generation.md` (sinh thực đơn) + `specs/06-meal-plan-review.md` (duyệt). Dùng use-case dưới đây làm lớp mô tả luồng nghiệp vụ, chi tiết kỹ thuật xem 2 spec gốc.

| Use case | Include | Mô tả |
|---|---|---|
| Tạo thực đơn bằng AI | `<<include>> A2 Sinh thực đơn` | Bác sĩ generate hộ bệnh nhân qua `/doctor/patients/{id}/generate` |
| Cập nhật thực đơn | | Sửa món/ngày trong plan trước khi duyệt |
| Tạo lại thực đơn | | Yêu cầu AI sinh lại toàn bộ 7 ngày (khi bác sĩ từ chối) |
| Duyệt/Từ chối thực đơn | | `approve` / `reject` (có ghi chú) |
| Cảnh báo dị ứng và tương tác | `<<include>> A1` | Hiển thị các cảnh báo AI phát hiện trước khi bác sĩ quyết định duyệt |
| Phản hồi và điều chỉnh | | Bác sĩ để lại feedback → dùng làm dữ liệu tinh chỉnh lần generate sau (Should Have — "Adaptive feedback") |

**Luồng chính — Tạo & duyệt thực đơn (North Star flow, khớp `tasks/roadmap-mvp.md` demo flow):**
1. Bác sĩ vào `/doctor/patients/{id}/generate` → bấm "Tạo thực đơn AI".
2. FE gọi `POST /api/v1/doctor/patients/{id}/meal-plans/generate`.
3. BE load Profile bệnh nhân → gọi `meal_planner_agent` (luôn chạy, không rẽ nhánh `DEMO_MOCK`) → sinh 7 ngày, mỗi món có citation.
4. Agent tự động chạy `InteractionCheckerAgent` trên các món trong plan → nếu phát hiện cặp thuốc–thực phẩm mức "Nguy hiểm" → tự swap món + ghi `swaps[]`; mức "Cần chú ý" → gắn cảnh báo hiển thị, không swap.
5. Plan persist với `status=pending_review`.
6. Bác sĩ xem danh sách `GET /api/v1/doctor/meal-plans?status=pending_review` → mở chi tiết → xem cảnh báo dị ứng/tương tác đính kèm.
7. Bác sĩ chọn:
   - **Duyệt** → `POST /doctor/meal-plans/{id}/review` `{action: approve}` → plan chuyển `approved` → tạo Notification `plan_approved` cho bệnh nhân + materialize `meal_reminder`/`adherence_checkin`.
   - **Từ chối** → `{action: reject, note}` → plan chuyển `rejected`, bệnh nhân/bác sĩ có thể trigger "Tạo lại thực đơn" (lặp lại bước 2–5, giữ note làm ngữ cảnh bổ sung cho lần sinh sau).
   - **Sửa tay** → `POST /doctor/meal-plans/{id}/review` `{action: edit, edited_plan: ...}` — full-replace toàn bộ plan trước khi approve; **không có** PUT cấp món riêng lẻ (`specs/06` §6 Out of scope).

### 2.3 Xem tuân thủ
**Status:** Đã có spec → `specs/10-doctor-compliance-view.md` (Done core) + `specs/11-compliance-notification-delivery.md` (nguồn dữ liệu notification).

| Use case | Mô tả |
|---|---|
| Xem biểu đồ tuân thủ bệnh nhân | Bác sĩ xem % tuân thủ meal plan / thuốc theo thời gian |
| Cảnh báo tuân thủ | Hệ thống nổi cảnh báo khi bệnh nhân tuân thủ thấp (VD <60% trong 7 ngày) |
| Cảnh báo/nhắc nhở bệnh nhân | Bác sĩ chủ động gửi nhắc nhở thủ công |
| Xem nhật ký ăn uống của bệnh nhân | **Phụ thuộc Food Log — xem mục 5.3, hiện Won't Have** |

**Luồng chính — Xem biểu đồ tuân thủ:**
1. Bác sĩ vào `/doctor/patients/compliance` (route FE thật; trang `/doctor/history` dùng nguồn khác — `meal-logs-store`, không phải compliance API).
2. FE gọi `GET /api/v1/doctor/patients/{id}/compliance?days=14` — on-the-fly aggregation từ `adherence_checkin` notifications (`adrs/008`, `specs/10`).
3. FE vẽ biểu đồ (line/bar theo ngày) từ `daily_series` + `weekly_rate`.
4. Nếu `weekly_rate < ngưỡng` (config `COMPLIANCE_LOW_THRESHOLD_PCT`, VD 60%) → hiển thị badge cảnh báo; bác sĩ có thể gửi nhắc thủ công qua `POST /api/v1/doctor/patients/{id}/compliance/remind`.

### 2.4 Quản lý ràng buộc lâm sàng
**Status:** Đã có spec (Planned) → `specs/04-clinical-constraints.md`. UI đã build tại `frontend/app/doctor/patients/constraints/page.tsx` (nav có link), nhưng **chỉ lưu state cục bộ** — backend `PUT/POST .../constraints[/approve]` chưa code.

| Use case | Mô tả |
|---|---|
| Xem ràng buộc lâm sàng | Xem danh sách ràng buộc áp dụng cho bệnh nhân (giới hạn carb/bữa, sodium/ngày — đã có trong Profile.restrictions theo CLAUDE §8) |
| Cập nhật ràng buộc lâm sàng | Sửa `restrictions.carb_per_meal`, `restrictions.sodium_daily`, hoặc thêm ràng buộc theo bệnh lý cụ thể (VD purine cho gout) |

**Luồng chính (thiết kế đề xuất — Planned):**
1. Bác sĩ mở `/doctor/patients/constraints` (tab "Ràng buộc lâm sàng" trong nav doctor).
2. Hiển thị `target_kcal` + `restrictions` hiện tại từ Profile (`specs/02`, `specs/04`).
3. Sửa → gọi `PUT /api/v1/doctor/patients/{id}/constraints` (Planned — **không** dùng `PUT .../profile`, endpoint profile không nhận `target_kcal`/`restrictions`, xem `specs/03` rule 4).
4. Ràng buộc mới có hiệu lực ngay từ lần generate thực đơn tiếp theo (Agent đọc `restrictions` khi build prompt/filter).

**As-built hiện tại:** UI constraints lưu local state (`handleSaveEdit` không gọi BE); cần nối API khi `specs/04` được implement.

**Lưu ý dữ liệu gap đã biết (memory dự án):** bảng "serving-size conversion" và "purine content" cho gout còn thiếu trong KB — cần bổ sung trước khi ràng buộc lâm sàng cho bệnh gout hoạt động chính xác.

### 2.5 Cập nhật và theo dõi chỉ số (góc nhìn bác sĩ)
**Status:** Đã có spec → `specs/12-patient-metrics-tracking.md` (Partial — snapshot Done; xu hướng dài hạn hoãn theo `adrs/010`).

| Use case | Mô tả |
|---|---|
| Theo dõi chỉ số bệnh nhân | Xem lịch sử cân nặng/chiều cao/huyết áp theo thời gian |
| Phân tích xu hướng dinh dưỡng | So sánh chỉ số theo tuần/tháng, phát hiện xu hướng bất thường (VD BMI tăng liên tục) |

**Luồng chính:**
1. Bác sĩ xem `PatientMetrics` hiện tại (`weight`, `height`, `bmi`, `bmi_category`) qua `PUT /doctor/patients/{id}/metrics` — snapshot mới nhất, BE tự tính BMI.
2. Với "phân tích xu hướng" — **Out of scope vòng demo này** (ADR-010: hoãn time-series, chỉ lưu snapshot trên `profiles`). Nice to have — không chặn North Star.

---

## 3. Nhóm chức năng: Bệnh nhân

### 3.1 Đăng ký hồ sơ ban đầu (Onboarding)
**Status:** Đã có spec → `specs/02-patient-profile-onboarding.md` + `specs/01-account-auth.md` (đăng ký/đăng nhập).

| Use case | Mô tả |
|---|---|
| Khai báo thông tin cơ bản | Họ tên, tuổi, giới tính |
| Khai báo hồ sơ bệnh lý | `disease[]`, `medications[]` |
| Khai báo dị ứng & không dung nạp | `allergies[]` |
| Đặt mục tiêu cân nặng/dinh dưỡng | `target_kcal`, mục tiêu cân nặng |

**Luồng chính:** Đăng ký (`POST /auth/register`) → login → `/patient/onboarding` → điền form nhiều bước → `POST /api/v1/profile` (upsert) → redirect `/patient/home`.

### 3.2 Cập nhật và theo dõi chỉ số
**Status:** Đã có spec → `specs/12-patient-metrics-tracking.md` (Partial — ghi nhận snapshot Done; "lời khuyên khi chỉ số đổi" Planned).

| Use case | Mô tả |
|---|---|
| Ghi nhận chỉ số mới | Cân nặng, huyết áp định kỳ |
| Theo dõi chỉ số | Xem lại lịch sử đã ghi |
| Nhận lời khuyên theo thay đổi chỉ số | AI đưa gợi ý ngắn khi chỉ số thay đổi bất thường (VD cân nặng tăng nhanh) |

**Luồng chính — Nhận lời khuyên theo thay đổi chỉ số (Planned):**
1. Bệnh nhân cập nhật cân nặng mới trong `/patient/profile`.
2. BE so sánh với giá trị cũ → nếu delta vượt ngưỡng (VD >2kg/tuần) → gọi Agent với intent `metric_feedback` (node mới — **chưa có** trong graph; xem `specs/12` §6 Out of scope / Planned).
3. Agent trả lời ngắn (grounded, có citation nếu liên quan dinh dưỡng) → hiển thị dạng notification/toast trong `/patient`.
4. Guardrails: nếu câu trả lời chạm tới thay đổi thuốc → redirect bác sĩ (không tự khuyến nghị).

### 3.3 Quản lý nhật ký ăn uống — ⚠️ Ngoài MVP
**Status:** Ngoài MVP — Xem mục 5.3.

Đề bài gốc có: Khai báo tuân thủ, Xem nhật ký ăn uống và thực đơn, Cảnh báo vượt ngưỡng, Nhận cảnh báo dị ứng và tương tác. Trong đó **"Nhận cảnh báo dị ứng và tương tác"** không phụ thuộc Food Log — nó thuộc luồng xem thực đơn (mục 3.4) và vẫn nằm trong MVP.

### 3.4 Xem thực đơn
**Status:** Đã có spec → `specs/07-patient-meal-plan-view.md` (xem chi tiết + swaps Done; đi chợ/gợi ý khu vực Could Have).

| Use case | Include | Mô tả |
|---|---|---|
| Xem chi tiết thực đơn | | `GET /api/v1/meal-plans/me` — xem 7 ngày, từng món kèm citation |
| Xem thực đơn thay thế | | Khi 1 món bị swap do tương tác nguy hiểm, hiển thị lý do + món thay thế |
| Tạo danh sách đi chợ | | **Ngoài MVP hiện tại** — nằm ở "Could Have" trong CLAUDE §2 (đã có Stitch prompt thiết kế UI theo memory dự án, nhưng backend chưa build) |
| Phản hồi và điều chỉnh | | Bệnh nhân feedback món không thích → dùng cho lần generate sau (Should Have — "Adaptive feedback") |
| Gợi ý khu vực bán nguyên liệu | | **Could Have**, cần tích hợp map (đã có Stitch prompt "shopping location map" theo memory dự án) — chưa có backend |

**Luồng chính — Xem thực đơn thay thế:**
1. Bệnh nhân mở plan detail → thấy badge "⚠️ Đã thay thế" trên món bị swap.
2. Bấm vào → hiển thị: món gốc, lý do (`mechanism` + `severity` từ format tương tác thuốc–thực phẩm CLAUDE §8), món thay thế, nguồn trích dẫn.
3. Đây chính là dữ liệu `swaps[]` sinh ra ở bước 4, mục 2.2 — FE chỉ cần render, không cần logic mới ở BE.

### 3.5 Tương tác với AI
**Status:** Đã có spec → `specs/13-ai-chat-assistant.md`.

| Use case | Mô tả |
|---|---|
| Yêu cầu xem thực đơn | Chat: "cho tôi xem thực đơn hôm nay" → route intent `meal_plan` |
| Yêu cầu xem thực đơn thay thế | Chat hỏi vì sao món bị đổi |
| Yêu cầu tạo danh sách đi chợ | Ngoài MVP (như 3.4) |
| Gợi ý khu vực bán nguyên liệu | Ngoài MVP |
| Tra cứu thông tin thực phẩm | Chat RAG Q&A — route intent `rag_qa`, luôn kèm citation |
| Phân tích nhu cầu dinh dưỡng | Chat hỏi "tôi cần bao nhiêu kcal/ngày" → NutritionCalculator + trả lời có căn cứ |

**Luồng chính (đã khớp `POST /api/v1/chat` hiện có trong `lib/api.ts`):**
1. Bệnh nhân gõ câu hỏi tự do trong `/patient/assistant`.
2. `POST /api/v1/chat {message}` → LangGraph: `profile_loader` (load context bệnh nhân) → `intent` classifier → route tới 1 trong các node: `meal_plan`, `interaction_check`, `rag_qa`, `refuse`, `food_log` (stub), `unknown`.
3. Guardrails: `guardrails/rules.py` đã có logic từ chối/validate nhưng **chưa wired vào graph** — as-built dùng `refuse_node` inline + regex trong `intent_classifier` (`adrs/006`, `specs/13`).
4. Nếu không bị chặn → trả `AgentRunOutput` gồm câu trả lời + `citations[]`.
5. FE render trong chat UI.

---

## 4. Nhóm chức năng: Chức năng dùng chung

| Use case | Mô tả | API hiện có |
|---|---|---|
| Đăng ký | Tạo tài khoản `patient` hoặc `doctor` | `POST /api/v1/auth/register` |
| Đăng nhập | Cấp JWT | `POST /api/v1/auth/login` |
| Liên hệ | Form liên hệ (hỗ trợ/feedback) — chưa thấy endpoint trong `api-v1.md`, nếu cần cho demo có thể làm form gửi email tĩnh phía FE, không cần backend riêng |

---

## 5. Ghi chú đối chiếu với hiện trạng codebase (quan trọng cho agent trước khi code)

### 5.1 Use case đã có backend/API sẵn — chỉ cần nối luồng
Quản lý bệnh nhân (đọc/tạo qua register), sinh thực đơn, duyệt thực đơn, chat RAG, cập nhật chỉ số cơ bản, notifications, **Doctor Compliance View** (`GET/POST .../compliance*`).

### 5.2 Use case còn gap thật (ưu tiên theo `tasks/roadmap-mvp.md`)
- **Guardrails wired vào graph** — `guardrails/rules.py` đã code nhưng chưa được graph gọi; `source_check.py` vẫn placeholder (`specs/13`, `adrs/006`) — **P0**.
- **`DEMO_MOCK=false` cho interaction check** — wire agent thật vào `POST /interactions/check` (hiện trả 501) (`specs/08`) — **P0**.
- **`PUT/POST .../constraints[/approve]`** — Clinical Constraints HITL; UI đã build nhưng BE chưa (`specs/04`) — **P1**.
- **Optimistic lock review** — 409 khi plan không còn `pending_review` (`specs/06`) — **P1**.
- **Persist meal plan qua `/chat`** — `meal_plan_node` trả `meal_plan_id` nhưng chưa ghi DB (`specs/05`) — **P1**.
- **Node `metric_feedback`** — "lời khuyên theo thay đổi chỉ số" (`specs/12` §6 Planned) — **P2/Should Have**.

**Đã chốt/đã code — không còn là gap:**
- `POST /api/v1/doctor/patients` — **không làm**; dùng `POST /auth/register` + `PUT /doctor/patients/{id}/profile` (`specs/03` rule 2).
- `GET .../compliance-summary` — **đã có** dưới tên `GET /doctor/patients/{id}/compliance` + `POST .../compliance/remind` (`specs/10` Done core).
- `PUT` cấp món trong plan — **không làm**; dùng `action=edit` với `edited_plan` full-replace (`specs/06` §6 Out of scope).

### 5.3 Lệch pha giữa đề bài gốc và MoSCoW hiện tại — đã chốt
Đề bài/UML có nhóm **"Quản lý nhật ký ăn uống"** (Food Log) ở cả 2 phía bác sĩ và bệnh nhân, nhưng `CLAUDE.md §2` và `AGENTS.md` xếp Food Log vào **Won't Have MVP** — quyết định chi tiết tại `adrs/009-food-log-scope-strategy.md` (Deferred) và `specs/09-food-log-adherence.md` (slot vocabulary 3-slot `morning/noon/evening` đã chốt để tránh thiết kế lại sau này). Route/stub có thể tồn tại (`food_log_node`, `/patient/meals/log`) nhưng **ẩn nav**, không mount API trong `main.py`.

Có 2 hướng khi trình bày UML:
1. **Giữ nguyên quyết định Won't Have** (khuyến nghị) → ghi chú scope cắt giảm có chủ đích cho prototype 2 tuần.
2. Nếu bắt buộc có trên diagram nộp bài → giữ Food Log **trên UML**, code là tập con ưu tiên theo MoSCoW — thực hành bình thường.

### 5.4 Use case "Cảnh báo dị ứng và tương tác" (A1) — đã có, đóng vai trò include dùng chung
Đây là use case được nhiều luồng khác `<<include>>` (sinh thực đơn, xem thực đơn, chat). Về code, nó tương ứng 1 service dùng chung: `InteractionCheckerAgent` + KB `drug_food_interactions.json` (`specs/08-drug-food-interaction-check.md`). Khi implement bất kỳ use case nào ở trên có include A1, **tái dùng service này**, không viết logic tương tác thuốc–thực phẩm riêng lẻ ở nơi khác.

---

## 6. Thứ tự triển khai đề xuất

Xem chi tiết đầy đủ tại **[`tasks/roadmap-mvp.md`](../tasks/roadmap-mvp.md)** mục "Thứ tự triển khai đề xuất" — đây là nguồn ưu tiên chính (SSOT), tránh lệch pha với tài liệu này.

**Tóm tắt cấp cao:**
- **P0:** Guardrails thật (wired graph) + `profile_loader` DB thật + `DEMO_MOCK=false` interaction check.
- **P1:** Clinical Constraints HITL (`specs/04`), optimistic lock review (`specs/06`), persist meal plan qua chat (`specs/05`).
- **P2/P3:** Mở rộng preferences, embedding/LLM migration, metric_feedback — không chặn North Star demo.
- **Won't Have (giữ nguyên):** Food Log, xu hướng chỉ số dài hạn, danh sách đi chợ/gợi ý khu vực bán.