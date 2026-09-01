import { formatDateIso, parseFlexibleDate } from "./plan-expiry";
import type { MealPlanScheduleOut, MealPlanScheduleSlot } from "./types";

function addDaysIso(iso: string, days: number): string {
  const d = parseFlexibleDate(iso);
  if (!d) return iso;
  d.setDate(d.getDate() + days);
  return formatDateIso(d);
}

function isPastWindow(slot: MealPlanScheduleSlot, todayIso?: string): boolean {
  const end = parseFlexibleDate(slot.ends_on);
  const today = parseFlexibleDate(todayIso ?? formatDateIso(new Date()));
  if (!end || !today) return slot.occupancy === "past";
  return end.getTime() < today.getTime();
}

/** Default the history view to tuần hiện tại. */
export function pickDefaultSlot(
  schedule: MealPlanScheduleOut
): MealPlanScheduleSlot | null {
  return (
    schedule.slots.find((s) => s.slot_key === "current") ??
    schedule.slots.find((s) => s.occupancy === "active") ??
    schedule.slots.find((s) => s.slot_key === "next") ??
    schedule.slots[0] ??
    null
  );
}

/**
 * Exactly 3 columns: đã qua, đang chạy, xếp sẵn.
 * Empty slots stay empty — unassigned plans are listed separately.
 */
export function visibleScheduleSlots(
  schedule: MealPlanScheduleOut
): MealPlanScheduleSlot[] {
  const current = schedule.slots.find((s) => s.slot_key === "current");
  const next = schedule.slots.find((s) => s.slot_key === "next");
  if (!current || !next) return schedule.slots.slice(0, 3);

  const currentStart = parseFlexibleDate(current.starts_on);
  const pastApplied = [...schedule.slots]
    .filter((s) => s.occupancy === "past" && s.plan)
    .at(-1);
  const pastFitsCurrent =
    pastApplied &&
    currentStart &&
    parseFlexibleDate(pastApplied.ends_on) &&
    parseFlexibleDate(pastApplied.ends_on)!.getTime() < currentStart.getTime();

  const past: MealPlanScheduleSlot = pastFitsCurrent && pastApplied
    ? { ...pastApplied, occupancy: "past", actions: pastApplied.plan ? ["view"] : [] }
    : {
        slot_key: "empty",
        starts_on: addDaysIso(current.starts_on, -7),
        ends_on: addDaysIso(current.starts_on, -1),
        occupancy: "past",
        plan: null,
        actions: ["view"],
      };

  return [past, { ...current }, { ...next }];
}

export function displaySlotTitle(index: number): string {
  if (index === 0) return "Đã qua";
  if (index === 1) return "Đang áp dụng";
  if (index === 2) return "Xếp sẵn";
  return "Chu kỳ";
}

/** First empty week to generate/apply into. Prefer tuần hiện tại when it is still empty. */
export function firstEmptyScheduleSlot(
  schedule: MealPlanScheduleOut
): MealPlanScheduleSlot | null {
  return (
    schedule.slots.find((s) => s.slot_key === "current" && s.occupancy === "empty") ??
    schedule.slots.find((s) => s.slot_key === "next" && s.occupancy === "empty") ??
    schedule.slots.find(
      (s) => s.slot_key === "empty" && s.occupancy === "empty" && s.actions.includes("add")
    ) ??
    schedule.slots.find((s) => s.occupancy === "empty") ??
    null
  );
}

export function slotTitle(slot: MealPlanScheduleSlot): string {
  if (slot.slot_key === "current") return "Đang áp dụng";
  if (slot.slot_key === "next") return "Xếp sẵn";
  if (slot.occupancy === "upcoming") return "Xếp sẵn";
  if (slot.occupancy === "past") return "Đã qua";
  return "Chu kỳ trống";
}

export function slotAllowsAdd(slot: MealPlanScheduleSlot, todayIso?: string): boolean {
  if (!slot.actions.includes("add")) return false;
  if (slot.occupancy === "past" || isPastWindow(slot, todayIso)) return false;
  return true;
}
