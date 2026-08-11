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
  const mealRows: { type: MealType; label: string; icon: string }[] = [
    { type: "breakfast", label: "Sáng", icon: "wb_twilight" },
    { type: "lunch", label: "Trưa", icon: "wb_sunny" },
    { type: "dinner", label: "Tối", icon: "bedtime" },
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

  // Determine header status color class for a date
  const getHeaderStatusStyle = (dayPlans: MealPlanItem[]): {
    headerClass: string;
  } => {
    if (dayPlans.length > 0) {
      return {
        headerClass: "bg-emerald-100/90 border-emerald-300 text-emerald-900 shadow-2xs",
      };
    }

    return {
      headerClass: "bg-surface-container-low border-outline-variant text-on-surface-variant",
    };
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
          <div className="flex items-center bg-surface-container-lowest border border-outline-variant rounded-xl p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`px-md py-1 rounded-lg text-xs font-body-bold flex items-center gap-xs transition-all cursor-pointer ${viewMode === "grid"
                  ? "bg-primary text-on-primary font-semibold shadow-2xs"
                  : "text-on-surface-variant hover:text-on-surface"
                }`}
            >
              <span className="material-symbols-outlined text-[16px]">calendar_view_week</span>
              <span>Thời khóa biểu tuần</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("detail")}
              className={`px-md py-1 rounded-lg text-xs font-body-bold flex items-center gap-xs transition-all cursor-pointer ${viewMode === "detail"
                  ? "bg-primary text-on-primary font-semibold shadow-2xs"
                  : "text-on-surface-variant hover:text-on-surface"
                }`}
            >
              <span className="material-symbols-outlined text-[16px]">restaurant</span>
              <span>Chi tiết bữa ăn</span>
            </button>
          </div>
        }
      />

      <main className="flex-1 w-full p-lg min-h-[calc(100vh-64px)] flex justify-center">
        <div className="w-full max-w-[1280px] flex flex-col gap-section-gap py-md">
          {/* VIEW MODE 1: WEEKLY TIMETABLE GRID */}
          {viewMode === "grid" && (
            <div className="space-y-lg">
              {/* --- PATIENT TOP HEALTH DASHBOARD BAR --- */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-md shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md divide-y sm:divide-y-0 sm:divide-x divide-outline-variant/60">
                {/* Stat 1: Tỷ lệ tuân thủ thực đơn */}
                <div className="px-sm py-xs flex items-center gap-md">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0">
                    <span className="material-symbols-outlined text-[20px]">verified</span>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-on-surface-variant block">Tuân thủ thực đơn</span>
                    <div className="flex items-baseline gap-xs">
                      <span className="font-h1 text-xl font-bold text-emerald-900">{weeklyComplianceRate}%</span>
                      <span className="text-[11px] text-emerald-700 font-semibold">({matchedLogsCount}/{weeklyLogs.length || 7} bữa)</span>
                    </div>
                  </div>
                </div>

                {/* Stat 2: Muối trung bình */}
                <div className="px-sm py-xs flex items-center gap-md pt-sm sm:pt-0">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold shrink-0">
                    <span className="material-symbols-outlined text-[20px]">water_drop</span>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-on-surface-variant block">Lượng muối TB / ngày</span>
                    <div className="flex items-baseline gap-xs">
                      <span className="font-h1 text-xl font-bold text-on-surface">1.6g</span>
                      <span className="text-[11px] bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded font-semibold border border-emerald-200">An toàn &lt;2.0g</span>
                    </div>
                  </div>
                </div>

                {/* Stat 3: Năng lượng Kcal */}
                <div className="px-sm py-xs flex items-center gap-md pt-sm lg:pt-0">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold shrink-0">
                    <span className="material-symbols-outlined text-[20px]">local_fire_department</span>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-on-surface-variant block">Năng lượng Kcal TB</span>
                    <div className="flex items-baseline gap-xs">
                      <span className="font-h1 text-xl font-bold text-on-surface">1,750 kcal</span>
                      <span className="text-[11px] text-on-surface-variant">/ 1,800 mục tiêu</span>
                    </div>
                  </div>
                </div>

                {/* Stat 4: Rau & Nước */}
                <div className="px-sm py-xs flex items-center gap-md pt-sm lg:pt-0">
                  <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold shrink-0">
                    <span className="material-symbols-outlined text-[20px]">eco</span>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-on-surface-variant block">Mục tiêu Rau & Nước</span>
                    <div className="flex items-baseline gap-xs">
                      <span className="font-h1 text-base font-bold text-teal-900">2.5L nước</span>
                      <span className="text-[11px] text-teal-700 font-semibold">• 400g rau</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* --- WEEK NAVIGATION & INFO BAR --- */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-md shadow-xs flex flex-col md:flex-row items-center justify-between gap-md">
                {/* Left: Week Navigation Controls */}
                <div className="flex items-center gap-sm flex-wrap">
                  <button
                    onClick={handlePrevWeek}
                    className="px-md py-2 bg-surface-container-low hover:bg-surface-container-high border border-outline-variant rounded-xl text-xs font-body-bold font-semibold text-on-surface flex items-center gap-xs transition-colors cursor-pointer active:scale-95 shadow-2xs"
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                    <span>Tuần trước</span>
                  </button>

                  <div className="flex items-center gap-xs px-md py-2 bg-emerald-50/60 border border-emerald-200 rounded-xl text-emerald-900 font-bold text-xs shadow-2xs">
                    <span className="material-symbols-outlined text-emerald-700 text-[18px]">
                      calendar_month
                    </span>
                    <span>Tuần: {weekRangeLabel}</span>
                  </div>

                  <button
                    onClick={handleNextWeek}
                    className="px-md py-2 bg-surface-container-low hover:bg-surface-container-high border border-outline-variant rounded-xl text-xs font-body-bold font-semibold text-on-surface flex items-center gap-xs transition-colors cursor-pointer active:scale-95 shadow-2xs"
                  >
                    <span>Tuần sau</span>
                    <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                  </button>

                  <button
                    onClick={handleResetCurrentWeek}
                    className="px-sm py-2 text-xs font-semibold text-primary hover:underline transition-all cursor-pointer ml-1"
                  >
                    Về tuần hiện tại
                  </button>
                </div>

                {/* Right: Info Note */}
                <div className="flex items-center gap-xs text-xs text-on-surface-variant font-medium flex-wrap border-t md:border-t-0 pt-xs md:pt-0 border-outline-variant/60 w-full md:w-auto justify-end">
                  <span className="material-symbols-outlined text-emerald-700 text-[18px]">
                    verified
                  </span>
                  <span>Thực đơn chuẩn y khoa đã được bác sĩ chỉ định</span>
                </div>
              </div>

              {/* --- MAIN WEEKLY TIMETABLE CSS GRID --- */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <div className="min-w-[1050px] grid grid-cols-[100px_repeat(7,1fr)] divide-x divide-y divide-outline-variant/60">

                    {/* Corner Cell */}
                    <div className="sticky left-0 z-20 bg-surface-container-low p-md flex items-center justify-center font-bold text-xs text-on-surface-variant border-r border-outline-variant">
                      Bữa \ Ngày
                    </div>

                    {/* 7 Column Headers with Daily Nutrition Breakdown */}
                    {weekDays.map((day) => {
                      const dayPlans = getPlansForDate(day.isoDate);
                      const { headerClass } = getHeaderStatusStyle(dayPlans);

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
                          className={`p-sm md:p-md flex flex-col justify-between min-h-[90px] transition-all cursor-pointer group hover:brightness-95 ${headerClass}`}
                          title="Bấm để xem chi tiết bữa ăn ngày này"
                        >
                          <div>
                            <span className="font-body-bold font-bold text-sm block">
                              {day.fullDayName}
                            </span>
                            <span className="font-mono text-xs font-medium opacity-85">
                              {day.shortDate}
                            </span>
                          </div>

                          {/* Daily Nutrition Metrics Bar */}
                          <div className="mt-2 pt-1 border-t border-black/10 flex items-center justify-between text-[11px] font-mono">
                            <span>{dayCalo > 0 ? `${dayCalo} kcal` : "—"}</span>
                            <span className={daySalt > 2.0 ? "text-amber-800 font-bold" : "text-emerald-800 font-bold"}>
                              {daySalt > 0 ? `Na: ${daySalt}g` : "—"}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Grid Rows for Breakfast, Lunch, Dinner */}
                    {mealRows.map((row) => (
                      <React.Fragment key={row.type}>
                        {/* Sticky Meal Row Label */}
                        <div className="sticky left-0 z-20 bg-surface-container-low p-md flex flex-col items-center justify-center border-r border-outline-variant font-bold text-sm text-on-surface">
                          <span className="material-symbols-outlined text-primary text-[20px] mb-0.5">
                            {row.icon}
                          </span>
                          <span>{row.label}</span>
                        </div>

                        {/* 7 Day Cells for this Meal */}
                        {weekDays.map((day) => {
                          const cellLogs = patientLogs.filter(
                            (l) => l.date === day.isoDate && l.mealType === row.type
                          );

                          const isPast = day.isoDate <= todayIso;

                          return (
                            <div
                              key={`${day.isoDate}-${row.type}`}
                              onClick={() => setViewMode("detail")}
                              className="p-sm md:p-md min-h-[120px] bg-white flex flex-col justify-between hover:bg-surface-bright transition-colors cursor-pointer"
                              title="Bấm để xem chi tiết bữa ăn"
                            >
                              {cellLogs.length > 0 ? (
                                <div className="space-y-sm">
                                  {cellLogs.map((log) => (
                                    <div key={log.id} className="space-y-1">
                                      {/* Food items with Nutrient info */}
                                      <div className="space-y-1 font-body text-xs text-on-surface leading-snug">
                                        {log.foodItems.map((food, fIdx) => (
                                          <div key={fIdx} className="flex justify-between items-start text-xs border-b border-gray-100 pb-0.5">
                                            <span className="font-medium text-on-surface pr-1">
                                              • {food.name}
                                            </span>
                                            <span className="font-mono text-[10px] text-on-surface-variant shrink-0 font-semibold">
                                              {food.calories ? `${food.calories}k` : ""}{" "}
                                              {food.salt !== undefined ? `| ${food.salt}g` : ""}
                                            </span>
                                          </div>
                                        ))}
                                      </div>

                                      {/* Compliance Badge: "Ăn đúng" / "Ăn khác" */}
                                      <div className="pt-1 flex items-center justify-between gap-1 flex-wrap">
                                        {log.complianceType === "custom" || log.sourceBadgeText === "Ăn khác" ? (
                                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                                            <span className="material-symbols-outlined text-[12px] text-amber-700">edit_note</span>
                                            Ăn khác
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs">
                                            <span className="material-symbols-outlined text-[12px] text-emerald-700">check_circle</span>
                                            Ăn đúng
                                          </span>
                                        )}

                                        <span className="text-[10px] text-emerald-800 font-semibold flex items-center gap-0.5">
                                          <span className="material-symbols-outlined text-[12px] text-emerald-600">eco</span>
                                          ít muối
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="flex-1 flex items-center justify-center text-center">
                                  {isPast ? (
                                    <span className="font-caption text-caption text-outline text-xs italic">
                                      Chưa ghi nhận
                                    </span>
                                  ) : (
                                    <span className="text-outline text-sm font-bold font-mono">
                                      —
                                    </span>
                                  )}
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
            <div className="space-y-section-gap animate-fadeIn">
              {/* Progress / Summary Card */}
              <section className="bg-surface-container-lowest/80 backdrop-blur-md border border-outline-variant/60 rounded-xl p-card-padding flex flex-col sm:flex-row items-start sm:items-center justify-between gap-md shadow-subtle">
                <div>
                  <h3 className="font-body-bold text-on-surface text-base font-semibold">Tổng quan dinh dưỡng hôm nay</h3>
                  <p className="font-body text-on-surface-variant text-sm mt-1">Mục tiêu hàng ngày cho huyết áp & đường huyết ổn định</p>
                </div>
                <div className="flex gap-lg items-center self-end sm:self-auto">
                  <div className="text-center">
                    <div className="font-h2 text-primary font-bold text-lg">
                      1450 <span className="font-body text-sm text-on-surface-variant font-normal">/ 1800</span>
                    </div>
                    <div className="font-caption text-on-surface-variant uppercase tracking-wider text-[11px] mt-1">
                      Kcal
                    </div>
                  </div>
                  <div className="w-px h-10 bg-outline-variant/50 self-center"></div>
                  <div className="text-center">
                    <div className="font-h2 text-tertiary font-bold text-lg">
                      3.2 <span className="font-body text-sm text-on-surface-variant font-normal">/ 5g</span>
                    </div>
                    <div className="font-caption text-on-surface-variant uppercase tracking-wider text-[11px] mt-1">
                      Muối
                    </div>
                  </div>
                </div>
              </section>

              {/* Meals Cards List */}
              <div className="flex flex-col gap-4">
                {/* Breakfast Card */}
                <article className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-subtle hover:shadow-hover transition-shadow duration-300">
                  <div className="p-card-padding">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-tertiary-container text-xl">routine</span>
                        <h3 className="font-body-bold text-on-surface font-semibold">07:00 - Bữa sáng</h3>
                      </div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full font-label text-label bg-primary/10 text-primary font-medium text-xs">
                        Đã hoàn thành
                      </span>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 border border-outline-variant/30 relative">
                        <img
                          className="w-full h-full object-cover"
                          alt="Phở gà ít béo"
                          src="https://lh3.googleusercontent.com/aida-public/AB6AXuAVjwNT1KRGkEUs56K56bgRv8DcVYbh-262-Wwn83Hy8By9lD4HqvKDzD6gRapjtRdfmL8oU-zfh8DeDGVdC6h1gQUS9bRk0APT53LOn1dyzHfZvKikKb1GWJJqGwNk4ejVtzDGCJEhDpCRMIhFowjqUwVGNclfguqId8ImdCv1tSXnHc5wqXrWKosUFoAOLBvQPEN2cnoR-IWnz-NOM-zq5GPlmhFWD_-ibobwycG4i4i0eYMYohN64A"
                        />
                      </div>
                      <div className="flex-grow flex flex-col justify-center">
                        <h4 className="font-h2 text-h2 text-on-surface mb-1 font-semibold text-base">
                          Phở gà ít béo, nhiều rau
                        </h4>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-surface-container text-on-surface-variant font-caption text-caption border border-outline-variant/20 text-xs">
                            <span className="material-symbols-outlined text-[14px]">local_fire_department</span> 350 kcal
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-tertiary-container/10 text-tertiary font-caption text-caption border border-tertiary-container/20 text-xs">
                            <span className="material-symbols-outlined text-[14px]">water_drop</span> 1.2g Muối
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-surface-container text-on-surface-variant font-caption text-caption border border-outline-variant/20 text-xs">
                            <span className="material-symbols-outlined text-[14px]">spa</span> 5g Đường
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-outline-variant/30">
                      <details className="group">
                        <summary className="flex items-center gap-1 cursor-pointer font-body-bold text-sm text-primary hover:text-primary-container transition-colors list-none font-semibold">
                          <span className="material-symbols-outlined text-sm transition-transform duration-200 group-open:rotate-180">
                            expand_more
                          </span>
                          Vì sao gợi ý món này?
                        </summary>
                        <p className="mt-2 text-sm font-body text-on-surface-variant bg-surface-container-low p-3 rounded-lg border border-outline-variant/20">
                          Nước dùng được ninh từ xương ức gà thay vì xương heo giúp giảm đáng kể lượng cholesterol. Hàm lượng Natri thấp (1.2g) rất phù hợp để kiểm soát huyết áp buổi sáng của bạn.
                        </p>
                      </details>
                    </div>
                  </div>
                </article>

                {/* Lunch Card */}
                <article className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-subtle hover:shadow-hover transition-shadow duration-300">
                  <div className="p-card-padding">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-tertiary-container text-xl">light_mode</span>
                        <h3 className="font-body-bold text-on-surface font-semibold">12:30 - Bữa trưa</h3>
                      </div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full font-label text-label bg-secondary/10 text-secondary font-medium text-xs">
                        Sắp tới
                      </span>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 border border-outline-variant/30 relative">
                        <img
                          className="w-full h-full object-cover"
                          alt="Cơm gạo lứt cá hồi nướng"
                          src="https://lh3.googleusercontent.com/aida-public/AB6AXuBxH3tt8gEYfvie8RIzD30n979-Zlc9hI55BV7wrs-GKJWl8flfLTgEy5syTr-R_GvPIR-cAzkEUoz7Iomaplma_RPh3UAhlgTL-e0k1QcEFwhPSGQ9MY4_SwV_RQLefEm6c92SMtjBu-6EJsYiKlUoFtUCmAG7oY4nGNxZqhwgZCUIN85xN1tnj7A70__hCmjF4OjrdY4R58TY2lkfw7MW-U1VmQLYh70Ww6WW7_Cc9ccNOOWWtWro2A"
                        />
                      </div>
                      <div className="flex-grow flex flex-col justify-center">
                        <h4 className="font-h2 text-h2 text-on-surface mb-1 font-semibold text-base">
                          Cơm gạo lứt cá hồi nướng
                        </h4>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-surface-container text-on-surface-variant font-caption text-caption border border-outline-variant/20 text-xs">
                            <span className="material-symbols-outlined text-[14px]">local_fire_department</span> 450 kcal
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-surface-container text-on-surface-variant font-caption text-caption border border-outline-variant/20 text-xs">
                            <span className="material-symbols-outlined text-[14px]">water_drop</span> 0.8g Muối
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-secondary-container/20 text-on-secondary-container font-caption text-caption border border-secondary-container/30 text-xs">
                            <span className="material-symbols-outlined text-[14px]">set_meal</span> Omega-3 cao
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-outline-variant/30">
                      <details className="group">
                        <summary className="flex items-center gap-1 cursor-pointer font-body-bold text-sm text-primary hover:text-primary-container transition-colors list-none font-semibold">
                          <span className="material-symbols-outlined text-sm transition-transform duration-200 group-open:rotate-180">
                            expand_more
                          </span>
                          Vì sao gợi ý món này?
                        </summary>
                        <p className="mt-2 text-sm font-body text-on-surface-variant bg-surface-container-low p-3 rounded-lg border border-outline-variant/20">
                          Cá hồi cung cấp lượng Omega-3 dồi dào giúp bảo vệ thành mạch máu. Gạo lứt có chỉ số GI thấp, giúp duy trì mức đường huyết ổn định trong suốt buổi chiều.
                        </p>
                      </details>
                    </div>
                  </div>
                </article>

                {/* Dinner Card */}
                <article className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-subtle hover:shadow-hover transition-shadow duration-300">
                  <div className="p-card-padding">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-on-secondary-fixed text-xl">dark_mode</span>
                        <h3 className="font-body-bold text-on-surface font-semibold">19:00 - Bữa tối</h3>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 border border-outline-variant/30 relative">
                        <img
                          className="w-full h-full object-cover"
                          alt="Đậu hũ sốt cà chua"
                          src="https://lh3.googleusercontent.com/aida-public/AB6AXuDtSRjEDTZvusEmk9emXLf9sEPEV7Uq30u7qoMiyGYlGX8jLyp_3HMVM6tHofFLznplelsAf0gyp5FVC4Odf8sxxIM5DpsmSHHUvVCVcW-sUYS4Z0M34MyzxPB9oWLx1nifg8Q7RaaqGOXqYp9hZGa8GwX599n0B_3qL0wf2B6COppp2iHoReo3Qgya9bAc9GtsVhVyzKRM81G9aF2id4FDTQMXLXAxbqhcNLFJq4hbB7G49PU_OTt8VQ"
                        />
                      </div>
                      <div className="flex-grow flex flex-col justify-center">
                        <h4 className="font-h2 text-h2 text-on-surface mb-1 font-semibold text-base">
                          Đậu hũ sốt cà chua, Rau muống luộc
                        </h4>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-surface-container text-on-surface-variant font-caption text-caption border border-outline-variant/20 text-xs">
                            <span className="material-symbols-outlined text-[14px]">local_fire_department</span> 280 kcal
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-surface-container text-on-surface-variant font-caption text-caption border border-outline-variant/20 text-xs">
                            <span className="material-symbols-outlined text-[14px]">water_drop</span> 1.1g Muối
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary-container/10 text-primary-container font-caption text-caption border border-primary-container/20 text-xs">
                            <span className="material-symbols-outlined text-[14px]">eco</span> Thuần chay
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-outline-variant/30">
                      <details className="group">
                        <summary className="flex items-center gap-1 cursor-pointer font-body-bold text-sm text-primary hover:text-primary-container transition-colors list-none font-semibold">
                          <span className="material-symbols-outlined text-sm transition-transform duration-200 group-open:rotate-180">
                            expand_more
                          </span>
                          Vì sao gợi ý món này?
                        </summary>
                        <p className="mt-2 text-sm font-body text-on-surface-variant bg-surface-container-low p-3 rounded-lg border border-outline-variant/20">
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
