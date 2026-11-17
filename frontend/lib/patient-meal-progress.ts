import type { DayPlan, FoodLogEntry, MealPlanOutput } from "./types";
import { vietnamTodayIso } from "./meal-plan-calendar";

export const FOOD_LOG_LABELS = { morning: "Bữa sáng", noon: "Bữa trưa", evening: "Bữa tối", snack: "Bữa phụ" };

export function foodLogSlot(slot: string): FoodLogEntry["slot"] | null {
  if (slot === "morning" || slot === "breakfast") return "morning";
  if (slot === "noon" || slot === "lunch") return "noon";
  if (slot === "evening" || slot === "dinner") return "evening";
  return slot === "snack" ? "snack" : null;
}

/** A cycle's first day can be any weekday. Never substitute a different day. */
export function patientMealDay(plan: Pick<MealPlanOutput, "status" | "starts_on" | "ends_on" | "days"> | null, date: string): DayPlan | null {
  if (!plan || !["approved", "edited"].includes(plan.status) || !plan.starts_on || !plan.ends_on) return null;
  if (date < plan.starts_on || date > plan.ends_on) return null;
  const delta = (Date.parse(date + "T00:00:00Z") - Date.parse(plan.starts_on + "T00:00:00Z")) / 86_400_000;
  if (!Number.isInteger(delta) || delta < 0) return null;
  return plan.days.find((day) => day.day_index === delta + 1) ?? null;
}

export function latestMealLog(logs: FoodLogEntry[], planId: string, date: string, slot: string): FoodLogEntry | null {
  const target = foodLogSlot(slot);
  if (!target) return null;
  let latest: FoodLogEntry | null = null;
  let latestTime = -Infinity;
  for (const log of logs) {
    if (log.meal_plan_id !== planId || log.slot !== target || !log.logged_at) continue;
    const iso = /[zZ]|[+-]\d{2}:\d{2}$/.test(log.logged_at) ? log.logged_at : log.logged_at + "Z";
    const timestamp = new Date(iso);
    if (!Number.isFinite(timestamp.getTime()) || vietnamTodayIso(timestamp) !== date) continue;
    if (timestamp.getTime() > latestTime) { latest = log; latestTime = timestamp.getTime(); }
  }
  return latest;
}

export function patientMealProgress(plan: MealPlanOutput | null, date: string, logs: FoodLogEntry[]) {
  const day = patientMealDay(plan, date);
  const slots = [...new Set((day?.meals ?? []).map((meal) => foodLogSlot(meal.slot)).filter((slot): slot is FoodLogEntry["slot"] => slot !== null))];
  const meals = slots.map((slot) => ({ slot, label: FOOD_LOG_LABELS[slot], log: latestMealLog(logs, plan!.id, date, slot) }));
  const planned = meals.filter((meal) => meal.log?.type === "as_planned").length;
  const custom = meals.filter((meal) => meal.log?.type === "custom").length;
  return { meals, planned, custom, recorded: planned + custom, total: meals.length };
}
