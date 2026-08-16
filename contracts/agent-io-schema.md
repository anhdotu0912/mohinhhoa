# Agent I/O Schema Contract — VMEC-10

**Version:** 1.2 (2026-08-16 — as-built `salt_daily_g`/`sugar_daily_g` trên `Restrictions`; thêm `Macros.sugar_g`/`DayTotals.sugar_g`; bỏ `protein_daily_g` khỏi scope ràng buộc doctor; quy đổi muối→natri `salt_daily_g*400=sodium_mg` trong meal planner. Xem changelog ở §7 Versioning.)
**Nguồn sự thật:** `backend/app/schemas/*.py`, `backend/app/agents/state.py`, `backend/app/models/*.py` — đối chiếu trực tiếp với code tại thời điểm viết. Field đánh dấu `[Planned]` là quyết định đã chốt nhưng **chưa** có trong code — không dùng làm nguồn as-built cho tới khi implement.
**Luật bắt buộc:** Mọi thay đổi field/enum ở đây **PHẢI** sửa file này trước, code sau ("sửa contract trước, code sau" — `CLAUDE.md` Mục 6). PR đổi schema Agent mà không kèm diff của file này sẽ bị reject trong review.

---

## 0. Conventions chung

- **Timestamp:** ISO-8601 (`YYYY-MM-DDTHH:MM:SS±HH:MM` hoặc có hậu tố `Z`). Field kiểu `datetime` ở DB serialize theo chuẩn này khi trả HTTP.
- **ID:** UUID v4 dạng string (`String(36)`), sinh bằng `uuid.uuid4()`. Ngoại lệ: `demo_patient_1/2/3`, `demo_doctor` là ID cố định cho tài khoản demo (không phải UUID).
- **Error envelope** (dùng chung mọi endpoint, `backend/app/core/errors.py::APIError`):
  ```json
  { "code": "EMAIL_EXISTS", "detail": "Email đã được đăng ký." }
  ```
  HTTP status đi kèm theo ngữ cảnh (400/401/403/404/409/413/415/422/501/503).
- **Severity enum** (dùng chung `Alert`, `InteractionItem`): `"Nguy hiểm" | "Cần chú ý" | "An toàn"` — đúng 3 mức, tiếng Việt, không viết tắt.
- **Meal slot enum:** `"breakfast" | "lunch" | "dinner" | "snack"` — dùng cho `Meal.slot`, `Swap.slot`, `NotificationService.SLOT_TIMES`. **Lưu ý:** UI Food Log hiện chỉ có 3 slot (sáng/trưa/tối) — xem `adrs/009-food-log-scope-strategy.md`, [CẦN XÁC NHẬN] khi implement.
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
  "constraints_status": "confirmed"
}
```

**Ghi chú field:**
- Không có field nào bị Pydantic validate "required" cứng (mọi field có default) — nhưng về nghiệp vụ, `disease/medications/allergies/bmi/target_kcal` nên coi là "cần điền" để `meal_plan`/`interaction_check` có ý nghĩa lâm sàng (business rule, không phải schema validation — xem `specs/02-patient-profile-onboarding.md`).
- `allergies` = **hard filter** (loại tuyệt đối khỏi thực đơn, không có ngoại lệ) — dùng trong `meal_planner_agent._is_allergic`.
- `preferences` = **soft filter** — as-built hiện chỉ match đúng 1 pattern hard-code (`"không ăn thịt bò"`). **[Planned, quyết định 2026-08-15]** mở rộng thêm danh sách pattern phổ biến khác (ví dụ `"ăn chay"`, `"không ăn hải sản"`, `"không ăn heo/lợn"`, `"không ăn gà"`) — danh sách cụ thể do BE1 chốt khi implement, xem `specs/02` §3 rule 4 và `tasks/be1-ai-core.md`.
- `restrictions.carb_per_meal`/`restrictions.sodium_daily` optional, `null` = không áp giới hạn đó — **as-built**.
- **`restrictions.salt_daily_g`/`sugar_daily_g` — as-built (2026-08-16):** doctor set qua `PUT /doctor/patients/{id}/constraints`; optional, `null` = không áp giới hạn. Giữ **song song** với `carb_per_meal`/`sodium_daily` cũ (patient set qua `POST /profile`). Meal planner quy đổi `salt_daily_g` → natri hiệu lực: `effective_sodium_mg = min(sodium_daily, salt_daily_g * 400)` khi cả hai có giá trị (hằng số 400 mg natri/g muối).
- **`protein_daily_g` — Won't Have (2026-08-16):** bỏ khỏi scope ràng buộc doctor; `protein_g` vẫn có trong `Macros`/`DayTotals` như thông tin dinh dưỡng, không phải ngưỡng ràng buộc.
- **`constraints_status` — `[Planned]`, quyết định 2026-08-15:** enum `"confirmed" | "pending_doctor_review"`. Default `"confirmed"`. Chuyển sang `"pending_doctor_review"` khi **patient tự sửa** `target_kcal`/`restrictions` qua `POST /profile`; reset lại `"confirmed"` khi **doctor xác nhận** (qua `POST /doctor/patients/{id}/constraints/approve` hoặc khi doctor tự sửa trực tiếp qua `PUT /doctor/patients/{id}/constraints`). Giá trị mới của patient **vẫn được áp dụng ngay** cho lần generate plan kế tiếp trong lúc chờ duyệt (không block demo flow) — `constraints_status` chỉ là cờ hiển thị cho doctor biết cần xem lại, không phải cờ chặn sử dụng. Xem thiết kế đầy đủ ở `specs/04-clinical-constraints.md`.

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

## 3. `FoodLogEntry` (Planned — theo ADR-009)

**Status: Planned.** Chưa có bảng DB thật (`models/food_log.py` là placeholder), chưa mount route. Schema dưới đây là **thiết kế đề xuất**, dựa trên `schemas/food_log.py` hiện có (đã sửa `profile_id` sang `str` theo đúng convention UUID toàn hệ thống — xem ghi chú Negative của ADR-009) + UI đã thiết kế ở `frontend/app/patient/meals/log/page.tsx`.

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
- `slot`: **[Planned, quyết định 2026-08-15]** dùng đúng **3-slot theo UI**: `"morning" | "noon" | "evening"` (sáng/trưa/tối) — **KHÁC** với 4-slot của meal plan (`breakfast/lunch/dinner/snack`), có chủ đích, không mở rộng thêm slot thứ 4. Ánh xạ gần đúng khi đối chiếu tuân thủ: `morning≈breakfast`, `noon≈lunch`, `evening≈dinner`; **không có** slot tương ứng cho `snack` — tuân thủ bữa phụ không được food log ghi nhận (Out of scope có chủ đích, xem ADR-009).
- `alert_ids[]`: liên kết tới `Alert` được tạo nếu `custom` log trùng khớp 1 cặp tương tác nguy hiểm trong KB.

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
  "created_at": "2026-08-15T09:00:05+07:00"
}
```

**Ghi chú quan trọng (as-built, khác với `Alert` Pydantic phụ định nghĩa trong `schemas/meal_plan.py`):** model DB **không có** cột `food_log_id` (dù `schemas/meal_plan.py::Alert` — một class trùng tên, không dùng ở HTTP layer — có field này). `AlertOut` (schema HTTP thật) không có `food_log_id`. Khi `specs/09-food-log-adherence.md` (Planned) cần liên kết Alert → FoodLog, phải thêm cột `meal_plan_id`-style mới (`food_log_id`) vào model DB thật, không giả định nó đã tồn tại.

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
  "guardrail_triggered": false
}
```
**Field bắt buộc đúng tên `message`, KHÔNG PHẢI `reply`** — mọi FE/BE code đọc field này phải dùng `message`.

**`secondary_intents` — `[Planned]`, quyết định 2026-08-15** (đáp ứng gap "multi-intent ambiguous" từng ghi ở `specs/13-ai-chat-assistant.md`): mảng intent phụ (cùng enum `VALID_INTENTS`) mà `intent_classifier` phát hiện thêm trong cùng 1 câu hỏi nhưng **không** xử lý đầy đủ trong lượt trả lời này — chỉ để FE/patient biết còn ý định khác chưa được trả lời, không phải xử lý song song đầy đủ. Ví dụ: câu hỏi vừa yêu cầu lập thực đơn vừa hỏi tương tác thuốc → `intent="meal_plan"` (xử lý đầy đủ), `secondary_intents=["interaction_check"]`, và `message` nên kèm gợi ý "Bạn cũng hỏi về tương tác thuốc — vui lòng hỏi lại riêng câu này để tôi trả lời đầy đủ." Default `[]` khi không phát hiện ý định phụ nào (tương thích ngược 100% với code hiện tại).

**Danh sách intent hợp lệ (`VALID_INTENTS`, `nodes/intent_classifier.py`):**
```
meal_plan | interaction_check | food_log | rag_qa | refuse | unknown
```
Không có intent nào khác được thêm trong vòng cập nhật tài liệu này (đề xuất intent mới cho "lời khuyên khi chỉ số cơ thể đổi" ở `specs/12-patient-metrics-tracking.md` là **Planned**, chưa thêm vào enum thật).

**`meal_preview` — optional:** populated khi intent = `meal_plan` và patient có thực đơn trong DB để hiển thị. FE dùng field này render UI bữa ăn trong chat. `null` khi không có plan hoặc intent khác.

**`meal_plan_id` qua `/chat` (read-only):** khi intent = `meal_plan`, field này là ID plan **đang đọc** từ DB — **không** tạo/persist record mới. Chat **không** gọi meal planner generate; sinh plan chỉ qua `POST /meal-plans/generate` hoặc luồng bác sĩ.

### 5.3 `AgentState` (nội bộ, không public — tham khảo khi thêm node mới)
```json
{
  "user_id": "string",
  "message": "string",
  "force_intent": "string | null",
  "profile": {"...": "PatientProfile as dict"},
  "intent": "meal_plan | interaction_check | food_log | rag_qa | refuse | unknown",
  "rag_context": [{"chunk_id": "string", "text": "string", "source": "string", "score": 0.0}],
  "meal_plan": {"...": "MealPlanOutput | null"},
  "food_log": {"...": "null (stub, chưa dùng)"},
  "interactions": {"...": "InteractionCheckOutput | null"},
  "answer": "string | null",
  "citations": ["string"],
  "guardrail_flags": ["string"],
  "errors": ["string"]
}
```

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
**`unmatched_pairs[]` — `[Planned]`, quyết định 2026-08-15:** liệt kê các cặp `drug`×`food` gửi trong `InteractionCheckInput` nhưng **không tìm được dữ liệu nào trong KB** (kể cả sau khi unidecode/alias). Quy tắc: mọi cặp `medications × foods` gửi lên phải rơi vào đúng 1 trong 2 nhóm — có match (`interactions[]`, kể cả khi severity là `An toàn`) hoặc không tìm thấy dữ liệu (`unmatched_pairs[]`) — thay cho hành vi as-built hiện tại là **im lặng bỏ qua** cặp không khớp, dễ khiến người dùng hiểu nhầm "không thấy cảnh báo" = "đã kiểm tra và an toàn". Xem `specs/08-drug-food-interaction-check.md` §5.

**Lưu ý as-built quan trọng — 2 KB khác nhau dùng cùng shape:**
1. **KB đầy đủ** (`backend/data/drug_food_interactions.json`, 28 cặp, severity: 11 Nguy hiểm / 16 Cần chú ý / 1 An toàn) qua `agents/interaction_checker_agent.py` — có alias tiếng Anh/không dấu + so khớp accent-insensitive (`unidecode`). Dùng **nội bộ** trong `meal_planner_agent` để quyết định swap món khi sinh plan.
2. **KB rút gọn demo** (`services/meal_plan_demo.py::INTERACTION_KB`, chỉ 2 cặp: `warfarin+rau muống`, `warfarin+bông cải xanh`) — so khớp substring đơn giản, không unidecode, không alias. Dùng cho **`POST /interactions/check`** (khi `DEMO_MOCK=true`) **và** để tạo `Alert` sau khi sinh plan (`meal_plan_service._persist_interaction_alerts`).

→ Nghĩa là: món ăn trong thực đơn được swap an toàn dựa trên KB đầy đủ (28 cặp), nhưng `Alert` hiển thị cho bác sĩ/patient sau khi plan được tạo chỉ phản ánh KB rút gọn (2 cặp). **Quyết định team (2026-08-15): chấp nhận gap này cho vòng demo hiện tại**, không ưu tiên đóng ngay — 2 cặp demo đủ minh hoạ flow guardrail cho North Star. Xem `specs/08-drug-food-interaction-check.md` §5 và `tasks/roadmap-mvp.md` (đã hạ mức ưu tiên khỏi P0).

---

## 7. Versioning

- Version hiện tại của contract này: **1.2**.
- **Changelog 1.1 → 1.2 (2026-08-16):** `Restrictions.salt_daily_g`/`sugar_daily_g` chuyển từ `[Planned]` → as-built; thêm `Macros.sugar_g`/`DayTotals.sugar_g`; bỏ `protein_daily_g` khỏi scope ràng buộc; ghi chú quy đổi muối→natri trong meal planner.
- **Changelog 1.0 → 1.1 (2026-08-15):** thêm `PatientProfile.restrictions.{salt_daily_g,sugar_daily_g,protein_daily_g}` `[Planned]`, `PatientProfile.constraints_status` `[Planned]`, `FoodLogEntry.slot` đổi sang 3-giá-trị `morning|noon|evening` `[Planned]` (thay đề xuất 4-slot ban đầu), `InteractionCheckOutput.unmatched_pairs[]` `[Planned]`, `AgentRunOutput.secondary_intents[]` `[Planned]`. Toàn bộ đều là field mới optional với default an toàn (`null`/`[]`/`"confirmed"`) — không breaking change với code hiện tại, minor bump.
- Mọi thay đổi field/enum/shape phải: (1) bump version ở đầu file, (2) note ngày + lý do đổi ngay dưới tiêu đề version, (3) cập nhật `contracts/api-v1.md` nếu ảnh hưởng tới response HTTP, (4) cập nhật spec liên quan trong `specs/`.
- **Luật cứng:** sửa contract trước, code sau (`CLAUDE.md` Mục 6, Mục 12). Code không được implement field/enum chưa có trong contract này.
- Breaking change (đổi tên field, đổi enum value, đổi type) bắt buộc bump version major (2.0, 3.0...); thêm field optional mới có default không phá vỡ tương thích cũ được coi là minor (1.1, 1.2...).
