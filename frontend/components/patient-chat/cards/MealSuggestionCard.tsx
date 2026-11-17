"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Meal, MealPreviewOut } from "@/lib/types";
import { usePatientPanel } from "../PatientPanelProvider";
import {
  DAY_LABELS,
  mealsToDayTotals,
  slotMeta,
  todayDayIndex,
} from "@/lib/meal-plan-display";
import { NutrientChips } from "@/components/shared/NutrientChips";
import { toNutrientValues } from "@/lib/nutrient-display";
import {
  ApprovedMealSlotList,
  MealPlanEmptyState,
} from "./ApprovedMealSlotList";

interface MealSuggestionCardProps {
  preview?: MealPreviewOut | null;
}

function dayLabelFromPreview(preview: MealPreviewOut): string {
  if (preview.date) {
    const parsed = new Date(`${preview.date}T12:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return DAY_LABELS[todayDayIndex(parsed)]?.full ?? "hôm nay";
    }
  }
  return DAY_LABELS[todayDayIndex()]?.full ?? "hôm nay";
}

function mealsFromPreview(preview: MealPreviewOut): Meal[] {
  return (preview.meals ?? []).map((meal) => ({
    slot: meal.slot,
    items: meal.items ?? [],
  }));
}

export function MealSuggestionCard({ preview }: MealSuggestionCardProps) {
  const { openPanel } = usePatientPanel();
  const [showNutrients, setShowNutrients] = useState(false);
  const sourceMeals = useMemo(() => (preview ? mealsFromPreview(preview) : []), [preview]);
  const [meals, setMeals] = useState<Meal[]>(sourceMeals);
  useEffect(() => { setMeals(sourceMeals); }, [sourceMeals]);
  const dayLabel = preview ? dayLabelFromPreview(preview) : "hôm nay";
  const nutrition = mealsToDayTotals(meals);
  const isSingleSlot = meals.length === 1;
  const title = isSingleSlot ? `Thực đơn ${slotMeta(meals[0].slot).label.toLowerCase()}` : "Thực đơn hôm nay";
  const approved = preview?.plan_status === "approved" || preview?.plan_status === "edited";

  if (!preview) {
    return (
      <MealPlanEmptyState
        message="Bạn chưa có thực đơn đang áp dụng. Bạn có thể yêu cầu AI tạo bản dự thảo, sau đó bác sĩ kiểm tra và duyệt."
        showRequest
      />
    );
  }

  return (
    <div className="mt-1 flex w-full min-w-0 flex-col gap-3 rounded-xl border border-teal-100 bg-white p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
            <span className="material-symbols-outlined text-[20px] sm:text-[22px]">restaurant_menu</span>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <h2 className="text-[17px] font-bold tracking-tight text-slate-900">
                {title}
              </h2>
              <span className="text-[12px] font-medium text-slate-500">
                {dayLabel}
              </span>
            </div>
            <p className="mt-0.5 text-[12px] text-slate-500">
              {meals.length} bữa{nutrition.kcal > 0 ? ` · ${nutrition.kcal} kcal ${isSingleSlot ? "bữa này" : "cả ngày"}` : ""}
            </p>
          </div>
        </div>

        <div className="self-start sm:self-auto">
          {approved ? (
            <span className="inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-md border border-teal-200 bg-teal-50 px-2 py-1 text-[11px] font-semibold text-teal-800">
              <span className="material-symbols-outlined text-[12px] sm:text-[13px]">verified</span>
              Bác sĩ đã duyệt
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-[10px] sm:text-[11px] font-bold shrink-0">
              <span className="material-symbols-outlined text-[12px] sm:text-[13px]">pending</span>
              Chờ bác sĩ duyệt
            </span>
          )}
        </div>
      </div>

      <ApprovedMealSlotList
        meals={meals}
        onMealsChange={setMeals}
        readOnly={!approved}
        emptyLabel={
          isSingleSlot
            ? `Chưa có món cho ${slotMeta(meals[0].slot).label.toLowerCase()} hôm nay.`
            : `Chưa có thực đơn được kích hoạt cho ${dayLabel}.`
        }
      />

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        {approved ? <button
          type="button"
          onClick={() => openPanel("menu")}
          className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-[#006857] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#005245]"
        >
          <span className="material-symbols-outlined text-[17px]">restaurant_menu</span>
          <span>Ghi nhận bữa ăn</span>
        </button> : <Link href="/patient/meal-plan" className="text-xs font-bold text-teal-800 underline">Theo dõi kiểm duyệt thực đơn</Link>}
        {meals.length > 0 && <button type="button" aria-expanded={showNutrients} onClick={() => setShowNutrients((value) => !value)} className="inline-flex w-fit items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-teal-800"><span>{isSingleSlot ? "Dinh dưỡng bữa này" : "Dinh dưỡng cả ngày"}</span><span className={`material-symbols-outlined text-[16px] ${showNutrients ? "rotate-180" : ""}`}>expand_more</span></button>}
      </div>
      {showNutrients && <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3"><NutrientChips values={toNutrientValues({ kcal: nutrition.kcal, carbG: nutrition.carb_g, proteinG: nutrition.protein_g, fatG: nutrition.fat_g, sodiumMg: nutrition.sodium_mg, sugarG: nutrition.sugar_g })} layer="summary" compact /></div>}
    </div>
  );
}
