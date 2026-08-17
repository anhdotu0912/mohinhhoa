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
 * Exactly 3 columns: tuần trước, tuần hiện tại, tuần sau.
 * If tuần hiện tại is empty, show the latest unassigned plan there.
 */
export function visibleScheduleSlots(
  schedule: MealPlanScheduleOut
): MealPlanScheduleSlot[] {
  const current = schedule.slots.find((s) => s.slot_key === "current");
  const next = schedule.slots.find((s) => s.slot_key === "next");
  if (!current || !next) return schedule.slots.slice(0, 3);

  let currentDisplay: MealPlanScheduleSlot = { ...current };
  if (!currentDisplay.plan && currentDisplay.occupancy === "empty") {
    const preview = schedule.unassigned_plans[0];
    if (preview) {
      currentDisplay = {
        ...currentDisplay,
        plan: preview,
        actions: currentDisplay.actions.includes("view")
          ? currentDisplay.actions
          : ["view", ...currentDisplay.actions],
      };
    }
  }

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

  return [past, currentDisplay, { ...next }];
}

export function displaySlotTitle(index: number): string {
  if (index === 0) return "Tuần trước";
  if (index === 1) return "Tuần hiện tại";
  if (index === 2) return "Tuần sau";
  return "Tuần";
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
  if (slot.slot_key === "current") return "Tuần hiện tại";
  if (slot.slot_key === "next") return "Tuần sau";
  if (slot.occupancy === "upcoming") return "Tuần đã xếp";
  if (slot.occupancy === "past") return "Tuần trước";
  return "Tuần trống";
}

export function slotAllowsAdd(slot: MealPlanScheduleSlot, todayIso?: string): boolean {
  if (!slot.actions.includes("add")) return false;
  if (slot.occupancy === "past" || isPastWindow(slot, todayIso)) return false;
  return true;
}
