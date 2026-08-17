# CLAUDE.md — AI Agent Trợ Lý Dinh Dưỡng & Lối Sống Theo Bệnh Lý

> File này là "nguồn sự thật" (single source of truth) cho AI coding agent khi làm việc trên repo này.
> Đọc toàn bộ file này TRƯỚC khi code bất kỳ task nào. Pointer ngắn: [`AGENTS.md`](AGENTS.md).
> Hạn chế thay đổi Frontend đã thiết kế
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
| Hồ sơ bệnh nhân | Adaptive feedback | Food recognition ảnh | NLP parse tự do thành định lượng dinh dưỡng |
| Meal plan 7 ngày (RAG) | Memory preferences | Danh sách đi chợ | Billing/payment |
| Drug-food interaction + Alert | Expert review nâng cao | Export PDF | Multi-language |
| **Compliance Notification** (in-app) | Cảnh báo ngưỡng dinh dưỡng | Push notification (FCM/APNs) | Social features |
| Nutrition calculator | Chat Q&A sâu hơn | Wearable sync | |
| Guardrails + nguồn trích dẫn | **Doctor Compliance View** (`specs/10`, Done core) | | |
| Dietitian review UI (approve/edit/reject) | **Food Log** (structured manual entry, ADR-009) | | |
| | **Clinical Constraints HITL** (`specs/04`, Planned) | | |
| | **Patient Metrics History** (time-series, ADR-013) | | |

> **Thay đổi scope (2026-08-17):** Food Log (phạm vi tối thiểu ADR-009) và Patient Metrics time-series (ADR-013) đã được nâng lên Should Have và implement. Compliance Notification và Drug-food interaction vẫn Must Have.

---

## 3. Tech Stack (as-built)

> Chi tiết quyết định: `/adrs/`. Tổng quan hệ thống: `/docs/MO_TA_HE_THONG.md`.

**AI/ML Layer**
- LLM: GPT-4o-mini mặc định (`LLM_MODEL` + `OPENAI_API_KEY` trong env); as-built single-provider qua `LLM_PROVIDER` — ADR-004 đã quyết định dual-provider fallback OpenAI↔DeepSeek nhưng **Planned, chưa code**
- Orchestration: LangGraph (Python) — facade `run_agent`
- Embedding: **Gemini `gemini-embedding-2`** (default, `EMBEDDING_PROVIDER=gemini`) — fallback local `paraphrase-multilingual-MiniLM-L12-v2` khi thiếu key/lỗi API (ADR-003)
- Vector DB: **ChromaDB** persist (`CHROMA_PERSIST_DIR` / `chroma_db/`) — ADR-001 (Accepted, giữ Chroma cho prototype)
- RAG: dense retrieval (+ BM25 hybrid trong retriever)
- Demo flag: `DEMO_MOCK=true` (mặc định) — **chỉ** chi phối `POST /interactions/check` (trả 501 khi `false`); meal plan generate luôn chạy qua `meal_planner_agent`, không rẽ nhánh theo cờ này (`specs/05-meal-plan-generation.md`)

**Backend**
- Framework: FastAPI (Python)
- Database: **SQLite** mặc định (`DATABASE_URL`); Postgres-ready — ADR-005
- Auth: JWT, 2 role API (`patient`, `doctor`)
- Deploy hiện tại: `docker-compose` local; target prod Railway/Vercel vẫn là mục tiêu gap-closure

**Frontend**
- Framework: Next.js 16 (App Router)
- Styling: Tailwind CSS
- State: Zustand (stores cục bộ / mock); `lib/api.ts` đã nối nhiều endpoint thật — còn thiếu `checkInteraction`, `simulateNotifications` (xem `tasks/fe-frontend.md`)
- Shell: `/patient/*` (bệnh nhân) · `/doctor/*` (role API `doctor`)

---

## 4. Cấu trúc thư mục chuẩn (as-built)

```
P-014/
├── CLAUDE.md
├── docs/MO_TA_HE_THONG.md          # mô tả chức năng + luồng use-case (đối chiếu specs)
├── specs/                          # đặc tả nghiệp vụ (01–13, mỗi file có Status)
│   ├── 01-account-auth.md
│   ├── 02-patient-profile-onboarding.md
│   ├── 03-doctor-patient-management.md
│   ├── 04-clinical-constraints.md
│   ├── 05-meal-plan-generation.md
│   ├── 06-meal-plan-review.md
│   ├── 07-patient-meal-plan-view.md
│   ├── 08-drug-food-interaction-check.md
│   ├── 09-food-log-adherence.md
│   ├── 10-doctor-compliance-view.md
│   ├── 11-compliance-notification-delivery.md
│   ├── 12-patient-metrics-tracking.md
│   └── 13-ai-chat-assistant.md
├── adrs/
│   ├── 001-vector-database-choice.md
│   ├── 002-agent-orchestration-langgraph.md
│   ├── 003-embedding-model-choice.md
│   ├── 004-llm-provider-and-fallback-strategy.md
│   ├── 005-database-choice.md
│   ├── 006-hitl-guardrails-strategy.md
│   ├── 007-compliance-notification-strategy.md
│   ├── 008-compliance-summary-aggregation-strategy.md
│   ├── 009-food-log-scope-strategy.md
│   ├── 010-patient-metrics-history-strategy.md
│   └── 013-patient-metrics-time-series.md
├── contracts/
│   ├── agent-io-schema.md          # Agent facade + core schemas (versioned)
│   └── api-v1.md                   # FE ↔ BE HTTP
├── tasks/
│   ├── README.md                   # ownership + pointer backlog
│   ├── roadmap-mvp.md              # backlog đóng gap as-built → North Star (SSOT hiện tại)
│   ├── be1-ai-core.md
│   ├── be2-platform.md
│   └── fe-frontend.md
│
├── backend/app/
│   ├── main.py
│   ├── core/                       # config.py, security.py
│   ├── api/v1/                     # auth, profile, meal_plan, chat, interactions,
│   │                               # alerts, notifications, doctor
│   │                               # food_log, metrics
│   ├── agents/                     # graph.py, nodes/, meal_planner, interaction_checker
│   ├── rag/                        # indexer, retriever, embeddings (Chroma)
│   ├── guardrails/                 # rules.py đã code (chưa wired graph); source_check.py placeholder
│   ├── models/ · schemas/ · services/ · db/
├── backend/data/                   # food_db_vn.json, drug_food_interactions.json, guidelines/
├── backend/chroma_db/              # vector store local (gitignore)
├── frontend/app/
│   ├── (auth)/                     # login, register
│   ├── patient/                    # home, onboarding, meals, notifications, assistant...
│   └── doctor/                     # patients, patients/queue, patients/constraints,
│                                   # patients/compliance, reviews, history, messages
├── frontend/components/            # shared/, doctor/
├── frontend/lib/                   # api.ts, nav-config.ts, mock-data.ts, *-store.ts
└── docker-compose.yml
```

---

## 5. Phân công team (tóm tắt)

| Role | Owner modules | Không đụng (trừ khi thống nhất) |
|---|---|---|
| **BE1 — AI Core** | `agents/`, `rag/`, `guardrails/`, `services/nutrition_calculator.py`, data KB (`data/`), tests AI | Frontend, JWT/auth wiring chi tiết, notification scheduler |
| **BE2 — Platform** | `api/`, `models/`, `schemas/`, `db/`, `core/`, `services/notification.py`, routes doctor/alerts/notifications | Logic prompt/RAG internals, FE components |
| **FE — Frontend** | `frontend/**`, types đồng bộ contract, UX 4 screens | Backend agent logic, DB migrations |

**Handoff rule:** đổi schema Agent → sửa `/contracts/agent-io-schema.md` trước; đổi HTTP FE↔BE → sửa `/contracts/api-v1.md` trước (hoặc đồng bộ từ Swagger). BE1 ↔ BE2 qua contract + Pydantic; FE phụ thuộc `api-v1` / OpenAPI đã ổn định.

Backlog hiện tại: `/tasks/roadmap-mvp.md`. Ownership rút gọn: `/tasks/be1-ai-core.md`, `/tasks/be2-platform.md`, `/tasks/fe-frontend.md`.

---

## 6. Quy trình làm việc mỗi Task

1. **Đọc context trước** — `/specs/0x-*.md` liên quan, `/adrs/` nếu động kiến trúc, contracts nếu chạm ranh giới Agent↔API↔FE; đọc `/docs/MO_TA_HE_THONG.md` nếu cần big picture.
2. **Bám contract** — không tự sáng tạo format I/O. Sửa contract trước, code sau; bump version `agent-io-schema` khi breaking.
3. **Code theo boundary của role/task** — không lan sang module ngoài phạm vi.
4. **Test trước khi coi là xong** — `pytest tests/<module>` (RAG, interaction, compliance, API).
5. **Git kỷ luật** — nhánh `feature/<role>-*`, commit `feat(scope): …`, không push thẳng `main`.

---

## 7. Luật cứng (không được vi phạm)

- Mọi số liệu dinh dưỡng AI trả về **PHẢI** có nguồn trích dẫn từ RAG — không hallucinate.
- Guardrails: AI **không** được tự ý khuyến nghị đổi thuốc/liều lượng — luôn redirect bác sĩ.
- Mọi Agent mới phải khớp schema đã định nghĩa trong `contracts/agent-io-schema.md`.
- Danh sách câu AI phải từ chối & redirect bác sĩ → định nghĩa trong `backend/app/guardrails/rules.py`.
- Food Log implement theo phạm vi tối thiểu ADR-009: nhập tay có cấu trúc (3 slot `morning|noon|evening`, `as_planned|custom`), **không** làm NLP parse tự do hay nhận diện ảnh món ăn.
- Patient Metrics time-series theo ADR-013: bảng `body_metrics_history` cho bệnh nhân/bác sĩ ghi nhận theo thời gian; snapshot trên `profiles` vẫn giữ làm giá trị mới nhất.

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

## 9. Roadmap & backlog hiện tại

Roadmap 14 ngày gốc đã **superseded**. Backlog đóng gap as-built → North Star:

→ **[`/tasks/roadmap-mvp.md`](/tasks/roadmap-mvp.md)** (bảng ánh xạ spec→task→MoSCoW→owner, cập nhật 2026-08-15).

Tóm tắt ưu tiên (chi tiết đầy đủ xem file trên):

| Ưu tiên | Việc | Owner |
|---|---|---|
| **P0** | Guardrails thật (`rules.py` + `source_check.py` wired vào graph) + `profile_loader` đọc DB thật khi chat | BE1 |
| **P0** | `DEMO_MOCK=false` cho interaction check — wire agent thật vào `POST /interactions/check` (hết 501) | BE1 + BE2 |
| **P1** | Clinical Constraints HITL — `PUT/POST .../constraints[/approve]` (`specs/04`) | BE2 |
| **P1** | Optimistic lock review (409) + persist meal plan qua `/chat` (`specs/06`, `specs/05`) | BE2 + BE1 |
| **P2/P3** | Mở rộng `preferences`, `unmatched_pairs[]`, migrate embedding/LLM provider (Should, không chặn demo) | BE1 |

**Đã Done (core), không chặn North Star:** Doctor Compliance View (`specs/10` — `GET/POST .../compliance*`, FE nối API thật).

---

## 10. Rủi ro & Plan B

| Rủi ro | Xác suất | Plan B |
|---|---|---|
| CSDL thực phẩm VN thiếu/khó collect | Cao | USDA FoodData + map tên VN |
| LangGraph / LLM không ổn định khi demo | Trung bình | Giữ `DEMO_MOCK=true` cho pitch; test nhánh thật riêng |
| RAG tiếng Việt accuracy thấp | Trung bình | Hybrid dense + BM25; eval query mẫu |
| Chroma đủ cho prototype / không migrate Qdrant | Thấp | Giữ Chroma (ADR-001 Accepted) |
| Compliance không có cron thật | Trung bình | Event-driven materialize + `demo/simulate` seed mẫu |
| API cost LLM vượt budget | Thấp | Cache, model nhỏ, mock mặc định |
| Scope creep (Food Log quay lại) | Trung bình | Giữ Won't Have; ẩn nav |

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
| `rag-indexing` | Index CSDL thực phẩm/guideline vào Chroma | Chuẩn hoá format chunk/metadata |
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
