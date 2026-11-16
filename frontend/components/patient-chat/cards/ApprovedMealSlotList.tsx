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

  return (
    <div
      key={`${meal.slot}-${mealIdx}`}
      className="p-3 sm:p-4 border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-sm transition-shadow flex flex-col gap-3 sm:gap-3.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-emerald-50 text-[#006857] flex items-center justify-center border border-emerald-200/80 shrink-0">
            <span className="material-symbols-outlined text-[15px] sm:text-[16px]">{meta.icon}</span>
          </div>
          <span className="text-xs sm:text-sm font-bold text-slate-900">{meta.label}</span>
          {nutrition.kcal > 0 && (
            <span className="text-[11px] sm:text-xs font-extrabold text-[#006857] bg-emerald-50 px-1.5 sm:px-2 py-0.5 rounded-md border border-emerald-200/80">
              {nutrition.kcal} kcal
            </span>
          )}
        </div>
        <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 px-2 py-0.5 bg-slate-50 rounded-md border border-slate-200/60">
          Kế hoạch thực đơn
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
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
        <div className="pt-0.5">
          <button
            type="button"
            onClick={() => setShowSlotNutrients((v) => !v)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-[#006857] py-0.5 px-1.5 rounded-md hover:bg-emerald-50/60 transition-colors cursor-pointer"
          >
            <span>Thành phần bữa</span>
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
    setLocalMeals((prev) => {
      const updated = prev.map((meal, i) => {
        if (i !== mealIdx) return meal;
        return {
          ...meal,
          items: (meal.items ?? []).map((item, j) => (j === itemIdx ? next : item)),
        };
      });
      onMealsChange?.(updated);
      return updated;
    });
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
    <div className="space-y-3.5">
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
