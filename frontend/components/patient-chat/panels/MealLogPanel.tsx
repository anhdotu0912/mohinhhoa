"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { usePatientPanel } from "../PatientPanelProvider";
import { api } from "@/lib/api";
import {
  ApiError,
  type MealPlanOutput,
  type FoodItem,
  type FoodLogEntry,
  type PatientComplianceOut,
} from "@/lib/types";
import { MealItemRow } from "@/components/patient-chat/MealItemRow";
import { mealsToDayTotals } from "@/lib/meal-plan-display";


const DEFAULT_MEAL_IMAGES: Record<string, string> = {
  morning:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCy63oLuOJDAmaKRpjFVopv89rdYQENESNjmE7aq_Ocq5jrHK-FH4GgCQR9vK5YZKE3RLentfO1lbIteBFsDnqnrIzn4LYFvI8taELitugsX2t_WedQhDlwtNFs5y9hU2pIiXrC7lePguTix4QtDrL0g3dW0dBVdyMRmIFNu-q5hrSD3rHRDJuBreht0dKaUxvrTNLQ65jCCGDQv-UyRxlfu-xHsVEgiGRWTVTxHlL_H-pkvO10wV_OkQ",
  breakfast:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCy63oLuOJDAmaKRpjFVopv89rdYQENESNjmE7aq_Ocq5jrHK-FH4GgCQR9vK5YZKE3RLentfO1lbIteBFsDnqnrIzn4LYFvI8taELitugsX2t_WedQhDlwtNFs5y9hU2pIiXrC7lePguTix4QtDrL0g3dW0dBVdyMRmIFNu-q5hrSD3rHRDJuBreht0dKaUxvrTNLQ65jCCGDQv-UyRxlfu-xHsVEgiGRWTVTxHlL_H-pkvO10wV_OkQ",
  noon:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuADxt27IKTLgeBaUZZGmclNHqa1yxJ5BdE0hwQFPCghtzkBs-pLnXxtW9rJx9oEEHdsi2YcdIOOe-sJ_ieXqF3meSXctDnCBu_bdGF6O00ujRzs-_rwLYj9GMPyExtZbk6BybfRiv4tdGIw277x0dhVDL-038JXsqgcXBovCGlm_GNZ49AuvnZ74ZowOiWHC9-1EtExtZZAYUgEh-yrRUXoED48SXWnpqysR-Isco73Nyy02z2BTLtdmw",
  lunch:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuADxt27IKTLgeBaUZZGmclNHqa1yxJ5BdE0hwQFPCghtzkBs-pLnXxtW9rJx9oEEHdsi2YcdIOOe-sJ_ieXqF3meSXctDnCBu_bdGF6O00ujRzs-_rwLYj9GMPyExtZbk6BybfRiv4tdGIw277x0dhVDL-038JXsqgcXBovCGlm_GNZ49AuvnZ74ZowOiWHC9-1EtExtZZAYUgEh-yrRUXoED48SXWnpqysR-Isco73Nyy02z2BTLtdmw",
  evening:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuD2oStqvUJaJYckUh0nABnEJ8Ct080LnSnLWI4sl5w6O9GOHregWxmfd5Kv18OPXYPh3r6OLpxuRI9X7zxLm8gxXIqGIBGjVCQJN7KsNoDmYo_EVCUf90JZkUVFlrbTBFU1m_dX_RW3fMInFSM5ldv15Fv4EYzGjOnB2xGQOg6r2NILwjFncmEUHwMc9Gn66Z6roL-wOe1RtpO9zdnVpk5wYh_AXeLPxp7HmrOXOGRVtdwEKAbLW8hq6g",
  dinner:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuD2oStqvUJaJYckUh0nABnEJ8Ct080LnSnLWI4sl5w6O9GOHregWxmfd5Kv18OPXYPh3r6OLpxuRI9X7zxLm8gxXIqGIBGjVCQJN7KsNoDmYo_EVCUf90JZkUVFlrbTBFU1m_dX_RW3fMInFSM5ldv15Fv4EYzGjOnB2xGQOg6r2NILwjFncmEUHwMc9Gn66Z6roL-wOe1RtpO9zdnVpk5wYh_AXeLPxp7HmrOXOGRVtdwEKAbLW8hq6g",
};

const SLOT_META: Record<string, { label: string; icon: string }> = {
  morning: { label: "Bữa sáng", icon: "wb_twilight" },
  breakfast: { label: "Bữa sáng", icon: "wb_twilight" },
  noon: { label: "Bữa trưa", icon: "wb_sunny" },
  lunch: { label: "Bữa trưa", icon: "wb_sunny" },
  evening: { label: "Bữa tối", icon: "bedtime" },
  dinner: { label: "Bữa tối", icon: "bedtime" },
};

function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const DAY_LABELS = [
  { short: "T2", full: "Thứ 2", index: 0, dayIndex: 1 },
  { short: "T3", full: "Thứ 3", index: 1, dayIndex: 2 },
  { short: "T4", full: "Thứ 4", index: 2, dayIndex: 3 },
  { short: "T5", full: "Thứ 5", index: 3, dayIndex: 4 },
  { short: "T6", full: "Thứ 6", index: 4, dayIndex: 5 },
  { short: "T7", full: "Thứ 7", index: 5, dayIndex: 6 },
  { short: "CN", full: "Chủ nhật", index: 6, dayIndex: 7 },
];

function normalizeSlot(slot: string): "morning" | "noon" | "evening" {
  if (slot === "breakfast" || slot === "morning") return "morning";
  if (slot === "lunch" || slot === "noon") return "noon";
  if (slot === "dinner" || slot === "evening") return "evening";
  return "noon";
}

export function MealLogPanel() {
  const { closePanel } = usePatientPanel();

  const [mealPlan, setMealPlan] = useState<MealPlanOutput | null>(null);
  const [foodLogs, setFoodLogs] = useState<FoodLogEntry[]>([]);
  const [compliance, setCompliance] = useState<PatientComplianceOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Determine current day of week (0 = Mon ... 6 = Sun)
  const now = useMemo(() => new Date(), []);
  const todayDayOfWeek = useMemo(() => (now.getDay() + 6) % 7, [now]);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(todayDayOfWeek);

  // Custom log inline inputs
  const [customSlot, setCustomSlot] = useState<string | null>(null);
  const [customNote, setCustomNote] = useState("");
  const [savingSlot, setSavingSlot] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [plan, logs, complianceData] = await Promise.all([
        api.getMyMealPlan().catch(() => null),
        api.listFoodLogs().catch(() => []),
        api.getMyCompliance(7).catch(() => null),
      ]);
      setMealPlan(plan);
      setFoodLogs(logs);
      setCompliance(complianceData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không tải được thực đơn.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const todayDateStr = useMemo(() => getLocalDateString(now), [now]);

  // Selected Day Plan (plan.days have day_index 1..7)
  const activeDayPlan = useMemo(() => {
    if (!mealPlan?.days || mealPlan.days.length === 0) return null;
    const targetDayIndex = selectedDayIndex + 1;
    return (
      mealPlan.days.find((d) => d.day_index === targetDayIndex) ||
      mealPlan.days[selectedDayIndex % mealPlan.days.length] ||
      null
    );
  }, [mealPlan, selectedDayIndex]);

  const isToday = selectedDayIndex === todayDayOfWeek;

  const adherencePct = compliance?.overall_adherence_pct ?? null;
  const adherenceBadgeLabel =
    adherencePct != null
      ? `${Math.round(adherencePct)}% Đạt chuẩn y khoa`
      : "Chưa có dữ liệu";

  // Build 7-day compliance data points from the actual daily_series (rolling 7 days up to today)
  const compliancePoints = useMemo(() => {
    const rawSeries = compliance?.daily_series ?? [];
    return rawSeries.map((point, index) => {
      const pct = point?.adherence_pct ?? null;
      const pointDateStr = point?.date;
      let label = `D${index + 1}`;
      let isPointToday = false;

      if (pointDateStr) {
        const [year, month, day] = pointDateStr.split("-").map(Number);
        if (year && month && day) {
          const d = new Date(year, month - 1, day);
          const dayOfWeekIndex = (d.getDay() + 6) % 7;
          label = DAY_LABELS[dayOfWeekIndex]?.short ?? label;
        }
        isPointToday = pointDateStr === todayDateStr;
      }

      return {
        label,
        date: pointDateStr ?? `D${index + 1}`,
        pct: pct != null ? Math.round(pct) : null,
        isToday: isPointToday,
      };
    });
  }, [compliance, todayDateStr]);

  // Determine logged status for each slot today
  const isSlotLogged = useCallback(
    (slotKey: string) => {
      const target = normalizeSlot(slotKey);
      return foodLogs.some((log) => {
        const logDate = log.logged_at ? getLocalDateString(new Date(log.logged_at)) : "";
        return logDate === todayDateStr && log.slot === target;
      });
    },
    [foodLogs, todayDateStr]
  );

  const replaceDayItem = (slotKey: string, itemIdx: number, next: FoodItem) => {
    const targetDayIndex = selectedDayIndex + 1;
    setMealPlan((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        days: prev.days.map((day) => {
          if (day.day_index !== targetDayIndex) return day;
          const meals = (day.meals ?? []).map((meal) => {
            if (meal.slot !== slotKey) return meal;
            return {
              ...meal,
              items: (meal.items ?? []).map((item, idx) => (idx === itemIdx ? next : item)),
            };
          });
          return { ...day, meals, totals: mealsToDayTotals(meals, day.totals) };
        }),
      };
    });
  };

  const handleLogPlanned = async (slotKey: string) => {
    if (!mealPlan || !activeDayPlan) return;
    setSavingSlot(slotKey);
    try {
      const slot = normalizeSlot(slotKey);
      await api.createFoodLog({
        meal_plan_id: mealPlan.id,
        day_index: activeDayPlan.day_index,
        slot,
        type: "as_planned",
      });
      await loadData();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Không thể ghi nhận bữa ăn.");
    } finally {
      setSavingSlot(null);
    }
  };

  const handleLogCustom = async (slotKey: string) => {
    if (!mealPlan || !activeDayPlan || !customNote.trim()) return;
    setSavingSlot(slotKey);
    try {
      const slot = normalizeSlot(slotKey);
      await api.createFoodLog({
        meal_plan_id: mealPlan.id,
        day_index: activeDayPlan.day_index,
        slot,
        type: "custom",
        note: customNote.trim(),
      });
      setCustomSlot(null);
      setCustomNote("");
      await loadData();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Không thể ghi nhận bữa ăn.");
    } finally {
      setSavingSlot(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Đóng bảng thực đơn"
        onClick={closePanel}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") closePanel();
        }}
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity cursor-pointer"
      />

      {/* Centered Modal Card Dialog */}
      <div className="relative w-full max-w-2xl max-h-[88vh] bg-white rounded-2xl shadow-2xl z-10 flex flex-col border border-slate-200/90 animate-in fade-in zoom-in-95 duration-200 overflow-hidden my-auto">
        {/* Fixed Header */}
        <div className="px-6 sm:px-8 py-4 sm:py-5 min-h-[72px] sm:min-h-[78px] border-b border-slate-100 flex items-center justify-between bg-white/95 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-emerald-50 text-[#006857] flex items-center justify-center border border-emerald-200 shadow-2xs shrink-0">
              <span className="material-symbols-outlined text-[22px] sm:text-[24px]">
                restaurant_menu
              </span>
            </div>
            <div className="flex flex-col">
              <h2 className="font-bold text-lg sm:text-xl text-slate-900 leading-tight">Thực đơn &amp; Ghi nhận tuân thủ</h2>
              <p className="text-xs sm:text-[13px] text-slate-500 font-medium mt-0.5">Kế hoạch dinh dưỡng cá nhân hóa được bác sĩ phê duyệt</p>
            </div>
          </div>
          <button
            type="button"
            onClick={closePanel}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
            title="Đóng (ESC)"
          >
            <span className="material-symbols-outlined text-[20px] sm:text-[22px]">close</span>
          </button>
        </div>

        {/* 7-Day Selector Bar */}
        <div className="px-6 md:px-8 pt-3.5 pb-2.5 bg-slate-50/80 border-b border-slate-200/70 flex items-center justify-between gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          {DAY_LABELS.map((day) => {
            const isSelected = selectedDayIndex === day.index;
            const isCurrentDay = todayDayOfWeek === day.index;

            return (
              <button
                key={day.index}
                type="button"
                onClick={() => {
                  setSelectedDayIndex(day.index);
                  setCustomSlot(null);
                }}
                className={`flex-1 min-w-[52px] py-2 px-1.5 rounded-xl text-center flex flex-col items-center transition-all cursor-pointer ${
                  isSelected
                    ? "bg-[#006857] text-white shadow-md font-bold scale-[1.02]"
                    : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/80 font-medium shadow-2xs"
                }`}
              >
                <span className="text-[10px] uppercase tracking-wider opacity-80">
                  {day.short}
                </span>
                <span className="text-xs font-extrabold mt-0.5">
                  {day.full.replace("Thứ ", "T")}
                </span>
                {isCurrentDay && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full mt-1 ${
                      isSelected ? "bg-amber-300 ring-2 ring-emerald-700" : "bg-emerald-600"
                    }`}
                    title="Hôm nay"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 md:p-7 flex-1 overflow-y-auto custom-scrollbar space-y-5">
          {/* Mini 7-day Compliance Chart with Explicit Values and Labels */}
          <div className="bg-slate-50/90 border border-slate-200/80 rounded-xl p-4 flex flex-col gap-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#006857]">monitoring</span>
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Mức độ tuân thủ 7 ngày qua
                </span>
              </div>
              <span
                className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full border shadow-2xs ${
                  adherencePct != null && adherencePct >= 85
                    ? "text-[#006857] bg-emerald-50 border-emerald-200"
                    : adherencePct != null
                    ? "text-amber-800 bg-amber-50 border-amber-200"
                    : "text-slate-500 bg-slate-100 border-slate-200"
                }`}
              >
                {adherenceBadgeLabel}
              </span>
            </div>

            {/* Visual 7-day Bar Chart with Exact Numbers & Day Labels */}
            <div className="bg-white rounded-xl p-3 border border-slate-200/70 shadow-2xs">
              <div className="h-24 w-full flex items-end justify-between gap-2 px-1">
                {compliancePoints.map((point) => {
                  const hasData = point.pct !== null;
                  const barHeight = hasData ? Math.max(12, Math.min(100, point.pct)) : 10;
                  const isHigh = hasData && point.pct >= 85;
                  const isMed = hasData && point.pct < 85 && point.pct > 0;

                  return (
                    <div
                      key={point.label}
                      className="flex-1 flex flex-col items-center justify-end h-full group relative"
                    >
                      {/* Exact Number / Percentage Label on Top of Bar */}
                      <span
                        className={`text-[10px] font-bold mb-1 leading-none transition-transform group-hover:scale-110 ${
                          !hasData
                            ? "text-slate-300"
                            : isHigh
                            ? "text-[#006857]"
                            : "text-amber-600"
                        }`}
                      >
                        {hasData ? `${point.pct}%` : "--"}
                      </span>

                      {/* Bar Column */}
                      <div className="w-full max-w-[28px] h-14 bg-slate-100 rounded-t-md flex items-end overflow-hidden">
                        <div
                          className={`w-full rounded-t-md transition-all duration-300 ${
                            !hasData
                              ? "bg-slate-200"
                              : isHigh
                              ? "bg-[#006857] group-hover:bg-[#005245]"
                              : "bg-amber-500 group-hover:bg-amber-600"
                          }`}
                          style={{ height: `${barHeight}%` }}
                        />
                      </div>

                      {/* Day Label Below Bar */}
                      <div className="mt-1.5 flex flex-col items-center">
                        <span
                          className={`text-[11px] font-bold ${
                            point.isToday
                              ? "text-[#006857] underline decoration-emerald-500 decoration-2 font-black"
                              : "text-slate-600"
                          }`}
                        >
                          {point.label}
                        </span>
                        {point.isToday && (
                          <span className="w-1 h-1 rounded-full bg-emerald-600 mt-0.5" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-xs bg-[#006857]" />
                    <span>≥85% Đạt chuẩn</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-xs bg-amber-500" />
                    <span>&lt;85% Cần lưu ý</span>
                  </span>
                </div>
                <span className="font-semibold text-slate-600">Mục tiêu y khoa: 85%</span>
              </div>
            </div>
          </div>

          {/* Meals for Selected Day Section */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Thực đơn chi tiết {DAY_LABELS[selectedDayIndex]?.full}</span>
                {isToday && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Hôm nay
                  </span>
                )}
              </h3>
              {activeDayPlan?.totals?.kcal ? (
                <span className="text-xs font-bold text-[#006857] bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  Tổng ngày: {Math.round(activeDayPlan.totals.kcal)} kcal
                </span>
              ) : activeDayPlan?.meals && activeDayPlan.meals.length > 0 ? (
                <span className="text-xs font-bold text-[#006857]">
                  {activeDayPlan.meals.length} bữa ăn chuẩn y khoa
                </span>
              ) : null}
            </div>

            {loading && (
              <div className="py-10 text-center text-xs text-slate-500">
                <span className="material-symbols-outlined animate-spin text-[26px] text-[#006857] mb-2">
                  progress_activity
                </span>
                <p className="font-medium">Đang tải thực đơn tuần...</p>
              </div>
            )}

            {error && !loading && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                {error}
              </div>
            )}

            {!loading && !error && (!activeDayPlan || !activeDayPlan.meals?.length) && (
              <div className="p-8 bg-slate-50 rounded-xl text-center text-xs text-slate-500 border border-slate-200">
                <span className="material-symbols-outlined text-3xl text-slate-300 mb-1">
                  restaurant
                </span>
                <p>Chưa có thực đơn được kích hoạt cho {DAY_LABELS[selectedDayIndex]?.full}.</p>
              </div>
            )}

            {!loading &&
              activeDayPlan?.meals?.map((meal) => {
                const slotKey = meal.slot;
                const slotMeta = SLOT_META[slotKey] || { label: slotKey, icon: "restaurant" };
                const items = meal.items || [];
                const totalKcal = Math.round(
                  items.reduce((acc, it) => acc + (it.kcal || 0), 0)
                );
                const totalProtein = Math.round(
                  items.reduce((acc, it) => acc + (it.macros?.protein_g || 0), 0)
                );
                const totalCarbs = Math.round(
                  items.reduce((acc, it) => acc + (it.macros?.carb_g || 0), 0)
                );
                const totalFat = Math.round(
                  items.reduce((acc, it) => acc + (it.macros?.fat_g || 0), 0)
                );

                const imageSrc = DEFAULT_MEAL_IMAGES[slotKey] || DEFAULT_MEAL_IMAGES.noon;
                const isLogged = isToday ? isSlotLogged(slotKey) : false;
                const isSaving = savingSlot === slotKey;
                const isCustomOpen = customSlot === slotKey;

                return (
                  <div
                    key={slotKey}
                    className="p-4 border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-sm transition-shadow flex flex-col gap-3.5"
                  >
                    {/* Top Row: Slot Header + Nutrition Badges + Logging Action */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#006857] flex items-center justify-center border border-emerald-200/80">
                          <span className="material-symbols-outlined text-[16px]">
                            {slotMeta.icon}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-slate-900">
                          {slotMeta.label}
                        </span>
                        {totalKcal > 0 && (
                          <span className="text-xs font-extrabold text-[#006857] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80 ml-1">
                            {totalKcal} kcal
                          </span>
                        )}
                      </div>

                      {/* Action / Logging Buttons */}
                      <div>
                        {isLogged ? (
                          <div className="flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-800 rounded-full text-xs font-bold shrink-0 border border-emerald-200 shadow-2xs">
                            <span className="material-symbols-outlined text-[15px] text-[#006857]">check_circle</span>
                            <span>Đã ghi nhận</span>
                          </div>
                        ) : isToday ? (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => void handleLogPlanned(slotKey)}
                              className="px-3 py-1.5 bg-[#006857] hover:bg-[#005245] text-white rounded-lg text-xs font-bold transition-all shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-[14px]">done</span>
                              <span>{isSaving ? "Đang lưu..." : "Ăn đúng"}</span>
                            </button>
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => {
                                setCustomSlot(isCustomOpen ? null : slotKey);
                                setCustomNote("");
                              }}
                              className="px-3 py-1.5 border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-[14px]">edit_note</span>
                              <span>Ăn khác</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] font-semibold text-slate-400 px-2.5 py-1 bg-slate-50 rounded-lg border border-slate-200/60">
                            Kế hoạch thực đơn
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Middle Row: Image Thumbnail + Full Dishes List */}
                    <div className="flex items-start gap-3.5">
                      <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200/70 shadow-2xs">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imageSrc}
                          alt={slotMeta.label}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* Multi-dish items breakdown */}
                      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                        {items.length > 0 ? (
                          items.map((item, idx) => (
                            <MealItemRow
                              key={`${slotKey}-${idx}`}
                              item={item}
                              onChange={(next) => replaceDayItem(slotKey, idx, next)}
                            />
                          ))
                        ) : (
                          <div className="text-xs text-slate-500 italic py-1">
                            Món ăn dinh dưỡng chuẩn theo hướng dẫn y khoa.
                          </div>
                        )}

                        {/* Macros Breakdown Pills */}
                        {(totalProtein > 0 || totalCarbs > 0 || totalFat > 0) && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] font-semibold text-slate-500">
                            {totalProtein > 0 && (
                              <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-200/70">
                                Đạm: {totalProtein}g
                              </span>
                            )}
                            {totalCarbs > 0 && (
                              <span className="bg-blue-50 text-blue-800 px-2 py-0.5 rounded-md border border-blue-200/70">
                                Carb: {totalCarbs}g
                              </span>
                            )}
                            {totalFat > 0 && (
                              <span className="bg-amber-50 text-amber-800 px-2 py-0.5 rounded-md border border-amber-200/70">
                                Béo: {totalFat}g
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Inline Custom Meal Note Input */}
                    {isCustomOpen && !isLogged && isToday && (
                      <div className="p-3.5 bg-emerald-50/30 rounded-xl border border-emerald-200/80 flex flex-col gap-2.5 animate-in fade-in duration-200">
                        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[15px] text-[#006857]">edit</span>
                          <span>Bạn đã ăn món gì cho {slotMeta.label.toLowerCase()}?</span>
                        </label>
                        <input
                          type="text"
                          value={customNote}
                          onChange={(e) => setCustomNote(e.target.value)}
                          placeholder="Ví dụ: 1 tô phở bò tái, 1 quả chuối tiêu..."
                          className="w-full text-xs px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-slate-900"
                          autoFocus
                        />
                        <div className="flex items-center justify-end gap-2 pt-0.5">
                          <button
                            type="button"
                            onClick={() => setCustomSlot(null)}
                            className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 font-semibold cursor-pointer"
                          >
                            Hủy
                          </button>
                          <button
                            type="button"
                            disabled={!customNote.trim() || isSaving}
                            onClick={() => void handleLogCustom(slotKey)}
                            className="px-3.5 py-1.5 bg-[#006857] hover:bg-[#005245] text-white rounded-lg text-xs font-bold disabled:opacity-50 transition-colors cursor-pointer shadow-xs"
                          >
                            {isSaving ? "Đang lưu..." : "Xác nhận ghi nhận"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
