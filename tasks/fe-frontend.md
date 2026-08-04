# FE — Frontend backlog

> Modules: `frontend/**`  
> Specs: tất cả (consume) · đặc biệt UI cho meal plan, alerts, compliance  
> Contract: mirror `contracts/agent-io-schema.md` → `lib/types.ts`

---

## Trách nhiệm

- 4 screens MVP: **Onboarding · Meal Plan · Dashboard · Dietitian**
- Auth UX (login/register patient & dietitian)
- Zustand: profile, meal plan, notifications (alerts có thể nằm chung dashboard store)
- Đồng bộ types với contract; gọi API qua `lib/api.ts`
- Demo UX: loading, empty, error, trust badge, severity colors
- Deploy Vercel

## Không làm

- Food Log page/route/component (xoá stub nếu còn từ boilerplate)
- Tự gọi LLM / Qdrant từ browser
- Đổi severity enum / status string lệch contract

---

## Screens & DoD

### Screen 1 — Onboarding (`/onboarding`)
- [ ] Form đúng field `PatientProfile`
- [ ] Submit → `POST /profile` → redirect meal-plan hoặc dashboard
- [ ] Validation cơ bản (disease ≥1, target_kcal >0)

### Screen 2 — Meal Plan (`/meal-plan`)
- [ ] Nút generate + hiển thị 7 ngày / slots
- [ ] Citations visible
- [ ] Status + trust badge khi `approved`
- [ ] Warnings / swaps (nếu có)

### Screen 3 — Dashboard (`/dashboard`)
- [ ] Alert list (severity badge)
- [ ] Notification inbox (filter type/status)
- [ ] Actions: read / dismiss / done (adherence)
- [ ] Demo simulate button (hidden unless demo flag)

### Screen 4 — Dietitian (`/dietitian`)
- [ ] Login role dietitian
- [ ] List `pending_review`
- [ ] Approve / Reject / Edit (edit tối thiểu: notes + optional JSON/simple fields)
- [ ] Sau approve, patient side phản ánh badge (verify E2E)

---

## Checklist theo milestone

### M1 (ngày 1–7)
- [ ] App shell + NavBar + auth
- [ ] Types + API client
- [ ] Onboarding + Meal Plan mock → real API

### M2 (ngày 8–9)
- [ ] 4 screens click-through
- [ ] Dashboard layout alerts + notifications

### M3 (ngày 10–11)
- [ ] Alerts thật
- [ ] Notification actions thật
- [ ] Dietitian review UI

### M4 (ngày 12–14)
- [ ] Polish + mobile
- [ ] Vercel deploy
- [ ] Rehearse click-path ≤5 phút

---

## Handoff / blockers cần báo sớm

| Cần từ | Nội dung |
|---|---|
| BE2 | CORS, cookie/token scheme, exact error shape |
| BE2 | Notification sample + simulate |
| BE1/BE2 | 1 meal plan JSON “đẹp” cho demo |

## Commands

```bash
cd frontend
npm run dev
npm run build
```

## Explicit removals

- Route `/food-log` và copy “log bữa ăn” trên North Star / landing → thay bằng Compliance / Dashboard.
