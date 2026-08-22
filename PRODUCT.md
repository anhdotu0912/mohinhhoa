# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Bệnh nhân (đặc biệt là bệnh nhân mắc các bệnh mãn tính như đái tháo đường, tim mạch, thận, gút, v.v.) đang tự quản lý chế độ ăn uống, dinh dưỡng và lối sống cá nhân tại nhà theo hướng dẫn y khoa.

## Product Purpose

Cung cấp trợ lý dinh dưỡng lâm sàng cá nhân hoá thông minh (VMEC-10), giúp người bệnh xây dựng thực đơn an toàn, tra cứu tương tác thuốc - món ăn, ghi nhật ký ăn uống và theo dõi các chỉ số sức khoẻ một cách khoa học, trực quan và dễ tiếp cận.

## Positioning

Trợ lý AI dinh dưỡng lâm sàng cá nhân hoá tuân thủ nghiêm ngặt nguyên tắc an toàn y khoa (Human-In-The-Loop / HITL Guardrails): mọi gợi ý đều được đối soát với bệnh lý, tiền sử dùng thuốc, dị ứng và kiểm chứng thông qua RAG y văn có nguồn trích dẫn rõ ràng, không ảo giác (hallucination).

## Operating Context

- Môi trường Web App (desktop & mobile responsive), hỗ trợ bệnh nhân tương tác hàng ngày: hỏi đáp chat dinh dưỡng, xem thực đơn tuần, ghi nhật ký bữa ăn (Food Log), và nhập/theo dõi chỉ số sinh hiệu (HbA1c, huyết áp, đường huyết, BMI, v.v.).
- Tích hợp luồng phản hồi và cảnh báo y khoa tức thì khi phát hiện xung đột giữa thuốc đang sử dụng và thực phẩm.

## Capabilities and Constraints

- **Capabilities**:
  - Chat AI tư vấn dinh dưỡng thông minh (Generative UI cards, trích dẫn tài liệu y khoa RAG).
  - Quản lý thực đơn 7 ngày / 3 bữa có tính toán chi tiết Calo & Macros (Carbs, Protein, Fat).
  - Quản lý nhật ký ăn uống 3-slot (Food Log) và đối soát tuân thủ thực đơn (Compliance tracking).
  - Theo dõi chuỗi thời gian chỉ số bệnh nhân (Patient Metrics Time-series).
  - Cảnh báo tương tác thuốc - thức ăn (Drug-Food Interactions) và dị ứng/không dung nạp.
- **Constraints**:
  - Tuân thủ nghiêm ngặt HITL: AI không tự ý chẩn đoán hay thay đổi phác đồ điều trị/thuốc của bác sĩ.
  - Mọi số liệu dinh dưỡng phải grounded và có trích dẫn nguồn uy tín.
  - Hạn chế tối đa việc làm xáo trộn các component UI nền tảng đã thiết kế.

## Brand Commitments

- **Tên hệ thống**: VMEC-10 (P-014) Clinical Nutrition AI Assistant.
- **Tone & Voice**: Chuyên nghiệp, chuẩn mực y khoa, đáng tin cậy, thấu hiểu và ân cần với người bệnh.
- **Thiết kế**: Giao diện trực quan, rõ ràng, phân cấp thị giác tốt, dễ đọc cho người lớn tuổi / bệnh nhân mãn tính.

## Evidence on Hand

- Đặc tả use-case và kiến trúc chi tiết tại `docs/MO_TA_HE_THONG.md` và `specs/01-13`.
- Hợp đồng giao tiếp API & schema tại `contracts/api-v1.md` và `contracts/agent-io-schema.md`.
- Tập dữ liệu guideline y khoa và dược thư dinh dưỡng được RAG hóa trong Qdrant vector database.

## Product Principles

1. **An toàn y khoa là trên hết (Safety First)**: Tuyệt đối không đề xuất món ăn gây dị ứng hoặc xung đột nguy hiểm với thuốc đang dùng.
2. **Minh bạch & Đáng tin cậy (Grounded & Cited)**: Mọi lời khuyên đều có cơ sở khoa học và nguồn tài liệu tham khảo rõ ràng.
3. **Cá nhân hoá thiết thực (Actionable Personalization)**: Phù hợp với thể trạng, sở thích, văn hoá ẩm thực Việt Nam và bệnh lý cụ thể.
4. **Trải nghiệm dễ dàng cho bệnh nhân (Patient-Centric Simplicity)**: Giao diện tinh gọn, nhập liệu thuận tiện, biểu đồ và thẻ thông tin trực quan.

## Accessibility & Inclusion

- Font chữ rõ nét, độ tương phản cao, kích thước dễ đọc cho bệnh nhân lớn tuổi.
- Bố cục responsive mượt mà trên cả thiết bị di động và máy tính để bàn.
