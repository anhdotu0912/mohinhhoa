# Agent I/O Schema Contract — VinNutri

**Version:** 1.11 (2026-08-29 — HITL ràng buộc lâm sàng: patient proposal không có hiệu lực tới khi bác sĩ duyệt. Xem changelog ở §7 Versioning.)
**Nguồn sự thật:** `backend/app/schemas/*.py`, `backend/app/agents/state.py`, `backend/app/models/*.py` — đối chiếu trực tiếp với code tại thời điểm viết. Field đánh dấu `[Planned]` là quyết định đã chốt nhưng **chưa** có trong code — không dùng làm nguồn as-built cho tới khi implement.
**Luật bắt buộc:** Mọi thay đổi field/enum ở đây **PHẢI** sửa file này trước, code sau ("sửa contract trước, code sau" — `CLAUDE.md` Mục 6). PR đổi schema Agent mà không kèm diff của file này sẽ bị reject trong review.

---

## 0. Conventions chung

- **Timestamp:** ISO-8601 (`YYYY-MM-DDTHH:MM:SS±HH:MM` hoặc có hậu tố `Z`). Field kiểu `datetime` ở DB serialize theo chuẩn này khi trả HTTP.
- **ID:** UUID v4 dạng string (`String(36)`), sinh bằng `uuid.uuid4()`. Ngoại lệ: `demo_patient_1/2/3/4/5`, `demo_doctor` là ID cố định cho tài khoản demo (không phải UUID).
- **Error envelope** (dùng chung mọi endpoint, `backend/app/core/errors.py::APIError`):
  ```json
  { "code": "EMAIL_EXISTS", "detail": "Email đã được đăng ký." }
  ```
  HTTP status đi kèm theo ngữ cảnh (400/401/403/404/409/413/415/422/501/503).
- **Severity enum** (dùng chung `Alert`, `InteractionItem`): `"Nguy hiểm" | "Cần chú ý" | "An toàn"` — đúng 3 mức, tiếng Việt, không viết tắt.
- **Meal slot enum:** `"breakfast" | "lunch" | "dinner" | "snack"` — dùng cho `Meal.slot`, `Swap.slot`, `NotificationService.SLOT_TIMES`.
- **Food Log slot enum:** `"morning" | "noon" | "evening" | "snack"` — dùng cho `FoodLogEntry.slot`. Ánh xạ meal plan: `breakfast→morning`, `lunch→noon`, `dinner→evening`, `snack→snack` (xem `adrs/009-food-log-scope-strategy.md`, supersede 2026-08-27).
- Field không bắt buộc trong Pydantic đều có default rõ ràng (không dùng `Optional` trần không default trừ khi cố ý cho phép `null`).

---

## 1. `PatientProfile`

Nguồn: `backend/app/schemas/profile.py`. Dùng cho `GET/POST /profile`, `PatientProfile` trong `AgentState`, `profile_snapshot` trong `MealPlanOutput`.

```json
{
  "id": "prof_uuid",
  "user_id": "user_uuid",
  "disease": ["diabetes_t2", "hypertension"],
  "medications": ["metformin", "warfarin"],
  "allergies": ["hải sản"],
  "bmi": 26.5,
  "weight": 72,
  "height": 170,
  "age": 45,
  "gender": "Nam",
  "phone": "0901 234 567",
  "address": "Quận 1, TP. Hồ Chí Minh",
  "blood_pressure": "130/80 mmHg",
  "blood_glucose": "135 mg/dL",
  "target_kcal": 1800,
  "restrictions": {
    "carb_per_meal": 45,
    "sodium_daily": 1500,
    "salt_daily_g": 5,
    "sugar_daily_g": 25
  },
  "preferences": ["thích ăn cơm", "không ăn thịt bò"],
  "treatment_goals": ["Kiểm soát đường huyết ổn định (HbA1c < 7%)."],
  "constraints_status": "confirmed",
  "proposed_target_kcal": null,
  "proposed_restrictions": null,
  "proposed_treatment_goals": null
}
```

**Ghi chú field:**
- `disease`: Danh sách mã bệnh nhân (JSON list). Hỗ trợ đầy đủ các phân nhóm đái tháo đường theo hướng dẫn Bộ Y Tế:
  - `diabetes_t1`: Đái tháo đường type 1 (QĐ 1760/QĐ-BYT) — yêu cầu đếm carb (carb counting), insulin basal-bolus / CSII.
  - `diabetes_t2`: Đái tháo đường type 2 (QĐ 5481/QĐ-BYT) — kiểm soát carb, giảm cân nếu thừa cân, dùng thuốc uống / insulin.
  - `diabetes_gestational`: Đái tháo đường thai kỳ (QĐ 1470/QĐ-BYT) — chia 3 bữa chính + 2-4 bữa phụ (bữa phụ đêm bắt buộc), carb ≥ 175g/ngày.
  - `diabetic_neuropathy`: Bệnh thần kinh đái tháo đường (QĐ 3510/QĐ-BYT) — Alpha-lipoic acid, chế độ ăn mềm dễ tiêu chia nhỏ nếu có liệt dạ dày.
  - `prediabetes`: Tiền đái tháo đường (QĐ 5481/QĐ-BYT) — can thiệp lối sống tích cực phòng ngừa tiến triển.
- Không có field nào bị Pydantic validate "required" cứng (mọi field có default) — nhưng về nghiệp vụ, `disease/medications/allergies/bmi/target_kcal` nên coi là "cần điền" để `meal_plan`/`interaction_check` có ý nghĩa lâm sàng (business rule, không phải schema validation — xem `specs/02-patient-profile-onboarding.md`).
- `allergies` = **hard filter** (loại tuyệt đối khỏi thực đơn, không có ngoại lệ) — dùng trong `meal_planner_agent._is_allergic`.
- `preferences` = **soft filter** — as-built hiện chỉ match đúng 1 pattern hard-code (`"không ăn thịt bò"`). **[Planned, quyết định 2026-08-15]** mở rộng thêm danh sách pattern phổ biến khác (ví dụ `"ăn chay"`, `"không ăn hải sản"`, `"không ăn heo/lợn"`, `"không ăn gà"`) — danh sách cụ thể do BE1 chốt khi implement, xem `specs/02` §3 rule 4 và `tasks/be1-ai-core.md`.
- `restrictions.carb_per_meal`/`restrictions.sodium_daily` optional, `null` = không áp giới hạn đó — **as-built**.
- **`restrictions.salt_daily_g`/`sugar_daily_g` — as-built (2026-08-16):** doctor set qua `PUT /doctor/patients/{id}/constraints`; optional, `null` = không áp giới hạn. Giữ **song song** với `carb_per_meal`/`sodium_daily`. Meal planner quy đổi `salt_daily_g` → natri hiệu lực: `effective_sodium_mg = min(sodium_daily, salt_daily_g * 400)` khi cả hai có giá trị (hằng số 400 mg natri/g muối). Patient `POST /profile` **không** ghi đè các field này lên cột hiệu lực — chỉ lưu đề xuất (xem `proposed_*`).
- **`protein_daily_g` — Won't Have (2026-08-16):** bỏ khỏi scope ràng buộc doctor; `protein_g` vẫn có trong `Macros`/`DayTotals` như thông tin dinh dưỡng, không phải ngưỡng ràng buộc.
- **`constraints_status` — as-built (cập nhật 2026-08-29):** enum `"confirmed" | "pending_doctor_review"`. Default `"confirmed"`. `target_kcal` / `restrictions` / `treatment_goals` trên `PatientProfile` là **giá trị đã duyệt** (cột hiệu lực). Khi patient gửi các field này qua `POST /profile`, BE **không** ghi đè cột hiệu lực — lưu vào `proposed_target_kcal` / `proposed_restrictions` / `proposed_treatment_goals` và set `"pending_doctor_review"`. Meal planner / `profile_snapshot` chỉ đọc cột hiệu lực. Doctor `POST .../constraints/approve` **chép** proposed → hiệu lực rồi xóa proposed, `"confirmed"`. Doctor `PUT .../constraints` ghi hiệu lực ngay, xóa proposed, `"confirmed"`. Xem `specs/04-clinical-constraints.md`.
- **`proposed_target_kcal` / `proposed_restrictions` / `proposed_treatment_goals`:** optional, `null` khi không có đề xuất đang chờ. Không đưa vào input lâm sàng của `meal_planner_agent`.

---

## 2. `MealPlanOutput`

Nguồn: `backend/app/schemas/meal_plan.py`. Luôn **7 ngày** (`days_count=7` mặc định trong `meal_planner_agent.generate_meal_plan`).

```json
{
  "id": "plan_uuid",
  "variant_group_id": null,
  "variant_index": null,
  "total_variants": null,
  "user_id": "user_uuid",
  "profile_snapshot": { "...": "PatientProfile lúc sinh plan" },
  "days": [
    {
      "day_index": 1,
      "date": null,
      "meals": [
        {
          "slot": "breakfast",
          "items": [
            {
              "name": "Cháo yến mạch",
              "portion": "1 bát (~250ml)",
              "kcal": 220,
              "macros": { "carb_g": 38, "protein_g": 8, "fat_g": 4, "sodium_mg": 40, "sugar_g": 2 },
              "food_id": "f_yen_mach",
              "citations": ["food_catalog_demo#f_yen_mach", "byt_vn_notes.md"],
              "alternatives": [
                { "name": "Bánh mì nguyên cám", "portion": "2 lát", "kcal": 180, "macros": {"carb_g": 34, "protein_g": 7, "fat_g": 2, "sodium_mg": 220, "sugar_g": 2}, "food_id": "f_banh_mi_cam", "citations": ["food_catalog_demo#f_banh_mi_cam"], "alternatives": [] }
              ]
            }
          ]
        }
      ],
      "totals": { "kcal": 1780, "carb_g": 200, "protein_g": 80, "fat_g": 55, "sodium_mg": 1400, "sugar_g": 22 },
      "warnings": []
    }
  ],
  "swaps": [
    { "day_index": 2, "slot": "lunch", "from": "Rau muống xào tỏi", "to": "Rau ngót luộc", "reason": "Tương tác thuốc (warfarin + rau muống): Rau muống giàu vitamin K, đối kháng tác dụng chống đông của warfarin." }
  ],
  "citations": ["byt_vn_notes.md", "ada_diabetes.md"],
  "status": "pending_review",
  "created_at": "2026-08-15T09:00:00+07:00"
}
```

**Ghi chú field:**
- `days[]` luôn đúng 7 phần tử, `day_index` 1..7.
- `FoodItem.alternatives[]` — món thay thế **đã được lọc an toàn** (không dị ứng, không phạm preference cứng, không tương tác nguy hiểm với thuốc hiện tại) trước khi trả về, nhờ `_filter_allergic_alternatives` + `_ensure_safe_alternatives`.
- `Swap.from`/`Swap.to` — key JSON là `"from"` (Python field name `from_food`, alias `"from"`, `populate_by_name=True`).
- `citations[]` ở cấp `MealPlanOutput` là **citation hướng dẫn lâm sàng** (`byt_vn_notes.md`, `ada_diabetes.md`, `aha_cardiovascular.md`, `acr_gout.md` theo `disease`); `citations[]` ở cấp `FoodItem` là **citation nguồn món ăn** (`food_catalog_demo#<id>`). Hai loại citation khác mục đích, không gộp chung.
- `status` enum: `"pending_review" | "approved" | "rejected" | "edited"` — xem bảng Enum tham chiếu cuối `contracts/api-v1.md`.
- `variant_group_id/variant_index/total_variants` tồn tại trong schema cho khả năng sinh nhiều biến thể/lần generate (A/B) — **hiện chưa có endpoint nào set giá trị khác `null`**, giữ nguyên field để không breaking change nếu tính năng này được implement sau.

---

## 3. `FoodLogEntry` (as-built — ADR-009)

Nguồn: `backend/app/models/food_log.py`, `backend/app/schemas/food_log.py`.

```json
{
  "id": "log_uuid",
  "user_id": "user_uuid",
  "meal_plan_id": "plan_uuid",
  "day_index": 3,
  "slot": "noon",
  "type": "as_planned",
  "note": "",
  "logged_at": "2026-08-15T12:05:00+07:00",
  "status": "logged",
  "alert_ids": []
}
```

- `type`: `"as_planned" | "custom"` — khớp 2 nút bấm đã có trên UI ("Đã ăn theo kế hoạch" / "Ăn khác").
- `note`: bắt buộc khi `type="custom"`, rỗng khi `type="as_planned"`.
- `status`: `"logged" | "adjusted"` — không có `pending/rejected` (không cần workflow duyệt, xem ADR-009).
- `slot`: `"morning" | "noon" | "evening" | "snack"` — ánh xạ meal plan: `morning≈breakfast`, `noon≈lunch`, `evening≈dinner`, `snack≈snack`.
- `alert_ids[]`: liên kết tới `Alert` được tạo nếu `custom` log trùng khớp 1 cặp tương tác nguy hiểm trong KB.
- `logged_at`: ISO-8601 timezone-aware (`Z` hoặc offset, ví dụ `+07:00` / `+00:00`). Giá trị naive trong DB được coi là UTC khi serialize. Ngày lịch để lọc/tuân thủ = ngày dương lịch **Asia/Ho_Chi_Minh**, không phải `date()` UTC của timestamp.
- Một user / một ngày VN / một slot: một log (upsert khi `POST /food-log` lần 2 trong cùng ngày VN).

---

## 4. `Alert`

Nguồn HTTP: `backend/app/schemas/alert.py` (`AlertOut`, đây là schema thật trả qua `GET /alerts`). Nguồn DB: `backend/app/models/alert.py`.

```json
{
  "id": "alert_uuid",
  "user_id": "user_uuid",
  "drug": "warfarin",
  "food": "rau muống",
  "mechanism": "Rau muống giàu Vitamin K, đối kháng tác dụng chống đông của warfarin.",
  "severity": "Nguy hiểm",
  "recommendation": "Hạn chế và giữ ổn định lượng rau giàu Vitamin K; trao đổi với bác sĩ trước khi thay đổi chế độ ăn.",
  "sources": ["drug_food_interactions#warfarin_rau_muong"],
  "meal_plan_id": "plan_uuid",
  "food_log_id": "log_uuid",
  "created_at": "2026-08-15T09:00:05+07:00"
}
```

**Ghi chú:** model DB và `AlertOut` có cột/field `food_log_id` (nullable) khi Alert được tạo từ custom food log.

---

## 3.5 `BodyMetricsEntry` (as-built — ADR-013)

Nguồn: `backend/app/models/body_metrics.py`, `backend/app/schemas/body_metrics.py`.

```json
{
  "id": "metrics_uuid",
  "user_id": "user_uuid",
  "weight": 72,
  "height": 170,
  "bmi": 24.9,
  "waist_cm": 92,
  "systolic": 128,
  "diastolic": 78,
  "glucose_fasting": 6.2,
  "glucose_postprandial": 8.4,
  "hba1c": 6.8,
  "blood_pressure": "128/78 mmHg",
  "blood_glucose": "6.2 mmol/L",
  "note": "",
  "recorded_by": "patient",
  "recorded_at": "2026-08-17T08:00:00+07:00"
}
```

- `recorded_by`: `"patient" | "doctor"`.
- Field mới (optional, default `null`): `waist_cm`, `systolic`, `diastolic`, `glucose_fasting` (mmol/L), `glucose_postprandial` (mmol/L), `hba1c` (%).
- `blood_pressure` / `blood_glucose` **derived** để client cũ không gãy: `blood_pressure` = `"{systolic}/{diastolic} mmHg"` khi có cặp HA; `blood_glucose` ưu tiên `glucose_fasting` (mmol/L). Request cũ gửi `blood_pressure` / `blood_glucose` string vẫn được parse vào field cấu trúc.
- Ít nhất 1 trong `weight` / `blood_pressure` / `blood_glucose` / `waist_cm` / `systolic` / `glucose_fasting` / `glucose_postprandial` / `hba1c` phải có khi ghi qua `POST /metrics`.
- **`POST /metrics` upsert theo ngày VN (Asia/Ho_Chi_Minh):** tối đa 1 entry `recorded_by=patient` / user / ngày; lần ghi sau cập nhật cùng `id`, merge field (field không gửi giữ nguyên). Doctor metrics vẫn insert entry mới mỗi lần.
- Snapshot `profiles` vẫn cập nhật song song mỗi lần ghi (`weight`/`height`/`bmi`/`blood_pressure`/`blood_glucose`).

---

## 5. `AgentState` / `AgentRunInput` / `AgentRunOutput`

Nguồn: `backend/app/agents/state.py` (`AgentState`, TypedDict nội bộ graph — không expose qua HTTP) và `backend/app/schemas/meal_plan.py` (`AgentRunInput`/`AgentRunOutput` — public I/O của facade `run_agent()`).

### 5.1 `AgentRunInput` (input của `run_agent()`, dùng bởi `POST /chat`)
```json
{ "user_id": "user_uuid", "message": "Tôi nên ăn gì hôm nay?", "force_intent": null }
```
- `force_intent` **không** expose qua `ChatRequest` HTTP (`schemas/chat.py` chỉ có field `message`) — chỉ dùng nội bộ/test.

### 5.2 `AgentRunOutput` (output của `run_agent()`, response của `POST /chat`)
```json
{
  "intent": "meal_plan",
  "secondary_intents": [],
  "message": "Thực đơn ngày 16/08/2026 (Ngày 3) — Bữa sáng, trưa, tối theo kế hoạch bác sĩ đã duyệt.",
  "meal_plan_id": "plan_uuid",
  "meal_preview": {
    "date": "2026-08-16",
    "day_index": 3,
    "meal_plan_id": "plan_uuid",
    "plan_status": "approved",
    "meals": [
      { "slot": "breakfast", "label": "Bữa sáng", "items": [ /* FoodItem §1.2 */ ] },
      { "slot": "lunch", "label": "Bữa trưa", "items": [] },
      { "slot": "dinner", "label": "Bữa tối", "items": [] }
    ]
  },
  "food_log_id": null,
  "alert_ids": [],
  "citations": ["byt_vn_notes.md"],
  "guardrail_triggered": false,
  "weekly_compliance": null,
  "doctor_note": null,
  "metrics_delta_advice": null
}
```
**Field bắt buộc đúng tên `message`, KHÔNG PHẢI `reply`** — mọi FE/BE code đọc field này phải dùng `message`.

**Ví dụ khi intent = `weekly_compliance`:**
```json
{
  "intent": "weekly_compliance",
  "secondary_intents": [],
  "message": "Tuân thủ tuần này của bạn đạt 92%. Bạn đã ghi nhận đúng kế hoạch hầu hết các ngày.",
  "meal_plan_id": null,
  "meal_preview": null,
  "food_log_id": null,
  "alert_ids": [],
  "citations": [],
  "guardrail_triggered": false,
  "weekly_compliance": {
    "overall_adherence_pct": 92,
    "daily_series": [
      { "date": "2026-08-17", "adherence_pct": 100 },
      { "date": "2026-08-18", "adherence_pct": 80 },
      { "date": "2026-08-19", "adherence_pct": null }
    ]
  },
  "doctor_note": null
}
```

**Ví dụ khi intent = `doctor_note`:**
```json
{
  "intent": "doctor_note",
  "secondary_intents": [],
  "message": "BS. Minh có 2 lời dặn gần đây.",
  "meal_plan_id": null,
  "meal_preview": null,
  "food_log_id": null,
  "alert_ids": [],
  "citations": [],
  "guardrail_triggered": false,
  "weekly_compliance": null,
  "doctor_note": {
    "doctor_name": "BS. Minh",
    "doctor_avatar": "/static/avatars/demo_doctor.jpg",
    "note": "Hạn chế muối trong 2 tuần tới. Tái khám ngày 06/09/2026.",
    "created_at": "2026-08-23T08:15:00+07:00",
    "tags": ["Hạn chế muối", "Tái khám 2 tuần"],
    "has_more": false,
    "notes": [
      {
        "id": "notif_uuid_1",
        "title": "Nhắc nhở tuân thủ từ bác sĩ",
        "note": "Hạn chế muối trong 2 tuần tới. Tái khám ngày 06/09/2026.",
        "created_at": "2026-08-23T08:15:00+07:00",
        "tags": ["Hạn chế muối", "Tái khám 2 tuần"]
      },
      {
        "id": "notif_uuid_2",
        "title": "Nhắc nhở",
        "note": "Uống thuốc đúng giờ trước bữa sáng.",
        "created_at": "2026-08-20T07:00:00+07:00",
        "tags": []
      }
    ]
  }
}
```

**`secondary_intents` — as-built** (đáp ứng gap "multi-intent ambiguous" ghi ở `specs/13-ai-chat-assistant.md`): mảng intent phụ (cùng enum `VALID_INTENTS`) mà `intent_classifier` phát hiện thêm trong cùng 1 câu hỏi nhưng **không** xử lý đầy đủ trong lượt trả lời này — chỉ để FE/patient biết còn ý định khác chưa được trả lời, không phải xử lý song song đầy đủ. Ví dụ: câu hỏi vừa yêu cầu lập thực đơn vừa hỏi tương tác thuốc → `intent="meal_plan"` (xử lý đầy đủ), `secondary_intents=["interaction_check"]`, và `message` nên kèm gợi ý "Bạn cũng hỏi về tương tác thuốc — vui lòng hỏi lại riêng câu này để tôi trả lời đầy đủ." Default `[]` khi không phát hiện ý định phụ nào.

**Danh sách intent hợp lệ (`VALID_INTENTS`, `nodes/intent_classifier.py`):**
```
meal_plan | interaction_check | food_log | rag_qa | refuse | unknown | weekly_compliance | doctor_note | metrics_delta_advice
```

**`weekly_compliance` — as-built (Phase 2 patient chat redesign):** intent cho câu hỏi tuân thủ tuần của bệnh nhân. Node gọi `ComplianceService.get_patient_compliance(user_id, days=7)` và map sang `WeeklyComplianceOut` (subset của `PatientComplianceOut` §10 `contracts/api-v1.md`). Field `weekly_compliance` populated khi intent khớp; `null` khi intent khác. Không sinh dữ liệu giả — nếu chưa có check-in, `overall_adherence_pct` có thể `null`, `daily_series[].adherence_pct` có thể `null` theo ngày.

**`doctor_note` — as-built (Phase 2; cập nhật 2026-08-28):** intent cho câu hỏi "bác sĩ dặn gì / lời nhắc bác sĩ". Nguồn: mọi `Notification` `type="manual_reminder"` của patient, **mới → cũ**, tối đa 10 (`has_more=true` nếu còn). **Không** fallback `adjustment_note`. Danh tính: `users.assigned_doctor_id` → `full_name` (trống thì `email`) + `avatar` — **không** default cứng `"Bác sĩ điều trị"` / `"BS. Minh"`. Chưa được gán bác sĩ và không có reminder: `doctor_note = null`, `message` = "Bạn đang chờ bác sĩ nhận hồ sơ. Khi có lời dặn, tôi sẽ hiện tại đây." Được gán nhưng chưa có reminder: `doctor_note = null`, `message` = "Bạn chưa có lời dặn nào từ bác sĩ gần đây." `note` / `created_at` / `tags` trên envelope = bản ghi mới nhất (tương thích client cũ).

**`WeeklyMealPlanCard` (FE, không intent mới):** câu "thực đơn tuần / xem thực đơn / lịch ăn 7 ngày" vẫn classify về `meal_plan` (mở rộng pattern classifier hiện có). FE gọi `GET /meal-plans/me` khi render card — **không** thêm intent riêng.

**`metrics_delta_advice` — as-built (2026-08-26):** intent "lời khuyên khi chỉ số cơ thể đổi" (`specs/12`). Node so sánh 2 bản ghi gần nhất; nếu delta vượt ngưỡng (cân ≥1 kg, glucose ≥1 mmol/L, tâm thu ≥10 mmHg, vòng eo ≥2 cm, HbA1c ≥0.3 điểm) thì soạn 1–2 câu nhận xét quan sát + citation RAG nếu có. **HITL:** không chẩn đoán, không đổi thuốc/liều; `ask_doctor=true` khi chỉ số ngoài ngưỡng guideline T2DM hoặc câu trả lời bị guardrail. Field `metrics_delta_advice` populated khi intent khớp; `null` khi intent khác. Cùng schema được `POST /metrics` trả về optional `delta_advice` khi lần ghi vừa rồi vượt ngưỡng.

```json
// MetricsDeltaAdviceOut
{
  "message": "Cân nặng tăng 1.2 kg so với lần ghi trước. Đây là diễn biến cần theo dõi cùng bác sĩ — không phải chẩn đoán.",
  "changed_fields": ["weight"],
  "citations": [],
  "ask_doctor": false
}
```

**`meal_preview` — optional:** populated khi intent = `meal_plan` và patient có thực đơn trong DB để hiển thị. FE dùng field này render UI bữa ăn trong chat. `null` khi không có plan hoặc intent khác.

**`meal_plan_id` qua `/chat` (read-only):** khi intent = `meal_plan`, field này là ID plan **đang đọc** từ DB — **không** tạo/persist record mới. Chat **không** gọi meal planner generate; sinh plan chỉ qua `POST /meal-plans/generate` hoặc luồng bác sĩ.

**`weekly_compliance` / `doctor_note` — optional, default `null`:** populated tương ứng khi intent khớp. FE render `WeeklyComplianceCard` / `DoctorNoteCard` từ 2 field này (pattern giống `meal_preview`). Schema con:

```json
// WeeklyComplianceOut — subset PatientComplianceOut (§10 api-v1)
{ "overall_adherence_pct": 92, "daily_series": [{ "date": "2026-08-15", "adherence_pct": 80 }] }

// DoctorNoteOut
{
  "doctor_name": "BS. Minh",
  "doctor_avatar": "/static/avatars/demo_doctor.jpg",
  "note": "...",
  "created_at": "2026-08-23T08:15:00+07:00",
  "tags": ["Hạn chế muối"],
  "has_more": false,
  "notes": [{ "id": "notif_uuid", "title": "Nhắc nhở", "note": "...", "created_at": "2026-08-23T08:15:00+07:00", "tags": ["Hạn chế muối"] }]
}
```

Nguồn Pydantic dự kiến: `backend/app/schemas/meal_plan.py` (`WeeklyComplianceOut`, `DoctorNoteOut`); `ComplianceDayPoint` tái dùng từ `backend/app/schemas/doctor.py`.

### 5.3 `AgentState` (nội bộ, không public — tham khảo khi thêm node mới)
```json
{
  "user_id": "string",
  "message": "string",
  "force_intent": "string | null",
  "profile": {"...": "PatientProfile as dict"},
  "intent": "meal_plan | interaction_check | food_log | rag_qa | refuse | unknown | weekly_compliance | doctor_note | metrics_delta_advice",
  "rag_context": [{"chunk_id": "string", "text": "string", "source": "string", "score": 0.0}],
  "meal_plan": {"...": "MealPlanOutput | null"},
  "food_log": {"...": "null (stub, chưa dùng)"},
  "interactions": {"...": "InteractionCheckOutput | null"},
  "weekly_compliance": {"...": "WeeklyComplianceOut | null"},
  "doctor_note": {"...": "DoctorNoteOut | null"},
  "answer": "string | null",
  "citations": ["string"],
  "guardrail_flags": ["string"],
  "errors": ["string"]
}
```

State trung gian `weekly_compliance` / `doctor_note` được node tương ứng populate trước khi `run_agent()` map sang `AgentRunOutput`.

---

## 6. `InteractionCheckInput` / `InteractionCheckOutput`

Nguồn: `backend/app/schemas/meal_plan.py`. Dùng cho `POST /interactions/check` và nội bộ pipeline meal plan (2 code path khác nhau dùng cùng shape output — xem `specs/08-drug-food-interaction-check.md`).

```json
// Input
{ "medications": ["warfarin", "metformin"], "foods": ["rau muống", "rượu"], "profile_user_id": "user_uuid" }

// Output
{
  "interactions": [
    {
      "drug": "warfarin",
      "food": "rau muống",
      "mechanism": "Rau muống giàu Vitamin K, đối kháng tác dụng chống đông của warfarin.",
      "severity": "Nguy hiểm",
      "recommendation": "Hạn chế và giữ ổn định lượng rau giàu Vitamin K; trao đổi với bác sĩ trước khi thay đổi chế độ ăn.",
      "sources": ["drug_food_interactions#warfarin_rau_muong"]
    }
  ],
  "unmatched_pairs": [
    { "drug": "metformin", "food": "sữa chua" }
  ]
}
```
**`unmatched_pairs[]` — as-built:** liệt kê các cặp `drug`×`food` gửi trong `InteractionCheckInput` nhưng **không tìm được dữ liệu nào trong KB** (kể cả sau khi unidecode/alias). Mọi cặp `medications × foods` gửi lên rơi vào đúng 1 trong 2 nhóm — có match (`interactions[]`, kể cả khi severity là `An toàn`) hoặc không tìm thấy dữ liệu (`unmatched_pairs[]`, tính bởi `interaction_checker_agent.compute_unmatched_pairs`) — không còn im lặng bỏ qua cặp không khớp. Xem `specs/08-drug-food-interaction-check.md` §3.

**Lưu ý as-built quan trọng — 1 KB đầy đủ duy nhất (2026-08-18):** cả luồng "gắn plan" (nội bộ `meal_planner_agent`, quyết định swap món) và luồng "ad-hoc" (`POST /interactions/check`) đều dùng chung **KB đầy đủ** (`backend/data/drug_food_interactions.json`, 28 cặp, severity: 11 Nguy hiểm / 16 Cần chú ý / 1 An toàn) qua `agents/interaction_checker_agent.py` — có alias tiếng Anh/không dấu + so khớp accent-insensitive (`unidecode`), resolve tên thuốc thương mại qua `drug_products`/`drug_rules`. Không còn KB rút gọn/`DEMO_MOCK` riêng — `services/meal_plan_demo.py` đã bị gỡ bỏ hoàn toàn khỏi codebase. `Alert` hiển thị cho bác sĩ/patient sau khi sinh plan phản ánh đúng cùng KB đầy đủ dùng để swap món. Xem `specs/08-drug-food-interaction-check.md` §3–4.

---

## 7. Versioning

- Version hiện tại của contract này: **1.11**.
- **Changelog 1.10 → 1.11 (2026-08-29):** HITL ràng buộc lâm sàng — `PatientProfile` thêm `proposed_target_kcal` / `proposed_restrictions` / `proposed_treatment_goals` (optional, default `null`). `POST /profile` không còn ghi đè `target_kcal`/`restrictions`/`treatment_goals` hiệu lực; meal planner chỉ đọc giá trị đã duyệt. Đồng bộ `contracts/api-v1.md` v1.17, `specs/02`, `specs/04`. Không breaking — field mới optional, cột hiệu lực giữ nguyên shape.
- **Changelog 1.9 → 1.10 (2026-08-28):** `DoctorNoteOut` thêm `doctor_avatar`, `notes[]`, `has_more`; `note`/`created_at`/`tags` giữ là reminder mới nhất. Nguồn chỉ `manual_reminder` (bỏ fallback `adjustment_note`). Tên/ảnh từ bác sĩ được gán, không hallucinate. Đồng bộ `contracts/api-v1.md` v1.15. Không breaking — field mới optional/default.
- **Changelog 1.8 → 1.9 (2026-08-27):** `FoodLogEntry.slot` thêm `"snack"` (4 slot food log khớp meal plan bữa phụ). Không breaking — giá trị mới optional cho client cũ. Đồng bộ `contracts/api-v1.md` v1.12, `adrs/009` supersede, `specs/09`.
- **Changelog 1.7 → 1.8 (2026-08-26):** `BodyMetricsEntry` thêm field lâm sàng optional (`waist_cm`, `systolic`, `diastolic`, `glucose_fasting`, `glucose_postprandial`, `hba1c`); `blood_pressure`/`blood_glucose` giữ derived. Intent `metrics_delta_advice` + `AgentRunOutput.metrics_delta_advice` (`MetricsDeltaAdviceOut`). Không breaking — field mới default `null`. Đồng bộ `contracts/api-v1.md` v1.11.
- **Changelog 1.6 → 1.7 (2026-08-24):** `FoodLogEntry.logged_at` chốt timezone-aware; ngày tuân thủ / filter food-log theo Asia/Ho_Chi_Minh; upsert 1 log / user / ngày VN / slot. Đồng bộ `contracts/api-v1.md` v1.8. Không đổi enum `slot`.
- **Changelog 1.5 → 1.6 (2026-08-23):** `BodyMetricsEntry` §3.5 — `POST /metrics` upsert 1 entry patient/ngày VN (merge field, giữ `id`); đồng bộ `contracts/api-v1.md` v1.7. Không đổi JSON shape.
- **Changelog 1.4 → 1.5 (2026-08-23):** thêm 2 intent `weekly_compliance` | `doctor_note` vào `VALID_INTENTS` (patient chat redesign Phase 2); mở rộng `AgentRunOutput` với field optional `weekly_compliance: WeeklyComplianceOut | null`, `doctor_note: DoctorNoteOut | null`; mở rộng `AgentState` với state trung gian tương ứng. Quyết định nguồn dữ liệu: compliance từ `ComplianceService.get_patient_compliance(days=7)`; doctor note từ `manual_reminder` notification hoặc fallback `adjustment_note` meal plan — không hallucinate tên bác sĩ. `WeeklyMealPlanCard` không thêm intent mới (vẫn `meal_plan`). Không breaking change — field mới default `null`.
- **Changelog 1.3 → 1.4 (2026-08-22):** dọn tag `[Planned]` còn sót cho các field thực ra đã as-built — `PatientProfile.constraints_status`, `AgentRunOutput.secondary_intents[]`, `InteractionCheckOutput.unmatched_pairs[]` (đều chuyển thành "as-built" trong mô tả); xác nhận `POST /interactions/check` và luồng gắn plan dùng chung 1 KB đầy đủ duy nhất (không còn KB rút gọn/`DEMO_MOCK`, `services/meal_plan_demo.py` đã bị gỡ khỏi codebase). Không đổi shape field nào — chỉ sửa mô tả trạng thái, không cần code thay đổi kèm theo.
- **Changelog 1.2 → 1.3 (2026-08-17):** `FoodLogEntry` chuyển Planned → as-built; `Alert` thêm `food_log_id`; thêm `BodyMetricsEntry` §3.5 (ADR-013).
- **Changelog 1.0 → 1.1 (2026-08-15):** thêm `PatientProfile.restrictions.{salt_daily_g,sugar_daily_g,protein_daily_g}` `[Planned]`, `PatientProfile.constraints_status` `[Planned]`, `FoodLogEntry.slot` đổi sang 3-giá-trị `morning|noon|evening` `[Planned]` (thay đề xuất 4-slot ban đầu), `InteractionCheckOutput.unmatched_pairs[]` `[Planned]`, `AgentRunOutput.secondary_intents[]` `[Planned]`. Toàn bộ đều là field mới optional với default an toàn (`null`/`[]`/`"confirmed"`) — không breaking change với code hiện tại, minor bump.
- Mọi thay đổi field/enum/shape phải: (1) bump version ở đầu file, (2) note ngày + lý do đổi ngay dưới tiêu đề version, (3) cập nhật `contracts/api-v1.md` nếu ảnh hưởng tới response HTTP, (4) cập nhật spec liên quan trong `specs/`.
- **Luật cứng:** sửa contract trước, code sau (`CLAUDE.md` Mục 6, Mục 12). Code không được implement field/enum chưa có trong contract này.
- Breaking change (đổi tên field, đổi enum value, đổi type) bắt buộc bump version major (2.0, 3.0...); thêm field optional mới có default không phá vỡ tương thích cũ được coi là minor (1.1, 1.2...).
