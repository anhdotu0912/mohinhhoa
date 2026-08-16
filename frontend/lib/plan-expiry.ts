import type { MealPlanOutput } from "./types";
import type { Patient } from "./mock-data";

export type PlanExpiryBucket = "expiring" | "expired" | "ok" | "none";
export type PlanUsageStatus = "active" | "upcoming" | "finished" | "none";
export type TimeFilterPreset = "all" | "today" | "week" | "month" | "custom";
export type ScheduleSlotKey = "current" | "next" | "empty";
export type ScheduleOccupancy = "empty" | "active" | "upcoming" | "past";
export type ScheduleAction = "add" | "replace" | "view";

const EXPIRING_THRESHOLD_DAYS = 2;
const DEFAULT_DURATION = 7;

export function durationDays(daysCount?: number | null): number {
  return Math.max(1, daysCount ?? DEFAULT_DURATION);
}

/** Parse dd/mm/yyyy or ISO date string to local midnight Date. */
export function parseFlexibleDate(str: string | null | undefined): Date | null {
  if (!str) return null;
  const trimmed = str.trim();
  const vnMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (vnMatch) {
    const day = parseInt(vnMatch[1], 10);
    const month = parseInt(vnMatch[2], 10) - 1;
    const year = parseInt(vnMatch[3], 10);
    const d = new Date(year, month, day);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    const d = new Date(year, month, day);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

export function formatDateIso(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateShort(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

export function formatDateFull(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function bucketFromDaysLeft(daysLeft: number | null): PlanExpiryBucket {
  if (daysLeft === null) return "none";
  if (daysLeft <= 0) return "expired";
  if (daysLeft <= EXPIRING_THRESHOLD_DAYS) return "expiring";
  return "ok";
}

export interface PlanValidityRange {
  start: Date;
  end: Date;
  daysLeft: number;
  bucket: PlanExpiryBucket;
  endDateLabel: string;
  startDateLabel: string;
}

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

export function computeValidityFromEndDate(
  planEndDate: string,
  daysCount?: number | null,
  today: Date = new Date()
): PlanValidityRange | null {
  const end = parseFlexibleDate(planEndDate);
  if (!end) return null;
  const duration = durationDays(daysCount);
  const start = new Date(end);
  start.setDate(start.getDate() - (duration - 1));
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const todayNorm = new Date(today);
  todayNorm.setHours(0, 0, 0, 0);
  const left = daysBetween(todayNorm, end);
  return {
    start,
    end,
    daysLeft: left,
    bucket: bucketFromDaysLeft(left),
    endDateLabel: formatDateFull(end),
    startDateLabel: formatDateFull(start),
  };
}

export function computeValidityFromCreatedAt(
  createdAt: string | null | undefined,
  daysCount?: number | null,
  today: Date = new Date()
): PlanValidityRange | null {
  const start = parseFlexibleDate(createdAt ?? "");
  if (!start) return null;
  const duration = durationDays(daysCount);
  const end = new Date(start);
  end.setDate(end.getDate() + (duration - 1));
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const todayNorm = new Date(today);
  todayNorm.setHours(0, 0, 0, 0);
  const left = daysBetween(todayNorm, end);
  return {
    start,
    end,
    daysLeft: left,
    bucket: bucketFromDaysLeft(left),
    endDateLabel: formatDateFull(end),
    startDateLabel: formatDateFull(start),
  };
}

export function computeMealPlanValidity(
  plan: MealPlanOutput,
  _options?: {
    isLatest?: boolean;
    apiEndDate?: string | null;
    apiDaysLeft?: number | null;
    apiBucket?: PlanExpiryBucket | null;
  }
): PlanValidityRange | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Apply-time window only (ADR-011). Unassigned plans have no validity dates —
  // do not inherit the patient's active plan or invent a range from created_at.
  if (plan.starts_on && plan.ends_on) {
    const start = parseFlexibleDate(plan.starts_on);
    const end = parseFlexibleDate(plan.ends_on);
    if (start && end) {
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      const left = daysBetween(today, end);
      return {
        start,
        end,
        daysLeft: left,
        bucket: bucketFromDaysLeft(left),
        endDateLabel: formatDateFull(end),
        startDateLabel: formatDateFull(start),
      };
    }
  }

  return null;
}

export function isReviewedPlanStatus(status: string): boolean {
  return status === "approved" || status === "edited";
}

export function patientUsageStatus(patient: Patient): PlanUsageStatus {
  if (patient.planUsage === "active") return "active";
  if (patient.planUsage === "finished") return "finished";
  if (patient.planUsage === "none") return "none";
  if (!isReviewedPlanStatus(patient.latestPlanStatus ?? "")) return "none";
  const expiry = patient.planExpiry;
  if (expiry === "expired") return "finished";
  if (expiry === "ok" || expiry === "expiring") return "active";
  return "none";
}

export function patientUsageLabel(status: PlanUsageStatus): string {
  switch (status) {
    case "active":
      return "Đang sử dụng";
    case "upcoming":
      return "Sắp áp dụng";
    case "finished":
      return "Đã dùng xong";
    default:
      return "Chưa có thực đơn";
  }
}

export function planCardUsageLabel(
  usage: PlanUsageStatus,
  hasValidity: boolean
): string {
  if (usage === "none") {
    return hasValidity ? "Đã thay thế" : "Chưa xếp lịch";
  }
  return patientUsageLabel(usage);
}

export function patientValidityRange(patient: Patient): PlanValidityRange | null {
  if (!patient.planEndDate || !isReviewedPlanStatus(patient.latestPlanStatus ?? "")) {
    return null;
  }
  return computeValidityFromEndDate(patient.planEndDate, DEFAULT_DURATION);
}

function getFilterRange(
  preset: TimeFilterPreset,
  customStart: string,
  customEnd: string,
  reference: Date = new Date()
): { start: Date; end: Date } | null {
  if (preset === "all") return null;

  const ref = new Date(reference);
  ref.setHours(0, 0, 0, 0);

  if (preset === "today") {
    return { start: new Date(ref), end: new Date(ref) };
  }

  if (preset === "week") {
    const monday = getMonday(ref);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    return { start: monday, end: sunday };
  }

  if (preset === "month") {
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    return { start, end };
  }

  if (preset === "custom") {
    const start = customStart
      ? new Date(customStart + "T00:00:00")
      : new Date(0);
    const end = customEnd
      ? new Date(customEnd + "T23:59:59")
      : new Date(8640000000000000);
    if (customStart) start.setHours(0, 0, 0, 0);
    if (customEnd) end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  return null;
}

/** True if plan validity range overlaps filter window; null range only passes when preset=all. */
export function matchesValidityTimeFilter(
  planRange: PlanValidityRange | null,
  preset: TimeFilterPreset,
  customStart: string,
  customEnd: string
): boolean {
  if (preset === "all") return true;
  if (!planRange) return false;

  const filter = getFilterRange(preset, customStart, customEnd);
  if (!filter) return true;

  return (
    planRange.start.getTime() <= filter.end.getTime() &&
    planRange.end.getTime() >= filter.start.getTime()
  );
}

/** Map day_index + plan to ISO calendar date for grid cells. */
export function dayIsoForPlan(
  plan: MealPlanOutput,
  dayIndex: number,
  validity?: PlanValidityRange | null
): string | null {
  const day = plan.days?.find((d) => d.day_index === dayIndex);
  if (day?.date) {
    const parsed = parseFlexibleDate(day.date);
    if (parsed) return formatDateIso(parsed);
  }
  if (validity) {
    const d = new Date(validity.start);
    d.setDate(d.getDate() + (dayIndex - 1));
    return formatDateIso(d);
  }
  if (plan.created_at) {
    const start = parseFlexibleDate(plan.created_at);
    if (start) {
      const d = new Date(start);
      d.setDate(d.getDate() + (dayIndex - 1));
      return formatDateIso(d);
    }
  }
  return null;
}

export function planUsageFromValidity(
  validity: PlanValidityRange | null,
  today: Date = new Date()
): PlanUsageStatus {
  if (!validity) return "none";
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  const start = new Date(validity.start);
  const end = new Date(validity.end);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  if (start.getTime() <= t.getTime() && t.getTime() <= end.getTime()) {
    return "active";
  }
  if (t.getTime() < start.getTime()) return "upcoming";
  return "finished";
}

/** Per-plan occupancy. At most one plan covering today is `active`. */
export function planUsageFromPlan(
  plan: Pick<MealPlanOutput, "id" | "status" | "starts_on" | "ends_on">,
  options?: { today?: Date; activePlanId?: string | null }
): PlanUsageStatus {
  if (!isReviewedPlanStatus(plan.status)) return "none";
  if (!plan.starts_on || !plan.ends_on) return "none";
  const start = parseFlexibleDate(plan.starts_on);
  const end = parseFlexibleDate(plan.ends_on);
  if (!start || !end) return "none";

  const today = new Date(options?.today ?? new Date());
  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  if (start.getTime() <= today.getTime() && today.getTime() <= end.getTime()) {
    if (options?.activePlanId && plan.id !== options.activePlanId) {
      return "none";
    }
    return "active";
  }
  if (today.getTime() < start.getTime()) return "upcoming";
  return "finished";
}
