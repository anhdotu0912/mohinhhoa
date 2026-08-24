# Weekly Journal — Team VMEC-10 (P-014)

> **Dự án:** VMEC-10 — AI Agent Trợ Lý Dinh Dưỡng Lâm Sàng & Lối Sống Theo Bệnh Lý (VinUni AI20K Build Phase)  
> **Mục đích:** Ghi lại tiến độ hàng tuần, bài học kinh nghiệm, các quyết định kiến trúc quan trọng và kế hoạch phát triển.

---

## Week 1: 2026-08-08 - 2026-08-14

### Mục tiêu tuần này
- [x] Khởi tạo kiến trúc dự án, repository, thiết lập môi trường phát triển chung và CI/CD với GitHub Actions.
- [x] Thiết kế sơ đồ Use Case, xác định các tác nhân hệ thống (Bác sĩ, Bệnh nhân, AI Agent) và nguyên tắc Human-in-the-Loop (HITL).
- [x] Xây dựng khung Frontend Next.js 16 (App Router) phân tách 2 portal riêng biệt: `/patient/*` và `/doctor/*`.
- [x] Xây dựng Backend FastAPI: Module xác thực tài khoản (JWT Auth), quản lý hồ sơ bệnh nhân (`PatientProfile`).
- [x] Khởi tạo cơ sở tri thức tương tác thuốc - thực phẩm ban đầu (`data/drug_food_interactions.json`) và Agent phân loại ý định sơ khởi.

### Đã hoàn thành
- Setup thành công Dockerfile multi-stage, Docker Compose dev và pipeline GitHub Actions chạy linting/test tự động.
- Hoàn thiện luồng đăng ký, đăng nhập JWT cho cả 2 vai trò `patient` và `doctor`.
- Xây dựng màn hình khai báo hồ sơ bệnh nhân (bệnh lý nền, danh sách thuốc đang dùng, tiền sử dị ứng, chiều cao, cân nặng).
- Xây dựng Agent Core ban đầu bằng LangGraph (`profile_loader`, `intent_classifier`, `interaction_check`).
- Thu thập và chuẩn hóa hơn 28 cặp tương tác thuốc - thực phẩm lâm sàng phổ biến cho bệnh mãn tính (Metformin, Statin, Warfarin, Insulin...).

### Khó khăn & Giải pháp
| Khó khăn | Giải pháp | Kết quả |
|---|---|---|
| Cần hỗ trợ 2 vai trò người dùng (Bác sĩ và Bệnh nhân) với luồng thao tác hoàn toàn khác biệt trên cùng một ứng dụng. | Tách route Next.js thành 2 phân hệ rõ ràng: `/patient` và `/doctor`, kết hợp Auth Guard middleware và Zustand store. | Giao diện rõ ràng, phân quyền bảo mật, trải nghiệm người dùng tối ưu theo từng vai trò. |
| Một số embedding model mã nguồn mở xử lý tiếng Việt y khoa chưa tốt, tìm kiếm guideline kém chính xác. | Thử nghiệm và tích hợp Google Gemini `gemini-embedding-2` kết hợp fallback local MiniLM. | Khả năng truy xuất tài liệu guideline tiếng Việt đạt độ liên quan ngữ nghĩa rất cao. |
| Phức tạp trong việc quản lý trạng thái luồng hội thoại và phân nhánh nghiệp vụ an toàn y tế. | Sử dụng LangGraph StateGraph để kiểm soát luồng điều phối tuần tự và conditional edges. | Dễ dàng quản lý state, kiểm soát rẽ nhánh và chốt chặn an toàn y khoa. |

### Bài học
- Cần thống nhất Hợp đồng giao tiếp (API Contract & Schemas) giữa Frontend và Backend từ sớm để tránh việc sửa đổi code nhiều lần.
- Trong lĩnh vực y tế, AI không được tự quyết định hoàn toàn; việc đưa bác sĩ vào quy trình kiểm duyệt (HITL) là yêu cầu tiên quyết.

### Kế hoạch tuần sau
- [ ] Chuyển đổi toàn diện cơ sở dữ liệu sang PostgreSQL để đảm bảo tính toàn vẹn dữ liệu.
- [ ] Xây dựng hoàn chỉnh luồng North Star: AI sinh thực đơn 7 ngày → Bác sĩ duyệt/từ chối → Bệnh nhân xem thực đơn.
- [ ] Phát triển tính năng Nhật ký ăn uống (Food Log) và Ràng buộc lâm sàng (Clinical Constraints).

---

## Week 2: 2026-08-15 - 2026-08-21

### Mục tiêu tuần này
- [x] Chuyển đổi Database từ SQLite sang PostgreSQL (ADR-005) và Vector Store từ Chroma sang Qdrant (ADR-001).
- [x] Xây dựng hoàn chỉnh luồng North Star Demo: Sinh thực đơn 7 ngày cá nhân hóa → Hàng đợi Bác sĩ duyệt (`/doctor/queue`) → Bệnh nhân nhận thực đơn đã duyệt.
- [x] Triển khai tính năng Nhật ký ăn uống 3-slot (Food Log - ADR-009) và Theo dõi tuân thủ (Compliance tracking).
- [x] Tích hợp Module Quản lý Ràng buộc Lâm sàng (`/doctor/constraints`) cho phép bác sĩ can thiệp giới hạn Calo/Carbs/Natri.
- [x] Nâng cấp Trợ lý AI Chat với Generative UI cards, streaming token và phản hồi theo ngữ cảnh hồ sơ bệnh án.

### Đã hoàn thành
- Tái cấu trúc backend sử dụng PostgreSQL và migration script tự động, bổ sung đầy đủ models: `MealPlan`, `Alert`, `Notification`, `FoodLog`, `BodyMetricsHistory`.
- Tích hợp Qdrant Vector Database và cài đặt thuật toán Hybrid Search (Dense Vector + BM25 với RRF).
- Xây dựng hoàn thiện trang duyệt thực đơn cho bác sĩ với đầy đủ tính năng: Xem phân tích dinh dưỡng, cảnh báo dị ứng/tương tác thuốc, Duyệt (`approve`), Từ chối (`reject`) và Sửa nhanh (`edit`).
- Triển khai cơ chế Notification event-driven materialize-ahead, tự động sinh lịch thông báo nhắc nhở sau khi thực đơn được bác sĩ phê duyệt.
- Xây dựng giao diện Chatbot AI thế hệ mới: Render trực tiếp thẻ món ăn, nút thao tác nhanh (Action buttons) và hỗ trợ nhận diện đa ý định (multi-intent).

### Khó khăn & Giải pháp
| Khó khăn | Giải pháp | Kết quả |
|---|---|---|
| ChromaDB chạy local đôi khi gặp lỗi khóa file và khó tích hợp Hybrid Search BM25 hiệu quả. | Chuyển đổi hoàn toàn sang Qdrant Vector Database (ADR-001), cài đặt BM25 tokenizer tiếng Việt. | Tốc độ truy vấn RAG dưới 100ms, độ chính xác tìm kiếm thông tin dinh dưỡng tăng rõ rệt. |
| Trải nghiệm chat AI bị giật khi vừa stream text vừa render các component thẻ dinh dưỡng phức tạp. | Tách biệt luồng stream text và metadata cards, tối ưu hóa Zustand state và virtual scrolling. | Chatbot phản hồi mượt mà, hiển thị Generative UI cards tức thì và trực quan. |
| Cần theo dõi mức độ tuân thủ của bệnh nhân mà không phụ thuộc vào cronjob nền phức tạp trên server free-tier. | Thiết kế cơ chế Event-Driven Materialize-Ahead (ADR-007): sinh trước các bản ghi notification khi plan được duyệt. | Tiết kiệm tài nguyên server, hoạt động ổn định và chính xác 100%. |

### Bài học
- Việc tuân thủ nghiêm ngặt nguyên tắc *"Sửa Contract trước, Code sau"* giúp giảm thiểu 90% lỗi sai lệch dữ liệu giữa FE và BE.
- Cơ chế Hybrid Search (kết hợp từ khóa chính xác và vector ngữ nghĩa) vượt trội hơn hẳn so với chỉ dùng vector search thuần túy đối với thuật ngữ y khoa và tên thuốc.

### Kế hoạch tuần sau
- [ ] Hoàn thiện chốt chặn an toàn Guardrails y khoa (`rules.py`, `source_check.py`), bắt buộc trích dẫn y văn BYT / ADA.
- [ ] Xây dựng tính năng theo dõi chuỗi thời gian chỉ số bệnh nhân (Patient Metrics Time-series).
- [ ] Bổ sung các tính năng quản lý trên Portal Bác sĩ: xóa bệnh nhân, xóa thực đơn, gửi nhắc nhở tuân thủ thủ công.
- [ ] Chạy bộ kiểm thử toàn diện (pytest unit/integration tests, golden dataset evaluation) và chuẩn bị hồ sơ deliverables nộp BTC.

---

## Week 3: 2026-08-22 - 2026-08-24

### Mục tiêu tuần này
- [x] Triển khai và tinh chỉnh Guardrails y tế (`backend/app/guardrails/rules.py` & `source_check.py`) ngăn chặn hallucination và lời khuyên dùng thuốc tùy tiện.
- [x] Làm giàu dữ liệu guidelines ĐTĐ Type 2 (Quyết định 5481/QĐ-BYT) và Bảng thành phần thực phẩm Việt Nam vào Qdrant Vector DB.
- [x] Hoàn thiện tính năng Quản lý Bệnh nhân nâng cao cho Bác sĩ (Xóa bệnh nhân, Xóa thực đơn, Gửi nhắc nhở tuân thủ).
- [x] Xây dựng Biểu đồ Tuân thủ Dinh dưỡng và Chuỗi Thời gian Chỉ số Sinh hiệu (HbA1c, Đường huyết, Huyết áp, BMI).
- [x] Thực hiện đánh giá chất lượng hệ thống (Golden Dataset 100 test cases, 76/76 unit & integration tests passed).
- [x] Hoàn thiện toàn bộ hệ thống tài liệu chuẩn hóa: 13 Specs, 13 ADRs, 2 Contracts, Architecture Document và Tasks Roadmap.

### Đã hoàn thành
- Hệ thống Guardrails hoạt động chính xác: 100% câu trả lời RAG có trích dẫn nguồn y văn rõ ràng; chặn 100% các câu hỏi yêu cầu kê đơn, đổi liều thuốc.
- Mở rộng ngân hàng thực phẩm Việt Nam với hơn 100+ món ăn chuẩn bệnh lý đái tháo đường, hỗ trợ tính toán calo và tỷ lệ đa lượng Macros (Carbs/Protein/Fat) chi tiết.
- Đạt 76/76 unit & integration tests pass (100% pass rate) với độ trễ phản hồi trung bình <0.8s cho sinh thực đơn và <0.05s cho kiểm tra tương tác thuốc.
- Hoàn thiện giao diện bác sĩ với các biểu đồ tuân thủ trực quan và tính năng quản lý bệnh nhân toàn diện.
- Cập nhật và đồng bộ 100% tài liệu kiến trúc, specs, contracts và deliverables theo đúng yêu cầu của BTC AI20K.

### Khó khăn & Giải pháp
| Khó khăn | Giải pháp | Kết quả |
|---|---|---|
| LLM đôi khi đưa ra lời khuyên chung chung mà không trích dẫn chính xác số quyết định/hướng dẫn của Bộ Y tế. | Tinh chỉnh prompt RAG, bắt buộc định dạng trích dẫn `[Nguồn: ...]` và dùng `source_check.py` để validate trước khi trả về. | Mọi câu trả lời tư vấn y tế đều có cơ sở khoa học minh bạch và dẫn chứng tin cậy. |
| Múi giờ ghi nhận Food Log và Check-in tuân thủ bị lệch khi bệnh nhân nhập liệu ở múi giờ Việt Nam (UTC+7). | Chuẩn hóa toàn bộ thời gian hệ thống theo chuẩn ISO-8601 UTC và chuyển đổi múi giờ hiển thị thống nhất tại API & Client. | Nhật ký và biểu đồ tuân thủ hiển thị chính xác theo từng ngày và từng bữa ăn. |
| Một số câu chào hỏi thông thường của bệnh nhân bị Guardrail chặn nhầm do quá nghiêm ngặt. | Bổ sung Intent Greeting chuyên biệt và tinh chỉnh bộ lọc an toàn để phân biệt giữa câu chào xã giao và câu hỏi bệnh lý. | Trải nghiệm giao tiếp tự nhiên, thân thiện nhưng vẫn tuyệt đối an toàn về mặt y khoa. |

### Bài học
- Guardrails đa tầng (kết hợp Regex, Rules, Schema validation và Source checking) đem lại sự an toàn và độ tin cậy vượt bậc so với việc chỉ trông cậy vào System Prompt của LLM.
- Việc chuẩn bị bộ dữ liệu đánh giá chuẩn (Golden Dataset) từ sớm giúp đội ngũ tự tin kiểm thử hồi quy (regression testing) sau mỗi lần refactor code.

### Kế hoạch tuần sau (Week 4: Hoàn tất & Chuẩn bị Demo Day)
- [ ] Triển khai hệ thống lên môi trường VPS / Cloud Production (Docker Compose, Nginx SSL).
- [ ] Quay Video Demo sản phẩm chất lượng cao (thời lượng 3–5 phút) bám sát kịch bản North Star Flow.
- [ ] Thiết kế hoàn thiện Slide thuyết trình Pitch Deck (10 slides chuẩn) cho sự kiện Demo Day.
- [ ] Tiến hành diễn tập thuyết trình (Rehearsal) và kiểm tra lại toàn bộ 10 Deliverables theo checklist BTC.
