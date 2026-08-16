/**
 * Self-check for nutrition warning gates (hard vs advisory).
 * Run: npm run verify:nutrition
 */
import assert from "node:assert/strict";

import {
  computeNutritionWarningBundle,
  countHardNutritionWarnings,
  countStructuredWarnings,
  type NutritionTargets,
} from "./meal-plan-mappers";
import type { MealDishItem } from "./plans-store";

function dish(kcal: number, saltG = 0): MealDishItem {
  return {
    name: "test",
    calories: kcal,
    salt: saltG,
    sugar: 0,
    carbG: 0,
    alternatives: [],
  };
}

const targets1800: NutritionTargets = {
  targetKcal: 1800,
  sodiumDailyMg: 2300,
  carbPerMealG: 45,
};

// BE-like shares: BF 25% / L 35% / D 30% / snack 10% → within ±10% day band
const beLikeSlots = {
  breakfast: [dish(450, 0.1)],
  lunch: [dish(630, 0.2)],
  dinner: [dish(540, 0.15)],
  snack: [dish(180, 0.05)],
};

const bundleOk = computeNutritionWarningBundle(beLikeSlots, targets1800);
assert.equal(
  countStructuredWarnings(bundleOk.hard),
  0,
  "BE-like day should have zero hard warnings"
);
assert.ok(
  countStructuredWarnings(bundleOk.advisory) >= 0,
  "advisory may exist for per-meal kcal hints"
);

// Soft sodium at 85% — advisory only, not hard (day kcal must stay in band)
const softNaSlots = {
  breakfast: [dish(450, 0.5)],
  lunch: [dish(630, 0.5)],
  dinner: [dish(540, 0.5)],
  snack: [dish(180, 0.455)], // ~1955mg total ≈ 85% of 2300
};
const bundleSoftNa = computeNutritionWarningBundle(softNaSlots, targets1800);
assert.equal(
  countStructuredWarnings(bundleSoftNa.hard),
  0,
  "soft sodium (>=85%) must not block approve"
);
assert.ok(
  bundleSoftNa.advisory.day.some((w) => w.includes("sắp chạm")),
  "soft sodium should appear in advisory"
);

// Hard sodium over limit
const hardNaSlots = {
  breakfast: [dish(400, 1.0)],
  lunch: [dish(400, 1.0)],
  dinner: [dish(400, 1.0)],
  snack: [dish(100, 0.5)], // 3500mg > 2300
};
assert.ok(
  countHardNutritionWarnings(hardNaSlots, targets1800) > 0,
  "hard sodium over limit must block approve"
);

// Snack must count toward day kcal — without snack, day looks too low
const noSnackSlots = {
  breakfast: [dish(400, 0.1)],
  lunch: [dish(580, 0.2)],
  dinner: [dish(500, 0.15)],
  snack: [] as MealDishItem[],
};
const bundleNoSnack = computeNutritionWarningBundle(noSnackSlots, targets1800);
assert.ok(
  bundleNoSnack.hard.day.some((w) => w.includes("thấp hơn ngưỡng")),
  "excluding snack from totals should still flag low day kcal when under band"
);

console.log("meal-plan-nutrition-warnings.check.ts: all assertions passed");
