"use client";

import React, { useEffect, useState } from "react";
import type { FoodItem, Meal } from "@/lib/types";
import { ApiError } from "@/lib/types";
import { api } from "@/lib/api";
import { slotMeta, sumMealNutrition } from "@/lib/meal-plan-display";
import { MealItemRow } from "../MealItemRow";
import { NutrientChips } from "@/components/shared/NutrientChips";

interface ApprovedMealSlotListProps {
  meals: Meal[];
  emptyLabel: string;
  onMealsChange?: (meals: Meal[]) => void;
}

function ApprovedMealSlotCard({
  meal,
  mealIdx,
  onReplaceItem,
}: {
  meal: Meal;
  mealIdx: number;
  onReplaceItem: (mealIdx: number, itemIdx: number, next: FoodItem) => void;
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
