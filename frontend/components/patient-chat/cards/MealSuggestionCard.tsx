"use client";

import React, { useMemo } from "react";
import type { Meal, MealPreviewOut } from "@/lib/types";
import { usePatientPanel } from "../PatientPanelProvider";
import {
  DAY_LABELS,
  mealsToDayTotals,
  slotMeta,
  todayDayIndex,
} from "@/lib/meal-plan-display";
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
      <MealPlanEmptyState message="Bạn chưa có thực đơn được bác sĩ kích hoạt. Hãy liên hệ bác sĩ để được lập kế hoạch dinh dưỡng." />
    );
  }

  return (
    <div className="w-full bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col gap-4 mt-1">
      <div className="flex flex-wrap items-start justify-between gap-2.5 pb-1 border-b border-slate-100">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#006857] flex items-center justify-center border border-emerald-200/80 shadow-2xs shrink-0">
            <span className="material-symbols-outlined text-[22px]">restaurant_menu</span>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                {title}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Hôm nay · {dayLabel}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Kế hoạch dinh dưỡng đã được bác sĩ phê duyệt
            </p>
          </div>
        </div>

        {approved ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-[11px] font-bold shrink-0">
            <span className="material-symbols-outlined text-[13px]">verified</span>
            Bác sĩ đã duyệt
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-[11px] font-bold shrink-0">
            <span className="material-symbols-outlined text-[13px]">pending</span>
            Chờ bác sĩ duyệt
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900">{slotHeading}</h3>
        {nutrition.kcal > 0 ? (
          <span className="text-xs font-bold text-[#006857] bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 tabular-nums">
            {isSingleSlot ? `${nutrition.kcal} kcal` : `Tổng ngày: ${nutrition.kcal} kcal`}
          </span>
        ) : meals.length > 0 ? (
          <span className="text-xs font-bold text-[#006857]">{meals.length} bữa ăn</span>
        ) : null}
      </div>

      <ApprovedMealSlotList
        meals={meals}
        emptyLabel={
          isSingleSlot
            ? `Chưa có món cho ${slotMeta(meals[0].slot).label.toLowerCase()} hôm nay.`
            : `Chưa có thực đơn được kích hoạt cho ${dayLabel}.`
        }
      />

      <div className="pt-1">
        <button
          type="button"
          onClick={() => openPanel("menu")}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#006857] hover:bg-[#005245] text-white rounded-xl text-xs font-bold transition-colors shadow-xs active:scale-95 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[17px]">restaurant_menu</span>
          Xem chi tiết / Ghi nhận
        </button>
      </div>
    </div>
  );
}
