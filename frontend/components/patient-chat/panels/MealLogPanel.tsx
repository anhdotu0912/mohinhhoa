"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
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
import { WeeklyAdherenceChart } from "@/components/patient-chat/WeeklyAdherenceChart";
import { DailyMealProgress } from "@/components/patient-chat/DailyMealProgress";
import { foodLogSlot as toFoodLogSlot, latestMealLog, patientMealDay } from "@/lib/patient-meal-progress";
import { mealsToDayTotals, sumMealNutrition } from "@/lib/meal-plan-display";
import { NutrientChips } from "@/components/shared/NutrientChips";
import { useVietnamToday } from "@/lib/use-vietnam-today";
import { vietnamTodayIso } from "@/lib/meal-plan-calendar";
import { parseFlexibleDate } from "@/lib/plan-expiry";
import { mealPlanHistory } from "@/lib/meal-plan-workflow";
import { WeeklyMealPlanCard } from "../cards/WeeklyMealPlanCard";



const SLOT_META: Record<string, { label: string; icon: string }> = {
  morning: { label: "Bữa sáng", icon: "wb_twilight" },
  breakfast: { label: "Bữa sáng", icon: "wb_twilight" },
  noon: { label: "Bữa trưa", icon: "wb_sunny" },
  lunch: { label: "Bữa trưa", icon: "wb_sunny" },
  evening: { label: "Bữa tối", icon: "bedtime" },
  dinner: { label: "Bữa tối", icon: "bedtime" },
  snack: { label: "Bữa phụ", icon: "cookie" },
};

const DAY_LABELS = [
  { short: "T2", full: "Thứ 2", index: 0, dayIndex: 1 },
  { short: "T3", full: "Thứ 3", index: 1, dayIndex: 2 },
  { short: "T4", full: "Thứ 4", index: 2, dayIndex: 3 },
  { short: "T5", full: "Thứ 5", index: 3, dayIndex: 4 },
  { short: "T6", full: "Thứ 6", index: 4, dayIndex: 5 },
  { short: "T7", full: "Thứ 7", index: 5, dayIndex: 6 },
  { short: "CN", full: "Chủ nhật", index: 6, dayIndex: 7 },
];

export function MealLogPanel() {
  const { closePanel } = usePatientPanel();

  const [mealPlan, setMealPlan] = useState<MealPlanOutput | null>(null);
  const [historyPlans, setHistoryPlans] = useState<MealPlanOutput[]>([]);
  const [foodLogs, setFoodLogs] = useState<FoodLogEntry[]>([]);
  const [compliance, setCompliance] = useState<PatientComplianceOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [foodLogsError, setFoodLogsError] = useState<string | null>(null);
  const [complianceError, setComplianceError] = useState<string | null>(null);
  const mealsSectionRef = useRef<HTMLDivElement>(null);

  // Determine current day of week (0 = Mon ... 6 = Sun)
  const vietnamToday = useVietnamToday();
  const now = useMemo(() => parseFlexibleDate(vietnamToday)!, [vietnamToday]);
  const todayDayOfWeek = useMemo(() => (now.getDay() + 6) % 7, [now]);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(todayDayOfWeek);

  // Custom log inline inputs
  const [customSlot, setCustomSlot] = useState<string | null>(null);
  const [customNote, setCustomNote] = useState("");
  const [savingSlot, setSavingSlot] = useState<string | null>(null);
  const [expandedNutrientSlots, setExpandedNutrientSlots] = useState<Record<string, boolean>>({});

  const toggleSlotNutrient = (slotKey: string) => {
    setExpandedNutrientSlots((prev) => ({
      ...prev,
      [slotKey]: !prev[slotKey],
    }));
  };

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [scheduleResult, logsResult, complianceResult] = await Promise.allSettled([
        api.getMyMealPlanSchedule(),
        api.listFoodLogs(),
        api.getMyCompliance(14),
      ]);
      if (scheduleResult.status === "rejected") throw scheduleResult.reason;
      const schedule = scheduleResult.value;
      const plan = schedule.active_plan;
      const today = vietnamTodayIso();
      const isApplied = plan && ["approved", "edited"].includes(plan.status)
        && plan.starts_on && plan.ends_on
        && plan.starts_on <= today && today <= plan.ends_on;
      setMealPlan(isApplied ? plan : null);
      setHistoryPlans(mealPlanHistory(schedule));
      setFoodLogs(logsResult.status === "fulfilled" ? logsResult.value : []);
      setFoodLogsError(logsResult.status === "rejected" ? "Chưa tải được nhật ký bữa ăn. Chưa thể xác định bữa nào đã ghi." : null);
      setCompliance(complianceResult.status === "fulfilled" ? complianceResult.value : null);
      setComplianceError(complianceResult.status === "rejected" ? "Chưa tải được điểm ghi nhận. Vui lòng tải lại." : null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không tải được thực đơn.");
      setFoodLogsError("Chưa tải được lịch áp dụng. Vui lòng tải lại trước khi ghi nhận bữa ăn.");
      setComplianceError("Chưa tải được dữ liệu để hiển thị điểm ghi nhận.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData, vietnamToday]);

  const todayDateStr = vietnamToday;
  const selectedDateStr = useMemo(() => {
    const date = new Date(`${vietnamToday}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + selectedDayIndex - todayDayOfWeek);
    return date.toISOString().slice(0, 10);
  }, [vietnamToday, selectedDayIndex, todayDayOfWeek]);

  // Selected Day Plan (plan.days have day_index 1..7)
  const activeDayPlan = useMemo(() => {
    return patientMealDay(mealPlan, selectedDateStr);
  }, [mealPlan, selectedDateStr]);

  const isToday = selectedDayIndex === todayDayOfWeek;

  const replaceDayItem = (slotKey: string, itemIdx: number, next: FoodItem) => {
    const targetDayIndex = activeDayPlan?.day_index;
    if (!targetDayIndex) return;
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
    const slot = toFoodLogSlot(slotKey);
    if (!mealPlan || !activeDayPlan || !slot || !isToday || savingSlot || foodLogsError) return;
    setSavingSlot(slotKey);
    try {
      const created = await api.createFoodLog({
        meal_plan_id: mealPlan.id,
        day_index: activeDayPlan.day_index,
        slot,
        type: "as_planned",
      });
      setFoodLogs((prev) => [created, ...prev.filter((log) => log.id !== created.id)]);
      await loadData();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Không thể ghi nhận bữa ăn.");
    } finally {
      setSavingSlot(null);
    }
  };

  const handleLogCustom = async (slotKey: string) => {
    const slot = toFoodLogSlot(slotKey);
    if (!mealPlan || !activeDayPlan || !slot || !isToday || savingSlot || foodLogsError || !customNote.trim()) return;
    setSavingSlot(slotKey);
    try {
      const created = await api.createFoodLog({
        meal_plan_id: mealPlan.id,
        day_index: activeDayPlan.day_index,
        slot,
        type: "custom",
        note: customNote.trim(),
      });
      setCustomSlot(null);
      setCustomNote("");
      setFoodLogs((prev) => [created, ...prev.filter((log) => log.id !== created.id)]);
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
      <div className="relative w-full max-w-2xl max-h-[94vh] sm:max-h-[88vh] bg-white rounded-2xl shadow-2xl z-10 flex flex-col border border-slate-200/90 animate-in fade-in zoom-in-95 duration-200 overflow-hidden my-auto m-2 sm:m-0">
        {/* Fixed Header */}
        <div className="px-4 sm:px-6 md:px-8 py-3.5 sm:py-5 min-h-[64px] sm:min-h-[78px] border-b border-slate-100 flex items-center justify-between bg-white/95 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-emerald-50 text-[#006857] flex items-center justify-center border border-emerald-200 shadow-2xs shrink-0">
              <span className="material-symbols-outlined text-[20px] sm:text-[24px]">
                restaurant_menu
              </span>
            </div>
            <div className="flex flex-col min-w-0">
              <h2 className="font-bold text-base sm:text-xl text-slate-900 leading-tight truncate">Thực đơn &amp; Nhật ký</h2>
              <p className="text-[11px] sm:text-[13px] text-slate-500 font-medium mt-0.5 truncate">Kế hoạch dinh dưỡng cá nhân hóa</p>
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
        <div className="px-3 sm:px-6 md:px-8 pt-2.5 sm:pt-3.5 pb-2 sm:pb-2.5 bg-slate-50/80 border-b border-slate-200/70 flex items-center justify-between gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar shrink-0">
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
                className={`flex-1 min-w-[42px] sm:min-w-[52px] py-1.5 sm:py-2 px-1 sm:px-1.5 rounded-xl text-center flex flex-col items-center transition-all cursor-pointer ${
                  isSelected
                    ? "bg-[#006857] text-white shadow-md font-bold scale-[1.02]"
                    : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/80 font-medium shadow-2xs"
                }`}
              >
                <span className="text-[9px] sm:text-[10px] uppercase tracking-wider opacity-80">
                  {day.short}
                </span>
                <span className="text-[11px] sm:text-xs font-extrabold mt-0.5">
                  {day.full.replace("Thứ ", "T")}
                </span>
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

        {/* Scrollable Content Body */}
        <div className="p-3.5 sm:p-5 md:p-7 flex-1 overflow-y-auto custom-scrollbar space-y-4 sm:space-y-5">
          <DailyMealProgress
            plan={mealPlan} logs={foodLogs} today={todayDateStr} loading={loading}
            error={error || foodLogsError}
            onRetry={() => { setLoading(true); void loadData(); }}
            onNavigate={closePanel}
            onRecord={() => {
              setSelectedDayIndex(todayDayOfWeek);
              setCustomSlot(null);
              mealsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          />
          <WeeklyAdherenceChart
            series={compliance?.daily_series ?? []}
            todayDateStr={todayDateStr}
            selectedDayIndex={selectedDayIndex}
            loading={loading}
            errorMessage={complianceError}
            onRetry={() => { setLoading(true); void loadData(); }}
            onSelectDay={(index) => {
              setSelectedDayIndex(index);
              setCustomSlot(null);
            }}
          />
          {/* Meals for Selected Day Section */}
          <div ref={mealsSectionRef} className="scroll-mt-3 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5 sm:gap-2">
                <span>Thực đơn {DAY_LABELS[selectedDayIndex]?.full}</span>
                {isToday && (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Hôm nay
                  </span>
                )}
              </h3>
              {activeDayPlan?.totals?.kcal ? (
                <span className="text-[11px] sm:text-xs font-bold text-[#006857] bg-emerald-50 px-2 sm:px-2.5 py-0.5 rounded-full border border-emerald-200">
                  Tổng ngày: {Math.round(activeDayPlan.totals.kcal)} kcal
                </span>
              ) : activeDayPlan?.meals && activeDayPlan.meals.length > 0 ? (
                <span className="text-[11px] sm:text-xs font-bold text-[#006857]">
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
                <Link href="/patient/meal-plan" onClick={closePanel} className="inline-block mt-3 font-bold text-teal-800 underline">Tạo thực đơn AI / Theo dõi kiểm duyệt</Link>
              </div>
            )}

            {!loading &&
              activeDayPlan?.meals?.map((meal) => {
                const slotKey = meal.slot;
                const slotMeta = SLOT_META[slotKey] || { label: slotKey, icon: "restaurant" };
                const items = meal.items || [];
                const nutrition = sumMealNutrition(meal);

                const foodLogSlot = toFoodLogSlot(slotKey);
                const canLogSlot = foodLogSlot !== null;
                const slotLog = mealPlan && !foodLogsError ? latestMealLog(foodLogs, mealPlan.id, selectedDateStr, slotKey) : null;
                const isLogged = slotLog !== null;
                const isSaving = savingSlot === slotKey;
                const isCustomOpen = customSlot === slotKey;

                return (
                  <div
                    key={slotKey}
                    className="p-3 sm:p-4 border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-sm transition-shadow flex flex-col gap-3 sm:gap-3.5"
                  >
                    {/* Top Row: Slot Header + Nutrition Badges + Logging Action */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-emerald-50 text-[#006857] flex items-center justify-center border border-emerald-200/80 shrink-0">
                          <span className="material-symbols-outlined text-[15px] sm:text-[16px]">
                            {slotMeta.icon}
                          </span>
                        </div>
                        <span className="text-xs sm:text-sm font-bold text-slate-900">
                          {slotMeta.label}
                        </span>
                        {nutrition.kcal > 0 && (
                          <span className="text-[11px] sm:text-xs font-extrabold text-[#006857] bg-emerald-50 px-1.5 sm:px-2 py-0.5 rounded-md border border-emerald-200/80 tabular-nums">
                            {nutrition.kcal} kcal
                          </span>
                        )}
                      </div>

                      {/* Action / Logging Buttons */}
                      <div className="shrink-0">
                        {isLogged ? (
                          <div className={`flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-semibold ${slotLog.type === "as_planned" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                            <span className="material-symbols-outlined text-[15px]">{slotLog.type === "as_planned" ? "check_circle" : "edit_note"}</span>
                            <span>{slotLog.type === "as_planned" ? "Đã ăn theo thực đơn" : "Đã ăn khác"}</span>
                          </div>
                        ) : isToday && canLogSlot && !foodLogsError ? (
                          <div className="flex items-center gap-1 sm:gap-1.5">
                            <button
                              type="button"
                              disabled={savingSlot !== null}
                              onClick={() => void handleLogPlanned(slotKey)}
                              className="px-2.5 py-1 sm:px-3 sm:py-1.5 bg-[#006857] hover:bg-[#005245] text-white rounded-lg text-[11px] sm:text-xs font-bold transition-all shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-[13px] sm:text-[14px]">done</span>
                              <span>{isSaving ? "Đang lưu..." : "Đã ăn theo thực đơn"}</span>
                            </button>
                            <button
                              type="button"
                              disabled={savingSlot !== null}
                              onClick={() => {
                                setCustomSlot(isCustomOpen ? null : slotKey);
                                setCustomNote("");
                              }}
                              className="px-2.5 py-1 sm:px-3 sm:py-1.5 border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg text-[11px] sm:text-xs font-semibold hover:bg-slate-50 transition-colors active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-[13px] sm:text-[14px]">edit_note</span>
                              <span>Đã ăn khác</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 px-2 py-0.5 sm:px-2.5 sm:py-1 bg-slate-50 rounded-md sm:rounded-lg border border-slate-200/60">
                            {foodLogsError ? "Chưa tải được ghi nhận" : selectedDateStr > todayDateStr ? "Chưa đến ngày" : "Chưa ghi nhận"}
                          </span>
                        )}
                      </div>
                    </div>

                    {slotLog?.type === "custom" && slotLog.note && <p className="mb-2 rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2 text-xs text-amber-900">Bạn đã ăn: {slotLog.note}</p>}

                    {/* Dishes List */}
                    <div className="flex flex-col gap-2">
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
                      </div>

                      {/* Nút Xem thêm thành phần dinh dưỡng bữa */}
                      <div className="pt-0.5">
                        <button
                          type="button"
                          onClick={() => toggleSlotNutrient(slotKey)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-[#006857] py-0.5 px-1.5 rounded-md hover:bg-emerald-50/60 transition-colors cursor-pointer"
                        >
                          <span>Thành phần bữa</span>
                          <span
                            className={`material-symbols-outlined text-[15px] transition-transform duration-200 ${
                              expandedNutrientSlots[slotKey] ? "rotate-180 text-[#006857]" : "text-slate-400"
                            }`}
                          >
                            expand_more
                          </span>
                        </button>

                        {expandedNutrientSlots[slotKey] && (
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
          {!loading && historyPlans.length > 0 && <section aria-label="Nhật ký thực đơn" className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Nhật ký thực đơn cũ</h3>
            <p className="text-xs text-slate-500">Các bản cũ được giữ để xem lại. Bản chưa áp dụng không được tính là đã ăn theo thực đơn.</p>
            {historyPlans.map((old) => <details key={old.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <summary className="cursor-pointer text-xs font-bold text-slate-800">{old.starts_on && old.ends_on
                ? `${old.starts_on} – ${old.ends_on} · Hoàn thành`
                : `Bản ngày ${old.created_at?.slice(0, 10) ?? "chưa xác định"} · Đã lưu Nhật ký · Chưa áp dụng`}</summary>
              <WeeklyMealPlanCard plan={old} historical />
            </details>)}
          </section>}

        </div>
      </div>
    </div>
  );
}
