import type { MealPlanOutput } from "./types";
import { DAY_LABELS, todayDayIndex } from "./meal-plan-display";
import { formatDateIso, parseFlexibleDate } from "./plan-expiry";

/** Calendar boundaries follow the patient's Vietnam day, regardless of device timezone. */
export function vietnamTodayIso(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (name: string) => parts.find((item) => item.type === name)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** day_index is relative to starts_on, not an ISO weekday. */
export function mealPlanCalendarDays(plan?: Pick<MealPlanOutput, "starts_on"> | null) {
  const start = parseFlexibleDate(plan?.starts_on);
  return DAY_LABELS.map((_, index) => {
    if (!start) return { index, short: `N${index + 1}`, full: `Ngày ${index + 1}`, date: null as string | null };
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const label = DAY_LABELS[todayDayIndex(date)];
    return { index, short: label.short, full: label.full as string, date: formatDateIso(date) };
  });
}
