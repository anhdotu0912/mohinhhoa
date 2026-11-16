import assert from "node:assert/strict";
import { complianceWeek } from "./doctor-dashboard";
import type { PatientComplianceOut } from "./types";

const row = (id: string, points: [string, number | null][]) => ({
  patient_id: id, daily_series: points.map(([date, adherence_pct]) => ({ date, adherence_pct })),
} as PatientComplianceOut);

// Missing days stay null, while a real recorded zero remains a measured zero.
const monday = complianceWeek([
  row("a", [["2026-11-16", 0], ["2026-11-17", 100]]),
  row("b", [["2026-11-16", null]]),
], "2026-11-16");
assert.equal(monday.start, "2026-11-16");
assert.equal(monday.end, "2026-11-22");
assert.equal(monday.average, 0);
assert.equal(monday.patients, 1);
assert.equal(monday.days[1].rate, null);
assert.equal(monday.days[1].future, true);
assert.equal(complianceWeek([], "2026-11-16").average, null);

// Align by ISO date, never array position; the mean uses observed patient-days.
const previous = complianceWeek([
  row("a", [["2026-11-09", 100], ["2026-11-10", 0]]),
  row("b", [["2026-11-10", 100], ["2026-11-09", null]]),
], "2026-11-16", true);
assert.equal(previous.start, "2026-11-09");
assert.equal(previous.average, 67);
assert.equal(previous.days[0].rate, 100);
assert.equal(previous.days[1].rate, 50);
assert.equal(previous.days[1].patients, 2);
assert.equal(previous.days[2].rate, null);
assert.equal(previous.observations, 3);

// Calendar boundaries work across year changes and Sunday.
assert.equal(complianceWeek([], "2027-01-01").start, "2026-12-28");
assert.equal(complianceWeek([], "2026-11-22").start, "2026-11-16");
assert.equal(complianceWeek([row("a", [["2026-11-16", 200]])], "2026-11-16").average, null);
console.log("Dashboard aggregation checks passed.");
