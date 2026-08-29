import { doctorReviewHref } from "@/lib/doctor-routes";

/** Navigation helpers for meal plan review / history routes. */

export function buildReviewHref(patientId: string, planId: string): string {
  return doctorReviewHref(patientId, planId);
}

export function buildHistoryHref(patientId: string, startsOn?: string | null): string {
  const base = `/doctor/patients/${encodeURIComponent(patientId)}/history`;
  if (!startsOn) return base;
  return `${base}?week=${encodeURIComponent(startsOn.slice(0, 10))}`;
}
