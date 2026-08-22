# Spec: Kiểm tra Tương tác Thuốc–Thực phẩm (Service dùng chung)

## Status
Done — `POST /interactions/check` và luồng "gắn plan" đều dùng chung `interaction_checker_agent` thật với **cùng KB đầy đủ** (`data/drug_food_interactions.json`, 28 cặp) qua Postgres (`drug_products`/`drug_rules`) hoặc fallback JSON — không còn nhánh `DEMO_MOCK`/KB rút gọn riêng cho ad-hoc check (xem §5). `unmatched_pairs[]` (rule 7) đã **Done**. Đây là spec dùng chung cho mọi nơi khác cần include (đặc biệt `specs/05`, `specs/09`) — không lặp lại logic ở các spec đó.

## 1. Mục tiêu (Why)
Đây là 1 trong 2 tính năng North Star (cùng Meal Plan) — cảnh báo bệnh nhân/bác sĩ khi thuốc đang dùng có tương tác nguy hiểm/cần chú ý với thực phẩm trong thực đơn hoặc trong bữa ăn thực tế, để tránh rủi ro lâm sàng (ví dụ warfarin + rau muống làm giảm hiệu quả chống đông).

## 2. User story
Là **AI** (dùng chung cho mọi luồng gọi tới), tôi cần so khớp danh sách thuốc bệnh nhân đang dùng với danh sách thực phẩm (trong thực đơn hoặc do người dùng nhập ad-hoc), trả về mức độ nguy hiểm và khuyến nghị xử lý — nhưng **không bao giờ** đề xuất đổi thuốc/liều lượng.

## 3. Business rules
1. **Severity 3 mức, đúng chính tả tiếng Việt, không viết tắt:** `"Nguy hiểm" | "Cần chú ý" | "An toàn"`.
2. **Matching accent-insensitive** — KB đầy đủ dùng `unidecode` để so khớp không phân biệt có dấu/không dấu, kèm bảng alias tên thuốc tiếng Anh/tiếng Việt (ví dụ `"warfarin"` khớp cả biến thể viết khác). KB rút gọn (demo) chỉ so khớp substring đơn giản, **không** unidecode, **không** alias — kém chính xác hơn KB đầy đủ.
3. **Guardrail cứng (bắt buộc mọi nơi gọi service này tuân theo):** khi phát hiện tương tác nguy hiểm, AI chỉ được đề xuất **đổi món ăn** (swap thực phẩm) hoặc **khuyến cáo trao đổi với bác sĩ** — không bao giờ tự ý đề xuất đổi thuốc, ngừng thuốc, hoặc đổi liều lượng. Vi phạm rule này là vi phạm luật cứng `CLAUDE.md` Mục 7.
4. **2 luồng sử dụng (2 use case), cùng shape output `InteractionCheckOutput`, cùng KB đầy đủ (as-built 2026-08-18):**
   - **Luồng "gắn plan"** (nội bộ, trong `meal_planner_agent`, bước 3.5 của `specs/05`): dùng **KB đầy đủ** (`data/drug_food_interactions.json`, 28 cặp: 11 Nguy hiểm / 16 Cần chú ý / 1 An toàn) qua `agents/interaction_checker_agent.py`. Kết quả dùng để **swap món** trong thực đơn trước khi trả cho patient — patient/doctor không thấy trực tiếp output của bước này, chỉ thấy hệ quả (`swaps[]` trong `MealPlanOutput`).
   - **Luồng "ad-hoc"** (`POST /interactions/check`, dùng bởi patient/doctor muốn tự kiểm tra 1 danh sách thuốc/thực phẩm tuỳ ý, không gắn với plan cụ thể): `routes_interactions.py` luôn gọi trực tiếp `interaction_checker_agent(payload, db=db)` — **không còn** nhánh `DEMO_MOCK`/KB rút gọn/`501` như thiết kế cũ; mọi request đều dùng KB đầy đủ giống luồng "gắn plan".
   - Alert được persist vào DB (`_persist_interaction_alerts`, hiển thị cho patient/doctor qua `GET /alerts`) sau khi generate plan, dùng **cùng `interaction_checker_agent.check_interactions`** (KB 28 cặp + resolve thuốc qua `drug_products`/`drug_rules` từ Postgres hoặc fallback `data/clean/*.json`) — nhất quán hoàn toàn với pipeline swap, không còn 2 KB khác nhau.
5. `POST /interactions/check` có side-effect: mỗi interaction phát hiện được tự động tạo `Alert` (persist DB); nếu severity ∈ `{Nguy hiểm, Cần chú ý}` có thể kèm `Notification(type="interaction_followup")`.
6. `sources[]` trong output luôn trỏ về key cụ thể trong KB (`drug_food_interactions#<drug>_<food>`) — không được trả interaction nào thiếu `sources`.
7. **`unmatched_pairs[]` (as-built):** mọi cặp `medications × foods` gửi trong `InteractionCheckInput` rơi vào đúng 1 trong 2 nhóm ở output — có match (`interactions[]`, kể cả severity `An toàn`) hoặc không tìm thấy dữ liệu (`unmatched_pairs[]`, `compute_unmatched_pairs` trong `interaction_checker_agent.py`) — không còn im lặng bỏ qua cặp không khớp.

## 4. Luồng chính (happy path)
**Ad-hoc check:**
1. Patient/doctor nhập danh sách thuốc + thực phẩm muốn kiểm tra → `POST /interactions/check`.
2. BE so khớp KB (rút gọn nếu `DEMO_MOCK=true`), trả `InteractionCheckOutput`.
3. BE tạo `Alert` cho mỗi kết quả tìm được, patient/doctor xem lại qua `GET /alerts`.

**Gắn plan (nội bộ, không có endpoint riêng để patient gọi trực tiếp bước này):**
1. Xảy ra tự động như bước 3.5 trong pipeline sinh plan (`specs/05` §3).
2. Kết quả thể hiện qua `swaps[]` trong `MealPlanOutput`, không qua `InteractionCheckOutput` trực tiếp.

## 5. Edge cases
- Thuốc/thực phẩm nhập không có trong KB (kể cả sau khi unidecode) → cặp đó rơi vào `unmatched_pairs[]` (rule 7) để FE biết rõ "không tìm thấy dữ liệu cho X", tránh hiểu nhầm "im lặng" = "đã kiểm tra và an toàn".
- KB đầy đủ có 1 cặp mức `An toàn` — nghĩa là hệ thống cũng chủ động xác nhận "không nguy hiểm" cho 1 số cặp cụ thể đã biết, không chỉ báo cặp nguy hiểm.
- **`drug_products` / `drug_rules` (2026-08-15 as-built):** resolve tên thuốc thương mại → `activeKey` và enrich clinical metadata đọc từ Postgres (`drug_products`, `drug_rules`, seed từ `data/clean/drug_products.json` + `data/clean/drug_rules.json`) khi có `db` session; fallback file JSON khi DB rỗng hoặc không truyền `db` (test local).

## 6. Ngoài phạm vi (Out of scope)
- Tương tác thuốc–thuốc (chỉ thuốc–thực phẩm, không kiểm tra 2 thuốc tương tác nhau).
- Mở rộng KB tự động (crawl nguồn y khoa ngoài) — KB là file JSON tĩnh, cập nhật thủ công.
- Đề xuất đổi thuốc/liều lượng — **cấm tuyệt đối** theo guardrail (xem rule 3).

## 7. Schema tham chiếu
- `InteractionCheckInput`/`InteractionCheckOutput`, `InteractionItem` — `contracts/agent-io-schema.md` §6.
- `Alert` — `contracts/agent-io-schema.md` §4.

## 8. API liên quan
| Method | Path | Role |
|---|---|---|
| POST | `/interactions/check` | patient, doctor |
| GET | `/alerts` | patient (chỉ của mình) / doctor (cần query `patient_id`) |

## 9. Liên quan
- `specs/05-meal-plan-generation.md` — luồng "gắn plan" dùng KB đầy đủ.
- `specs/09-food-log-adherence.md` — đề xuất liên kết Alert với food log custom entry.
- `specs/11-compliance-notification-delivery.md` — notification `interaction_followup`.
- `adrs/006-hitl-guardrails-strategy.md`.
- `contracts/agent-io-schema.md` §6.
