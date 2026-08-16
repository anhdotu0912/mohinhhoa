/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState } from "react";
import { TopBar } from "@/components/shared/TopBar";
import { useMealLogsStore, MealType } from "@/lib/meal-logs-store";
import { usePlansStore, MealPlanItem } from "@/lib/plans-store";
import { MOCK_PATIENTS } from "@/lib/mock-data";

// Helper functions for date math
function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function formatDateIso(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateShort(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

function formatDateFull(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

// Reference mock date (12 Oct 2023)
const MOCK_REFERENCE_DATE = new Date(2023, 9, 12);

export default function PatientMealsPage() {
  const patientId = "BN-10293";
  const patient = MOCK_PATIENTS.find((p) => p.id === patientId) || MOCK_PATIENTS[0];

  // Active View Mode: "grid" (Thời khóa biểu tuần) | "detail" (Chi tiết hôm nay)
  const [viewMode, setViewMode] = useState<"grid" | "detail">("grid");

  // State: Monday of active week being viewed
  const [currentMonday, setCurrentMonday] = useState<Date>(() =>
    getMonday(MOCK_REFERENCE_DATE)
  );

  const { logs } = useMealLogsStore();
  const { getPlansByPatientId } = usePlansStore();

  const patientLogs = logs.filter((l) => l.patientId === patientId);
  const patientPlans = getPlansByPatientId(patientId);

  // Navigate week
  const handlePrevWeek = () => {
    const prev = new Date(currentMonday);
    prev.setDate(prev.getDate() - 7);
    setCurrentMonday(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(currentMonday);
    next.setDate(next.getDate() + 7);
    setCurrentMonday(next);
  };

  const handleResetCurrentWeek = () => {
    setCurrentMonday(getMonday(MOCK_REFERENCE_DATE));
  };

  // Compute 7 days of current week (Monday to Sunday)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentMonday);
    d.setDate(currentMonday.getDate() + i);
    const isoDate = formatDateIso(d);
    const dayNames = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
    const fullDayNames = [
      "Thứ 2",
      "Thứ 3",
      "Thứ 4",
      "Thứ 5",
      "Thứ 6",
      "Thứ 7",
      "Chủ nhật",
    ];

    return {
      dayIndex: i,
      dayShort: dayNames[i],
      fullDayName: fullDayNames[i],
      dateObj: d,
      isoDate,
      shortDate: formatDateShort(d),
      fullDate: formatDateFull(d),
    };
  });

  const sundayDate = new Date(currentMonday);
  sundayDate.setDate(currentMonday.getDate() + 6);
  const weekRangeLabel = `${formatDateShort(currentMonday)} – ${formatDateFull(sundayDate)}`;

  const todayIso = formatDateIso(MOCK_REFERENCE_DATE);

  // Define rows for meal types
  const mealRows: { type: MealType; label: string; icon: string; time: string }[] = [
    { type: "breakfast", label: "Sáng", icon: "wb_twilight", time: "07:00" },
    { type: "lunch", label: "Trưa", icon: "wb_sunny", time: "12:00" },
    { type: "dinner", label: "Tối", icon: "bedtime", time: "18:30" },
  ];

  // Helper: Find APPROVED plans for a specific date
  const getPlansForDate = (isoDate: string): MealPlanItem[] => {
    return patientPlans.filter((p) => {
      // Patients ONLY see approved plans
      if (p.status !== "approved") return false;

      const createdDateParts = p.createdAt.split(" ")[0]?.split("/");
      if (createdDateParts && createdDateParts.length === 3) {
        const pIso = `${createdDateParts[2]}-${createdDateParts[1].padStart(2, "0")}-${createdDateParts[0].padStart(2, "0")}`;
        return pIso === isoDate;
      }
      return false;
    });
  };

  // Calculate patient weekly stats
  const weeklyLogs = patientLogs.filter(
    (l) => l.date >= formatDateIso(currentMonday) && l.date <= formatDateIso(sundayDate)
  );

  const matchedLogsCount = weeklyLogs.filter(
    (l) => l.complianceType === "as_planned" || l.sourceBadgeText === "Ăn đúng"
  ).length;

  const weeklyComplianceRate =
    weeklyLogs.length > 0 ? Math.round((matchedLogsCount / weeklyLogs.length) * 100) : 85;

  return (
    <>
      <TopBar
        title="Thực đơn bệnh nhân"
        rightSlot={
          <div className="flex items-center bg-slate-100/90 border border-slate-200/80 rounded-xl p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === "grid"
                  ? "bg-white text-emerald-800 shadow-xs border border-slate-200/60"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span className="material-symbols-outlined text-[16px] text-emerald-700">calendar_view_week</span>
              <span>Thời khóa biểu tuần</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("detail")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === "detail"
                  ? "bg-white text-emerald-800 shadow-xs border border-slate-200/60"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span className="material-symbols-outlined text-[16px] text-emerald-700">restaurant</span>
              <span>Chi tiết bữa ăn</span>
            </button>
          </div>
        }
      />

      <main className="flex-1 w-full p-4 sm:p-6 min-h-[calc(100vh-64px)] flex justify-center bg-slate-50/50">
        <div className="w-full max-w-[1280px] flex flex-col gap-4">
          {/* VIEW MODE 1: WEEKLY TIMETABLE GRID */}
          {viewMode === "grid" && (
            <div className="space-y-4">
              {/* --- 1. TOP STATS CARDS (COMPACT ROW) --- */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Stat 1: Tuân thủ thực đơn */}
                <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs hover:border-emerald-200 transition-colors flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[18px]">verified</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-medium text-slate-500 block truncate">Tuân thủ thực đơn</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-base font-bold text-emerald-700">{weeklyComplianceRate}%</span>
                      <span className="text-[11px] text-slate-500">({matchedLogsCount}/{weeklyLogs.length || 7} bữa)</span>
                    </div>
                  </div>
                </div>

                {/* Stat 2: Muối trung bình */}
                <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs hover:border-amber-200 transition-colors flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[18px]">water_drop</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-medium text-slate-500 block truncate">Lượng muối TB / ngày</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-base font-bold text-slate-800">1.6g</span>
                      <span className="text-[10px] text-emerald-700 font-medium bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/50">
                        &lt;2.0g an toàn
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stat 3: Năng lượng Kcal */}
                <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs hover:border-sky-200 transition-colors flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[18px]">local_fire_department</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-medium text-slate-500 block truncate">Năng lượng Kcal TB</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-base font-bold text-slate-800">1,750</span>
                      <span className="text-[11px] text-slate-500">/ 1,800 kcal</span>
                    </div>
                  </div>
                </div>

                {/* Stat 4: Rau & Nước */}
                <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs hover:border-teal-200 transition-colors flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[18px]">eco</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-medium text-slate-500 block truncate">Mục tiêu Rau & Nước</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-base font-bold text-teal-800">2.5L</span>
                      <span className="text-[11px] text-slate-500">• 400g rau</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* --- 2. DATE NAVIGATION & COMPACT INFO BAR --- */}
              <div className="bg-white border border-slate-200/80 rounded-xl px-3.5 py-2.5 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-2.5">
                {/* Left: Compact Button Group for Week Navigation */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="inline-flex items-center bg-slate-100/90 border border-slate-200/70 rounded-lg p-0.5 shadow-2xs">
                    <button
                      onClick={handlePrevWeek}
                      className="p-1.5 hover:bg-white hover:shadow-2xs rounded-md text-slate-600 hover:text-slate-900 transition-all cursor-pointer active:scale-95"
                      title="Tuần trước"
                    >
                      <span className="material-symbols-outlined text-[16px] block">chevron_left</span>
                    </button>

                    <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-800">
                      <span className="material-symbols-outlined text-emerald-600 text-[15px]">
                        calendar_month
                      </span>
                      <span>Tuần: {weekRangeLabel}</span>
                    </div>

                    <button
                      onClick={handleNextWeek}
                      className="p-1.5 hover:bg-white hover:shadow-2xs rounded-md text-slate-600 hover:text-slate-900 transition-all cursor-pointer active:scale-95"
                      title="Tuần sau"
                    >
                      <span className="material-symbols-outlined text-[16px] block">chevron_right</span>
                    </button>
                  </div>

                  <button
                    onClick={handleResetCurrentWeek}
                    className="px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50/90 hover:bg-emerald-100/80 border border-emerald-200/60 rounded-lg transition-colors cursor-pointer"
                  >
                    Về tuần hiện tại
                  </button>
                </div>

                {/* Right: Compact Medical Tag */}
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50/70 border border-emerald-200/50 rounded-full text-xs font-medium text-emerald-800">
                  <span className="material-symbols-outlined text-emerald-600 text-[15px]">
                    verified
                  </span>
                  <span>Thực đơn chuẩn y khoa (Bác sĩ chỉ định)</span>
                </div>
              </div>

              {/* --- 3. MEAL TIMETABLE / GRID --- */}
              <div className="bg-white border border-slate-200/80 rounded-xl shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <div className="min-w-[1020px] grid grid-cols-[90px_repeat(7,1fr)] divide-x divide-y divide-slate-200/70">
                    {/* Corner Cell */}
                    <div className="sticky left-0 z-20 bg-slate-100/90 p-2.5 flex items-center justify-center font-semibold text-xs text-slate-500 border-r border-slate-200">
                      Bữa \ Ngày
                    </div>

                    {/* 7 Column Headers with Compact Daily Nutrition Breakdown */}
                    {weekDays.map((day) => {
                      const dayPlans = getPlansForDate(day.isoDate);
                      const isToday = day.isoDate === todayIso;
                      const isFuture = day.isoDate > todayIso;

                      // Daily totals
                      const dayLogs = patientLogs.filter((l) => l.date === day.isoDate);
                      const dayCalo = dayLogs.reduce(
                        (sum, l) => sum + l.foodItems.reduce((fs, f) => fs + (f.calories || 0), 0),
                        0
                      );
                      const daySalt = Number(
                        dayLogs
                          .reduce(
                            (sum, l) => sum + l.foodItems.reduce((fs, f) => fs + (f.salt || 0), 0),
                            0
                          )
                          .toFixed(1)
                      );

                      return (
                        <div
                          key={day.isoDate}
                          onClick={() => setViewMode("detail")}
                          className={`p-2.5 flex flex-col justify-between transition-colors cursor-pointer group ${
                            isToday
                              ? "bg-emerald-600 text-white shadow-xs"
                              : isFuture
                              ? "bg-slate-50/50 text-slate-700 hover:bg-slate-100/70"
                              : "bg-slate-100/70 text-slate-800 hover:bg-slate-200/60"
                          }`}
                          title="Bấm để xem chi tiết bữa ăn ngày này"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className={`text-xs font-bold ${isToday ? "text-white" : "text-slate-800"}`}>
                                  {day.fullDayName}
                                </span>
                                {isToday && (
                                  <span className="bg-white text-emerald-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold shadow-2xs leading-none">
                                    Hôm nay
                                  </span>
                                )}
                              </div>
                              <span className={`font-mono text-[11px] font-medium ${isToday ? "text-emerald-100" : "text-slate-500"}`}>
                                {day.shortDate}
                              </span>
                            </div>
                            {dayPlans.length > 0 && (
                              <span
                                className={`material-symbols-outlined text-[15px] ${isToday ? "text-emerald-200" : "text-emerald-600"}`}
                                title="Đã có thực đơn chuẩn y khoa"
                              >
                                check_circle
                              </span>
                            )}
                          </div>

                          {/* Daily Nutrition Metrics Pill */}
                          <div
                            className={`mt-2 px-2 py-0.5 rounded-md flex items-center justify-between text-[11px] font-mono shadow-2xs ${
                              isToday
                                ? "bg-emerald-700/80 text-white border border-emerald-500/50"
                                : "bg-white/90 border border-slate-200/60 text-slate-600"
                            }`}
                          >
                            <span>{dayCalo > 0 ? `${dayCalo} kcal` : "—"}</span>
                            <span
                              className={
                                isToday
                                  ? "text-emerald-100 font-semibold"
                                  : daySalt > 2.0
                                  ? "text-amber-700 font-semibold"
                                  : "text-emerald-700 font-semibold"
                              }
                            >
                              {daySalt > 0 ? `${daySalt}g Na` : "—"}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Grid Rows for Breakfast, Lunch, Dinner */}
                    {mealRows.map((row, rIdx) => (
                      <React.Fragment key={row.type}>
                        {/* Sticky Meal Row Label */}
                        <div className="sticky left-0 z-20 bg-slate-50 p-2.5 flex flex-col items-center justify-center border-r border-slate-200 text-slate-700">
                          <span className="material-symbols-outlined text-emerald-600 text-[18px] mb-0.5">
                            {row.icon}
                          </span>
                          <span className="text-xs font-semibold">{row.label}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{row.time}</span>
                        </div>

                        {/* 7 Day Cells for this Meal */}
                        {weekDays.map((day, dIdx) => {
                          const cellLogs = patientLogs.filter(
                            (l) => l.date === day.isoDate && l.mealType === row.type
                          );
                          const isToday = day.isoDate === todayIso;
                          const isFuture = day.isoDate > todayIso;
                          const isEven = (rIdx + dIdx) % 2 === 0;

                          const cellBg = isToday
                            ? "bg-emerald-50/35 hover:bg-emerald-50/60"
                            : isFuture
                            ? "bg-slate-50/20 hover:bg-slate-100/30"
                            : isEven
                            ? "bg-white hover:bg-slate-50/60"
                            : "bg-slate-50/40 hover:bg-slate-100/50";

                          return (
                            <div
                              key={`${day.isoDate}-${row.type}`}
                              onClick={() => setViewMode("detail")}
                              className={`p-2 min-h-[96px] flex flex-col justify-between transition-colors cursor-pointer ${cellBg}`}
                              title="Bấm để xem chi tiết bữa ăn"
                            >
                              {cellLogs.length > 0 ? (
                                <div className="space-y-1.5">
                                  {cellLogs.map((log) => {
                                    const isCustom = log.complianceType === "custom" || log.sourceBadgeText === "Ăn khác";

                                    return (
                                      <div key={log.id} className="space-y-1">
                                        {/* Status indicator dot & label header - ONLY show for today or past days */}
                                        {!isFuture && (
                                          <div className="flex items-center justify-between gap-1">
                                            <div className="flex items-center gap-1">
                                              <span
                                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                                  isCustom ? "bg-amber-500 ring-2 ring-amber-100" : "bg-emerald-500 ring-2 ring-emerald-100"
                                                }`}
                                              />
                                              <span className={`text-[10px] font-semibold ${isCustom ? "text-amber-700" : "text-emerald-700"}`}>
                                                {isCustom ? "Ăn khác" : "Ăn đúng"}
                                              </span>
                                            </div>
                                          </div>
                                        )}

                                        {/* Food Items with Compact Inline Nutrients */}
                                        <div className="space-y-0.5">
                                          {log.foodItems.map((food, fIdx) => {
                                            const nutrientParts = [];
                                            if (food.calories) nutrientParts.push(`${food.calories} kcal`);
                                            if (food.salt !== undefined) nutrientParts.push(`${food.salt}g`);
                                            const nutrientString = nutrientParts.length > 0 ? `(${nutrientParts.join(" • ")})` : "";

                                            return (
                                              <div key={fIdx} className="text-xs text-slate-700 leading-snug">
                                                <span className="font-medium">{food.name}</span>{" "}
                                                {nutrientString && (
                                                  <span className="text-[10px] text-slate-400 font-mono font-normal">
                                                    {nutrientString}
                                                  </span>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="flex-1 flex items-center justify-center text-center">
                                  <span className="text-slate-300 text-xs font-mono">
                                    -
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW MODE 2: DAILY MEALS DETAIL VIEW */}
          {viewMode === "detail" && (
            <div className="space-y-4 animate-fadeIn">
              {/* Progress / Summary Card */}
              <section className="bg-white border border-slate-200/80 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
                <div>
                  <h3 className="text-slate-900 text-base font-semibold">Tổng quan dinh dưỡng hôm nay</h3>
                  <p className="text-slate-500 text-xs mt-0.5">Mục tiêu hàng ngày cho huyết áp & đường huyết ổn định</p>
                </div>
                <div className="flex gap-6 items-center self-end sm:self-auto">
                  <div className="text-center">
                    <div className="text-emerald-700 font-bold text-lg font-mono">
                      1,450 <span className="text-xs text-slate-400 font-normal">/ 1,800</span>
                    </div>
                    <div className="text-slate-500 uppercase tracking-wider text-[10px] mt-0.5 font-semibold">
                      Kcal
                    </div>
                  </div>
                  <div className="w-px h-8 bg-slate-200 self-center"></div>
                  <div className="text-center">
                    <div className="text-amber-700 font-bold text-lg font-mono">
                      3.2 <span className="text-xs text-slate-400 font-normal">/ 5g</span>
                    </div>
                    <div className="text-slate-500 uppercase tracking-wider text-[10px] mt-0.5 font-semibold">
                      Muối (Natri)
                    </div>
                  </div>
                </div>
              </section>

              {/* Meals Cards List */}
              <div className="flex flex-col gap-3">
                {/* Breakfast Card */}
                <article className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-2xs hover:border-slate-300 transition-colors">
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-emerald-600 text-lg">wb_twilight</span>
                        <h3 className="text-slate-800 font-semibold text-sm">07:00 - Bữa sáng</h3>
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-medium text-xs">
                        Đã hoàn thành
                      </span>
                    </div>
                    <div className="flex gap-3.5">
                      <div className="w-18 h-18 rounded-lg overflow-hidden shrink-0 border border-slate-200 relative">
                        <img
                          className="w-full h-full object-cover"
                          alt="Phở gà ít béo"
                          src="https://lh3.googleusercontent.com/aida-public/AB6AXuAVjwNT1KRGkEUs56K56bgRv8DcVYbh-262-Wwn83Hy8By9lD4HqvKDzD6gRapjtRdfmL8oU-zfh8DeDGVdC6h1gQUS9bRk0APT53LOn1dyzHfZvKikKb1GWJJqGwNk4ejVtzDGCJEhDpCRMIhFowjqUwVGNclfguqId8ImdCv1tSXnHc5wqXrWKosUFoAOLBvQPEN2cnoR-IWnz-NOM-zq5GPlmhFWD_-ibobwycG4i4i0eYMYohN64A"
                        />
                      </div>
                      <div className="flex-grow flex flex-col justify-center">
                        <h4 className="text-slate-900 font-semibold text-sm mb-1">
                          Phở gà ít béo, nhiều rau
                        </h4>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-mono">
                            <span className="material-symbols-outlined text-[13px] text-slate-500">local_fire_department</span> 350 kcal
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200/50 text-xs font-mono">
                            <span className="material-symbols-outlined text-[13px] text-amber-600">water_drop</span> 1.2g Muối
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-mono">
                            <span className="material-symbols-outlined text-[13px] text-slate-500">spa</span> 5g Đường
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-slate-100">
                      <details className="group">
                        <summary className="flex items-center gap-1 cursor-pointer text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors list-none">
                          <span className="material-symbols-outlined text-sm transition-transform duration-200 group-open:rotate-180">
                            expand_more
                          </span>
                          Vì sao gợi ý món này?
                        </summary>
                        <p className="mt-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 leading-relaxed">
                          Nước dùng được ninh từ xương ức gà thay vì xương heo giúp giảm đáng kể lượng cholesterol. Hàm lượng Natri thấp (1.2g) rất phù hợp để kiểm soát huyết áp buổi sáng của bạn.
                        </p>
                      </details>
                    </div>
                  </div>
                </article>

                {/* Lunch Card */}
                <article className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-2xs hover:border-slate-300 transition-colors">
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-amber-600 text-lg">wb_sunny</span>
                        <h3 className="text-slate-800 font-semibold text-sm">12:30 - Bữa trưa</h3>
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60 font-medium text-xs">
                        Sắp tới
                      </span>
                    </div>
                    <div className="flex gap-3.5">
                      <div className="w-18 h-18 rounded-lg overflow-hidden shrink-0 border border-slate-200 relative">
                        <img
                          className="w-full h-full object-cover"
                          alt="Cơm gạo lứt cá hồi nướng"
                          src="https://lh3.googleusercontent.com/aida-public/AB6AXuBxH3tt8gEYfvie8RIzD30n979-Zlc9hI55BV7wrs-GKJWl8flfLTgEy5syTr-R_GvPIR-cAzkEUoz7Iomaplma_RPh3UAhlgTL-e0k1QcEFwhPSGQ9MY4_SwV_RQLefEm6c92SMtjBu-6EJsYiKlUoFtUCmAG7oY4nGNxZqhwgZCUIN85xN1tnj7A70__hCmjF4OjrdY4R58TY2lkfw7MW-U1VmQLYh70Ww6WW7_Cc9ccNOOWWtWro2A"
                        />
                      </div>
                      <div className="flex-grow flex flex-col justify-center">
                        <h4 className="text-slate-900 font-semibold text-sm mb-1">
                          Cơm gạo lứt cá hồi nướng
                        </h4>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-mono">
                            <span className="material-symbols-outlined text-[13px] text-slate-500">local_fire_department</span> 450 kcal
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-mono">
                            <span className="material-symbols-outlined text-[13px] text-slate-500">water_drop</span> 0.8g Muối
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200/50 text-xs">
                            <span className="material-symbols-outlined text-[13px] text-teal-600">set_meal</span> Omega-3 cao
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-slate-100">
                      <details className="group">
                        <summary className="flex items-center gap-1 cursor-pointer text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors list-none">
                          <span className="material-symbols-outlined text-sm transition-transform duration-200 group-open:rotate-180">
                            expand_more
                          </span>
                          Vì sao gợi ý món này?
                        </summary>
                        <p className="mt-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 leading-relaxed">
                          Cá hồi cung cấp lượng Omega-3 dồi dào giúp bảo vệ thành mạch máu. Gạo lứt có chỉ số GI thấp, giúp duy trì mức đường huyết ổn định trong suốt buổi chiều.
                        </p>
                      </details>
                    </div>
                  </div>
                </article>

                {/* Dinner Card */}
                <article className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-2xs hover:border-slate-300 transition-colors">
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-indigo-600 text-lg">bedtime</span>
                        <h3 className="text-slate-800 font-semibold text-sm">19:00 - Bữa tối</h3>
                      </div>
                    </div>
                    <div className="flex gap-3.5">
                      <div className="w-18 h-18 rounded-lg overflow-hidden shrink-0 border border-slate-200 relative">
                        <img
                          className="w-full h-full object-cover"
                          alt="Đậu hũ sốt cà chua"
                          src="https://lh3.googleusercontent.com/aida-public/AB6AXuDtSRjEDTZvusEmk9emXLf9sEPEV7Uq30u7qoMiyGYlGX8jLyp_3HMVM6tHofFLznplelsAf0gyp5FVC4Odf8sxxIM5DpsmSHHUvVCVcW-sUYS4Z0M34MyzxPB9oWLx1nifg8Q7RaaqGOXqYp9hZGa8GwX599n0B_3qL0wf2B6COppp2iHoReo3Qgya9bAc9GtsVhVyzKRM81G9aF2id4FDTQMXLXAxbqhcNLFJq4hbB7G49PU_OTt8VQ"
                        />
                      </div>
                      <div className="flex-grow flex flex-col justify-center">
                        <h4 className="text-slate-900 font-semibold text-sm mb-1">
                          Đậu hũ sốt cà chua, Rau muống luộc
                        </h4>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-mono">
                            <span className="material-symbols-outlined text-[13px] text-slate-500">local_fire_department</span> 280 kcal
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-mono">
                            <span className="material-symbols-outlined text-[13px] text-slate-500">water_drop</span> 1.1g Muối
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200/50 text-xs">
                            <span className="material-symbols-outlined text-[13px] text-emerald-600">eco</span> Thuần chay
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-slate-100">
                      <details className="group">
                        <summary className="flex items-center gap-1 cursor-pointer text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors list-none">
                          <span className="material-symbols-outlined text-sm transition-transform duration-200 group-open:rotate-180">
                            expand_more
                          </span>
                          Vì sao gợi ý món này?
                        </summary>
                        <p className="mt-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 leading-relaxed">
                          Bữa tối nhẹ nhàng với đạm thực vật từ đậu hũ giúp dạ dày dễ tiêu hóa trước khi ngủ. Cà chua giàu kali giúp cân bằng natri trong cơ thể, hỗ trợ hạ huyết áp tự nhiên.
                        </p>
                      </details>
                    </div>
                  </div>
                </article>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

