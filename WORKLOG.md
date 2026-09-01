# Worklog — Team VinNutri (P-014)

> Ghi lại công việc theo ngày từ 23/07/2026 đến 01/09/2026. Ai làm gì, kết quả gì.
> Dựng từ lịch sử commit thật của repo (`git log`); cột **Time** là ước lượng dựa trên khối lượng công việc trong ngày, không phải chấm công chính xác từng phút.

---

## 2026-07-23

| Member | Task | Status | Output | Time |
|--------|------|--------|--------|------|
| Cả team | Khởi tạo repository từ template BTC AI20K, họp chọn đề tài (AI Agent dinh dưỡng lâm sàng cho bệnh nhân đái tháo đường) và phân công vai trò sơ bộ | ✅ Done | Repo khởi tạo, đề bài + vai trò 4 thành viên đã chốt | 2h |

**Tổng kết ngày:** Kick-off dự án, chưa code — tập trung chọn đề bài và thống nhất hướng đi.

---

## 2026-08-04

| Member | Task | Status | Output | Time |
|--------|------|--------|--------|------|
| Hoàng Văn Quang | Khởi tạo lại dự án theo kiến trúc client-server; dựng khung FastAPI backend + placeholder frontend; refactor backend & cập nhật docker config + kế hoạch MVP; sửa script AI logging (lỗi ghi log, fix log cursor) | ✅ Done | Cấu trúc `backend/`/`frontend/` mới, docker-compose khởi tạo, AI log hoạt động ổn định | 5h |

**Tổng kết ngày:** Đặt lại nền móng kiến trúc client-server sau tuần lên ý tưởng.

---

## 2026-08-08

| Member | Task | Status | Output | Time |
|--------|------|--------|--------|------|
| Hoàng Văn Quang | Kiểm kê & migrate code cũ (`fe_old`/`be_old`) sang cấu trúc mới; restructure frontend theo role; merge UI components `fe_old` vào `/doctor`, `/patient`; thêm mock data + docker cho FE; dọn file tạm; update architecture diagram | ✅ Done | Migration hoàn tất, kiến trúc frontend/backend thống nhất | 6h |

**Tổng kết ngày:** Ngày migration lớn nhất — dọn sạch code cũ, thống nhất cấu trúc theo role.

---

## 2026-08-09

| Member | Task | Status | Output | Time |
|--------|------|--------|--------|------|
| Hoàng Văn Quang | Sửa lỗi CI workflow; review & merge PR #3 (`migration/fe-be-consolidation`); update UI khách hàng (bệnh nhân) | ✅ Done | CI xanh trở lại, nhánh migration merge vào `dev` | 3h |

**Tổng kết ngày:** Ổn định CI sau đợt migration lớn.

---

## 2026-08-10

| Member | Task | Status | Output | Time |
|--------|------|--------|--------|------|
| Hoàng Văn Quang | Thêm giao diện bác sĩ; review & merge PR #4 | ✅ Done | Khung UI `/doctor` đầu tiên | 3h |

**Tổng kết ngày:** Khởi tạo UI portal bác sĩ.

---

## 2026-08-11

| Member | Task | Status | Output | Time |
|--------|------|--------|--------|------|
| Hoàng Văn Quang | Sửa giao diện bác sĩ (merge PR #5); thêm giao diện log ăn uống + cập nhật thực đơn tuần cho bệnh nhân (merge PR #6) | ✅ Done | UI food log + meal plan tuần cho bệnh nhân | 4h |
| Nguyễn Thiên Tài | Cài thư viện AI logging; hoàn thiện Milestone 3 (tương tác thuốc, profile loader, interaction checker cơ bản) | ✅ Done | AI Core Milestone 3 hoàn tất, log AI usage hoạt động | 4h |

**Tổng kết ngày:** Song song tiến độ FE (food log, meal plan) và AI core (interaction checker).

---

## 2026-08-12

| Member | Task | Status | Output | Time |
|--------|------|--------|--------|------|
| Nguyễn Thiên Tài | Hoàn thiện Milestone 4 — interaction checker agent, intent classifier, security, RAG tool, retriever, profile loader nâng cấp | ✅ Done | Pipeline agent cơ bản end-to-end | 5h |
| Hoàng Văn Quang | Đồng bộ tài liệu cho agent coding | ✅ Done | Tài liệu team đồng bộ giữa BE1/BE2 | 1.5h |

**Tổng kết ngày:** AI Core đạt Milestone 4, tài liệu agent đồng bộ giữa các thành viên.

---

## 2026-08-13

| Member | Task | Status | Output | Time |
|--------|------|--------|--------|------|
| Nguyễn Thiên Tài | Cập nhật `package-lock.json`; cập nhật spec dự án; hoàn thiện kết hợp AI core với dữ liệu thật | ✅ Done | AI core chạy trên data thật thay vì mock | 4h |
| Hoàng Văn Quang | Code backend login/register; commit README; update config frontend | ✅ Done | Auth backend (JWT) khởi tạo | 4h |

**Tổng kết ngày:** Auth backend và AI core với data thật cùng tiến triển.

---

## 2026-08-14

| Member | Task | Status | Output | Time |
|--------|------|--------|--------|------|
| Hoàng Văn Quang | Thêm backend tạo thực đơn cho nhiều người dùng; deploy frontend lần đầu; thêm logging lỗi; migrate DB SQLite → PostgreSQL | ✅ Done | Meal plan multi-user, FE deploy, Postgres thay SQLite | 5h |

**Tổng kết ngày:** Chuyển hẳn sang PostgreSQL, deploy frontend lần đầu — kết thúc Tuần 1.

---

## 2026-08-15

| Member | Task | Status | Output | Time |
|--------|------|--------|--------|------|
| Hoàng Văn Quang | Merge `dev` vào nhánh login-register (PR #8); dọn config cục bộ không cần thiết; update tài liệu; merge nhánh `dev-aicore` (PR #7); thêm `data/` vào `.gitignore` | ✅ Done | Nhánh auth + AI core hợp nhất vào `dev` | 3h |

**Tổng kết ngày:** Hợp nhất 2 nhánh lớn (auth, AI core) vào `dev`.

---

## 2026-08-16

| Member | Task | Status | Output | Time |
|--------|------|--------|--------|------|
| Hoàng Văn Quang | Thêm module theo dõi tuân thủ dinh dưỡng (PR #9); hoàn thiện ràng buộc lâm sàng (PR #10); sửa avatar trang queue; thêm model lịch sử bác sĩ; update thông tin bác sĩ + UI; xóa video demo cũ không dùng; thêm chức năng xem thực đơn cho bệnh nhân + chatbot khởi tạo (PR #12, #13) | ✅ Done | 4 module lớn merge trong ngày: compliance, clinical constraints, doctor history, patient meal view + chatbot khởi tạo | 7h |

**Tổng kết ngày:** Ngày năng suất cao nhất Tuần 2 — 4 tính năng lớn merge cùng lúc.

---

## 2026-08-17

| Member | Task | Status | Output | Time |
|--------|------|--------|--------|------|
| Đỗ Tú Anh | Refine UI typography, components và user flows toàn frontend | ✅ Done | UI nhất quán hơn theo design system | 4h |
| Hoàng Văn Quang | Module xem thực đơn + ghi nhận tuân thủ; merge nhánh food-log (PR #14) | ✅ Done | Food Log — tính năng đầu tiên hoạt động | 4h |

**Tổng kết ngày:** Frontend Engineer chính thức tham gia sâu vào UI polish; Food Log go-live.

---

## 2026-08-18

| Member | Task | Status | Output | Time |
|--------|------|--------|--------|------|
| Nguyễn Thiên Tài | Checkpoint dọn code / WIP AI core | ✅ Done | Commit trung gian, chuẩn bị cho đợt bảo mật ngày 19/08 | 1h |
| Hoàng Văn Quang | Cải thiện tính năng quản lý mật khẩu, tuân thủ quy định bảo mật và log ghi nhận của user | ✅ Done | Quản lý mật khẩu an toàn hơn | 3h |

**Tổng kết ngày:** Ngày chuẩn bị nhẹ trước đợt fix bảo mật lớn.

---

## 2026-08-19

| Member | Task | Status | Output | Time |
|--------|------|--------|--------|------|
| Hoàng Văn Quang | Cơ chế rotation API key + fix lỗi bảo mật (merge PR #15, #16); tái cấu trúc env bỏ cờ demo (merge PR #19); tái cấu trúc hạ tầng chỉ hỗ trợ PostgreSQL + Qdrant; merge deploy v1 (PR #18) | ✅ Done | Bảo mật API key nâng cao, hạ tầng chỉ còn Postgres/Qdrant, deploy v1 | 6h |
| Nguyễn Thiên Tài | Cập nhật cấu hình Docker/env/DB init; hoàn thiện chatbot (action button theo intent, hiển thị đa ý định, tối ưu UX streaming, thẻ thực đơn); chuyển embedding/vector store sang Qdrant; chỉnh scroll chat (merge PR #17); sửa lỗi cuộn trang, lịch sử chat, tài liệu tham khảo; docs FAQ bệnh nhân + ignore chroma data | ✅ Done | Chatbot thế hệ mới (Generative UI) + migration Qdrant hoàn tất | 7h |

**Tổng kết ngày:** Ngày hoạt động nhiều nhất tính đến thời điểm này — bảo mật (Quang) và chatbot/Qdrant (Tài) song song về đích.

---

## 2026-08-20

| Member | Task | Status | Output | Time |
|--------|------|--------|--------|------|
| Đỗ Tú Anh | Tích hợp patient dashboard UI, meal log, biểu đồ, floating menu | ✅ Done | Dashboard bệnh nhân v1 | 5h |

**Tổng kết ngày:** Dashboard bệnh nhân thành hình.

---

## 2026-08-21

| Member | Task | Status | Output | Time |
|--------|------|--------|--------|------|
| Đỗ Tú Anh | Update patient dashboard + assistant UI; biểu đồ sức khỏe mới + AI sidebar toàn cục; overhaul trang lịch sử bệnh nhân; fix lỗi TypeScript `FoodLogEntry`; chỉnh grid dashboard bác sĩ 50:50; fix lỗi syntax component Sidebar | ✅ Done | Dashboard bệnh nhân + trang lịch sử hoàn thiện, sidebar ổn định | 6h |
| Thiều Thị Ngọc Ánh | Cập nhật `eval/golden_dataset.json` với 100 test case đánh giá | ✅ Done | Golden dataset 100 test case sẵn sàng cho eval | 4h |
| Hoàng Văn Quang | Thêm chức năng xem hồ sơ bệnh nhân cho bác sĩ + tài liệu refactor dự án; sửa sidebar theo bản mới | ✅ Done | Bác sĩ xem được hồ sơ chi tiết bệnh nhân | 3h |

**Tổng kết ngày:** Clinical QA chính thức đóng góp golden dataset; FE hoàn thiện dashboard + lịch sử.

---

## 2026-08-22

| Member | Task | Status | Output | Time |
|--------|------|--------|--------|------|
| Hoàng Văn Quang | Fix bug sidebar; update tài liệu dự án; fixbug meal plan preview nhận tham số ngày tùy chọn + dọn DB thực phẩm + bổ sung FAQ (BMI, lượng protein); ẩn tạm chức năng nhắn tin (message), bỏ mock data | ✅ Done | Dữ liệu thực phẩm sạch hơn, meal plan preview theo ngày cụ thể | 4h |

**Tổng kết ngày:** Dọn dữ liệu và ổn định UI trước khi vào đợt tính năng RAG/guardrails.

---

## 2026-08-23

| Member | Task | Status | Output | Time |
|--------|------|--------|--------|------|
| Hoàng Văn Quang | Update FE, chuyển giao diện bệnh nhân qua chatbot làm trung tâm; cải thiện biểu đồ tuân thủ trong chatbot + lời nhắc bác sĩ; cải thiện UI FE bệnh nhân + backend tương ứng; thêm node tuân thủ hàng tuần tóm tắt cho agent | ✅ Done | Trải nghiệm chat-first cho bệnh nhân + tóm tắt tuân thủ hàng tuần | 6h |
| Nguyễn Thiên Tài | Cập nhật giao diện bác sĩ; feat(rag) làm giàu dữ liệu guideline ĐTĐ Type 2 vào Qdrant; feat(agent) thêm intent chào hỏi + tinh chỉnh guardrails tránh chặn nhầm | ✅ Done | RAG guideline giàu hơn, guardrail không còn chặn nhầm câu chào xã giao | 5h |

**Tổng kết ngày:** Chatbot trở thành trung tâm trải nghiệm bệnh nhân; RAG + guardrails được tinh chỉnh.

---

## 2026-08-24

| Member | Task | Status | Output | Time |
|--------|------|--------|--------|------|
| Hoàng Văn Quang | Triển khai dịch vụ theo dõi mức độ tuân thủ ghi nhật ký ăn uống, hỗ trợ múi giờ Việt Nam; fixbug validate input các form bệnh nhân + avatar; thêm chức năng bệnh nhân yêu cầu tạo thực đơn (request) | ✅ Done | Compliance service chuẩn múi giờ VN, patient request meal plan | 5h |
| Nguyễn Thiên Tài | feat(doctor) xóa bệnh nhân + xóa thực đơn (API DELETE, UI confirm modal, unit test, cập nhật `contracts/api-v1.md`); feat(agent) nâng cấp prompt RAG theo BYT QĐ 5481/ADA, mở rộng guideline (omega-3, thịt nạc, trứng, đậu phụ) + index vào vector DB; fix(fe) tối ưu bảng dashboard bác sĩ + biểu đồ tuân thủ 14 ngày; update tài liệu kiến trúc; sửa câu trả lời đúng intent, trình bày đẹp hơn | ✅ Done | Doctor quản trị đầy đủ hơn (xóa bệnh nhân/plan), RAG chuẩn y khoa hơn, biểu đồ tuân thủ 14 ngày | 7h |

**Tổng kết ngày:** Kết thúc Tuần 3 với loạt tính năng quản trị bác sĩ + RAG chuẩn hóa theo guideline BYT/ADA.

---

## 2026-08-25

| Member | Task | Status | Output | Time |
|--------|------|--------|--------|------|
| Hoàng Văn Quang | Fix bug hiển thị thực đơn trong chatbot; thêm tài khoản mật khẩu demo cho người dùng | ✅ Done | Demo account sẵn sàng cho test/chấm điểm | 2h |
| Nguyễn Thiên Tài | fix(agent) ưu tiên tuyệt đối cảnh báo dị ứng thực phẩm, tách nhánh xử lý dị ứng riêng khỏi interaction check thuốc, thêm gợi ý thay thế an toàn + unit test; cải thiện biểu đồ giao diện bác sĩ | ✅ Done | An toàn dị ứng được đảm bảo tuyệt đối, có test hồi quy | 4h |

**Tổng kết ngày:** Mở đầu Tuần 4 bằng cải thiện an toàn y khoa quan trọng (dị ứng thực phẩm).

---

## 2026-08-26

| Member | Task | Status | Output | Time |
|--------|------|--------|--------|------|
| Hoàng Văn Quang | Refactor FE bác sĩ; update giao diện ghi nhận chỉ số bệnh nhân; review & merge PR #20 (`refactor-ui-doctor`) | ✅ Done | UI bác sĩ + ghi nhận chỉ số làm mới | 4h |

**Tổng kết ngày:** Refactor UI bác sĩ theo hướng gọn hơn.

---

## 2026-08-27

| Member | Task | Status | Output | Time |
|--------|------|--------|--------|------|
| Hoàng Văn Quang | Update UI FE bác sĩ; loại bỏ các bệnh không liên quan (chỉ giữ nhóm tiểu đường); update giao diện quản lý bệnh nhân; thêm responsive cho giao diện bệnh nhân; sửa luồng suy nghĩ chatbot (mặc định không xổ xuống) + giao diện ghi nhận bữa ăn; update giao diện các biểu đồ phía bệnh nhân | ✅ Done | UI responsive đầy đủ, phạm vi bệnh lý thu hẹp đúng đề bài | 6h |
| Nguyễn Thiên Tài | Thêm dữ liệu bệnh tiểu đường Type 1, tiền tiểu đường, tiểu đường thai kỳ; sửa thông tin bệnh nhân + bổ sung bệnh nền liên quan | ✅ Done | Knowledge base bệnh lý mở rộng đúng nhóm đái tháo đường | 3h |

**Tổng kết ngày:** Thu hẹp và làm sâu đúng phạm vi đề bài (đái tháo đường), UI responsive hoàn thiện.

---

## 2026-08-28

| Member | Task | Status | Output | Time |
|--------|------|--------|--------|------|
| Nguyễn Thiên Tài | feat(skills) triển khai kiến trúc skills module hóa + benchmark đánh giá; feat(guardrails) two-tier clinical safety filter + prompt state pruning | ✅ Done | Guardrails an toàn 2 tầng, hạ tầng skills cho agent | 5h |
| Hoàng Văn Quang | Fixbug ghi đè nội dung lịch sử hội thoại; thêm phân quyền nhiều bác sĩ; bổ sung dữ liệu mẫu 3 thực đơn | ✅ Done | Đa bác sĩ hoạt động đúng phân quyền, lịch sử chat không bị ghi đè | 4h |

**Tổng kết ngày:** Guardrails nâng cấp lên 2 tầng; hệ thống hỗ trợ nhiều bác sĩ.

---

## 2026-08-29

| Member | Task | Status | Output | Time |
|--------|------|--------|--------|------|
| Hoàng Văn Quang | Thêm profile cho bác sĩ; sửa conflict code; dọn file tạm + xóa dữ liệu trùng lặp (PR #26); sửa lỗi CI, tạm tắt rồi bật lại CI check (PR #27); cập nhật README (PR #28); update UI bác sĩ + trang chủ, thêm responsive mobile (PR #29); chỉnh phân quyền + giao diện (PR #30); chuyển luồng tạo tài khoản qua CLI script tương tác (PR #31); đổi tên dự án thành VinNutri + sửa tên trong live preview chat (PR #32) | ✅ Done | Repo sạch, CI ổn định, README cập nhật, đổi tên chính thức **VinNutri**, tạo tài khoản demo an toàn qua CLI | 8h |
| Nguyễn Thiên Tài | feat(metrics-ui) health metrics panel, meal plan impact summary, tab favicon | ✅ Done | Panel chỉ số sức khỏe + tóm tắt tác động meal plan | 4h |

**Tổng kết ngày:** Ngày dọn dẹp & ổn định lớn nhất dự án — 6 PR merge, đổi tên chính thức thành VinNutri.

---

## 2026-08-30

| Member | Task | Status | Output | Time |
|--------|------|--------|--------|------|
| Hoàng Văn Quang | Sửa UI tạo thực đơn + chatbot; sửa thông tin trang chủ; sửa lỗi xuống dòng; merge PR #33 (`update-ui`) | ✅ Done | UI tạo thực đơn + trang chủ hoàn thiện | 3h |

**Tổng kết ngày:** Polish UI trước khi thêm tính năng chat với bác sĩ.

---

## 2026-08-31

| Member | Task | Status | Output | Time |
|--------|------|--------|--------|------|
| Hoàng Văn Quang | Thêm chức năng chat trực tiếp với bác sĩ + sửa UI; sửa hiển thị chunk trong nguồn trích dẫn; merge PR #34 (`add-chat`) | ✅ Done | Bệnh nhân chat được với bác sĩ, trích dẫn RAG hiển thị đúng | 4h |

**Tổng kết ngày:** Thêm kênh liên lạc trực tiếp bệnh nhân–bác sĩ.

---

## 2026-09-01

| Member | Task | Status | Output | Time |
|--------|------|--------|--------|------|
| Nguyễn Thiên Tài | fix(agents) cải thiện safety escalation, RAG faithfulness và routing `interaction_check`; feat(metrics) cải thiện `MetricsOverlayChart` + tóm tắt cải thiện chỉ số | ✅ Done | Agent an toàn + trung thực hơn, biểu đồ overlay chỉ số nâng cấp | 4h |

**Tổng kết ngày:** Tinh chỉnh an toàn agent và biểu đồ chỉ số trước khi chốt hồ sơ nộp BTC.

---

<!-- Format: copy block trên cho mỗi ngày làm việc mới -->
