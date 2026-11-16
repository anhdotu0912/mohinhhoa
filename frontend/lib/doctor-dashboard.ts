import type { PatientComplianceOut } from "./types";

export type DashboardDay = {
  date: string;
  label: string;
  rate: number | null;
  patients: number;
  future: boolean;
};

export function shiftCalendarDate(iso: string, offset: number): string {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function complianceWeek(rows: PatientComplianceOut[], today: string, previous = false) {
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const start = shiftCalendarDate(today, -((weekday + 6) % 7) - (previous ? 7 : 0));
  const end = shiftCalendarDate(start, 6);
  const byDate = new Map<string, Map<string, number>>();
  for (const row of rows) {
    for (const point of row.daily_series) {
      if (point.date < start || point.date > end || point.date > today || point.adherence_pct == null) continue;
      if (!Number.isFinite(point.adherence_pct) || point.adherence_pct < 0 || point.adherence_pct > 100) continue;
      const patients = byDate.get(point.date) ?? new Map<string, number>();
      patients.set(row.patient_id, point.adherence_pct);
      byDate.set(point.date, patients);
    }
  }
  let total = 0;
  let observations = 0;
  const patientIds = new Set<string>();
  const days: DashboardDay[] = Array.from({ length: 7 }, (_, index) => {
    const date = shiftCalendarDate(start, index);
    const recorded = byDate.get(date) ?? new Map<string, number>();
    let sum = 0;
    for (const [id, value] of recorded) {
      patientIds.add(id);
      sum += value;
    }
    total += sum;
    observations += recorded.size;
    return { date, label: ["T2", "T3", "T4", "T5", "T6", "T7", "CN"][index], rate: recorded.size ? Math.round(sum / recorded.size) : null, patients: recorded.size, future: date > today };
  });
  return { start, end, days, average: observations ? Math.round(total / observations) : null, patients: patientIds.size, observations };
}

export function shortDashboardDate(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}
