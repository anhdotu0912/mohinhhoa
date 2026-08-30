/**
 * Self-check for nutrition warning gates (hard vs advisory).
 * Run: npm run verify:nutrition
 */
import assert from "node:assert/strict";

import {
  computeNutritionWarningBundle,
  countHardNutritionWarnings,
  countStructuredWarnings,
  formatPortionLabel,
  mergeNutritionTargets,
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
  carbDisplayLimit: 45,
  sugarDisplayLimit: 25,
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

function dishCarb(kcal: number, carbG: number): MealDishItem {
  return { ...dish(kcal, 0.1), carbG };
}

const overCarbSlots = {
  breakfast: [dishCarb(450, 50)],
  lunch: [dishCarb(630, 40)],
  dinner: [dishCarb(540, 40)],
  snack: [dishCarb(180, 10)],
};
const bundleCarb = computeNutritionWarningBundle(overCarbSlots, {
  ...targets1800,
  carbPerMealG: 45,
});
assert.ok(
  bundleCarb.hard.breakfast.some((w) => w.toLowerCase().includes("carb")),
  "carb/bữa over clinical ceiling must be a hard warning"
);
assert.equal(
  bundleCarb.hard.lunch.length,
  0,
  "carb under ceiling must not block that slot"
);

function dishSugar(kcal: number, sugar: number): MealDishItem {
  return { ...dish(kcal, 0.1), sugar };
}

const overSugarSlots = {
  breakfast: [dishSugar(450, 10)],
  lunch: [dishSugar(630, 10)],
  dinner: [dishSugar(540, 8)],
  snack: [dishSugar(180, 2)], // 30g > 25
};
const bundleSugar = computeNutritionWarningBundle(overSugarSlots, {
  ...targets1800,
  sugarDailyG: 25,
});
assert.ok(
  bundleSugar.hard.day.some((w) => w.toLowerCase().includes("đường")),
  "sugar over clinical ceiling must block approve"
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

assert.equal(
  formatPortionLabel("100.0g phần ăn được (×1.52)"),
  "152 g",
  "scaled gram portion should show actual grams"
);
assert.equal(formatPortionLabel("100.0g phần ăn được"), "100 g");
assert.equal(formatPortionLabel("1 bát (~250ml)"), "1 bát (~250ml)");
assert.equal(formatPortionLabel("1 bát (~250ml) (×1.20)"), "1 bát (~300ml)");
assert.equal(formatPortionLabel("1 phần theo công thức (×1.47)"), "1.5 phần");
assert.equal(formatPortionLabel("1 phần theo công thức"), "1 phần");
assert.equal(formatPortionLabel("1 đĩa (x1.50)"), "1.5 đĩa");

const mergedEmpty = mergeNutritionTargets(
  { target_kcal: 1800, restrictions: { carb_per_meal: null, sugar_daily_g: null, sodium_daily: null } },
  { carbPerMeal: 45, sugarDailyG: 25, sodiumDaily: 2300, saltDailyG: 5 }
);
assert.equal(mergedEmpty.carbDisplayLimit, 45, "dashboard shows live carb ceiling when snapshot is empty");
assert.equal(mergedEmpty.sugarDisplayLimit, 25, "dashboard shows live sugar ceiling when snapshot is empty");
assert.equal(mergedEmpty.saltDisplayG, 5, "dashboard shows live salt ceiling in grams");
assert.equal(mergedEmpty.carbPerMealG, null, "hard carb gate follows snapshot only");
assert.equal(mergedEmpty.sodiumDailyMg, null, "hard sodium gate follows snapshot only");

const mergedSnap = mergeNutritionTargets(
  { target_kcal: 1800, restrictions: { carb_per_meal: 50, sugar_daily_g: 30 } },
  { carbPerMeal: 45, sugarDailyG: 25 }
);
assert.equal(mergedSnap.carbDisplayLimit, 50);
assert.equal(mergedSnap.sugarDisplayLimit, 30);

console.log("meal-plan-nutrition-warnings.check.ts: all assertions passed");
