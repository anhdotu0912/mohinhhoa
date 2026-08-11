# CLAUDE.md — AI Agent Trợ Lý Dinh Dưỡng & Lối Sống Theo Bệnh Lý

> File này là "nguồn sự thật" (single source of truth) cho AI coding agent khi làm việc trên repo này.
> Đọc toàn bộ file này TRƯỚC khi code bất kỳ task nào.

---

## 1. Tổng quan dự án

**Sản phẩm:** AI Agent giúp bệnh nhân đái tháo đường (tiểu đường Type 2) nhận thực đơn cá nhân hoá theo bệnh lý, nhận cảnh báo tương tác thuốc–thực phẩm, và nhận nhắc tuân thủ (compliance) theo thực đơn/thuốc. Có dashboard cho chuyên gia dinh dưỡng duyệt thực đơn.

**Timeline:** Prototype 2 tuần (14 ngày), mục tiêu là demo, không phải sản phẩm hoàn chỉnh.

**Team:** 3 người — **BE1 (AI Core)** · **BE2 (Platform API)** · **FE (Frontend)**. Chi tiết phân công: `/tasks/`.

**North Star:** Có 1 demo flow hoàn chỉnh chạy được — từ bệnh nhân nhập hồ sơ → nhận thực đơn 7 ngày → nhận cảnh báo tương tác thuốc–thực phẩm → nhận Compliance Notification → BS duyệt.

**Nguyên tắc vàng:** Khi phải đánh đổi giữa "thêm tính năng" vs "demo flow mượt" → luôn chọn demo flow mượt. Một prototype chạy trơn tru với 4 tính năng > app nhiều tính năng nhưng lỗi vặt.

---

## 2. Feature Priority (MoSCoW) — MVP hiện tại

| Must Have (MVP) | Should Have | Could Have | Won't Have (MVP này) |
|---|---|---|---|
| Hồ sơ bệnh nhân | Adaptive feedback | Food recognition ảnh | **Food Log** (text/search/NLP) |
| Meal plan 7 ngày (RAG) | Memory preferences | Danh sách đi chợ | Billing/payment |
| Drug-food interaction + Alert | Expert review nâng cao | Export PDF | Multi-language |
| **Compliance Notification** (in-app) | Cảnh báo ngưỡng dinh dưỡng | Push notification (FCM/APNs) | Social features |
| Nutrition calculator | Chat Q&A sâu hơn | Wearable sync | |
| Guardrails + nguồn trích dẫn | | | |
| Dietitian review UI (approve/edit/reject) | | | |

> **Thay đổi scope so với bản cũ:** bỏ Food Log khỏi MVP; đưa Compliance Notification vào Must Have; Drug-food interaction nâng lên Must Have vì nằm trên North Star demo.

---

## 3. Tech Stack

**AI/ML Layer**
- LLM: GPT-4o-mini hoặc DeepSeek (cấu hình `MODEL_LLM`, `LLM_PROVIDER` trong env)
- Orchestration: LangGraph (Python)
- Embedding: Gemini Embedding 2 (có API key rotation; tên model trong env)
- Vector DB: Qdrant
- RAG: LangChain + custom retriever (hybrid dense + BM25)

**Backend**
- Framework: FastAPI (Python)
- Database: PostgreSQL
- Auth: JWT + python-jose, 2 role (`patient`, `dietitian`)
- Deploy: Railway

**Frontend**
- Framework: Next.js 14 (App Router)
- Styling: Tailwind CSS + shadcn/ui
- State: Zustand
- Deploy: Vercel

---

## 4. Cấu trúc thư mục chuẩn

```
P-014/
├── CLAUDE.md                       # file này
├── .claude/skills/                 # rag-indexing, langgraph-agent-node, interaction-checker...
│
├── specs/                          # đặc tả nghiệp vụ — "cái gì, tại sao"
│   ├── meal-planner.md
│   ├── interaction-checker.md
│   └── compliance-notification.md
├── adrs/                           # quyết định kiến trúc — "như thế nào"
│   ├── 001-vector-db-choice.md
│   ├── 002-langgraph-vs-chain.md
│   ├── 003-embedding-model.md
│   └── 004-compliance-notification.md
├── contracts/
│   └── agent-io-schema.md          # input/output schema từng Agent + API boundary
├── tasks/                          # roadmap 14 ngày + phân công BE1/BE2/FE
│   ├── README.md
│   ├── roadmap-14-days.md
│   ├── be1-ai-core.md
│   ├── be2-platform.md
│   └── fe-frontend.md
│
├── backend/                        # ── FastAPI ──
│   └── app/
│       ├── main.py
│       ├── core/                   # config.py, security.py (JWT)
│       ├── api/v1/                 # routes_profile, routes_meal_plan,
│       │                           # routes_chat, routes_dietitian,
│       │                           # routes_alerts, routes_notifications
│       ├── agents/                 # ── LangGraph ──
│       │   ├── graph.py
│       │   ├── nodes/              # profile_loader, intent_classifier, rag_tool
│       │   ├── meal_planner_agent.py
│       │   └── interaction_checker_agent.py
│       ├── rag/                    # indexer.py, retriever.py, embeddings.py
│       ├── guardrails/             # rules.py, source_check.py
│       ├── models/                 # user, profile, meal_plan, alert, notification
│       ├── schemas/                # Pydantic — contract với frontend
│       ├── services/               # nutrition_calculator.py, notification.py
│       └── db/
│   ├── data/                       # food_db_vn.json, guidelines/, drug_food_interactions.json
│   ├── tests/                      # test_rag, test_meal_planner, test_interaction_checker,
│   │                               # test_compliance_notification
│   └── qdrant_data/                # local vector store (gitignore)
│
├── frontend/                       # ── Next.js 14 App Router ──
│   └── app/
│       ├── onboarding/             # Screen 1: hồ sơ bệnh nhân
│       ├── meal-plan/              # Screen 2: thực đơn 7 ngày
│       ├── dashboard/              # Screen 3: alerts + compliance notifications
│       └── dietitian/              # Screen 4: dietitian review
│   ├── components/                 # ui/, meal-plan/, chat/, alerts/, notifications/
│   ├── lib/                        # api.ts, types.ts (đồng bộ với backend/schemas)
│   └── store/                      # useProfileStore, useMealPlanStore, useNotificationStore
│
└── docker-compose.yml
```

---

## 5. Phân công team (tóm tắt)

| Role | Owner modules | Không đụng (trừ khi thống nhất) |
|---|---|---|
| **BE1 — AI Core** | `agents/`, `rag/`, `guardrails/`, `services/nutrition_calculator.py`, data KB (`data/`), tests AI | Frontend, JWT/auth wiring chi tiết, notification scheduler |
| **BE2 — Platform** | `api/`, `models/`, `schemas/`, `db/`, `core/`, `services/notification.py`, routes dietitian/alerts/notifications | Logic prompt/RAG internals, FE components |
| **FE — Frontend** | `frontend/**`, types đồng bộ contract, UX 4 screens | Backend agent logic, DB migrations |

**Handoff rule:** mọi thay đổi schema Agent/API → sửa `/contracts/agent-io-schema.md` trước, rồi mới code. BE1 ↔ BE2 giao tiếp qua contract + Pydantic schemas; FE chỉ phụ thuộc OpenAPI/schemas đã ổn định.

Chi tiết backlog từng role: `/tasks/be1-ai-core.md`, `/tasks/be2-platform.md`, `/tasks/fe-frontend.md`.

---

## 6. Quy trình làm việc mỗi Task

1. **Đọc context trước** — bắt buộc: `/specs/<feature>.md` liên quan, `/adrs/` nếu động tới kiến trúc, `/contracts/agent-io-schema.md` nếu chạm ranh giới Agent↔Backend↔Frontend.
2. **Bám contract** — không tự sáng tạo format input/output giữa các Agent/API. Sửa contract trước, code sau.
3. **Code theo boundary của role/task** — không lan sang module của người khác ngoài phạm vi đã phân công.
4. **Test trước khi coi là xong** — chạy `pytest tests/<module>`, bắt buộc với: RAG accuracy, guardrails, interaction checker, compliance notification scheduler.
5. **Git kỷ luật** — nhánh `feature/<role>-*`, commit theo `feat(scope): mô tả`, không push thẳng `main`. PR nhỏ, có reviewer từ role liên quan khi chạm contract.

---

## 7. Luật cứng (không được vi phạm)

- Mọi số liệu dinh dưỡng AI trả về **PHẢI** có nguồn trích dẫn từ RAG — không hallucinate.
- Guardrails: AI **không** được tự ý khuyến nghị đổi thuốc/liều lượng — luôn redirect bác sĩ.
- Mọi Agent mới phải khớp schema đã định nghĩa trong `contracts/agent-io-schema.md`.
- Danh sách câu AI phải từ chối & redirect bác sĩ → định nghĩa trong `backend/app/guardrails/rules.py`.
- **Không** implement Food Log trong MVP này (kể cả endpoint stub lộ ra FE demo) trừ khi team thống nhất đổi MoSCoW và cập nhật CLAUDE.md + specs.

---

## 8. Schema hồ sơ bệnh nhân (tham chiếu chuẩn cho mọi Agent)

```json
{
  "disease": ["diabetes_t2"],
  "medications": ["metformin", "glipizide"],
  "allergies": ["hải sản"],
  "bmi": 26.5,
  "target_kcal": 1800,
  "restrictions": { "carb_per_meal": 45, "sodium_daily": 2300 },
  "preferences": ["thích ăn cơm", "ít dầu mỡ"]
}
```

**Format cặp tương tác thuốc–thực phẩm:**
```json
{
  "drug": "metformin",
  "food": "rượu",
  "mechanism": "...",
  "severity": "Nguy hiểm|Cần chú ý|An toàn",
  "recommendation": "..."
}
```

**Format Compliance Notification (tóm tắt):**
```json
{
  "type": "meal_reminder|interaction_followup|plan_approved|adherence_checkin",
  "title": "...",
  "body": "...",
  "scheduled_at": "ISO-8601",
  "status": "pending|sent|read|dismissed|done",
  "related_ids": { "meal_plan_id": "...", "alert_id": "..." }
}
```

---

## 9. Roadmap 14 ngày (tóm tắt)

**Tuần 1 — Validate + Foundation**
| Ngày | Nội dung | Owner chính | Deliverable |
|---|---|---|---|
| 1-2 | Research & Data: CSDL ≥300 thực phẩm VN, guideline ADA/AHA/ACR/BYT, ≥10 survey | BE1 + cả team | CSDL + 5 insight |
| 3-4 | AI Core: index Qdrant, LangGraph skeleton, guardrails, test 20 câu | BE1 | RAG pass ≥80% |
| 5 | MealPlannerAgent + NutritionCalculator, 3 profile mẫu | BE1 | Thực đơn 7 ngày × 3 |
| 6-7 | Backend API nền (auth, profile, meal plan), DB PostgreSQL, JWT | BE2 | API chạy được (Swagger) |

**Tuần 2 — Build + Polish + Demo**
| Ngày | Nội dung | Owner chính | Deliverable |
|---|---|---|---|
| 8-9 | Frontend 4 screens: Onboarding, Meal Plan, Dashboard (alerts+compliance), Dietitian shell | FE | 4 màn hình chạy được |
| 10 | Interaction KB ≥20 cặp + InteractionCheckerAgent + Alert API | BE1 + BE2 | Checker ≥20 cặp |
| 11 | Compliance Notification service + Dietitian approve/edit/reject + trust badge | BE2 + FE | Nhắc tuân thủ + BS duyệt |
| 12-13 | E2E integration, fix bugs, polish UX, perf (RAG <5s, meal plan <15s), deploy | Cả team | App live URL |
| 14 | Demo script (5 scene) + data demo + rehearse ×3 | Cả team | Demo sẵn sàng |

Chi tiết ngày-ngày: `/tasks/roadmap-14-days.md`.

---

## 10. Rủi ro & Plan B

| Rủi ro | Xác suất | Plan B |
|---|---|---|
| CSDL thực phẩm VN thiếu/khó collect | Cao | USDA FoodData + map tên VN |
| LangGraph phức tạp, delay | Trung bình | Simple LangChain chain trước, migrate sau |
| RAG tiếng Việt accuracy thấp | Trung bình | Hybrid dense + BM25 |
| Qdrant setup chậm trên deploy | Trung bình | Qdrant Cloud free tier / Docker local trước |
| Gemini embedding rate-limit | Trung bình | Key rotation (đã thiết kế) + cache embedding |
| Compliance cron/scheduler phức tạp | Trung bình | Generate notifications khi tạo/duyệt meal plan (event-driven), chưa cần worker riêng |
| API cost LLM vượt budget | Thấp | Cache responses, model nhỏ hơn cho dev |
| Scope creep (Food Log quay lại) | Trung bình | Giữ Won't Have; ghi vào backlog post-demo |

---

## 11. Success Metrics (sau 2 tuần)

**Must achieve**
- [ ] Demo flow end-to-end chạy mượt, không crash
- [ ] Tạo được thực đơn 7 ngày phù hợp bệnh tiểu đường (có citation)
- [ ] Drug-food interaction hoạt động ≥10 cặp thuốc (target KB ≥20)
- [ ] Compliance Notification: tạo + hiển thị in-app theo meal plan / alert
- [ ] Mọi recommendation có nguồn trích dẫn (không hallucinate)
- [ ] Dietitian duyệt (approve/reject) được ít nhất 1 meal plan
- [ ] ≥5 responses khảo sát thật

**Nice to have**
- [ ] Chat Q&A có guardrails đầy đủ
- [ ] App deploy live trên URL public
- [ ] ≥20 responses khảo sát
- [ ] Push notification thật (FCM)

---

## 12. Definition of Done (mỗi task)

- [ ] Code đúng spec trong `/specs/`
- [ ] Đúng boundary role trong `/tasks/`
- [ ] Test liên quan pass
- [ ] Update `/contracts/` nếu schema thay đổi
- [ ] Không lint error
- [ ] Demo flow không bị gãy khi chạy thử end-to-end

**Checklist cuối mỗi ngày:**
1. Deliverable hôm nay có done không? (Y/N)
2. Blocker nào đang chặn? → Giải pháp ngay / escalate
3. Demo flow có tiến gần hơn không?
4. Handoff cho role khác cần gì ngày mai?

---

## 13. Skills cần build (`.claude/skills/`)

| Skill | Trigger | Mục đích |
|---|---|---|
| `rag-indexing` | Index CSDL thực phẩm/guideline vào Qdrant | Chuẩn hoá format chunk/metadata |
| `langgraph-agent-node` | Tạo node mới trong LangGraph | Pattern input/output/error handling |
| `interaction-checker` | Thêm cặp thuốc–thực phẩm | Format `{drug, food, mechanism, severity, recommendation}` |
| `compliance-notification` | Thêm loại nhắc tuân thủ | Format type/schedule/status + API |
| `fastapi-endpoint` | Thêm route mới | JWT auth, response schema, error format |
| `deploy-check` | Trước khi deploy | RAG <5s, meal plan <15s, healthcheck |

---

## 14. Commands tham khảo

```bash
# Backend
cd backend
uvicorn app.main:app --reload
pytest tests/

# Frontend
cd frontend
npm run dev

# Full stack (dev)
docker-compose up
```
