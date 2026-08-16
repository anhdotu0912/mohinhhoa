/** Meal plan slot intent — passed generate → review → apply (ADR-012). */

export type SlotIntentAction = "add" | "replace";
export type SlotIntentKey = "current" | "next" | "empty";

export interface MealPlanSlotIntent {
  patientId: string;
  action: SlotIntentAction;
  slotKey: SlotIntentKey;
  startsOn: string;
  replaceActive: boolean;
}

const STORAGE_KEY = "vmec-meal-plan-slot-intent";

export function saveSlotIntent(intent: MealPlanSlotIntent): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(intent));
}

export function loadSlotIntent(patientId?: string): MealPlanSlotIntent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const intent = JSON.parse(raw) as MealPlanSlotIntent;
    if (patientId && intent.patientId !== patientId) return null;
    return intent;
  } catch {
    return null;
  }
}

export function clearSlotIntent(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}

export function buildGenerateHref(
  patientId: string,
  intent: Pick<MealPlanSlotIntent, "action" | "slotKey" | "startsOn">
): string {
  const params = new URLSearchParams({
    intent: intent.action,
    slot: intent.slotKey,
    starts_on: intent.startsOn,
  });
  return `/doctor/patients/${encodeURIComponent(patientId)}/generate?${params}`;
}
