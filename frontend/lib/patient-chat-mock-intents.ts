// TODO(phase2): Thay bằng intent thật từ backend, xoá detector này ở Phase 3.
export type MockCardIntent = "grocery_list" | "weekly_compliance" | "doctor_note" | null;

export function detectMockCardIntent(message: string): MockCardIntent {
  const m = message.toLowerCase();
  if (
    /đi chợ|mua (nguyên liệu|thực phẩm|đồ ăn|đồ)|siêu thị|chợ gần|mua ở đâu|mua cái gì|nguyên liệu.*(gần|quanh)|mua hàng/.test(
      m
    )
  ) {
    return "grocery_list";
  }
  if (
    /tuân thủ.*(tuần|gần đây|này)|tuần này.*tuân thủ|báo cáo tuân thủ|tỉ lệ tuân thủ|tỷ lệ tuân thủ|tuân thủ của tôi/.test(
      m
    )
  ) {
    return "weekly_compliance";
  }
  if (
    /bác sĩ dặn|lời nhắc bác sĩ|ghi chú bác sĩ|bác sĩ có dặn|bác sĩ nhắc|lời dặn.*bác sĩ|lời khuyên.*bác sĩ/.test(
      m
    )
  ) {
    return "doctor_note";
  }
  return null;
}

