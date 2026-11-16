"use client";

import React, { useMemo, useState } from "react";
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
  const meals = useMemo(() => (preview ? mealsFromPreview(preview) : []), [preview]);
  const dayLabel = preview ? dayLabelFromPreview(preview) : "hôm nay";
  const nutrition = mealsToDayTotals(meals);
  const isSingleSlot = meals.length === 1;
  const slotHeading = isSingleSlot
    ? slotMeta(meals[0].slot).label
    : `Thực đơn chi tiết ${dayLabel}`;
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
    <div className="w-full bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-5 shadow-xs flex flex-col gap-3.5 sm:gap-4 mt-1">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 text-[#006857] flex items-center justify-center border border-emerald-200/80 shadow-2xs shrink-0">
            <span className="material-symbols-outlined text-[20px] sm:text-[22px]">restaurant_menu</span>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <h2 className="text-sm sm:text-lg font-extrabold text-slate-900 tracking-tight">
                {title}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Hôm nay · {dayLabel}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5 truncate">
              {approved ? "Kế hoạch dinh dưỡng đã được bác sĩ phê duyệt" : "Bản dự thảo AI · Chưa được áp dụng"}
            </p>
          </div>
        </div>

        <div className="self-start sm:self-auto">
          {approved ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-[10px] sm:text-[11px] font-bold shrink-0">
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

      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs sm:text-sm font-bold text-slate-900">{slotHeading}</h3>
        {meals.length > 0 ? (
          <span className="text-[11px] sm:text-xs font-bold text-[#006857]">{meals.length} bữa ăn</span>
        ) : null}
      </div>

      <ApprovedMealSlotList
        meals={meals}
        readOnly={!approved}
        emptyLabel={
          isSingleSlot
            ? `Chưa có món cho ${slotMeta(meals[0].slot).label.toLowerCase()} hôm nay.`
            : `Chưa có thực đơn được kích hoạt cho ${dayLabel}.`
        }
      />

      {meals.length > 0 && (
        <div className="bg-slate-50/90 border border-slate-200/80 rounded-xl p-2.5 sm:p-3 flex flex-col gap-2 transition-all">
          <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 min-w-0">
              <span className="material-symbols-outlined text-[17px] text-[#006857]">pie_chart</span>
              <span>Tổng giá trị dinh dưỡng</span>
              {nutrition.kcal > 0 && (
                <span className="text-[11px] font-extrabold text-[#006857] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 shrink-0">
                  {nutrition.kcal} kcal
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowNutrients((v) => !v)}
              className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-[#006857] hover:text-[#005245] bg-white hover:bg-emerald-50 px-2.5 py-1 rounded-lg border border-slate-200 hover:border-emerald-300 transition-all shadow-2xs cursor-pointer ml-auto sm:ml-0"
            >
              <span>{showNutrients ? "Ẩn thành phần" : "Xem thêm thành phần"}</span>
              <span
                className={`material-symbols-outlined text-[15px] transition-transform duration-200 ${
                  showNutrients ? "rotate-180" : ""
                }`}
              >
                expand_more
              </span>
            </button>
          </div>

          {showNutrients && (
            <div className="pt-2 border-t border-slate-200/60 animate-in fade-in slide-in-from-top-1 duration-150">
              <NutrientChips
                values={toNutrientValues({
                  kcal: nutrition.kcal,
                  carbG: nutrition.carb_g,
                  proteinG: nutrition.protein_g,
                  fatG: nutrition.fat_g,
                  sodiumMg: nutrition.sodium_mg,
                  sugarG: nutrition.sugar_g,
                })}
                layer="summary"
                compact
              />
            </div>
          )}
        </div>
      )}

      <div className="pt-1">
        {approved ? <button
          type="button"
          onClick={() => openPanel("menu")}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#006857] hover:bg-[#005245] text-white rounded-xl text-xs font-bold transition-colors shadow-xs active:scale-95 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[17px]">restaurant_menu</span>
          <span>Xem chi tiết / Ghi nhận</span>
        </button> : <Link href="/patient/meal-plan" className="text-xs font-bold text-teal-800 underline">Theo dõi kiểm duyệt thực đơn</Link>}
      </div>
    </div>
  );
}
