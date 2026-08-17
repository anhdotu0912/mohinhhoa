"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { TopBar } from "@/components/shared/TopBar";
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
      return {
        dayIndex: i + 1,
        fullDayName: WEEKDAY_FULL[d.getDay()],
        isoDate: formatDateIso(d),
        shortDate: formatDateShort(d),
      };
    });
  }, [weekStart]);

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
  };

  const handleSelectSlot = (slot: MealPlanScheduleSlot) => {
    setSelectedStartsOn(slot.starts_on);
    requestAnimationFrame(() => {
      document.getElementById("meal-week-grid")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const handleHeaderClick = () => {
    if (selectedEntry && patientId) {
      router.push(
        `/doctor/reviews/${encodeURIComponent(patientId)}/${encodeURIComponent(selectedEntry.plan.id)}`
      );
    }
  };

  if (!hydrated || !token || role !== "doctor") {
    return null;
  }

  if (loading) {
    return (
      <>
        <TopBar title="Lịch sử thực đơn" />
        <main className="p-lg text-sm text-on-surface-variant">
          Đang tải lịch sử thực đơn…
        </main>
      </>
    );
  }

  if (loadError || !patient || !summary) {
    return (
      <>
        <TopBar title="Lịch sử thực đơn" />
        <main className="p-lg max-w-[1440px]">
          <Link
            href="/doctor/history"
            className="inline-flex items-center gap-xs text-xs font-semibold text-primary hover:underline mb-md"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Quay lại danh sách
          </Link>
          <div className="bg-red-50 border border-red-200 rounded-xl p-lg text-red-800 text-sm">
            {loadError || "Không tìm thấy bệnh nhân."}
          </div>
        </main>
      </>
    );
  }

  const selectedExpiryFields = selectedEntry?.validity
    ? {
        plan_expiry: selectedEntry.validity.bucket,
        plan_days_left: selectedEntry.validity.daysLeft,
        plan_end_date: selectedEntry.validity.endDateLabel,
      }
    : null;

  return (
    <>
      <TopBar title={`Lịch sử thực đơn — ${patient.name}`} />

      <main className="p-lg max-w-[1440px]">
        <div className="mb-md flex items-center justify-between flex-wrap gap-sm">
          <Link
            href="/doctor/history"
            className="inline-flex items-center gap-xs text-xs font-semibold text-primary hover:underline cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Quay lại danh sách bệnh nhân
          </Link>
          <PlanExpiryBadge expiry={selectedExpiryFields} />
        </div>

        {/* Patient header */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-lg mb-md flex flex-col md:flex-row md:items-center justify-between gap-md shadow-xs">
          <div className="flex items-center gap-md">
            <div className="relative w-14 h-14 shrink-0">
              <div className="w-14 h-14 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-lg">
                {patient.name.charAt(0)}
              </div>
              {patient.avatar && (
                <img
                  src={patient.avatar}
                  alt={patient.name}
                  className="absolute inset-0 w-14 h-14 rounded-full object-cover border border-outline-variant"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              )}
            </div>
            <div>
              <div className="flex items-center gap-sm flex-wrap">
                <h2 className="font-h1 text-h1 text-on-surface font-bold text-xl">
                  {patient.name}
                </h2>
                <span className="font-mono bg-surface-container-high px-2 py-0.5 rounded-md text-xs font-semibold text-on-surface-variant">
                  {patient.id}
                </span>
                {selectedEntry && (
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-caption text-xs font-semibold border ${
                      selectedEntry.plan.status === "pending"
                        ? "bg-amber-50 text-amber-900 border-amber-200"
                        : "bg-primary-container/20 text-primary border-primary-container/30"
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
              </div>
              <p className="text-xs text-on-surface-variant mt-1">
                {patient.age} tuổi • {patient.gender} • {patient.condition}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-sm flex-wrap">
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
                className="bg-amber-600 hover:bg-amber-700 text-white font-body-bold px-md py-2 rounded-lg text-xs font-semibold flex items-center gap-xs shadow-2xs transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">assignment_turned_in</span>
                Duyệt thực đơn
              </Link>
            )}
            <Link
              href={buildHistoryGenerateHref(patientId!, schedule)}
              className="bg-primary hover:bg-primary-container text-on-primary font-body-bold px-md py-2 rounded-lg text-xs font-semibold flex items-center gap-xs shadow-2xs transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
              Tạo thực đơn AI mới
            </Link>
          </div>
        </div>

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

        {selectedSlot && (
          <div id="meal-week-grid">
            {/* Stats bar */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-md mb-section-gap shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md">
              <div className="px-sm py-xs flex items-center gap-md">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">check_circle</span>
                </div>
                <div>
                  <span className="text-xs font-medium text-on-surface-variant block">
                    Tuân thủ check-in tuần
                  </span>
                  <span className="font-h1 text-xl font-bold text-emerald-900">
                    {weeklyStats.adherencePct != null
                      ? `${weeklyStats.adherencePct}%`
                      : "Chưa có dữ liệu"}
                  </span>
                </div>
              </div>
              <div className="px-sm py-xs flex items-center gap-md">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">grain</span>
                </div>
                <div>
                  <span className="text-xs font-medium text-on-surface-variant block">
                    Natri kế hoạch TB
                  </span>
                  <span className="font-h1 text-xl font-bold text-on-surface">
                    {weeklyStats.avgSalt}g
                  </span>
                  {summary.salt_daily_g != null && (
                    <span className="text-[11px] text-on-surface-variant ml-1">
                      / mục tiêu {summary.salt_daily_g}g
                    </span>
                  )}
                </div>
              </div>
              <div className="px-sm py-xs flex items-center gap-md">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">local_fire_department</span>
                </div>
                <div>
                  <span className="text-xs font-medium text-on-surface-variant block">
                    Năng lượng kế hoạch TB
                  </span>
                  <span className="font-h1 text-xl font-bold text-on-surface">
                    {weeklyStats.avgKcal.toLocaleString()} kcal
                  </span>
                  <span className="text-[11px] text-on-surface-variant ml-1">
                    / {summary.target_kcal} mục tiêu
                  </span>
                </div>
              </div>
              <div className="px-sm py-xs flex items-center gap-md">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">event</span>
                </div>
                <div>
                  <span className="text-xs font-medium text-on-surface-variant block">
                    Hạn thực đơn
                  </span>
                  <PlanExpiryBadge expiry={selectedExpiryFields} />
                </div>
              </div>
            </div>

            {/* Week nav */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-md mb-lg shadow-xs flex flex-col md:flex-row items-center justify-between gap-md">
              <div className="flex items-center gap-sm flex-wrap">
                <button
                  onClick={handlePrevWeek}
                  className="px-md py-2 bg-surface-container-low hover:bg-surface-container-high border border-outline-variant rounded-xl text-xs font-semibold flex items-center gap-xs cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                  Tuần trước
                </button>
                <div className="flex items-center gap-xs px-md py-2 bg-emerald-50/60 border border-emerald-200 rounded-xl text-emerald-900 font-bold text-xs">
                  <span className="material-symbols-outlined text-emerald-700 text-[18px]">
                    calendar_month
                  </span>
                  Tuần: {weekRangeLabel}
                </div>
                <button
                  onClick={handleNextWeek}
                  className="px-md py-2 bg-surface-container-low hover:bg-surface-container-high border border-outline-variant rounded-xl text-xs font-semibold flex items-center gap-xs cursor-pointer"
                >
                  Tuần sau
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
                <button
                  onClick={handleResetCurrentWeek}
                  className="px-sm py-2 text-xs font-semibold text-primary hover:underline cursor-pointer"
                >
                  Về tuần thực đơn
                </button>
              </div>
              <div className="text-xs text-on-surface-variant">
                {selectedEntry?.validity
                  ? `Kế hoạch: ${selectedEntry.validity.startDateLabel} – ${selectedEntry.validity.endDateLabel}`
                  : selectedEntry
                    ? "Thực đơn chưa gán vào tuần này"
                    : "Chưa có thực đơn cho tuần đang xem"}
              </div>
            </div>

            {/* Week grid */}
            {!weekInPlan ? (
              <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-xl text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-[40px] text-outline mb-sm">
                  calendar_today
                </span>
                <p className="font-semibold">Chưa có thực đơn tuần này</p>
                <p className="text-xs mt-xs">
                  Tuần {weekRangeLabel} chưa được gán thực đơn. Bấm “Thêm thực đơn” trên cột tương ứng ở bảng lịch trình.
                </p>
              </div>
            ) : (
              <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <div className="min-w-[1050px] grid grid-cols-[100px_repeat(7,1fr)] divide-x divide-y divide-outline-variant/60">
                    <div className="sticky left-0 z-20 bg-surface-container-low p-md flex items-center justify-center font-bold text-xs text-on-surface-variant border-r border-outline-variant">
                      Bữa \ Ngày
                    </div>

                    {weekDays.map((day) => {
                      const dayMeal = selectedEntry
                        ? getDayMealByIndex(selectedEntry.plan, day.dayIndex)
                        : null;
                      const adherence = adherenceByDate.get(day.isoDate);
                      const dayKcal = dayMeal?.totalCalories ?? 0;
                      const daySalt = dayMeal?.totalSalt ?? 0;
                      const inPlan = dayMeal != null;

                      return (
                        <div
                          key={day.isoDate}
                          onClick={inPlan ? handleHeaderClick : undefined}
                          className={`p-sm md:p-md flex flex-col justify-between min-h-[95px] transition-all ${
                            inPlan
                              ? "bg-emerald-100/90 border-emerald-300 text-emerald-900 cursor-pointer hover:brightness-95"
                              : "bg-surface-container-low text-on-surface-variant"
                          }`}
                          title={
                            inPlan
                              ? "Bấm để xem chi tiết thực đơn"
                              : undefined
                          }
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-bold text-sm block">
                                {day.fullDayName}
                              </span>
                              <span className="font-mono text-xs opacity-85">
                                {day.shortDate}
                              </span>
                            </div>
                            {adherence != null && (
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  adherence >= 80
                                    ? "bg-emerald-600 text-white"
                                    : adherence >= 50
                                      ? "bg-amber-500 text-white"
                                      : "bg-red-500 text-white"
                                }`}
                              >
                                {adherence}%
                              </span>
                            )}
                          </div>
                          <div className="mt-2 pt-1 border-t border-black/10 flex items-center justify-between text-[11px] font-mono">
                            <span>{dayKcal > 0 ? `${dayKcal} kcal` : "—"}</span>
                            <span
                              className={
                                daySalt > (summary.salt_daily_g ?? 2)
                                  ? "text-red-700 font-bold"
                                  : "text-emerald-800 font-bold"
                              }
                            >
                              {daySalt > 0 ? `Na: ${daySalt}g` : "—"}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {MEAL_ROWS.map((row) => (
                      <React.Fragment key={row.slot}>
                        <div className="sticky left-0 z-20 bg-surface-container-low p-md flex flex-col items-center justify-center border-r border-outline-variant font-bold text-sm text-on-surface">
                          <span className="material-symbols-outlined text-primary text-[20px] mb-0.5">
                            {row.icon}
                          </span>
                          <span>{row.label}</span>
                        </div>

                        {weekDays.map((day) => {
                          const dayMeal = selectedEntry
                            ? getDayMealByIndex(selectedEntry.plan, day.dayIndex)
                            : null;
                          const dishes =
                            row.slot === "breakfast"
                              ? dayMeal?.breakfast
                              : row.slot === "lunch"
                                ? dayMeal?.lunch
                                : dayMeal?.dinner;

                          return (
                            <div
                              key={`${day.isoDate}-${row.slot}`}
                              className="p-sm md:p-md min-h-[125px] bg-white flex flex-col hover:bg-surface-bright transition-colors"
                            >
                              {dishes && dishes.length > 0 ? (
                                <div className="space-y-1 font-body text-xs text-on-surface leading-snug">
                                  {dishes.map((food, fIdx) => (
                                    <div
                                      key={fIdx}
                                      className="flex justify-between items-start border-b border-gray-100 pb-0.5"
                                    >
                                      <span className="font-medium pr-1">
                                        • {food.name}
                                      </span>
                                      <span className="font-mono text-[10px] text-on-surface-variant shrink-0 font-semibold">
                                        {food.calories ? `${food.calories}k` : ""}
                                        {food.salt !== undefined
                                          ? ` | ${food.salt}g`
                                          : ""}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="flex-1 flex items-center justify-center text-center">
                                  <span className="text-outline text-xs italic">
                                    {dayMeal ? "—" : "Ngoài kế hoạch"}
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
            )}

            <div className="mt-md p-md bg-surface-container-low/50 border border-outline-variant/60 rounded-xl text-xs text-on-surface-variant flex items-center justify-between gap-md flex-wrap">
              <span>
                Ô hiển thị món trong thực đơn kế hoạch đã duyệt. Tuân thủ theo ngày lấy từ check-in notification.
              </span>
              <Link
                href={`/doctor/patients/${encodeURIComponent(patientId!)}`}
                className="text-primary font-bold hover:underline text-xs"
              >
                Quản lý hồ sơ →
              </Link>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
