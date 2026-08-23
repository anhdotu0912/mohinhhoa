import type { DayPlan, DayTotals, FoodItem, Meal, MealPlanOutput } from "@/lib/types";

export type CanonicalSlot = "morning" | "noon" | "evening" | "snack";

export const DEFAULT_MEAL_IMAGES: Record<string, string> = {
  morning:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCy63oLuOJDAmaKRpjFVopv89rdYQENESNjmE7aq_Ocq5jrHK-FH4GgCQR9vK5YZKE3RLentfO1lbIteBFsDnqnrIzn4LYFvI8taELitugsX2t_WedQhDlwtNFs5y9hU2pIiXrC7lePguTix4QtDrL0g3dW0dBVdyMRmIFNu-q5hrSD3rHRDJuBreht0dKaUxvrTNLQ65jCCGDQv-UyRxlfu-xHsVEgiGRWTVTxHlL_H-pkvO10wV_OkQ",
  breakfast:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCy63oLuOJDAmaKRpjFVopv89rdYQENESNjmE7aq_Ocq5jrHK-FH4GgCQR9vK5YZKE3RLentfO1lbIteBFsDnqnrIzn4LYFvI8taELitugsX2t_WedQhDlwtNFs5y9hU2pIiXrC7lePguTix4QtDrL0g3dW0dBVdyMRmIFNu-q5hrSD3rHRDJuBreht0dKaUxvrTNLQ65jCCGDQv-UyRxlfu-xHsVEgiGRWTVTxHlL_H-pkvO10wV_OkQ",
  noon:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuADxt27IKTLgeBaUZZGmclNHqa1yxJ5BdE0hwQFPCghtzkBs-pLnXxtW9rJx9oEEHdsi2YcdIOOe-sJ_ieXqF3meSXctDnCBu_bdGF6O00ujRzs-_rwLYj9GMPyExtZbk6BybfRiv4tdGIw277x0dhVDL-038JXsqgcXBovCGlm_GNZ49AuvnZ74ZowOiWHC9-1EtExtZZAYUgEh-yrRUXoED48SXWnpqysR-Isco73Nyy02z2BTLtdmw",
  lunch:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuADxt27IKTLgeBaUZZGmclNHqa1yxJ5BdE0hwQFPCghtzkBs-pLnXxtW9rJx9oEEHdsi2YcdIOOe-sJ_ieXqF3meSXctDnCBu_bdGF6O00ujRzs-_rwLYj9GMPyExtZbk6BybfRiv4tdGIw277x0dhVDL-038JXsqgcXBovCGlm_GNZ49AuvnZ74ZowOiWHC9-1EtExtZZAYUgEh-yrRUXoED48SXWnpqysR-Isco73Nyy02z2BTLtdmw",
  evening:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuD2oStqvUJaJYckUh0nABnEJ8Ct080LnSnLWI4sl5w6O9GOHregWxmfd5Kv18OPXYPh3r6OLpxuRI9X7zxLm8gxXIqGIBGjVCQJN7KsNoDmYo_EVCUf90JZkUVFlrbTBFU1m_dX_RW3fMInFSM5ldv15Fv4EYzGjOnB2xGQOg6r2NILwjFncmEUHwMc9Gn66Z6roL-wOe1RtpO9zdnVpk5wYh_AXeLPxp7HmrOXOGRVtdwEKAbLW8hq6g",
  dinner:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuD2oStqvUJaJYckUh0nABnEJ8Ct080LnSnLWI4sl5w6O9GOHregWxmfd5Kv18OPXYPh3r6OLpxuRI9X7zxLm8gxXIqGIBGjVCQJN7KsNoDmYo_EVCUf90JZkUVFlrbTBFU1m_dX_RW3fMInFSM5ldv15Fv4EYzGjOnB2xGQOg6r2NILwjFncmEUHwMc9Gn66Z6roL-wOe1RtpO9zdnVpk5wYh_AXeLPxp7HmrOXOGRVtdwEKAbLW8hq6g",
  snack:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuADxt27IKTLgeBaUZZGmclNHqa1yxJ5BdE0hwQFPCghtzkBs-pLnXxtW9rJx9oEEHdsi2YcdIOOe-sJ_ieXqF3meSXctDnCBu_bdGF6O00ujRzs-_rwLYj9GMPyExtZbk6BybfRiv4tdGIw277x0dhVDL-038JXsqgcXBovCGlm_GNZ49AuvnZ74ZowOiWHC9-1EtExtZZAYUgEh-yrRUXoED48SXWnpqysR-Isco73Nyy02z2BTLtdmw",
};

export const SLOT_META: Record<string, { label: string; icon: string }> = {
  morning: { label: "Bữa sáng", icon: "wb_twilight" },
  breakfast: { label: "Bữa sáng", icon: "wb_twilight" },
  noon: { label: "Bữa trưa", icon: "wb_sunny" },
  lunch: { label: "Bữa trưa", icon: "wb_sunny" },
  evening: { label: "Bữa tối", icon: "bedtime" },
  dinner: { label: "Bữa tối", icon: "bedtime" },
  snack: { label: "Bữa phụ", icon: "cookie" },
};

export const DAY_LABELS = [
  { short: "T2", full: "Thứ 2", index: 0 },
  { short: "T3", full: "Thứ 3", index: 1 },
  { short: "T4", full: "Thứ 4", index: 2 },
  { short: "T5", full: "Thứ 5", index: 3 },
  { short: "T6", full: "Thứ 6", index: 4 },
  { short: "T7", full: "Thứ 7", index: 5 },
  { short: "CN", full: "Chủ nhật", index: 6 },
] as const;

export interface MealNutrition {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function normalizeSlot(slot: string): CanonicalSlot {
  if (slot === "breakfast" || slot === "morning") return "morning";
  if (slot === "lunch" || slot === "noon") return "noon";
  if (slot === "dinner" || slot === "evening") return "evening";
  if (slot === "snack") return "snack";
  return "noon";
}

/** Monday = 0 … Sunday = 6 — same as MealLogPanel. */
export function todayDayIndex(now: Date = new Date()): number {
  return (now.getDay() + 6) % 7;
}

export function findDayPlan(
  plan: MealPlanOutput | null | undefined,
  dayIndex: number
): DayPlan | null {
  if (!plan?.days?.length) return null;
  return plan.days.find((d) => d.day_index === dayIndex) ?? null;
}

export function sumMealNutrition(meal: Meal): MealNutrition {
  const items = meal.items ?? [];
  return {
    kcal: Math.round(items.reduce((acc, it) => acc + (it.kcal || 0), 0)),
    protein: Math.round(items.reduce((acc, it) => acc + (it.macros?.protein_g || 0), 0)),
    carbs: Math.round(items.reduce((acc, it) => acc + (it.macros?.carb_g || 0), 0)),
    fat: Math.round(items.reduce((acc, it) => acc + (it.macros?.fat_g || 0), 0)),
  };
}

export function resolveDayNutrition(day: DayPlan | null): MealNutrition {
  if (!day) return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const fromItems = (day.meals ?? []).reduce<MealNutrition>(
    (acc, meal) => {
      const n = sumMealNutrition(meal);
      return {
        kcal: acc.kcal + n.kcal,
        protein: acc.protein + n.protein,
        carbs: acc.carbs + n.carbs,
        fat: acc.fat + n.fat,
      };
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
  const totals = day.totals;
  return {
    kcal: totals?.kcal ? Math.round(totals.kcal) : fromItems.kcal,
    protein: totals?.protein_g ? Math.round(totals.protein_g) : fromItems.protein,
    carbs: totals?.carb_g ? Math.round(totals.carb_g) : fromItems.carbs,
    fat: totals?.fat_g ? Math.round(totals.fat_g) : fromItems.fat,
  };
}

export function slotImage(slot: string): string {
  return DEFAULT_MEAL_IMAGES[slot] || DEFAULT_MEAL_IMAGES[normalizeSlot(slot)] || DEFAULT_MEAL_IMAGES.noon;
}

export function slotMeta(slot: string): { label: string; icon: string } {
  return SLOT_META[slot] || SLOT_META[normalizeSlot(slot)] || { label: slot, icon: "restaurant" };
}

export function isApprovedPlan(plan: MealPlanOutput | null | undefined): boolean {
  return plan?.status === "approved" || plan?.status === "edited";
}

export function mealsToDayTotals(meals: Meal[], previous?: DayTotals | null): DayTotals {
  const nutrition = meals.reduce(
    (acc, meal) => {
      const n = sumMealNutrition(meal);
      return {
        kcal: acc.kcal + n.kcal,
        protein: acc.protein + n.protein,
        carbs: acc.carbs + n.carbs,
        fat: acc.fat + n.fat,
      };
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
  return {
    kcal: nutrition.kcal,
    protein_g: nutrition.protein,
    carb_g: nutrition.carbs,
    fat_g: nutrition.fat,
    sodium_mg: previous?.sodium_mg ?? 0,
  };
}

export function replaceDayMeals(
  plan: MealPlanOutput,
  dayIndex: number,
  meals: Meal[]
): MealPlanOutput {
  return {
    ...plan,
    days: plan.days.map((day) => {
      if (day.day_index !== dayIndex) return day;
      return { ...day, meals, totals: mealsToDayTotals(meals, day.totals) };
    }),
  };
}

function sameFood(a: FoodItem, b: FoodItem): boolean {
  if (a.food_id && b.food_id) return a.food_id === b.food_id;
  return a.name === b.name && a.portion === b.portion;
}

/** Replace the current dish with a chosen alternative; the previous dish stays in the list. */
export function swapFoodItem(current: FoodItem, chosen: FoodItem): FoodItem {
  const previous: FoodItem = { ...current, alternatives: [] };
  const remaining = (current.alternatives ?? []).filter(
    (alt) => Boolean(alt?.name) && !sameFood(alt, chosen)
  );
  return {
    ...chosen,
    alternatives: [previous, ...remaining],
  };
}
