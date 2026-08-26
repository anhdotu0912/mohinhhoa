"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { PlanExpiryBadge } from "@/components/doctor/PlanExpiryBadge";
import { MealPlanScheduleTable, buildHistoryGenerateHref } from "@/components/doctor/MealPlanScheduleTable";
import { api, assetUrl } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { doctorPatientToUi, type Patient } from "@/lib/mock-data";
import { mealPlanToUiItem } from "@/lib/meal-plan-mappers";
import {
  computeMealPlanValidity,
  formatDateFull,
  formatDateIso,
  formatDateShort,
  parseFlexibleDate,
  planCardUsageLabel,
  type PlanUsageStatus,
  type PlanValidityRange,
} from "@/lib/plan-expiry";
import { pickDefaultSlot, visibleScheduleSlots } from "@/lib/plan-schedule-helpers";
import { buildReviewHref, intentFromSlot, saveSlotIntent } from "@/lib/plan-slot-intent";
import type { DayMealPlan, MealPlanItem } from "@/lib/plans-store";
import { asRouteId } from "@/lib/route-params";
import {
  ApiError,
  type DoctorPatientSummary,
  type MealPlanScheduleOut,
  type MealPlanScheduleSlot,
  type PatientComplianceOut,
  type ScheduleOccupancy,
} from "@/lib/types";

interface HistoryPlanEntry {
  plan: MealPlanItem;
  validity: PlanValidityRange | null;
  usage: PlanUsageStatus;
}

function occupancyToUsage(occupancy: ScheduleOccupancy): PlanUsageStatus {
  if (occupancy === "active") return "active";
  if (occupancy === "upcoming") return "upcoming";
  if (occupancy === "past") return "finished";
  return "none";
}

function getDayMealByIndex(
  planItem: MealPlanItem,
  dayIndex: number
): DayMealPlan | null {
  return (
    planItem.days.find((day) => day.dayIndex === dayIndex) ??
    planItem.days[dayIndex - 1] ??
    null
  );
}

const MEAL_ROWS: { slot: "breakfast" | "lunch" | "dinner"; label: string; icon: string }[] = [
  { slot: "breakfast", label: "Sáng", icon: "wb_twilight" },
  { slot: "lunch", label: "Trưa", icon: "wb_sunny" },
  { slot: "dinner", label: "Tối", icon: "bedtime" },
];

const WEEKDAY_FULL = [
  "Chủ nhật",
  "Thứ 2",
  "Thứ 3",
  "Thứ 4",
  "Thứ 5",
  "Thứ 6",
  "Thứ 7",
];

function toUiPatient(row: DoctorPatientSummary): Patient {
  const ui = doctorPatientToUi(row);
  const avatar = assetUrl(ui.avatar) || ui.avatar;
  return { ...ui, avatar };
}

function shiftDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  next.setHours(0, 0, 0, 0);
  return next;
}

export default function DoctorPatientHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientId = asRouteId(params?.patientId);
  const weekParam = searchParams.get("week");

  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const [hydrated, setHydrated] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [summary, setSummary] = useState<DoctorPatientSummary | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [schedule, setSchedule] = useState<MealPlanScheduleOut | null>(null);
  const [compliance, setCompliance] = useState<PatientComplianceOut | null>(null);
  const [selectedStartsOn, setSelectedStartsOn] = useState<string | null>(null);
  const [previewPlanId, setPreviewPlanId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "day">("grid");
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(1);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const load = useCallback(async (opts?: { silent?: boolean; selectStartsOn?: string }) => {
    if (!token || role !== "doctor") return;
    if (!patientId) {
      setLoading(false);
      setLoadError("Thiếu mã bệnh nhân.");
      return;
    }
    if (!opts?.silent) setLoading(true);
    setLoadError(null);
    try {
      const [patientRow, scheduleData, complianceData] = await Promise.all([
        api.getDoctorPatient(patientId),
        api.getPatientMealPlanSchedule(patientId),
        api.getPatientCompliance(patientId, 14).catch(() => null),
      ]);
      setSummary(patientRow);
      setPatient(toUiPatient(patientRow));
      setSchedule(scheduleData);
      setCompliance(complianceData);

      if (opts?.selectStartsOn) {
        setSelectedStartsOn(opts.selectStartsOn);
      } else if (!opts?.silent) {
        setSelectedStartsOn(
          weekParam ?? pickDefaultSlot(scheduleData)?.starts_on ?? null
        );
      }
    } catch (err) {
      setLoadError(
        err instanceof ApiError
          ? err.message
          : "Không tải được lịch sử thực đơn."
      );
      if (!opts?.silent) {
        setSummary(null);
        setPatient(null);
        setSchedule(null);
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [token, role, patientId, weekParam]);

  useEffect(() => {
    if (!hydrated) return;
    if (!token || role !== "doctor") {
      router.replace("/login");
      return;
    }
    void load();
  }, [hydrated, token, role, router, load]);

  const displaySlots = useMemo(
    () => (schedule ? visibleScheduleSlots(schedule) : []),
    [schedule]
  );

  const selectedSlot = useMemo(() => {
    if (!displaySlots.length) return null;
    return (
      displaySlots.find((slot) => slot.starts_on === selectedStartsOn) ??
      displaySlots.find((slot) => slot.slot_key === "current") ??
      displaySlots[1] ??
      displaySlots[0]
    );
  }, [displaySlots, selectedStartsOn]);

  const selectedEntry = useMemo((): HistoryPlanEntry | null => {
    if (!selectedSlot || !patient || !summary) return null;
    const rawPlan =
      selectedSlot.plan ??
      (selectedSlot.slot_key === "current"
        ? (schedule?.unassigned_plans.find((p) => p.id === previewPlanId) ??
          schedule?.unassigned_plans[0] ??
          null)
        : null);
    if (!rawPlan) return null;
    const validity = computeMealPlanValidity(rawPlan);
    return {
      plan: mealPlanToUiItem(rawPlan, {
        patientName: patient.name,
        patientCode: patient.id,
        condition: patient.condition,
      }),
      validity,
      usage: occupancyToUsage(selectedSlot.occupancy),
    };
  }, [selectedSlot, patient, summary, schedule, previewPlanId]);

  const adherenceByDate = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const pt of compliance?.daily_series ?? []) {
      map.set(pt.date, pt.adherence_pct);
    }
    return map;
  }, [compliance]);

  const todayIso = useMemo(
    () => schedule?.today ?? formatDateIso(new Date()),
    [schedule?.today]
  );

  const weekStart = useMemo(() => {
    const fromSlot = parseFlexibleDate(selectedSlot?.starts_on);
    if (fromSlot) return fromSlot;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }, [selectedSlot?.starts_on]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = shiftDays(weekStart, i);
      const isoDate = formatDateIso(d);
      return {
        dayIndex: i + 1,
        fullDayName: WEEKDAY_FULL[d.getDay()],
        isoDate,
        shortDate: formatDateShort(d),
        isToday: isoDate === todayIso,
      };
    });
  }, [weekStart, todayIso]);

  useEffect(() => {
    const todayEntry = weekDays.find((d) => d.isToday);
    if (todayEntry) {
      setSelectedDayIdx(todayEntry.dayIndex);
    }
  }, [weekDays]);

  const weekEnd = useMemo(() => shiftDays(weekStart, 6), [weekStart]);

  const weekRangeLabel = `${formatDateShort(weekStart)} – ${formatDateFull(weekEnd)}`;
  const weekInPlan = Boolean(selectedEntry);

  const weeklyStats = useMemo(() => {
    if (!selectedEntry || !weekInPlan) {
      return {
        adherencePct: null as number | null,
        avgKcal: 0,
        avgSalt: 0,
        checkinsDone: compliance?.checkins_done ?? 0,
      };
    }

    let kcalSum = 0;
    let saltSum = 0;
    let dayCount = 0;
    const adherenceValues: number[] = [];

    for (const day of weekDays) {
      const dayMeal = selectedEntry
        ? getDayMealByIndex(selectedEntry.plan, day.dayIndex)
        : null;
      if (dayMeal) {
        kcalSum += dayMeal.totalCalories ?? 0;
        saltSum += dayMeal.totalSalt ?? 0;
        dayCount += 1;
      }
      const adh = adherenceByDate.get(day.isoDate);
      if (adh != null) adherenceValues.push(adh);
    }

    const adherencePct =
      adherenceValues.length > 0
        ? Math.round(
            adherenceValues.reduce((a, b) => a + b, 0) / adherenceValues.length
          )
        : compliance?.overall_adherence_pct ?? null;

    return {
      adherencePct,
      avgKcal: dayCount > 0 ? Math.round(kcalSum / dayCount) : 0,
      avgSalt:
        dayCount > 0 ? Math.round((saltSum / dayCount) * 10) / 10 : 0,
      checkinsDone: compliance?.checkins_done ?? 0,
    };
  }, [
    selectedEntry,
    weekInPlan,
    weekDays,
    adherenceByDate,
    compliance,
  ]);

  const handlePrevWeek = () => {
    if (!selectedSlot) return;
    const idx = displaySlots.findIndex(
      (slot) => slot.starts_on === selectedSlot.starts_on
    );
    if (idx > 0) setSelectedStartsOn(displaySlots[idx - 1].starts_on);
  };

  const handleNextWeek = () => {
    if (!selectedSlot) return;
    const idx = displaySlots.findIndex(
      (slot) => slot.starts_on === selectedSlot.starts_on
    );
    if (idx >= 0 && idx < displaySlots.length - 1) {
      setSelectedStartsOn(displaySlots[idx + 1].starts_on);
    }
  };

  const handleResetCurrentWeek = () => {
    const current = displaySlots.find((slot) => slot.slot_key === "current");
    if (current) setSelectedStartsOn(current.starts_on);
    const todayDay = weekDays.find((d) => d.isToday);
    if (todayDay) setSelectedDayIdx(todayDay.dayIndex);
  };

  const handleSelectSlot = (slot: MealPlanScheduleSlot) => {
    setSelectedStartsOn(slot.starts_on);
  };

  const handleDaySelect = (dayIndex: number) => {
    setSelectedDayIdx(dayIndex);
    setViewMode("day");
  };

  if (!hydrated || !token || role !== "doctor") {
    return null;
  }

  if (loading) {
    return (
      <main className="p-6 text-sm text-on-surface-variant max-w-[1440px] mx-auto">
        Đang tải lịch sử thực đơn…
      </main>
    );
  }

  if (loadError || !patient || !summary) {
    return (
      <main className="p-6 max-w-[1440px] mx-auto">
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-rose-800 text-sm">
          {loadError || "Không tìm thấy bệnh nhân."}
        </div>
      </main>
    );
  }

  const selectedExpiryFields = selectedEntry?.validity
    ? {
        plan_expiry: selectedEntry.validity.bucket,
        plan_days_left: selectedEntry.validity.daysLeft,
        plan_end_date: selectedEntry.validity.endDateLabel,
      }
    : null;

  const currentDayData = selectedEntry ? getDayMealByIndex(selectedEntry.plan, selectedDayIdx) : null;
  const currentWeekDayMeta = weekDays[selectedDayIdx - 1];

  return (
      <main className="p-6 max-w-[1440px] mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {selectedEntry && (
              <span
                className={`inline-flex items-center px-3 py-0.5 rounded-full text-xs font-bold border ${
                  selectedEntry.plan.status === "pending"
                    ? "bg-amber-50 text-amber-900 border-amber-200"
                    : "bg-emerald-50 text-emerald-900 border-emerald-200"
                }`}
              >
                {selectedEntry.plan.status === "pending"
                  ? "Chờ duyệt"
                  : planCardUsageLabel(
                      selectedEntry.usage,
                      selectedEntry.validity != null
                    )}
              </span>
            )}
            <PlanExpiryBadge expiry={selectedExpiryFields} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {selectedEntry?.plan.status === "pending" && patientId && selectedSlot && (
              <Link
                href={buildReviewHref(
                  patientId,
                  selectedEntry.plan.id,
                  intentFromSlot(patientId, selectedSlot, "add")
                )}
                onClick={() =>
                  saveSlotIntent(intentFromSlot(patientId, selectedSlot, "add"))
                }
                className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">assignment_turned_in</span>
                Duyệt thực đơn
              </Link>
            )}
            <Link
              href={buildHistoryGenerateHref(patientId!, schedule)}
              className="bg-primary hover:bg-primary/90 text-on-primary px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
              Tạo thực đơn AI mới
            </Link>
          </div>
        </div>

        {/* 3-Week Schedule Section */}
        {schedule && (
          <MealPlanScheduleTable
            patientId={patientId!}
            schedule={schedule}
            selectedStartsOn={selectedSlot?.starts_on ?? selectedStartsOn}
            onSelectSlot={handleSelectSlot}
            onPreviewPlan={(plan) => setPreviewPlanId(plan.id)}
            onRefresh={(applied) =>
              load({ silent: true, selectStartsOn: applied?.startsOn })
            }
          />
        )}

        {/* Weekly Content & View Controller */}
        {selectedSlot && (
          <div id="meal-week-grid" className="space-y-6">
            {/* Unified Weekly Toolbar & KPI Summary */}
            <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-3xl p-5 shadow-xs">
              {/* Controls row */}
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 pb-4 border-b border-outline-variant/50">
                {/* Week selector buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handlePrevWeek}
                    className="px-3 py-1.5 bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/60 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                    Tuần trước
                  </button>
                  <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary/10 border border-primary/25 rounded-xl text-primary font-bold text-xs">
                    <span className="material-symbols-outlined text-primary text-[18px]">
                      calendar_month
                    </span>
                    <span>Tuần: {weekRangeLabel}</span>
                  </div>
                  <button
                    onClick={handleNextWeek}
                    className="px-3 py-1.5 bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/60 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                  >
                    Tuần sau
                    <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                  </button>
                  <button
                    onClick={handleResetCurrentWeek}
                    className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-900 border border-emerald-500/25 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-2xs"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                    Về hôm nay
                  </button>
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-2xl border border-outline-variant/50 self-start lg:self-auto">
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      viewMode === "grid"
                        ? "bg-primary text-on-primary shadow-2xs"
                        : "text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">grid_view</span>
                    <span>Lưới 7 ngày</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("day")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      viewMode === "day"
                        ? "bg-primary text-on-primary shadow-2xs"
                        : "text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">view_day</span>
                    <span>Trọng tâm ngày</span>
                  </button>
                </div>
              </div>

              {/* 4 KPI Metric Chips */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4">
                <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-surface-container-low/40">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-800 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[20px]">check_circle</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-on-surface-variant block">
                      Tuân thủ tuần
                    </span>
                    <span className="text-base font-bold text-emerald-900 font-mono tabular-nums">
                      {weeklyStats.adherencePct != null ? `${weeklyStats.adherencePct}%` : "Chưa có"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-surface-container-low/40">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-800 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[20px]">grain</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-on-surface-variant block">
                      Natri TB / ngày
                    </span>
                    <span className="text-base font-bold text-on-surface font-mono tabular-nums">
                      {weeklyStats.avgSalt}g
                    </span>
                    {summary.salt_daily_g != null && (
                      <span className="text-[10px] text-on-surface-variant ml-1">
                        / {summary.salt_daily_g}g
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-surface-container-low/40">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-800 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[20px]">local_fire_department</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-on-surface-variant block">
                      Năng lượng TB / ngày
                    </span>
                    <span className="text-base font-bold text-on-surface font-mono tabular-nums">
                      {weeklyStats.avgKcal.toLocaleString("vi-VN")} kcal
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-surface-container-low/40">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-800 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[20px]">event</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-on-surface-variant block">
                      Hạn thực đơn
                    </span>
                    <PlanExpiryBadge expiry={selectedExpiryFields} />
                  </div>
                </div>
              </div>
            </div>

            {/* Main Menu Display Area */}
            {!weekInPlan ? (
              <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-3xl p-10 text-center text-on-surface-variant shadow-xs">
                <span className="material-symbols-outlined text-[48px] text-outline mb-2">
                  calendar_today
                </span>
                <p className="font-bold text-sm text-on-surface">Chưa có thực đơn cho tuần này</p>
                <p className="text-xs mt-1 max-w-[40ch] mx-auto text-on-surface-variant">
                  Tuần {weekRangeLabel} chưa được gán kế hoạch. Bạn có thể bấm “Thêm thực đơn” ở thẻ tuần tương ứng bên trên.
                </p>
              </div>
            ) : viewMode === "grid" ? (
              /* Mode 1: 7-Column Day Cards (Weekly Kanban Layout) */
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3.5">
                {weekDays.map((day) => {
                  const dayMeal = selectedEntry ? getDayMealByIndex(selectedEntry.plan, day.dayIndex) : null;
                  const adherence = adherenceByDate.get(day.isoDate);
                  const dayKcal = dayMeal?.totalCalories ?? 0;
                  const daySalt = dayMeal?.totalSalt ?? 0;

                  return (
                    <div
                      key={day.isoDate}
                      className={`rounded-3xl p-3.5 flex flex-col justify-between transition-all group relative overflow-hidden ${
                        day.isToday
                          ? "bg-gradient-to-b from-primary/[0.08] via-emerald-50/30 to-white border-2 border-primary shadow-lg ring-4 ring-primary/15"
                          : "bg-white border border-outline-variant/60 shadow-xs hover:border-primary/40 hover:shadow-md"
                      }`}
                    >
                      {/* Today Ribbon / Badge */}
                      {day.isToday && (
                        <div className="absolute top-0 right-0">
                          <div className="bg-primary text-on-primary text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-bl-xl shadow-xs flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                            Hôm nay
                          </div>
                        </div>
                      )}

                      {/* Day Header */}
                      <div className={`pb-2.5 border-b mb-3 ${day.isToday ? "border-primary/25 pt-2" : "border-outline-variant/40"}`}>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className={`text-xs transition-colors flex items-center gap-1.5 ${
                            day.isToday ? "font-black text-primary text-sm" : "font-bold text-on-surface group-hover:text-primary"
                          }`}>
                            {day.fullDayName}
                            {day.isToday && (
                              <span className="inline-block w-2 h-2 rounded-full bg-primary" />
                            )}
                          </span>
                          {adherence != null && (
                            <span
                              className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                                adherence >= 80
                                  ? "bg-emerald-500/15 text-emerald-900 border border-emerald-500/20"
                                  : adherence >= 50
                                    ? "bg-amber-500/15 text-amber-900 border border-amber-500/20"
                                    : "bg-rose-500/15 text-rose-900 border border-rose-500/20"
                              }`}
                            >
                              {adherence}%
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-[11px] font-mono text-on-surface-variant">
                          <span className={day.isToday ? "font-bold text-primary" : ""}>{day.shortDate}</span>
                          <span className={`font-semibold ${day.isToday ? "text-primary font-bold" : "text-emerald-900"}`}>
                            {dayKcal > 0 ? `${dayKcal} kcal` : "—"}
                          </span>
                        </div>
                      </div>

                      {/* 3 Meals Mini Cards */}
                      <div className="space-y-2 flex-1 mb-3">
                        {/* Breakfast */}
                        <div className={`rounded-xl p-2 transition-all ${
                          day.isToday
                            ? "bg-amber-500/[0.12] border-2 border-amber-500/30 shadow-2xs"
                            : "bg-amber-500/[0.06] border border-amber-500/15"
                        }`}>
                          <div className="flex items-center justify-between text-[10px] font-bold text-amber-900 mb-1">
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px]">wb_twilight</span>
                              Sáng
                            </span>
                          </div>
                          {dayMeal?.breakfast && dayMeal.breakfast.length > 0 ? (
                            <div className="space-y-1 text-[11px] text-on-surface">
                              {dayMeal.breakfast.map((food, fIdx) => (
                                <div key={fIdx} className="flex justify-between items-start leading-tight">
                                  <span className="truncate pr-1 font-medium">• {food.name}</span>
                                  <span className="text-[10px] font-mono text-on-surface-variant shrink-0">
                                    {food.calories}k
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[10px] text-outline italic">—</span>
                          )}
                        </div>

                        {/* Lunch */}
                        <div className={`rounded-xl p-2 transition-all ${
                          day.isToday
                            ? "bg-emerald-500/[0.12] border-2 border-emerald-500/30 shadow-2xs"
                            : "bg-emerald-500/[0.06] border border-emerald-500/15"
                        }`}>
                          <div className="flex items-center justify-between text-[10px] font-bold text-emerald-900 mb-1">
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px]">wb_sunny</span>
                              Trưa
                            </span>
                          </div>
                          {dayMeal?.lunch && dayMeal.lunch.length > 0 ? (
                            <div className="space-y-1 text-[11px] text-on-surface">
                              {dayMeal.lunch.map((food, fIdx) => (
                                <div key={fIdx} className="flex justify-between items-start leading-tight">
                                  <span className="truncate pr-1 font-medium">• {food.name}</span>
                                  <span className="text-[10px] font-mono text-on-surface-variant shrink-0">
                                    {food.calories}k
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[10px] text-outline italic">—</span>
                          )}
                        </div>

                        {/* Dinner */}
                        <div className={`rounded-xl p-2 transition-all ${
                          day.isToday
                            ? "bg-sky-500/[0.12] border-2 border-sky-500/30 shadow-2xs"
                            : "bg-sky-500/[0.06] border border-sky-500/15"
                        }`}>
                          <div className="flex items-center justify-between text-[10px] font-bold text-sky-900 mb-1">
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px]">bedtime</span>
                              Tối
                            </span>
                          </div>
                          {dayMeal?.dinner && dayMeal.dinner.length > 0 ? (
                            <div className="space-y-1 text-[11px] text-on-surface">
                              {dayMeal.dinner.map((food, fIdx) => (
                                <div key={fIdx} className="flex justify-between items-start leading-tight">
                                  <span className="truncate pr-1 font-medium">• {food.name}</span>
                                  <span className="text-[10px] font-mono text-on-surface-variant shrink-0">
                                    {food.calories}k
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[10px] text-outline italic">—</span>
                          )}
                        </div>
                      </div>

                      {/* View Day Details CTA */}
                      <button
                        type="button"
                        onClick={() => handleDaySelect(day.dayIndex)}
                        className={`w-full py-1.5 text-[11px] font-bold rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer ${
                          day.isToday
                            ? "bg-primary text-on-primary hover:bg-primary/90 shadow-2xs ring-2 ring-primary/20"
                            : "text-primary hover:bg-primary/10 border border-primary/20"
                        }`}
                      >
                        <span>{day.isToday ? "Xem thực đơn hôm nay" : "Chi tiết ngày"}</span>
                        <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Mode 2: Daily Focus Inspector */
              <div className="space-y-4">
                {/* 7 Day Tabs Horizontal Bar */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
                  {weekDays.map((day) => {
                    const isActive = day.dayIndex === selectedDayIdx;
                    return (
                      <button
                        key={day.isoDate}
                        type="button"
                        onClick={() => setSelectedDayIdx(day.dayIndex)}
                        className={`px-4 py-2 rounded-2xl text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-2 ${
                          isActive
                            ? "bg-primary text-on-primary shadow-xs ring-2 ring-primary/30"
                            : day.isToday
                              ? "bg-primary/10 border-2 border-primary/40 text-primary font-black hover:bg-primary/15"
                              : "bg-surface-container-lowest border border-outline-variant/60 text-on-surface hover:bg-surface-container-low"
                        }`}
                      >
                        <span className="flex items-center gap-1">
                          {day.isToday && <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
                          {day.fullDayName}
                        </span>
                        {day.isToday && (
                          <span
                            className={`px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase ${
                              isActive ? "bg-white/20 text-white" : "bg-primary text-white"
                            }`}
                          >
                            Hôm nay
                          </span>
                        )}
                        <span className={`font-mono text-[11px] ${isActive ? "text-on-primary/80" : "text-on-surface-variant"}`}>
                          {day.shortDate}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Day Overview Summary */}
                {currentDayData ? (
                  <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-3xl p-5 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-outline-variant/40 mb-5">
                      <div>
                        <h4 className="font-h2 text-base font-bold text-on-surface flex items-center gap-2">
                          <span>
                            {currentWeekDayMeta?.fullDayName} ({currentWeekDayMeta?.shortDate})
                            {currentWeekDayMeta?.isToday && (
                              <span className="ml-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black uppercase bg-primary text-on-primary">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                                Hôm nay
                              </span>
                            )}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-900 border border-emerald-500/20 font-mono">
                            Tổng: {currentDayData.totalCalories} kcal
                          </span>
                        </h4>
                      </div>
                      {patientId && selectedEntry && (
                        <Link
                          href={`/doctor/reviews/${encodeURIComponent(patientId)}/${encodeURIComponent(selectedEntry.plan.id)}`}
                          className="px-3 py-1.5 bg-primary text-on-primary rounded-xl text-xs font-bold hover:bg-primary/90 transition-all flex items-center gap-1 shadow-2xs"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                          <span>Chỉnh sửa thực đơn này</span>
                        </Link>
                      )}
                    </div>

                    {/* 3 Spacious Meal Cards */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      {/* Breakfast Large Card */}
                      <div className="bg-surface-container-low/30 border border-amber-500/20 rounded-2xl p-4 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-amber-500/15">
                            <span className="font-bold text-sm text-amber-950 flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-amber-700 text-[18px]">wb_twilight</span>
                              Bữa sáng
                            </span>
                            <span className="font-mono font-bold text-xs text-amber-900 bg-amber-500/15 px-2 py-0.5 rounded-full">
                              {currentDayData.breakfast?.reduce((s, i) => s + (i.calories || 0), 0)} kcal
                            </span>
                          </div>
                          <div className="space-y-2">
                            {currentDayData.breakfast?.map((food, idx) => (
                              <div key={idx} className="bg-white rounded-xl p-2.5 border border-outline-variant/40">
                                <div className="flex justify-between items-start">
                                  <span className="font-bold text-xs text-on-surface">{food.name}</span>
                                  <span className="font-mono text-xs text-emerald-900 font-semibold">{food.calories} kcal</span>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-on-surface-variant mt-1">
                                  {food.salt !== undefined && <span>Muối: {food.salt}g</span>}
                                  {food.carbG !== undefined && <span>• Carb: {food.carbG}g</span>}
                                  {food.fat !== undefined && <span>• Chất béo: {food.fat}g</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Lunch Large Card */}
                      <div className="bg-surface-container-low/30 border border-emerald-500/20 rounded-2xl p-4 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-emerald-500/15">
                            <span className="font-bold text-sm text-emerald-950 flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-emerald-700 text-[18px]">wb_sunny</span>
                              Bữa trưa
                            </span>
                            <span className="font-mono font-bold text-xs text-emerald-900 bg-emerald-500/15 px-2 py-0.5 rounded-full">
                              {currentDayData.lunch?.reduce((s, i) => s + (i.calories || 0), 0)} kcal
                            </span>
                          </div>
                          <div className="space-y-2">
                            {currentDayData.lunch?.map((food, idx) => (
                              <div key={idx} className="bg-white rounded-xl p-2.5 border border-outline-variant/40">
                                <div className="flex justify-between items-start">
                                  <span className="font-bold text-xs text-on-surface">{food.name}</span>
                                  <span className="font-mono text-xs text-emerald-900 font-semibold">{food.calories} kcal</span>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-on-surface-variant mt-1">
                                  {food.salt !== undefined && <span>Muối: {food.salt}g</span>}
                                  {food.carbG !== undefined && <span>• Carb: {food.carbG}g</span>}
                                  {food.fat !== undefined && <span>• Chất béo: {food.fat}g</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Dinner Large Card */}
                      <div className="bg-surface-container-low/30 border border-sky-500/20 rounded-2xl p-4 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-sky-500/15">
                            <span className="font-bold text-sm text-sky-950 flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-sky-700 text-[18px]">bedtime</span>
                              Bữa tối
                            </span>
                            <span className="font-mono font-bold text-xs text-sky-900 bg-sky-500/15 px-2 py-0.5 rounded-full">
                              {currentDayData.dinner?.reduce((s, i) => s + (i.calories || 0), 0)} kcal
                            </span>
                          </div>
                          <div className="space-y-2">
                            {currentDayData.dinner?.map((food, idx) => (
                              <div key={idx} className="bg-white rounded-xl p-2.5 border border-outline-variant/40">
                                <div className="flex justify-between items-start">
                                  <span className="font-bold text-xs text-on-surface">{food.name}</span>
                                  <span className="font-mono text-xs text-emerald-900 font-semibold">{food.calories} kcal</span>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-on-surface-variant mt-1">
                                  {food.salt !== undefined && <span>Muối: {food.salt}g</span>}
                                  {food.carbG !== undefined && <span>• Carb: {food.carbG}g</span>}
                                  {food.fat !== undefined && <span>• Chất béo: {food.fat}g</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-3xl p-8 text-center text-on-surface-variant">
                    <p className="text-xs italic">Không có dữ liệu chi tiết cho ngày được chọn.</p>
                  </div>
                )}
              </div>
            )}

            {/* Bottom footnote */}
            <div className="p-4 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl text-xs text-on-surface-variant flex items-center justify-between gap-4 flex-wrap shadow-xs">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[18px]">info</span>
                Dữ liệu thực đơn đã qua cổng kiểm soát lâm sàng tự động và đối soát tương tác thuốc.
              </span>
              <Link
                href={`/doctor/patients/${encodeURIComponent(patientId!)}`}
                className="text-primary font-bold hover:underline flex items-center gap-1 text-xs"
              >
                <span>Hồ sơ chi tiết bệnh nhân</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </Link>
            </div>
          </div>
        )}
      </main>
  );
}
