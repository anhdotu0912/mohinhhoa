# Spec: Theo dõi Chỉ số Cơ thể (Weight/Height/BMI)

## Status
Done (patient self-tracking) — snapshot Done; time-series Done (ADR-013); "lời khuyên khi chỉ số đổi" Planned.

## 1. Mục tiêu (Why)
Cân nặng/chiều cao/BMI là input quan trọng để tính `target_kcal` phù hợp và theo dõi tiến triển điều trị (ví dụ giảm cân cho bệnh nhân tiểu đường/tăng huyết áp). Bệnh nhân và bác sĩ cả hai cần ghi nhận được, nhưng theo 2 cơ chế tính BMI khác nhau (xem rule 2).

## 2. User story
- Là **bệnh nhân**, tôi muốn tự nhập cân nặng/chiều cao/BMI của mình, để hồ sơ của tôi luôn cập nhật.
- Là **bác sĩ**, tôi muốn nhập hộ chỉ số cơ thể đo được tại phòng khám và để hệ thống tự tính BMI, để đảm bảo tính chính xác không phụ thuộc bệnh nhân tự tính tay.

## 3. Business rules
1. **Lưu snapshot mới nhất trên `profiles`** — mỗi lần cập nhật cũng ghi vào `body_metrics_history` (ADR-013). Patient `POST /metrics`: tối đa 1 row/ngày (Asia/Ho_Chi_Minh); lần ghi sau cập nhật row đó. Doctor metrics: mỗi lần gọi vẫn insert row mới.
2. **2 cơ chế tính BMI khác nhau, có chủ đích:**
   - Patient tự nhập qua `POST /profile` → `bmi` là **giá trị patient tự khai tay**, BE **không tự tính lại**, không có validation chéo với `weight`/`height` đã nhập (patient có thể nhập bmi không khớp).
   - Doctor nhập qua `PUT /doctor/patients/{id}/metrics` → BE **tự tính lại `bmi`** từ `weight`/`height` gửi lên, kèm tự gán `bmi_category` (`Thiếu cân | Bình thường | Thừa cân nhẹ | Béo phì`, theo ngưỡng BMI **châu Á** 18.5/23/25 — không phải ngưỡng WHO chuẩn quốc tế 18.5/25/30, cần lưu ý khi so sánh với tài liệu y khoa quốc tế khác).
3. Không có validation chặn giá trị bất thường (ví dụ `weight=0` hoặc `height=300`) ở cả 2 endpoint — trách nhiệm nhập đúng thuộc về người dùng (patient/doctor), hệ thống hiện không tự phát hiện outlier.
4. **`POST /metrics` (patient self-tracking):** upsert 1 entry/ngày VN vào `body_metrics_history` — lần đầu insert, lần sau merge field vào cùng row (field không gửi giữ nguyên); ít nhất 1 trong `weight`/`blood_pressure`/`blood_glucose` phải có; `bmi` tự tính từ `weight` + `height` (height từ payload, entry hiện tại, hoặc snapshot cũ).
5. **`PUT /doctor/patients/{id}/metrics` (as-built):** phải gửi **đầy đủ cả `weight` và `height`** trong cùng 1 request (không cho cập nhật riêng lẻ 1 trong 2, tránh tính BMI sai do dùng giá trị cũ/thiếu ngữ cảnh) — thiếu 1 trong 2 → `400 METRICS_INCOMPLETE`.

## 4. Luồng chính (happy path)
**Patient tự cập nhật:**
1. Patient sửa hồ sơ (`specs/02`) → `POST /profile` với `weight`/`height`/`bmi` mới.
2. Snapshot cũ trong `profiles` bị ghi đè hoàn toàn.

**Doctor cập nhật hộ:**
1. Doctor đo/nhận chỉ số từ bệnh nhân → `PUT /doctor/patients/{patient_id}/metrics`.
2. BE tự tính `bmi`/`bmi_category`, ghi đè snapshot, trả lại giá trị đã tính.

**Patient tự ghi nhận chỉ số theo thời gian:**
1. Patient mở `/patient/history` → bấm "Ghi nhận chỉ số" → `POST /metrics`.
2. BE upsert `BodyMetricsEntry` của ngày hôm nay (VN), cập nhật snapshot `profiles`, trả entry vừa ghi.
3. Patient xem biểu đồ qua `GET /metrics/history?days=90`.

**Xem lại (patient/doctor):**
1. Patient xem qua `GET /profile/me`; doctor xem qua `GET /doctor/patients/{patient_id}`.
2. Chỉ hiển thị được **giá trị mới nhất** trên profile — biểu đồ xu hướng dùng dữ liệu thật từ `GET /metrics/history`.

## 5. Edge cases
- Patient tự nhập BMI mâu thuẫn với weight/height đã nhập → hệ thống chấp nhận, không cảnh báo (rule 2, cố ý không validate chéo ở endpoint patient).
- Doctor cập nhật metrics nhưng chỉ gửi 1 trong 2 field (`weight` hoặc `height`) → theo rule 5, BE trả `400 METRICS_INCOMPLETE`, không cố suy ra từ giá trị cũ trong `profiles`.

## 6. Ngoài phạm vi (Out of scope)
- **"Lời khuyên khi chỉ số đổi"** (Should Have theo brief) — **Status: Planned**, cần 1 intent Agent mới (chưa có trong `VALID_INTENTS` hiện tại: `meal_plan | interaction_check | food_log | rag_qa | refuse | unknown`) để AI chủ động tư vấn khi phát hiện thay đổi đáng kể giữa 2 lần cập nhật snapshot. Vì chỉ lưu snapshot (không có lịch sử), thiết kế thật cho intent này cần thêm cơ chế lưu "giá trị lần trước" tạm thời để so sánh — chưa thiết kế cụ thể trong tài liệu này, để dành cho khi feature được ưu tiên.
- **"Xu hướng dài hạn"** — **Done** (ADR-013): `GET /metrics/history` + UI `/patient/history`.
- Đo chỉ số khác ngoài weight/height/bmi (ví dụ vòng eo, mỡ cơ thể) — không có field, không nằm trong yêu cầu MVP.

## 7. Schema tham chiếu
- `PatientProfile.weight/height/bmi` — `contracts/agent-io-schema.md` §1.
- `MetricsUpdateRequest`, `bmi_category` enum — `contracts/api-v1.md` §8.

## 8. API liên quan
| Method | Path | Role |
|---|---|---|
| POST | `/metrics` | patient (self-tracking, BE tính BMI) |
| GET | `/metrics/history` | patient |
| POST | `/profile` | patient (tự nhập, `bmi` không tự tính) |
| GET | `/profile/me` | patient |
| PUT | `/doctor/patients/{patient_id}/metrics` | doctor (BE tự tính `bmi`/`bmi_category`) |
| GET | `/doctor/patients/{patient_id}` | doctor |

## 9. Liên quan
- `adrs/013-patient-metrics-time-series.md` — quyết định time-series mới.
- `specs/02-patient-profile-onboarding.md` — nơi patient tự nhập lần đầu.
- `specs/03-doctor-patient-management.md` — endpoint doctor liên quan.
- `contracts/api-v1.md` §8.
