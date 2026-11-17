import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DailyMealProgress } from "../components/patient-chat/DailyMealProgress";
import { latestMealLog, patientMealDay, patientMealProgress } from "./patient-meal-progress";
import type { FoodLogEntry, MealPlanOutput } from "./types";

const plan = {
  id: "fixture-plan", user_id: "fixture-patient", status: "approved", starts_on: "2026-11-11", ends_on: "2026-11-17",
  days: Array.from({ length: 7 }, (_, index) => ({ day_index: index + 1, meals: ["breakfast", "lunch", "dinner", "snack"].map((slot) => ({ slot, items: [] })), totals: {}, warnings: [] })),
  swaps: [], citations: [], profile_snapshot: {},
} as MealPlanOutput;
const log = (overrides: Partial<FoodLogEntry> = {}): FoodLogEntry => ({ id: "fixture-log", user_id: "fixture-patient", meal_plan_id: plan.id, day_index: 7, slot: "morning", type: "as_planned", status: "logged", alert_ids: [], logged_at: "2026-11-17T01:00:00Z", ...overrides });

// The active cycle starts Wednesday: Tuesday must show day 7, never day 2.
assert.equal(patientMealDay(plan, "2026-11-17")?.day_index, 7);
assert.equal(patientMealDay(plan, "2026-11-11")?.day_index, 1);
assert.equal(patientMealDay(plan, "2026-11-10"), null);
assert.equal(patientMealDay(plan, "2026-11-18"), null);
assert.equal(patientMealDay({ ...plan, status: "pending_review" }, "2026-11-17"), null);
assert.equal(patientMealDay({ ...plan, starts_on: null }, "2026-11-17"), null);
assert.equal(patientMealDay({ ...plan, days: plan.days.slice(0, 6) }, "2026-11-17"), null);

// Naive backend timestamps are UTC. Vietnam midnight changes the log's day.
assert.ok(latestMealLog([log({ logged_at: "2026-11-16T17:05:00" })], plan.id, "2026-11-17", "breakfast"));
assert.equal(latestMealLog([log({ logged_at: "2026-11-17T17:05:00Z" })], plan.id, "2026-11-17", "morning"), null);
assert.equal(latestMealLog([log({ meal_plan_id: "old-plan" })], plan.id, "2026-11-17", "morning"), null);
assert.equal(latestMealLog([log({ logged_at: "invalid" })], plan.id, "2026-11-17", "morning"), null);

const mixedLogs = [log(), log({ id: "custom-lunch", slot: "noon", type: "custom", note: "fixture food" })];
const progress = patientMealProgress(plan, "2026-11-17", mixedLogs);
assert.equal(progress.total, 4);
assert.equal(progress.recorded, 2);
assert.equal(progress.planned, 1);
assert.equal(progress.custom, 1);
assert.equal(progress.meals.find((meal) => meal.slot === "evening")?.log, null);
assert.equal(patientMealProgress(null, "2026-11-17", mixedLogs).recorded, 0);
assert.equal(patientMealProgress(plan, "2026-11-10", mixedLogs).total, 0);
assert.equal(patientMealProgress(plan, "2026-11-17", [log({ type: "custom", logged_at: "2026-11-17T00:00:00Z" }), log()]).planned, 1);
const threeMeals = { ...plan, days: plan.days.map((day) => ({ ...day, meals: day.meals.slice(0, 3) })) };
assert.equal(patientMealProgress(threeMeals, "2026-11-17", []).total, 3);

const props = { plan, logs: mixedLogs, today: "2026-11-17", loading: false, error: null, onRetry() {}, onRecord() {}, onNavigate() {} };
const html = renderToStaticMarkup(createElement(DailyMealProgress, props));
assert.match(html, /2\/4 bữa đã ghi/);
assert.match(html, /Đã ăn đúng/);
assert.match(html, /Đã ăn khác/);
assert.match(html, /Chưa ghi/);
assert.match(html, /Còn 2 bữa chưa ghi/);
assert.doesNotMatch(html, /Đã ghi đủ/);
const completeCustom = renderToStaticMarkup(createElement(DailyMealProgress, { ...props, logs: [log(), log({ slot: "noon" }), log({ slot: "evening" }), log({ slot: "snack", type: "custom" })] }));
assert.match(completeCustom, /Đã ghi đủ · Có bữa ăn khác/);
assert.doesNotMatch(completeCustom, /Đã ghi đủ · Ăn đúng thực đơn/);
const completePlanned = renderToStaticMarkup(createElement(DailyMealProgress, { ...props, logs: [log(), log({ slot: "noon" }), log({ slot: "evening" }), log({ slot: "snack" })] }));
assert.match(completePlanned, /Đã ghi đủ · Ăn đúng thực đơn/);
const missingPlan = renderToStaticMarkup(createElement(DailyMealProgress, { ...props, plan: null }));
assert.match(missingPlan, /chưa có thực đơn đang áp dụng/);
assert.doesNotMatch(missingPlan, /bữa đã ghi/);
const failed = renderToStaticMarkup(createElement(DailyMealProgress, { ...props, error: "fixture load failed" }));
assert.match(failed, /fixture load failed/);
assert.doesNotMatch(failed, /bữa đã ghi/);
console.log("PASS: cycle dates, Vietnam log dates, plan isolation, latest log, missing data, custom meals and patient status rendering.");
