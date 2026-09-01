"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePatientPanel } from "../PatientPanelProvider";
import { api } from "@/lib/api";
import type { Meal, MealPlanOutput } from "@/lib/types";
import {
  DAY_LABELS,
  findDayPlan,
  isApprovedPlan,
  replaceDayMeals,
  resolveDayNutrition,
  todayDayIndex,
} from "@/lib/meal-plan-display";
import {
  ApprovedMealSlotList,
  MealPlanEmptyState,
  MealPlanLoadingState,
} from "./ApprovedMealSlotList";
import { NutrientChips } from "@/components/shared/NutrientChips";

interface WeeklyMealPlanCardProps {
  plan?: MealPlanOutput | null;
}

export function WeeklyMealPlanCard({ plan: planProp }: WeeklyMealPlanCardProps) {
  const { openPanel } = usePatientPanel();
  const todayIndex = useMemo(() => todayDayIndex(), []);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(todayIndex);
  const [fetchedPlan, setFetchedPlan] = useState<MealPlanOutput | null | undefined>(
    planProp === undefined ? undefined : planProp
  );

  useEffect(() => {
    if (planProp !== undefined) {
      setFetchedPlan(planProp);
      return;
    }

    let cancelled = false;
    async function load() {
      try {
        const plan = await api.getMyMealPlan().catch(() => null);
        if (cancelled) return;
        setFetchedPlan(plan && plan.days?.length ? plan : null);
      } catch {
        if (!cancelled) setFetchedPlan(null);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [planProp]);

  const sourcePlan = planProp !== undefined ? planProp : fetchedPlan;
  const [workingPlan, setWorkingPlan] = useState<MealPlanOutput | null>(sourcePlan ?? null);

  useEffect(() => {
    setWorkingPlan(sourcePlan ?? null);
  }, [sourcePlan]);

  const plan = workingPlan ?? sourcePlan;
  const loading = sourcePlan === undefined;
  const selectedDay = findDayPlan(plan, selectedDayIndex);
  const selectedLabel = DAY_LABELS[selectedDayIndex];
  const nutrition = resolveDayNutrition(selectedDay);
  const meals = selectedDay?.meals ?? [];
  const isToday = selectedDayIndex === todayIndex;

  const [showNutrients, setShowNutrients] = useState(false);

  const handleMealsChange = (nextMeals: Meal[]) => {
    if (!plan) return;
    setWorkingPlan(replaceDayMeals(plan, selectedDayIndex, nextMeals));
  };

  const weekRange =
    plan?.starts_on && plan?.ends_on ? `${plan.starts_on} – ${plan.ends_on}` : "Thứ 2 – Chủ nhật";

  if (loading) {
    return <MealPlanLoadingState label="Đang tải thực đơn tuần..." />;
  }

  if (!plan) {
    return (
      <MealPlanEmptyState
        message="Bạn chưa có thực đơn tuần nào. Bạn có thể gửi yêu cầu để bác sĩ lập kế hoạch dinh dưỡng 7 ngày."
        showRequest
      />
    );
  }

  return (
    <div className="w-full bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-5 shadow-xs flex flex-col gap-3.5 sm:gap-4 mt-1">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 text-[#006857] flex items-center justify-center border border-emerald-200/80 shadow-2xs shrink-0">
            <span className="material-symbols-outlined text-[20px] sm:text-[22px]">calendar_month</span>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <h2 className="text-sm sm:text-lg font-extrabold text-slate-900 tracking-tight">
                Thực đơn tuần này
              </h2>
              <span className="text-[11px] sm:text-xs text-slate-500 font-medium">
                ({weekRange})
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5 truncate">
              Kế hoạch dinh dưỡng cá nhân hóa được bác sĩ phê duyệt
            </p>
          </div>
        </div>

        <div className="self-start sm:self-auto">
          {isApprovedPlan(plan) ? (
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 sm:px-3 sm:py-1 bg-emerald-50 text-[#006857] border border-emerald-200/90 rounded-full text-[11px] sm:text-xs font-bold shadow-2xs shrink-0">
              <span className="material-symbols-outlined text-[14px] sm:text-[15px]">verified</span>
              <span>Bác sĩ đã duyệt</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 sm:px-3 sm:py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-full text-[11px] sm:text-xs font-bold shadow-2xs shrink-0">
              <span className="material-symbols-outlined text-[14px] sm:text-[15px]">pending</span>
              <span>Chờ bác sĩ duyệt</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-bold text-slate-700">Chọn ngày trong tuần</span>
          <span className="text-emerald-800 font-semibold text-[11px] sm:text-xs">
            Đang xem: <strong className="font-bold">{selectedLabel?.full}</strong>
          </span>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar pb-0.5 -mx-0.5 px-0.5">
          {DAY_LABELS.map((day) => {
            const isSelected = selectedDayIndex === day.index;
            const isCurrentDay = todayIndex === day.index;

            return (
              <button
                key={day.index}
                type="button"
                onClick={() => setSelectedDayIndex(day.index)}
                className={`flex-1 min-w-[40px] sm:min-w-[44px] py-1.5 sm:py-2 px-1 rounded-xl text-center flex flex-col items-center transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-[#006857] text-white shadow-md font-bold"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 font-medium"
                }`}
              >
                <span className="text-[9px] sm:text-[10px] uppercase tracking-wider opacity-80">{day.short}</span>
                <span className="text-[11px] sm:text-xs font-extrabold mt-0.5">{day.full.replace("Thứ ", "T")}</span>
                {isCurrentDay && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full mt-0.5 sm:mt-1 ${
                      isSelected ? "bg-amber-300 ring-2 ring-emerald-700" : "bg-emerald-600"
                    }`}
                    title="Hôm nay"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5 sm:gap-2">
          <span>Thực đơn {selectedLabel?.full}</span>
          {isToday && (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
              Hôm nay
            </span>
          )}
        </h3>
        {nutrition.kcal > 0 ? (
          <span className="text-[11px] sm:text-xs font-bold text-[#006857] bg-emerald-50 px-2 sm:px-2.5 py-0.5 rounded-full border border-emerald-200 tabular-nums">
            {nutrition.kcal} kcal
          </span>
        ) : meals.length > 0 ? (
          <span className="text-[11px] sm:text-xs font-bold text-[#006857]">{meals.length} bữa ăn</span>
        ) : null}
      </div>

      <ApprovedMealSlotList
        meals={meals}
        emptyLabel={`Chưa có thực đơn được kích hoạt cho ${selectedLabel?.full}.`}
        onMealsChange={handleMealsChange}
      />

      {meals.length > 0 && (
        <div className="p-3 bg-slate-50/90 border border-slate-200/80 rounded-xl flex flex-col gap-2 transition-all">
          <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 min-w-0">
              <span className="material-symbols-outlined text-[17px] text-[#006857]">fact_check</span>
              <span>Tổng dinh dưỡng ngày ({selectedLabel?.full})</span>
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
              <NutrientChips values={nutrition} layer="summary" compact />
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={() => openPanel("menu")}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#006857] hover:bg-[#005245] text-white rounded-xl text-xs font-bold transition-colors shadow-xs active:scale-95 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[17px]">edit_note</span>
          <span>Xem chi tiết / Ghi nhận</span>
        </button>
        <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-slate-500">
          <span className="material-symbols-outlined text-[14px] sm:text-[15px] text-[#006857]">check_circle</span>
          <span>Thực đơn 7 ngày cá nhân hóa</span>
        </div>
      </div>
    </div>
  );
}
