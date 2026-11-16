import assert from "node:assert/strict";
import type { MealPlanOutput, MealPlanScheduleOut } from "./types";
import { mealPlanHistory, selectCreationPlan } from "./meal-plan-workflow";

const old = { id: "old", status: "approved", starts_on: null, ends_on: null, created_at: "2026-11-03" } as MealPlanOutput;
const schedule = { slots: [], unassigned_plans: [], active_plan: null, latest_plan: old, history_plans: [old] } as unknown as MealPlanScheduleOut;
assert.equal(selectCreationPlan(schedule), null);
assert.deepEqual(mealPlanHistory(schedule).map((p) => p.id), ["old"]);
assert.equal(selectCreationPlan({ ...schedule, unassigned_plans: [old] }), null);
const fresh = { ...old, id: "fresh", status: "pending_review", created_at: "2026-11-16" };
assert.equal(selectCreationPlan({ ...schedule, unassigned_plans: [fresh], latest_plan: fresh })?.id, "fresh");
const completed = { ...old, id: "completed", starts_on: "2026-11-01", ends_on: "2026-11-07" };
const appliedHistory = { ...schedule, history_plans: [completed], latest_plan: completed };
assert.equal(selectCreationPlan(appliedHistory), null);
assert.equal(mealPlanHistory(appliedHistory)[0].id, "completed");
console.log("Creation page and journal workflow checks passed.");
