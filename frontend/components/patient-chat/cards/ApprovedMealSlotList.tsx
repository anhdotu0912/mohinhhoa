"use client";

import React, { useEffect, useState } from "react";
import type { FoodItem, Meal } from "@/lib/types";
import { ApiError } from "@/lib/types";
import { api } from "@/lib/api";
import { slotImage, slotMeta, sumMealNutrition } from "@/lib/meal-plan-display";
import { MealItemRow } from "../MealItemRow";

interface ApprovedMealSlotListProps {
  meals: Meal[];
  emptyLabel: string;
  onMealsChange?: (meals: Meal[]) => void;
}

export function ApprovedMealSlotList({
  meals,
  emptyLabel,
  onMealsChange,
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
      {localMeals.map((meal, mealIdx) => {
        const meta = slotMeta(meal.slot);
        const items = meal.items ?? [];
        const nutrition = sumMealNutrition(meal);
        const imageSrc = slotImage(meal.slot);

        return (
          <div
            key={`${meal.slot}-${mealIdx}`}
            className="p-4 border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-sm transition-shadow flex flex-col gap-3.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#006857] flex items-center justify-center border border-emerald-200/80 shrink-0">
                  <span className="material-symbols-outlined text-[16px]">{meta.icon}</span>
                </div>
                <span className="text-sm font-bold text-slate-900">{meta.label}</span>
                {nutrition.kcal > 0 && (
                  <span className="text-xs font-extrabold text-[#006857] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80">
                    {nutrition.kcal} kcal
                  </span>
                )}
              </div>
              <span className="text-[11px] font-semibold text-slate-500 px-2.5 py-1 bg-slate-50 rounded-lg border border-slate-200/60">
                Kế hoạch thực đơn
              </span>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200/70 shadow-2xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageSrc} alt={meta.label} className="w-full h-full object-cover" />
              </div>

              <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                {items.length > 0 ? (
                  items.map((item, idx) => (
                    <MealItemRow
                      key={`${meal.slot}-${idx}`}
                      item={item}
                      onChange={(next) => replaceItem(mealIdx, idx, next)}
                    />
                  ))
                ) : (
                  <div className="text-xs text-slate-500 italic py-1">
                    Chưa có danh sách món cho bữa này.
                  </div>
                )}

                {(nutrition.protein > 0 || nutrition.carbs > 0 || nutrition.fat > 0) && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] font-semibold">
                    {nutrition.protein > 0 && (
                      <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-200/70">
                        Đạm: {nutrition.protein}g
                      </span>
                    )}
                    {nutrition.carbs > 0 && (
                      <span className="bg-blue-50 text-blue-800 px-2 py-0.5 rounded-md border border-blue-200/70">
                        Carb: {nutrition.carbs}g
                      </span>
                    )}
                    {nutrition.fat > 0 && (
                      <span className="bg-amber-50 text-amber-800 px-2 py-0.5 rounded-md border border-amber-200/70">
                        Béo: {nutrition.fat}g
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
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
  const [requestStatus, setRequestStatus] = useState<"none" | "pending" | "loading">("loading");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!showRequest) {
      setRequestStatus("none");
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const data = await api.getMealPlanRequest();
        if (cancelled) return;
        setRequestStatus(data.status === "pending" ? "pending" : "none");
      } catch {
        if (!cancelled) setRequestStatus("none");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [showRequest]);

  const handleRequest = async () => {
    setSubmitting(true);
    setError(null);
    setFeedback(null);
    try {
      const data = await api.requestMealPlan(note.trim());
      setRequestStatus(data.status === "pending" ? "pending" : "none");
      setFeedback("Đã gửi yêu cầu. Bác sĩ sẽ tạo thực đơn cho bạn.");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Không gửi được yêu cầu. Vui lòng thử lại."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col gap-3 mt-1">
      <p className="text-sm text-slate-700 leading-relaxed">{message}</p>

      {showRequest && requestStatus === "loading" && (
        <p className="text-xs text-slate-500">Đang kiểm tra trạng thái yêu cầu...</p>
      )}

      {showRequest && requestStatus === "pending" && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
          <span className="material-symbols-outlined text-[18px] shrink-0">hourglass_top</span>
          <p className="font-medium leading-relaxed">
            Bạn đã gửi yêu cầu tạo thực đơn. Bác sĩ sẽ xử lý trong thời gian sớm nhất.
          </p>
        </div>
      )}

      {showRequest && requestStatus === "none" && (
        <div className="flex flex-col gap-2.5">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Ghi chú cho bác sĩ (tuỳ chọn)..."
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 resize-none"
          />
          <button
            type="button"
            onClick={() => void handleRequest()}
            disabled={submitting}
            className="inline-flex items-center justify-center gap-1.5 self-start px-4 py-2.5 bg-[#006857] hover:bg-[#005245] disabled:opacity-60 text-white rounded-xl text-xs font-bold transition-colors shadow-xs active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[17px]">send</span>
            {submitting ? "Đang gửi..." : "Yêu cầu tạo thực đơn"}
          </button>
        </div>
      )}

      {feedback && (
        <p className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          {feedback}
        </p>
      )}
      {error && (
        <p className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          {error}
        </p>
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
