import type { DayPlan, FoodItem, Meal, MealPlanOutput } from "./types";
import type { DayMealPlan, MealDishItem, MealPlanItem } from "./plans-store";

function sodiumToSaltG(sodiumMg: number): number {
  return Math.round((sodiumMg / 1000) * 10) / 10;
}

export function foodItemToDish(item: FoodItem): MealDishItem {
  return {
    name: item.name,
    calories: Math.round(item.kcal),
    salt: sodiumToSaltG(item.macros?.sodium_mg ?? 0),
    sugar: 0,
    foodId: item.food_id,
    alternatives: (item.alternatives || []).map((alt) => ({
      name: alt.name,
      calories: Math.round(alt.kcal),
      salt: sodiumToSaltG(alt.macros?.sodium_mg ?? 0),
      sugar: 0,
      foodId: alt.food_id,
      alternatives: [],
    })),
  };
}

function slotItems(meals: Meal[], slot: string): MealDishItem[] {
  const meal = meals.find((m) => m.slot === slot);
  return (meal?.items || []).map(foodItemToDish);
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
    totalSugar: 0,
  };
}

function avgDailyKcal(plan: MealPlanOutput): number {
  if (!plan.days.length) return 0;
  const total = plan.days.reduce((sum, d) => sum + (d.totals?.kcal ?? 0), 0);
  return Math.round(total / plan.days.length);
}

function mapStatus(
  status: string
): MealPlanItem["status"] {
  if (status === "approved") return "approved";
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
  return {
    id: plan.id,
    patientId: plan.user_id,
    patientName: meta.patientName,
    patientCode: meta.patientCode,
    condition: meta.condition,
    duration: `${plan.days.length || 7} ngày`,
    daysCount: plan.days.length || 7,
    status: mapStatus(plan.status),
    planTitle: "Thực đơn 7 ngày (kèm món thay thế)",
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
