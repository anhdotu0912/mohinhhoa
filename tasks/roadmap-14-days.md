# Roadmap 14 ngày — phân công chi tiết

> Giả định lịch: Tuần 1 = ngày 1–7, Tuần 2 = ngày 8–14 (bám CLAUDE.md).  
> Mỗi ngày: **Goal** · **BE1 / BE2 / FE** · **DoD ngày** · **Handoff**

---

## Tuần 1 — Validate + Foundation

### Ngày 1–2 — Research & Data
**Goal:** CSDL thực phẩm VN ≥300 items + guideline + insight khảo sát.

| Role | Việc |
|---|---|
| BE1 | Thu thập/chuẩn hoá `food_db_vn.json`, `guidelines/*`, draft schema chunk; liệt kê 20 câu hỏi RAG test |
| BE2 | Chốt postgres schema draft (user, profile, meal_plan, alert, notification); docker-compose skeleton (api, db, qdrant) |
| FE | Wireframe 4 screens; chốt copy demo flow; hỗ trợ survey (≥10 responses cả team) |

**DoD:** ≥300 foods (hoặc Plan B USDA-map); 4 file guideline có nội dung; 5 insight ghi `/eval` hoặc JOURNAL.  
**Handoff:** BE1 → sẵn data path; BE2 → ERD ngắn trong PR/doc.

---

### Ngày 3–4 — AI Core skeleton
**Goal:** Index Qdrant + LangGraph skeleton + guardrails; RAG ≥80% trên 20 câu.

| Role | Việc |
|---|---|
| BE1 | Embeddings (Gemini + rotation), indexer, retriever hybrid, nodes `profile_loader` / `intent_classifier` / `rag_tool`, `rules.py` |
| BE2 | Env template, `run_agent` stub route `/chat` (có thể fake), JWT register/login minimal |
| FE | Setup Next.js layout, NavBar, auth pages shell, `lib/api.ts` base URL |

**DoD:** `pytest tests/test_rag.py` đạt ngưỡng team; guardrail từ chối ≥ mẫu trong rules.  
**Handoff:** BE1 cung cấp `AgentRunInput/Output` đã ghi contract.

---

### Ngày 5 — MealPlanner
**Goal:** Thực đơn 7 ngày cho 3 profile mẫu.

| Role | Việc |
|---|---|
| BE1 | `meal_planner_agent` + `nutrition_calculator`; source_check; 3 fixture profiles |
| BE2 | Model/schema `MealPlan`; `POST /meal-plans/generate` gọi agent (có thể sync); persist JSON |
| FE | Meal Plan page: render 7 ngày từ mock → chuyển sang API khi BE2 ready |

**DoD:** 3 plan generate được; citations không rỗng; latency ghi nhận.  
**Handoff:** Sample `MealPlanOutput` JSON cho FE.

---

### Ngày 6–7 — Platform API cứng
**Goal:** Backend chạy end-to-end auth + profile + meal plan qua Swagger.

| Role | Việc |
|---|---|
| BE1 | Ổn định agent API nội bộ; bắt đầu KB interaction draft (≥10 cặp) |
| BE2 | Hoàn thiện routes profile/meal-plan/chat; CORS; seed user patient+dietitian; integration smoke |
| FE | Onboarding form → `POST /profile`; connect login; error states |

**DoD:** Postman/Swagger flow: register → profile → generate plan.  
**Handoff:** OpenAPI ổn định cho FE ngày 8.

---

## Tuần 2 — Build + Polish + Demo

### Ngày 8–9 — Frontend 4 screens
**Goal:** 4 màn hình chạy được trên data thật/mock có kiểm soát.

| Role | Việc |
|---|---|
| BE1 | Hoàn thiện InteractionChecker + KB → 20 cặp; unit tests |
| BE2 | `GET /alerts`; skeleton `Notification` model + empty list API; dietitian list pending |
| FE | Onboarding, Meal Plan, Dashboard (alerts + notification inbox UI), Dietitian shell |

**DoD:** FE click-through 4 screens không trắng.  
**Handoff:** FE list missing fields → BE2 patch schemas trong ngày.

---

### Ngày 10 — Interaction + Alerts
**Goal:** Checker ≥20 cặp; alert hiện Dashboard.

| Role | Việc |
|---|---|
| BE1 | Tích hợp checker vào MealPlanner (swap món nguy hiểm); tests |
| BE2 | Persist alerts khi generate/check; API filter severity |
| FE | Alert list + severity badge; deep link tới món trong plan nếu có |

**DoD:** Demo: profile có warfarin → plan không còn rau muống (hoặc có swap) + alert.  
**Handoff:** Alert id để BE2 gắn `interaction_followup` ngày 11.

---

### Ngày 11 — Compliance Notification + Dietitian review
**Goal:** Nhắc tuân thủ in-app + BS duyệt được.

| Role | Việc |
|---|---|
| BE1 | Support review: đảm bảo output plan có đủ field để edit; hotfix citation |
| BE2 | NotificationService materialize + hooks approve/reject/alert; dietitian review endpoint + trust badge |
| FE | Notification actions (read/dismiss/done); Dietitian approve/edit/reject UI; hiện trust badge trên plan |

**DoD:** Flow approve → patient thấy `plan_approved`; check-in `done` lưu adherence.  
**Handoff:** Demo script draft scene list.

---

### Ngày 12–13 — E2E, perf, deploy
**Goal:** App live URL; RAG <5s; meal plan <15s.

| Role | Việc |
|---|---|
| BE1 | Perf RAG (cache embedding), eval report, fix hallucination gaps |
| BE2 | Deploy Railway (API+DB+Qdrant), migrations, demo simulate endpoint, logging |
| FE | Deploy Vercel, polish UX, loading/empty/error, mobile sanity |

**DoD:** Public URL + healthcheck; E2E script chạy 1 lần không crash.  
**Handoff:** Credentials demo (patient/dietitian) vào how_to_run / pitch note.

---

### Ngày 14 — Demo day prep
**Goal:** Demo script 5 scene + rehearse ×3.

| Role | Việc |
|---|---|
| BE1 | Seed data “đẹp”; câu hỏi RAG backup |
| BE2 | Reset DB script; monitor logs lúc rehearse |
| FE | Click-path tối ưu; fallback UI nếu API chậm |

**5 scene gợi ý**
1. Onboarding bệnh nhân T2DM + warfarin  
2. Generate meal plan + citations  
3. Alert tương tác + notification follow-up  
4. Compliance check-in cuối ngày  
5. Dietitian approve + patient nhận `plan_approved`

**DoD:** 3 lần chạy demo không gãy North Star.

---

## Buffer / escalation

- Nếu RAG <80% cuối ngày 4 → BE1 dừng feature mới, chỉ cải thiện retriever; BE2/FE dùng meal plan mock có citation cứng.
- Nếu Notification trễ ngày 11 → tối thiểu: 1 loại `plan_approved` + 1 `meal_reminder` demo simulate.
- Food Log **không** lấy buffer — giữ Won't Have.
