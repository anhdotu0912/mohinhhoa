/** Rút gọn danh sách chẩn đoán: chỉ giữ tối đa maxItems mục, phần còn lại thay bằng "...". */
export function shortCondition(condition: string, maxItems = 2): string {
  const items = condition
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (items.length <= maxItems) return items.join(", ");
  return `${items.slice(0, maxItems).join(", ")}, ...`;
}
