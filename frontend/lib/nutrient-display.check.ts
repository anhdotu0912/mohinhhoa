/**
 * Self-check for shared nutrient display helpers.
 * Run: npx tsx lib/nutrient-display.check.ts
 */
import assert from "node:assert/strict";

import {
  displaySaltG,
  formatNutrientValue,
  kindsForLayer,
  sodiumDailyFromSaltG,
  sodiumMgToSaltG,
  saltGToSodiumMg,
  toNutrientValues,
} from "./nutrient-display";

assert.equal(sodiumMgToSaltG(2300), 2.3);
assert.equal(saltGToSodiumMg(2.3), 2300);
assert.equal(displaySaltG(5, 2000), 5);
assert.equal(displaySaltG(null, 2000), 2);
assert.equal(displaySaltG(undefined, undefined), null);
assert.equal(sodiumDailyFromSaltG(5), 5000);
assert.equal(sodiumDailyFromSaltG(15), 5000);

const dish = toNutrientValues({
  kcal: 320,
  carbG: 40,
  proteinG: 12,
  fatG: 8,
  sodiumMg: 800,
  sugarG: 6,
});
assert.equal(dish.salt, 0.8);
assert.deepEqual(kindsForLayer("summary", dish), ["kcal", "carb", "salt", "sugar"]);
assert.deepEqual(kindsForLayer("detail", dish), [
  "kcal",
  "carb",
  "protein",
  "fat",
  "salt",
  "sugar",
]);
assert.deepEqual(
  kindsForLayer("detail", { ...dish, protein: 0, fat: 0 }),
  ["kcal", "carb", "salt", "sugar"]
);
assert.equal(formatNutrientValue("kcal", 1800.4), "1800");
assert.equal(formatNutrientValue("salt", 2.3), "2.3");

console.log("nutrient-display.check.ts: ok");
