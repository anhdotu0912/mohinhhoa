import assert from "node:assert/strict";
import { mealPlanCalendarDays, vietnamTodayIso } from "./meal-plan-calendar";
import { bucketFromDaysLeft, parseFlexibleDate, patientUsageLabel, planUsageFromPlan } from "./plan-expiry";

const plan = { id: "test", status: "approved", starts_on: "2026-11-11", ends_on: "2026-11-17" };
assert.equal(vietnamTodayIso(new Date("2026-11-17T16:59:59Z")), "2026-11-17");
assert.equal(vietnamTodayIso(new Date("2026-11-17T17:00:00Z")), "2026-11-18");
assert.equal(bucketFromDaysLeft(0), "expiring");
assert.equal(bucketFromDaysLeft(-1), "expired");
assert.equal(planUsageFromPlan(plan, { today: parseFlexibleDate("2026-11-17")! }), "active");
assert.equal(planUsageFromPlan(plan, { today: parseFlexibleDate("2026-11-18")! }), "finished");
assert.equal(patientUsageLabel("finished"), "Hoàn thành");
assert.equal(planUsageFromPlan({ ...plan, starts_on: null, ends_on: null }), "none");
const days = mealPlanCalendarDays(plan);
assert.equal(days[0].full, "Thứ 4"); // Cycles can start on any weekday.
assert.equal(days[0].date, "2026-11-11");
assert.equal(days[6].full, "Thứ 3");
assert.equal(days[6].date, "2026-11-17");
assert.equal(mealPlanCalendarDays(null)[0].full, "Ngày 1");
assert.equal(mealPlanCalendarDays(null)[0].date, null);
console.log("Meal-plan calendar and completion checks passed.");
