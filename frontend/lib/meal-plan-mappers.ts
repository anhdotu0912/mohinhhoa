import type {
  DayPlan,
  DayTotals,
  FoodItem,
  Macros,
  Meal,
  MealPlanOutput,
} from "./types";
import type { DayMealPlan, MealDishItem, MealPlanItem } from "./plans-store";

function sodiumToSaltG(sodiumMg: number): number {
  return Math.round((sodiumMg / 1000) * 10) / 10;
}

function saltGToSodiumMg(saltG: number): number {
  return Math.round(saltG * 1000);
}

export function foodItemToDish(item: FoodItem): MealDishItem {
  return {
    name: item.name,
    calories: Math.round(item.kcal),
    salt: sodiumToSaltG(item.macros?.sodium_mg ?? 0),
    sugar: item.macros?.sugar_g ?? 0,
    fat: Math.round((item.macros?.fat_g ?? 0) * 10) / 10,
    carbG: item.macros?.carb_g ?? 0,
    foodId: item.food_id,
    alternatives: (item.alternatives || []).map((alt) => ({
      name: alt.name,
      calories: Math.round(alt.kcal),
      salt: sodiumToSaltG(alt.macros?.sodium_mg ?? 0),
      sugar: alt.macros?.sugar_g ?? 0,
      fat: Math.round((alt.macros?.fat_g ?? 0) * 10) / 10,
      carbG: alt.macros?.carb_g ?? 0,
      foodId: alt.food_id,
      alternatives: [],
    })),
  };
}

function slotItems(meals: Meal[], slot: string): MealDishItem[] {
  const meal = meals.find((m) => m.slot === slot);
  return (meal?.items || []).map(foodItemToDish);
}

function sumDaySugar(day: DayPlan): number {
  let total = 0;
  for (const meal of day.meals) {
    for (const item of meal.items) {
      total += item.macros?.sugar_g ?? 0;
    }
  }
  return Math.round(total * 10) / 10;
}

export function dayPlanToUi(day: DayPlan): DayMealPlan {
  return {
    dayIndex: day.day_index,
    dayName: `Ngày ${day.day_index}`,
    breakfast: slotItems(day.meals, "breakfast"),
    lunch: slotItems(day.meals, "lunch"),
    dinner: slotItems(day.meals, "dinner"),
    snack: slotItems(day.meals, "snack"),
    totalCalories: Math.round(day.totals?.kcal ?? 0),
    totalSalt: sodiumToSaltG(day.totals?.sodium_mg ?? 0),
    totalSugar: sumDaySugar(day),
    warnings: day.warnings || [],
  };
}

function avgDailyKcal(plan: MealPlanOutput): number {
  if (!plan.days.length) return 0;
  const total = plan.days.reduce((sum, d) => sum + (d.totals?.kcal ?? 0), 0);
  return Math.round(total / plan.days.length);
}

function mapStatus(status: string): MealPlanItem["status"] {
  if (status === "approved") return "approved";
  if (status === "edited") return "edited";
  if (status === "rejected") return "rejected";
  return "pending";
}

export function mealPlanToUiItem(
  plan: MealPlanOutput,
  meta: {
    patientName: string;
    patientCode: string;
    condition: string;
  }
): MealPlanItem {
  const days = plan.days.map(dayPlanToUi);
  const first = days[0];
  const created = plan.created_at
    ? new Date(plan.created_at).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  const dayCount = plan.days.length || 7;
  return {
    id: plan.id,
    patientId: plan.user_id,
    patientName: meta.patientName,
    patientCode: meta.patientCode,
    condition: meta.condition,
    duration: `${dayCount} ngày`,
    daysCount: dayCount,
    status: mapStatus(plan.status),
    planTitle: `Thực đơn ${dayCount} ngày`,
    calories: `${avgDailyKcal(plan)} kcal/ngày`,
    salt: first ? `${first.totalSalt}g/ngày` : "—",
    sugar: first ? `${first.totalSugar}g/ngày` : "—",
    createdAt: created,
    days,
    breakfast: first?.breakfast,
    lunch: first?.lunch,
    dinner: first?.dinner,
    warnings: plan.days.flatMap((d) => d.warnings || []),
    citations: plan.citations || [],
  };
}

function emptyMacros(): Macros {
  return { carb_g: 0, protein_g: 0, fat_g: 0, sodium_mg: 0 };
}

export function dishToFoodItem(
  dish: MealDishItem,
  previous?: FoodItem | null
): FoodItem {
  const macros: Macros = {
    ...(previous?.macros || emptyMacros()),
    sodium_mg: saltGToSodiumMg(dish.salt),
    carb_g:
      dish.carbG != null
        ? dish.carbG
        : previous?.macros?.carb_g ?? 0,
  };
  return {
    name: dish.name,
    portion: previous?.portion || "",
    kcal: dish.calories,
    macros,
    food_id: dish.foodId ?? previous?.food_id ?? null,
    citations: previous?.citations ? [...previous.citations] : [],
    alternatives: (dish.alternatives || []).map((alt, idx) =>
      dishToFoodItem(alt, previous?.alternatives?.[idx] ?? null)
    ),
  };
}

function findPreviousItem(
  day: DayPlan | undefined,
  slot: string,
  index: number,
  dish: MealDishItem
): FoodItem | null {
  const meal = day?.meals.find((m) => m.slot === slot);
  if (!meal) return null;
  const byId = dish.foodId
    ? meal.items.find((it) => it.food_id && it.food_id === dish.foodId)
    : undefined;
  if (byId) return byId;
  const byName = meal.items.find((it) => it.name === dish.name);
  if (byName) return byName;
  return meal.items[index] ?? null;
}

function dishesToMeal(
  slot: string,
  dishes: MealDishItem[],
  previousDay?: DayPlan
): Meal {
  return {
    slot,
    items: dishes.map((dish, idx) =>
      dishToFoodItem(dish, findPreviousItem(previousDay, slot, idx, dish))
    ),
  };
}

export function recomputeDayTotals(meals: Meal[]): DayTotals {
  const totals: DayTotals = {
    kcal: 0,
    carb_g: 0,
    protein_g: 0,
    fat_g: 0,
    sodium_mg: 0,
  };
  for (const meal of meals) {
    for (const item of meal.items) {
      totals.kcal += item.kcal || 0;
      totals.carb_g += item.macros?.carb_g || 0;
      totals.protein_g += item.macros?.protein_g || 0;
      totals.fat_g += item.macros?.fat_g || 0;
      totals.sodium_mg += item.macros?.sodium_mg || 0;
    }
  }
  return {
    kcal: Math.round(totals.kcal * 10) / 10,
    carb_g: Math.round(totals.carb_g * 10) / 10,
    protein_g: Math.round(totals.protein_g * 10) / 10,
    fat_g: Math.round(totals.fat_g * 10) / 10,
    sodium_mg: Math.round(totals.sodium_mg * 10) / 10,
  };
}

export type DaySlotDishes = {
  breakfast: MealDishItem[];
  lunch: MealDishItem[];
  dinner: MealDishItem[];
  snack: MealDishItem[];
};

/** Merge UI slot edits for one day back into a MealPlanOutput clone. */
export function applyDaySlotsToPlan(
  plan: MealPlanOutput,
  dayIndex: number,
  slots: DaySlotDishes,
  opts?: { warnings?: string[] }
): MealPlanOutput {
  const days = plan.days.map((day) => {
    if (day.day_index !== dayIndex) return day;
    const meals = [
      dishesToMeal("breakfast", slots.breakfast, day),
      dishesToMeal("lunch", slots.lunch, day),
      dishesToMeal("dinner", slots.dinner, day),
      dishesToMeal("snack", slots.snack, day),
    ];
    return {
      ...day,
      meals,
      totals: recomputeDayTotals(meals),
      warnings: opts?.warnings !== undefined ? opts.warnings : day.warnings || [],
    };
  });
  return { ...plan, days };
}

export function setDayWarnings(
  plan: MealPlanOutput,
  dayIndex: number,
  warnings: string[]
): MealPlanOutput {
  return {
    ...plan,
    days: plan.days.map((day) =>
      day.day_index === dayIndex ? { ...day, warnings } : day
    ),
  };
}

export type MealSlotKey = "breakfast" | "lunch" | "dinner";

/** Tỉ lệ kcal gợi ý theo bữa chính — khớp BE meal planner (snack ~10% riêng). */
export const MEAL_KCAL_SHARES: Record<MealSlotKey, number> = {
  breakfast: 0.25,
  lunch: 0.35,
  dinner: 0.30,
};

export type NutritionWarningSlots = {
  breakfast: MealDishItem[];
  lunch: MealDishItem[];
  dinner: MealDishItem[];
  snack?: MealDishItem[];
};

export type KcalBand = { target: number; lower: number; upper: number };

export function dayKcalBand(targetKcal: number): KcalBand {
  const target = Math.round(targetKcal);
  return {
    target,
    lower: Math.round(target * 0.9),
    upper: Math.round(target * 1.1),
  };
}

export function mealKcalBand(targetKcal: number, slot: MealSlotKey): KcalBand {
  const share = MEAL_KCAL_SHARES[slot];
  const target = Math.round(targetKcal * share);
  return {
    target,
    lower: Math.round(target * 0.9),
    upper: Math.round(target * 1.1),
  };
}

export type StructuredNutritionWarnings = {
  day: string[];
  breakfast: string[];
  lunch: string[];
  dinner: string[];
};

export type NutritionWarningBundle = {
  hard: StructuredNutritionWarnings;
  advisory: StructuredNutritionWarnings;
};

function emptyStructuredWarnings(): StructuredNutritionWarnings {
  return { day: [], breakfast: [], lunch: [], dinner: [] };
}

export function flattenStructuredWarnings(
  w: StructuredNutritionWarnings
): string[] {
  return [...w.day, ...w.breakfast, ...w.lunch, ...w.dinner];
}

export function countStructuredWarnings(w: StructuredNutritionWarnings): number {
  return flattenStructuredWarnings(w).length;
}

export function countHardNutritionWarnings(
  slots: NutritionWarningSlots,
  targets: NutritionTargets
): number {
  return countStructuredWarnings(computeNutritionWarningBundle(slots, targets).hard);
}

function slotSodiumMg(items: MealDishItem[]): number {
  return items.reduce((sum, item) => sum + item.salt, 0) * 1000;
}

function allSlotKcal(slots: NutritionWarningSlots): number {
  return Math.round(
    slotCalories(slots.breakfast) +
      slotCalories(slots.lunch) +
      slotCalories(slots.dinner) +
      slotCalories(slots.snack || [])
  );
}

function allSlotSodiumMg(slots: NutritionWarningSlots): number {
  return (
    slotSodiumMg(slots.breakfast) +
    slotSodiumMg(slots.lunch) +
    slotSodiumMg(slots.dinner) +
    slotSodiumMg(slots.snack || [])
  );
}

export function partitionMealWarnings(warnings: string[]): {
  breakfast: string[];
  lunch: string[];
  dinner: string[];
} {
  const breakfast: string[] = [];
  const lunch: string[] = [];
  const dinner: string[] = [];
  for (const w of warnings) {
    const lower = w.toLowerCase();
    if (lower.includes("bữa sáng") || lower.includes("breakfast")) {
      breakfast.push(w);
    } else if (lower.includes("bữa trưa") || lower.includes("lunch")) {
      lunch.push(w);
    } else if (lower.includes("bữa tối") || lower.includes("dinner")) {
      dinner.push(w);
    }
    // Cảnh báo toàn ngày không gắn vào từng bữa
  }
  return { breakfast, lunch, dinner };
}

export function countPlanWarnings(plan: MealPlanOutput): number {
  return plan.days.reduce((n, d) => n + (d.warnings?.length || 0), 0);
}

export function slotCalories(items: MealDishItem[]): number {
  return items.reduce((sum, item) => sum + (item.calories || 0), 0);
}

export function slotCarbG(items: MealDishItem[]): number {
  return items.reduce((sum, item) => sum + (item.carbG || 0), 0);
}

export type NutritionTargets = {
  targetKcal: number;
  sodiumDailyMg?: number | null;
  carbPerMealG?: number | null;
};

export function targetsFromProfileSnapshot(
  snapshot: Record<string, unknown> | null | undefined
): NutritionTargets {
  const targetKcal = Number(snapshot?.target_kcal ?? 1800) || 1800;
  const restrictions = (snapshot?.restrictions || {}) as Record<string, unknown>;
  return {
    targetKcal,
    sodiumDailyMg:
      restrictions.sodium_daily != null ? Number(restrictions.sodium_daily) : null,
    carbPerMealG:
      restrictions.carb_per_meal != null ? Number(restrictions.carb_per_meal) : null,
  };
}

/**
 * Hard = chặn duyệt (khớp BE validate_nutrition).
 * Advisory = gợi ý kcal/bữa, natri sắp chạm — chỉ hiển thị, không chặn duyệt.
 */
export function computeNutritionWarningBundle(
  slots: NutritionWarningSlots,
  targets: NutritionTargets
): NutritionWarningBundle {
  const hard = emptyStructuredWarnings();
  const advisory = emptyStructuredWarnings();

  const dayBand = dayKcalBand(targets.targetKcal);
  const dayKcal = allSlotKcal(slots);
  const daySodiumMg = allSlotSodiumMg(slots);

  if (dayKcal < dayBand.lower) {
    hard.day.push(
      `Tổng ngày ${dayKcal} kcal — thấp hơn ngưỡng ${dayBand.lower}–${dayBand.upper} kcal (mục tiêu ${dayBand.target}).`
    );
  } else if (dayKcal > dayBand.upper) {
    hard.day.push(
      `Tổng ngày ${dayKcal} kcal — cao hơn ngưỡng ${dayBand.lower}–${dayBand.upper} kcal (mục tiêu ${dayBand.target}).`
    );
  }

  if (targets.sodiumDailyMg) {
    if (daySodiumMg > targets.sodiumDailyMg) {
      hard.day.push(
        `Tổng natri/ngày ${Math.round(daySodiumMg)}mg vượt giới hạn ${targets.sodiumDailyMg}mg.`
      );
    } else if (daySodiumMg >= targets.sodiumDailyMg * 0.85) {
      advisory.day.push(
        `Natri/ngày ${Math.round(daySodiumMg)}mg sắp chạm giới hạn ${targets.sodiumDailyMg}mg.`
      );
    }
  }

  const slotMeta: { key: MealSlotKey; label: string; items: MealDishItem[] }[] = [
    { key: "breakfast", label: "Bữa sáng", items: slots.breakfast },
    { key: "lunch", label: "Bữa trưa", items: slots.lunch },
    { key: "dinner", label: "Bữa tối", items: slots.dinner },
  ];

  for (const { key, label, items } of slotMeta) {
    const kcal = Math.round(slotCalories(items));
    const band = mealKcalBand(targets.targetKcal, key);
    if (kcal < band.lower) {
      advisory[key].push(
        `${label}: ${kcal} kcal — thấp hơn gợi ý ${band.lower}–${band.upper} kcal (còn thiếu ~${band.lower - kcal} kcal).`
      );
    } else if (kcal > band.upper) {
      advisory[key].push(
        `${label}: ${kcal} kcal — cao hơn gợi ý ${band.lower}–${band.upper} kcal (cần giảm ~${kcal - band.upper} kcal).`
      );
    }
  }

  return { hard, advisory };
}

/** Hard breaches only — dùng cho cổng duyệt và lưu day.warnings. */
export function computeStructuredNutritionWarnings(
  slots: NutritionWarningSlots,
  targets: NutritionTargets
): StructuredNutritionWarnings {
  return computeNutritionWarningBundle(slots, targets).hard;
}

/** Flat hard warnings (tương thích chỗ lưu warnings vào day plan). */
export function computeDayNutritionWarnings(
  slots: NutritionWarningSlots,
  targets: NutritionTargets
): string[] {
  return flattenStructuredWarnings(computeStructuredNutritionWarnings(slots, targets));
}

export function mealPlanToEditedPayload(plan: MealPlanOutput): MealPlanOutput {
  return {
    id: plan.id,
    variant_group_id: plan.variant_group_id ?? null,
    variant_index: plan.variant_index ?? null,
    total_variants: plan.total_variants ?? null,
    user_id: plan.user_id,
    profile_snapshot: plan.profile_snapshot || {},
    days: plan.days,
    swaps: plan.swaps || [],
    citations: plan.citations || [],
    status: plan.status,
    trust_badge: plan.trust_badge ?? null,
    created_at: plan.created_at ?? null,
  };
}
