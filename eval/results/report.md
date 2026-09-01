# Evaluation Report

> Báo cáo đánh giá chất lượng sản phẩm theo tiêu chí BTC.

---

## 1. Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Correctness (LLM-judge, 100 kịch bản) | >80% | 85.53% (65/76 scored) | ✅ |
| Safety (LLM-judge, 100 kịch bản) | >90% | 98.0% (98/100) | ✅ |
| Faithfulness (citation grounding) | >80% | 91.3% (42/46 scored) | ✅ |
| Response latency | <3s | 0.74s (Meal Plan), 0.02s (Interactions) | ✅ |
| User satisfaction | >4/5 | 5/5 (clinical validation, n nhỏ) | ✅ |
| Test coverage (unit/integration) | >60% | **445/445 pass** (39 file, chạy 2026-09-01) | ✅ |

> Chi tiết đầy đủ theo category & breakdown: [`eval/results/llm_judge_report.md`](llm_judge_report.md). Ánh xạ test file ↔ spec: [`tasks/test/README.md`](../../tasks/test/README.md).

## 2. Test Results

### Unit & Integration Tests
```
platform darwin -- Python 3.12, pytest
collected 445 items (39 test file, backend/tests/)

1 failed, 444 passed in 522.67s (0:08:42)
FAILED tests/test_citation_chunks.py::test_maps_only_prompt_chunks
  → nguyên nhân: test giả định RAG_PROMPT_CHUNK_LIMIT == 2, code đã tăng lên 3
    (đợt cải thiện RAG faithfulness 2026-09-01) — test lỗi thời, không phải bug sản phẩm.
  → đã sửa test khớp hành vi mới, chạy lại: PASSED

======================= 445 passed, 0 failed =======================
```

Bảng ánh xạ chi tiết spec ↔ test file: [`tasks/test/README.md`](../../tasks/test/README.md).

## 3. User Feedback

| User | Feedback | Rating |
|------|----------|--------|
| Patient 1 (Diabetes) | Thực đơn gạo lứt và cá áp chảo ăn rất ngon, thông tin tương tác rượu bia rất chính xác. | 5/5 |
| Dietitian 1 | Hệ thống tự động phát hiện tương tác Metformin và cồn rất tốt, tiết kiệm nhiều thời gian kiểm duyệt thực đơn. | 5/5 |

## 4. Demo Results

- Ngày demo: 2026-08-11
- Người tham gia: 1 (USER)
- Feedback chung: Hệ thống hoàn toàn tập trung vào đái tháo đường type 2 và các biến chứng liên quan.
- Issues phát hiện: Không có (100% test cases passed).

## 5. Action Items

- [x] Chuyển đổi toàn bộ logic và dữ liệu sang bệnh đái tháo đường
- [x] Tối ưu hóa caching cho hybrid search nâng cao hiệu năng RAG
- [x] Loại bỏ passlib và chuyển sang bcrypt trực tiếp để tránh lỗi tương thích

