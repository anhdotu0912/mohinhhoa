/** Meal plan slot intent — passed generate → review → apply (ADR-012). */

export type SlotIntentAction = "add" | "replace";
export type SlotIntentKey = "current" | "next" | "empty";

export interface MealPlanSlotIntent {
  patientId: string;
  action: SlotIntentAction;
  slotKey: SlotIntentKey;
  startsOn: string;
  replaceActive: boolean;
  planId?: string;
}

const STORAGE_KEY = "vmec-meal-plan-slot-intent";

type SearchLike = { get(name: string): string | null };

function normalizeDate(value: string): string {
  return value.slice(0, 10);
}

export function saveSlotIntent(intent: MealPlanSlotIntent): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...intent, startsOn: normalizeDate(intent.startsOn) })
  );
}

export function loadSlotIntent(patientId?: string, planId?: string): MealPlanSlotIntent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const intent = JSON.parse(raw) as MealPlanSlotIntent;
    if (patientId && intent.patientId !== patientId) return null;
    if (planId && intent.planId && intent.planId !== planId) return null;
    return { ...intent, startsOn: normalizeDate(intent.startsOn) };
  } catch {
    return null;
  }
}

export function clearSlotIntent(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}

export function parseSlotIntentParams(
  patientId: string,
  params: SearchLike
): MealPlanSlotIntent | null {
  const intent = params.get("intent");
  const slot = params.get("slot");
  const startsOn = params.get("starts_on");
  if (!patientId || !intent || !slot || !startsOn) return null;
  if (intent !== "add" && intent !== "replace") return null;
  if (slot !== "current" && slot !== "next" && slot !== "empty") return null;
  return {
    patientId,
    action: intent,
    slotKey: slot,
    startsOn: normalizeDate(startsOn),
    replaceActive: intent === "replace",
  };
}

export function slotIntentQuery(
  intent: Pick<MealPlanSlotIntent, "action" | "slotKey" | "startsOn">
): string {
  return new URLSearchParams({
    intent: intent.action,
    slot: intent.slotKey,
    starts_on: normalizeDate(intent.startsOn),
  }).toString();
}

export function buildGenerateHref(
  patientId: string,
  intent: Pick<MealPlanSlotIntent, "action" | "slotKey" | "startsOn">
): string {
  return `/doctor/patients/${encodeURIComponent(patientId)}/generate?${slotIntentQuery(intent)}`;
}

export function buildReviewHref(
  patientId: string,
  planId: string,
  intent?: Pick<MealPlanSlotIntent, "action" | "slotKey" | "startsOn"> | null
): string {
  const base = `/doctor/reviews/${encodeURIComponent(patientId)}/${encodeURIComponent(planId)}`;
  if (!intent) return base;
  return `${base}?${slotIntentQuery(intent)}`;
}

export function buildHistoryHref(patientId: string, startsOn?: string | null): string {
  const base = `/doctor/patients/${encodeURIComponent(patientId)}/history`;
  if (!startsOn) return base;
  return `${base}?week=${encodeURIComponent(normalizeDate(startsOn))}`;
}

export function intentFromSlot(
  patientId: string,
  slot: { slot_key: string; starts_on: string },
  action: SlotIntentAction
): MealPlanSlotIntent {
  const slotKey: SlotIntentKey =
    slot.slot_key === "current" || slot.slot_key === "next" || slot.slot_key === "empty"
      ? slot.slot_key
      : "empty";
  return {
    patientId,
    action,
    slotKey,
    startsOn: normalizeDate(slot.starts_on),
    replaceActive: action === "replace",
  };
}
