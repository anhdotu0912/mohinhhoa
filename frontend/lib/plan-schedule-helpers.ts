import type { MealPlanScheduleOut, MealPlanScheduleSlot } from "./types";

/** First empty slot suitable for adding a new plan (prefers "next"). */
export function firstEmptyScheduleSlot(
  schedule: MealPlanScheduleOut
): MealPlanScheduleSlot | null {
  return (
    schedule.slots.find(
      (s) => s.slot_key === "next" && s.occupancy === "empty"
    ) ??
    schedule.slots.find((s) => s.occupancy === "empty" && s.actions.includes("add")) ??
    schedule.slots.find((s) => s.occupancy === "empty") ??
    null
  );
}
