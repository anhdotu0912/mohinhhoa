export function isWeeklyPlanQuery(message: string): boolean {
  const m = message.toLowerCase();
  return /thực đơn.*(tuần|7 ngày|cả tuần|này)|(xem|cho tôi xem|lịch ăn|kế hoạch ăn|xem lại).*thực đơn|thực đơn của tôi|thực đơn tuần này|tuần này ăn gì/i.test(
    m
  );
}
