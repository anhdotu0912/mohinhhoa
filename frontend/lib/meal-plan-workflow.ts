import type { MealPlanOutput, MealPlanScheduleOut } from "./types";

export function mealPlanHistory(schedule: MealPlanScheduleOut): MealPlanOutput[] {
  const plans = new Map<string, MealPlanOutput>();
  for (const plan of schedule.history_plans ?? []) plans.set(plan.id, plan);
  for (const slot of schedule.slots) {
    if (slot.occupancy === "past" && slot.plan) plans.set(slot.plan.id, slot.plan);
  }
  return [...plans.values()].sort((a, b) =>
    (b.ends_on ?? b.created_at ?? "").localeCompare(a.ends_on ?? a.created_at ?? "")
  );
}

/** History is shown in the journal; it must never become the current creation request. */
export function selectCreationPlan(schedule: MealPlanScheduleOut): MealPlanOutput | null {
  const historical = new Set(mealPlanHistory(schedule).map((plan) => plan.id));
  const current = schedule.unassigned_plans.filter((plan) => !historical.has(plan.id));
  return current.find((plan) => plan.status === "pending_review") ?? current[0]
    ?? schedule.active_plan
    ?? schedule.slots.find((slot) => slot.occupancy === "upcoming" && slot.plan)?.plan
    ?? (schedule.latest_plan?.status === "rejected" && !historical.has(schedule.latest_plan.id)
      ? schedule.latest_plan : null);
}
