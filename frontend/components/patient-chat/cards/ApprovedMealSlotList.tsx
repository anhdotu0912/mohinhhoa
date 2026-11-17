"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { FoodItem, Meal } from "@/lib/types";
import { slotMeta, sumMealNutrition } from "@/lib/meal-plan-display";
import { MealItemRow } from "../MealItemRow";
import { NutrientChips } from "@/components/shared/NutrientChips";

interface ApprovedMealSlotListProps {
  meals: Meal[];
  emptyLabel: string;
  onMealsChange?: (meals: Meal[]) => void;
  readOnly?: boolean;
}

function ApprovedMealSlotCard({
  meal,
  mealIdx,
  onReplaceItem,
  readOnly,
}: {
  meal: Meal;
  mealIdx: number;
  onReplaceItem: (mealIdx: number, itemIdx: number, next: FoodItem) => void;
  readOnly: boolean;
}) {
  const [showSlotNutrients, setShowSlotNutrients] = useState(false);
  const meta = slotMeta(meal.slot);
  const items = meal.items ?? [];
  const nutrition = sumMealNutrition(meal);
  const headerTone = ["morning", "breakfast"].includes(meal.slot) ? "bg-amber-50/70 text-amber-800" : ["evening", "dinner"].includes(meal.slot) ? "bg-sky-50/70 text-sky-800" : meal.slot === "snack" ? "bg-violet-50/60 text-violet-800" : "bg-teal-50/70 text-teal-800";

  return (
    <div
      key={`${meal.slot}-${mealIdx}`}
      className="min-w-0 overflow-hidden rounded-xl border border-slate-200/80 bg-white"
    >
      <div className={`flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5 sm:px-4 ${headerTone}`}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center">
            <span className="material-symbols-outlined text-[15px] sm:text-[16px]">{meta.icon}</span>
          </div>
          <span className="text-[15px] font-bold text-slate-900">{meta.label}</span>
        </div>
        {nutrition.kcal > 0 && <span className="text-[12px] font-semibold tabular-nums text-slate-600">{nutrition.kcal} kcal</span>}
      </div>

      <div className="px-3 sm:px-4">
        <div className="min-w-0 divide-y divide-slate-100">
          {items.length > 0 ? (
            items.map((item, idx) => (
              <MealItemRow
                key={`${meal.slot}-${idx}`}
                item={item}
                onChange={(next) => onReplaceItem(mealIdx, idx, next)}
                readOnly={readOnly}
              />
            ))
          ) : (
            <div className="text-xs text-slate-500 italic py-1">
              Chưa có danh sách món cho bữa này.
            </div>
          )}
        </div>

        {/* Nút Xem thêm thành phần dinh dưỡng bữa */}
        <div className="border-t border-slate-100 py-2">
          <button
            type="button"
            onClick={() => setShowSlotNutrients((v) => !v)}
            aria-expanded={showSlotNutrients}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-[#006857] py-0.5 px-1.5 rounded-md hover:bg-emerald-50/60 transition-colors cursor-pointer"
          >
            <span>Dinh dưỡng cả bữa</span>
            <span
              className={`material-symbols-outlined text-[15px] transition-transform duration-200 ${
                showSlotNutrients ? "rotate-180 text-[#006857]" : "text-slate-400"
              }`}
            >
              expand_more
            </span>
          </button>

          {showSlotNutrients && (
            <div className="pt-2 animate-in fade-in slide-in-from-top-1 duration-150">
              <NutrientChips
                values={nutrition}
                layer="detail"
                compact
                omit={["kcal"]}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ApprovedMealSlotList({
  meals,
  emptyLabel,
  onMealsChange,
  readOnly = false,
}: ApprovedMealSlotListProps) {
  const [localMeals, setLocalMeals] = useState(meals);

  useEffect(() => {
    setLocalMeals(meals);
  }, [meals]);

  const replaceItem = (mealIdx: number, itemIdx: number, next: FoodItem) => {
    const updated = localMeals.map((meal, i) => {
      if (i !== mealIdx) return meal;
      return { ...meal, items: (meal.items ?? []).map((item, j) => (j === itemIdx ? next : item)) };
    });
    setLocalMeals(updated);
    onMealsChange?.(updated);
  };

  if (!localMeals.length) {
    return (
      <div className="p-8 bg-slate-50 rounded-xl text-center text-xs text-slate-600 border border-slate-200">
        <span className="material-symbols-outlined text-3xl text-slate-400 mb-1">restaurant</span>
        <p>{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-3">
      {localMeals.map((meal, mealIdx) => (
        <ApprovedMealSlotCard
          key={`${meal.slot}-${mealIdx}`}
          meal={meal}
          mealIdx={mealIdx}
          onReplaceItem={replaceItem}
          readOnly={readOnly}
        />
      ))}
    </div>
  );
}

export function MealPlanEmptyState({
  message,
  showRequest = true,
}: {
  message: string;
  showRequest?: boolean;
}) {
  return (
    <div className="w-full bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col gap-3 mt-1">
      <p className="text-sm text-slate-700 leading-relaxed">{message}</p>
      {showRequest && (
        <>
          <Link href="/patient/meal-plan" className="inline-flex items-center justify-center gap-1.5 self-start px-4 py-2.5 bg-[#006857] hover:bg-[#005245] text-white rounded-xl text-xs font-bold transition-colors">
            <span className="material-symbols-outlined text-[17px]">auto_awesome</span>
            Tạo thực đơn bằng AI
          </Link>
          <p className="text-xs text-slate-500">AI tạo bản dự thảo. Bác sĩ kiểm tra và duyệt trước khi áp dụng.</p>
        </>
      )}
    </div>
  );
}

export function MealPlanLoadingState({ label }: { label: string }) {
  return (
    <div className="w-full bg-white border border-slate-200/90 rounded-2xl p-8 shadow-xs text-center">
      <span className="material-symbols-outlined animate-spin text-[26px] text-[#006857] mb-2">
        progress_activity
      </span>
      <p className="text-xs font-medium text-slate-600">{label}</p>
    </div>
  );
}
