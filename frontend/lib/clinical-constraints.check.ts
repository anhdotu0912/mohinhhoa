/**
 * Self-check for clinical constraint ranges (keep in sync with BE clinical_limits.py).
 * Run: npm run verify:constraints
 */
import assert from "node:assert/strict";

import {
  CLINICAL_LIMITS,
  clampClinical,
  validateClinicalNumber,
  validateConstraintValues,
  validateTreatmentGoals,
  TREATMENT_GOAL_MAX_LEN,
  TREATMENT_GOALS_MAX_COUNT,
} from "./clinical-constraints";

assert.equal(CLINICAL_LIMITS.target_kcal.min, 800);
assert.equal(CLINICAL_LIMITS.target_kcal.max, 4000);
assert.equal(CLINICAL_LIMITS.carb_per_meal.max, 200);
assert.equal(CLINICAL_LIMITS.sodium_daily.max, 5000);
assert.equal(CLINICAL_LIMITS.salt_daily_g.max, 15);
assert.equal(CLINICAL_LIMITS.sugar_daily_g.max, 100);

assert.equal(clampClinical("target_kcal", 500), 800);
assert.equal(clampClinical("target_kcal", 9000), 4000);
assert.equal(clampClinical("salt_daily_g", null), 5);
assert.equal(clampClinical("carb_per_meal", 45), 45);

assert.equal(validateClinicalNumber("target_kcal", 799), "Năng lượng hợp lệ từ 800–4000 kcal.");
assert.equal(validateClinicalNumber("target_kcal", 1800), null);
assert.equal(validateClinicalNumber("sugar_daily_g", 101), "Đường / ngày hợp lệ từ 0–100 g.");
assert.equal(validateClinicalNumber("salt_daily_g", 15), null);

assert.equal(validateTreatmentGoals(["ab"]), "Mỗi mục tiêu tối thiểu 3 ký tự.");
assert.equal(
  validateTreatmentGoals(["x".repeat(TREATMENT_GOAL_MAX_LEN + 1)]),
  `Mỗi mục tiêu tối đa ${TREATMENT_GOAL_MAX_LEN} ký tự.`
);
assert.equal(
  validateTreatmentGoals(
    Array.from({ length: TREATMENT_GOALS_MAX_COUNT + 1 }, (_, i) => `Mục tiêu ${i}`)
  ),
  `Tối đa ${TREATMENT_GOALS_MAX_COUNT} mục tiêu điều trị.`
);
assert.equal(validateTreatmentGoals(["Kiểm soát đường huyết ổn định."]), null);

assert.equal(
  validateConstraintValues({
    target_kcal: 1800,
    carb_per_meal: 45,
    sodium_daily: 2000,
    salt_daily_g: 5,
    sugar_daily_g: 25,
    treatment_goals: ["Giảm cân nhẹ qua chế độ ăn."],
  }),
  null
);
assert.match(
  validateConstraintValues({
    target_kcal: 1800,
    carb_per_meal: 201,
    sodium_daily: 2000,
    salt_daily_g: 5,
    sugar_daily_g: 25,
  }) ?? "",
  /Carb/
);

console.log("clinical-constraints.check.ts: ok");
