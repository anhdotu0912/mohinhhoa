"use client";

import React, { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TopBar } from "@/components/shared/TopBar";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { dayPlanToUi } from "@/lib/meal-plan-mappers";
import type { MealDishItem } from "@/lib/plans-store";
import {
  DayNutritionProgress,
  DayTabButton,
  DishCard,
  MealSectionHeader,
  MedicalApprovalBadge,
} from "@/components/patient/PatientMealPlanUI";
import {
  FoodLogModal,
  type FoodLogModalContext,
  type FoodLogSlot,
} from "@/components/patient/FoodLogModal";
import {
  computeMealPlanValidity,
  formatDateFull,
  formatDateIso,
  formatDateShort,
  parseFlexibleDate,
} from "@/lib/plan-expiry";
import { pickDefaultSlot, visibleScheduleSlots, displaySlotTitle } from "@/lib/plan-schedule-helpers";
import {
  ApiError,
  type DayPlan,
  type FoodItem,
  type MealPlanOutput,
  type MealPlanScheduleOut,
  type MealPlanScheduleSlot,
  type PatientProfile,
} from "@/lib/types";

type ViewMode = "grid" | "detail";
type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

const MEAL_ROWS: {
  slot: Exclude<MealSlot, "snack">;
  label: string;
  icon: string;
}[] = [
    { slot: "breakfast", label: "Sáng", icon: "wb_twilight" },
    { slot: "lunch", label: "Trưa", icon: "wb_sunny" },
    { slot: "dinner", label: "Tối", icon: "bedtime" },
  ];

const DETAIL_MEALS: { slot: MealSlot; label: string; icon: string }[] = [
  ...MEAL_ROWS.map((r) => ({ slot: r.slot, label: r.label, icon: r.icon })),
  { slot: "snack", label: "Phụ", icon: "cookie" },
];

const WEEKDAY_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

const WEEKDAY_FULL = [
  "Chủ nhật",
  "Thứ 2",
  "Thứ 3",
  "Thứ 4",
  "Thứ 5",
  "Thứ 6",
  "Thứ 7",
];

function shiftDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  next.setHours(0, 0, 0, 0);
  return next;
}

function resolveDayDate(plan: MealPlanOutput, dayIndex: number): Date | null {
  const raw = plan.days.find((d) => d.day_index === dayIndex);
  if (raw?.date) {
    return parseFlexibleDate(raw.date);
  }
  if (plan.starts_on) {
    const start = parseFlexibleDate(plan.starts_on);
    if (start) return shiftDays(start, dayIndex - 1);
  }
  return null;
}

/** Column calendar date for the week being viewed (schedule slot window). */
function columnDateForDay(
  dayIndex: number,
  weekStart: Date,
  plan: MealPlanOutput,
  preferSlotWindow: boolean
): Date {
  if (preferSlotWindow) {
    return shiftDays(weekStart, dayIndex - 1);
  }
  return resolveDayDate(plan, dayIndex) ?? shiftDays(weekStart, dayIndex - 1);
}

function dayIndexForToday(
  days: { day_index: number }[],
  weekStart: Date,
  today: Date = new Date()
): number | undefined {
  const todayIso = formatDateIso(today);
  return days.find((d) => {
    return formatDateIso(shiftDays(weekStart, d.day_index - 1)) === todayIso;
  })?.day_index;
}

function statusMeta(status: string): { label: string; className: string; medical: boolean } {
  switch (status) {
    case "approved":
      return {
        label: "Đã duyệt — chuẩn y khoa",
        className: "bg-emerald-50/70 border-emerald-200/50 text-emerald-800",
        medical: true,
      };
    case "edited":
      return {
        label: "Đã duyệt (chỉnh sửa)",
        className: "bg-emerald-50/70 border-emerald-200/50 text-emerald-800",
        medical: true,
      };
    case "rejected":
      return {
        label: "Bác sĩ từ chối",
        className: "bg-red-50 border-red-200 text-red-800",
        medical: false,
      };
    default:
      return {
        label: "Chờ bác sĩ duyệt",
        className: "bg-amber-50 border-amber-200 text-amber-800",
        medical: false,
      };
  }
}

function saltTargetG(profile: PatientProfile | null): number | null {
  if (!profile) return null;
  const r = profile.restrictions;
  if (r.salt_daily_g != null) return r.salt_daily_g;
  if (r.sodium_daily != null) return Math.round((r.sodium_daily / 1000) * 10) / 10;
  return null;
}

function avgFromDays(plan: MealPlanOutput): { kcal: number; salt: number; sugar: number } {
  if (!plan.days.length) return { kcal: 0, salt: 0, sugar: 0 };
  const uiDays = plan.days.map(dayPlanToUi);
  const n = uiDays.length;
  const totalKcal = uiDays.reduce((s, d) => s + d.totalCalories, 0);
  const totalSalt = uiDays.reduce((s, d) => s + d.totalSalt, 0);
  const totalSugar = uiDays.reduce((s, d) => s + d.totalSugar, 0);
  return {
    kcal: Math.round(totalKcal / n),
    salt: Math.round((totalSalt / n) * 10) / 10,
    sugar: Math.round((totalSugar / n) * 10) / 10,
  };
}

function formatDayTotals(day: {
  totalCalories?: number;
  totalSalt?: number;
  totalSugar?: number;
}): string {
  const kcal = day.totalCalories ?? 0;
  const salt = day.totalSalt ?? 0;
  if (kcal <= 0) return "—";
  return `${kcal.toLocaleString("vi-VN")} kcal · ${salt.toFixed(1)}g muối`;
}

function slotItemsRaw(day: DayPlan, slot: string): FoodItem[] {
  return day.meals.find((m) => m.slot === slot)?.items ?? [];
}

function openDetail(dayIndex: number, setSelectedDayIndex: (n: number) => void, setViewMode: (m: ViewMode) => void) {
  setSelectedDayIndex(dayIndex);
  setViewMode("detail");
}

const MEAL_SLOT_TO_FOOD_LOG: Record<
  Exclude<MealSlot, "snack">,
  FoodLogSlot
> = {
  breakfast: "morning",
  lunch: "noon",
  dinner: "evening",
};

function PatientMealsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planIdParam = searchParams.get("plan_id");
  const { token, role } = useAuthStore();

  const [hydrated, setHydrated] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selectedDayIndex, setSelectedDayIndex] = useState(1);
  const [schedule, setSchedule] = useState<MealPlanScheduleOut | null>(null);
  const [selectedStartsOn, setSelectedStartsOn] = useState<string | null>(null);
  const [fallbackPlan, setFallbackPlan] = useState<MealPlanOutput | null>(null);
  const [urlPlan, setUrlPlan] = useState<MealPlanOutput | null>(null);
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logContext, setLogContext] = useState<FoodLogModalContext | null>(null);
  const [highlightDayIndex, setHighlightDayIndex] = useState<number | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setEmpty(false);
    try {
      const [scheduleRes, profileRes] = await Promise.all([
        api.getMyMealPlanSchedule(),
        api.getProfile(),
      ]);
      setSchedule(scheduleRes);
      setProfile(profileRes);

      let targetPlan: MealPlanOutput | null = null;
      if (planIdParam) {
        try {
          targetPlan = await api.getMealPlan(planIdParam);
          setUrlPlan(targetPlan);
        } catch {
          /* fallback if plan_id not found */
        }
      }

      let latestPlan: MealPlanOutput | null = null;
      try {
        latestPlan = await api.getMyMealPlan();
      } catch (err) {
        if (!(err instanceof ApiError && err.code === "NO_MEAL_PLAN")) {
          throw err;
        }
      }
      setFallbackPlan(targetPlan ?? latestPlan);

      const hasScheduledPlan = scheduleRes.slots.some((s) => s.plan != null);
      const hasUnassigned = (scheduleRes.unassigned_plans?.length ?? 0) > 0;
      if (!targetPlan && !latestPlan && !hasScheduledPlan && !hasUnassigned) {
        setEmpty(true);
        return;
      }

      const defaultSlot =
        visibleScheduleSlots(scheduleRes)[1] ?? pickDefaultSlot(scheduleRes);
      setSelectedStartsOn(defaultSlot?.starts_on ?? null);

      const initialPlan = targetPlan ?? defaultSlot?.plan ?? latestPlan;
      if (initialPlan) {
        const slotStart =
          parseFlexibleDate(defaultSlot?.starts_on) ??
          parseFlexibleDate(initialPlan.starts_on);
        const todayDayIndex = slotStart
          ? dayIndexForToday(initialPlan.days, slotStart)
          : initialPlan.days.find((d) => {
              const date = resolveDayDate(initialPlan, d.day_index);
              return date
                ? formatDateIso(date) === formatDateIso(new Date())
                : false;
            })?.day_index;
        setSelectedDayIndex(todayDayIndex ?? 1);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không tải được thực đơn.");
    } finally {
      setLoading(false);
    }
  }, [planIdParam]);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    if (role === "doctor") {
      router.replace("/doctor");
    }
  }, [hydrated, token, role, router]);

  useEffect(() => {
    if (!hydrated || !token || role === "doctor") return;
    void loadData();
  }, [hydrated, token, role, loadData]);

  const displaySlots = useMemo(
    () => (schedule ? visibleScheduleSlots(schedule) : []),
    [schedule]
  );

  const selectedSlot = useMemo(() => {
    if (!displaySlots.length) return null;
    return (
      displaySlots.find((slot) => slot.starts_on === selectedStartsOn) ??
      displaySlots[1] ??
      pickDefaultSlot(schedule!)
    );
  }, [displaySlots, selectedStartsOn, schedule]);

  const plan = useMemo((): MealPlanOutput | null => {
    if (urlPlan) return urlPlan;
    if (selectedSlot?.plan) return selectedSlot.plan;
    if (fallbackPlan && selectedSlot?.slot_key === "current") return fallbackPlan;
    return fallbackPlan;
  }, [urlPlan, selectedSlot, fallbackPlan]);

  const uiDays = useMemo(() => (plan ? plan.days.map(dayPlanToUi) : []), [plan]);
  const validity = useMemo(() => (plan ? computeMealPlanValidity(plan) : null), [plan]);
  const averages = useMemo(() => (plan ? avgFromDays(plan) : { kcal: 0, salt: 0, sugar: 0 }), [plan]);
  const saltLimit = saltTargetG(profile);
  const swapCount = plan?.swaps?.length ?? 0;
  const status = plan ? statusMeta(plan.status) : null;
  const weekInPlan = Boolean(plan);

  const weekStart = useMemo(() => {
    const fromSlot = parseFlexibleDate(selectedSlot?.starts_on);
    if (fromSlot) return fromSlot;
    const fromPlan = parseFlexibleDate(plan?.starts_on);
    if (fromPlan) return fromPlan;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }, [selectedSlot?.starts_on, plan?.starts_on]);

  const weekEnd = useMemo(() => {
    const fromSlot = parseFlexibleDate(selectedSlot?.ends_on);
    if (fromSlot) return fromSlot;
    return shiftDays(weekStart, 6);
  }, [selectedSlot?.ends_on, weekStart]);

  const weekRangeLabel = `${formatDateShort(weekStart)} – ${formatDateFull(weekEnd)}`;

  const planDays = useMemo(() => {
    if (!plan) return [];
    // Prefer the schedule slot window so "Hôm nay" tracks the week navigator,
    // even when plan.starts_on / day.date still stamp an older apply window
    // (e.g. unassigned plan previewed on empty current week).
    const preferSlotWindow = selectedSlot != null;
    const todayIso = formatDateIso(new Date());
    return plan.days.map((raw) => {
      const ui = uiDays.find((d) => d.dayIndex === raw.day_index)!;
      const date = columnDateForDay(
        raw.day_index,
        weekStart,
        plan,
        preferSlotWindow
      );
      const isoDate = formatDateIso(date);
      return {
        dayIndex: raw.day_index,
        ui,
        raw,
        isoDate,
        isToday: isoDate === todayIso,
        isFuture: isoDate > todayIso,
        label: `${WEEKDAY_FULL[date.getDay()]} • ${formatDateShort(date)}`,
        shortDate: formatDateShort(date),
        fullDayName: WEEKDAY_FULL[date.getDay()],
        weekdayShort: WEEKDAY_SHORT[date.getDay()],
      };
    });
  }, [plan, uiDays, selectedSlot, weekStart]);

  const selectedDay = planDays.find((d) => d.dayIndex === selectedDayIndex) ?? planDays[0];

  const slotIndex = selectedSlot
    ? displaySlots.findIndex((slot) => slot.starts_on === selectedSlot.starts_on)
    : -1;
  const canPrevWeek = slotIndex > 0;
  const canNextWeek = displaySlots.length > 0 && slotIndex >= 0 && slotIndex < displaySlots.length - 1;
  const weekSlotLabel = slotIndex >= 0 ? displaySlotTitle(slotIndex) : null;

  const openFoodLog = useCallback(
    (
      day: { dayIndex: number; label: string; isFuture: boolean },
      mealSlot: Exclude<MealSlot, "snack">,
      mealLabel: string
    ) => {
      if (!plan || day.isFuture) return;
      setLogContext({
        slot: MEAL_SLOT_TO_FOOD_LOG[mealSlot],
        slotLabel: mealLabel,
        dayLabel: day.label,
        mealPlanId: plan.id,
        dayIndex: day.dayIndex,
      });
    },
    [plan]
  );

  const handleFoodLogSaved = useCallback(() => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 4000);
  }, []);

  const handlePrevWeek = () => {
    if (!selectedSlot || !canPrevWeek || slotIndex <= 0) return;
    setSelectedStartsOn(displaySlots[slotIndex - 1].starts_on);
    setSelectedDayIndex(1);
  };

  const handleNextWeek = () => {
    if (!selectedSlot || !canNextWeek || slotIndex < 0) return;
    setSelectedStartsOn(displaySlots[slotIndex + 1].starts_on);
    setSelectedDayIndex(1);
  };

  const handleResetCurrentWeek = () => {
    const currentWeek = displaySlots[1];
    if (!currentWeek) return;
    setSelectedStartsOn(currentWeek.starts_on);
    const start = parseFlexibleDate(currentWeek.starts_on);
    const planForSlot = currentWeek.plan ?? fallbackPlan;
    const todayIdx =
      start && planForSlot ? dayIndexForToday(planForSlot.days, start) : undefined;
    setSelectedDayIndex(todayIdx ?? 1);
  };

  const showTodayButton = planDays.some((d) => d.isToday);

  if (!hydrated || (token && role !== "doctor" && loading && !schedule && !empty && !error)) {
    return (
      <>
        <TopBar title="Thực đơn bệnh nhân" />
        <main className="flex-1 w-full p-6 flex justify-center items-center bg-slate-50/50 min-h-[calc(100vh-64px)]">
          <p className="text-sm text-slate-500">Đang tải thực đơn…</p>
        </main>
      </>
    );
  }

  return (
    <>
      <TopBar
        title="Thực đơn bệnh nhân"
        rightSlot={
          schedule ? (
            <div className="flex items-center bg-slate-100/90 border border-slate-200/80 rounded-xl p-1 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${viewMode === "grid"
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
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${viewMode === "detail"
                    ? "bg-white text-emerald-800 shadow-xs border border-slate-200/60"
                    : "text-slate-600 hover:text-slate-900"
                  }`}
              >
                <span className="material-symbols-outlined text-[16px] text-emerald-700">restaurant</span>
                <span>Chi tiết bữa ăn</span>
              </button>
            </div>
          ) : undefined
        }
      />

      <main className="flex-1 w-full p-4 sm:p-6 min-h-[calc(100vh-64px)] flex justify-center bg-slate-50/50">
        <div className="w-full max-w-[1280px] flex flex-col gap-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-sm text-red-800">{error}</p>
              <button
                type="button"
                onClick={() => void loadData()}
                className="px-3 py-1.5 text-xs font-semibold bg-white border border-red-200 rounded-lg text-red-700 hover:bg-red-50"
              >
                Thử lại
              </button>
            </div>
          )}

          {saveSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-2 text-sm text-emerald-800 font-semibold">
                <span className="material-symbols-outlined text-[20px]">check_circle</span>
                Đã lưu ghi nhận bữa ăn thành công!
              </div>
              <button
                type="button"
                onClick={() => setSaveSuccess(false)}
                className="text-emerald-700 hover:opacity-75"
                aria-label="Đóng"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
          )}

          {urlPlan && (
            <div className="bg-emerald-50/90 border border-emerald-300 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <span className="material-symbols-outlined text-[22px]">smart_toy</span>
                </div>
                <div>
                  <p className="font-semibold text-xs text-emerald-950 flex items-center gap-1.5">
                    <span>Đang hiển thị Thực đơn gợi ý từ Trợ lý AI</span>
                    {urlPlan.status === "approved" ? (
                      <span className="px-2 py-0.5 bg-emerald-200/70 text-emerald-900 rounded-md text-[10px] font-bold">Đã duyệt</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-200 rounded-md text-[10px] font-bold">Chờ bác sĩ duyệt</span>
                    )}
                  </p>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    Thực đơn này được tạo riêng từ phiên tư vấn Chatbot theo thể trạng và nhu cầu của bạn.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setUrlPlan(null);
                    router.replace("/patient/meals");
                  }}
                  className="px-3 py-1.5 text-xs font-semibold bg-white border border-emerald-300 rounded-lg text-emerald-900 hover:bg-emerald-100/50 transition-colors shadow-2xs shrink-0 cursor-pointer"
                >
                  Về thực đơn mặc định
                </button>
              </div>
            </div>
          )}

          {empty && (
            <div className="bg-white border border-slate-200/80 rounded-xl p-8 text-center shadow-2xs">
              <span className="material-symbols-outlined text-4xl text-slate-300">restaurant_menu</span>
              <h2 className="text-lg font-semibold text-slate-900 mt-3">Bạn chưa có thực đơn</h2>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                Hãy trò chuyện với trợ lý AI để tạo thực đơn 7 ngày phù hợp với hồ sơ bệnh lý của bạn.
              </p>
              <Link
                href="/patient/assistant"
                className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                Mở trợ lý AI
              </Link>
            </div>
          )}

          {schedule && !empty && (
            <>
              {plan?.status === "rejected" && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
                  <span className="material-symbols-outlined text-red-600 text-[20px]">error</span>
                  <p className="text-sm text-red-800">
                    Thực đơn này đã bị bác sĩ từ chối. Nội dung bên dưới chỉ để tham khảo — không phải thực đơn chính thức cần tuân theo.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[18px]">verified</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-medium text-slate-500 block truncate">Trạng thái</span>
                    <span className="text-sm font-bold text-slate-800 block truncate">
                      {status?.label ?? "Chưa có thực đơn tuần này"}
                    </span>
                    <span className="text-[10px] text-slate-500 truncate block">
                      {validity ? `${validity.startDateLabel} – ${validity.endDateLabel}` : weekRangeLabel}
                    </span>
                  </div>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[18px]">water_drop</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-medium text-slate-500 block truncate">Muối TB / ngày</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-base font-bold text-slate-800">{weekInPlan ? averages.salt : "—"}g</span>
                      {saltLimit != null && (
                        <span className="text-[10px] text-emerald-700 font-medium bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/50">
                          mục tiêu {saltLimit}g
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[18px]">local_fire_department</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-medium text-slate-500 block truncate">Kcal TB / ngày</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-base font-bold text-slate-800">
                        {weekInPlan ? averages.kcal.toLocaleString("vi-VN") : "—"}
                      </span>
                      {profile?.target_kcal != null && (
                        <span className="text-[11px] text-slate-500">/ {profile.target_kcal} kcal</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-medium text-slate-500 block truncate">Món đã đổi</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-base font-bold text-teal-800">{weekInPlan ? swapCount : "—"}</span>
                      <span className="text-[11px] text-slate-500">do tương tác thuốc</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-xl px-3.5 py-2.5 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="inline-flex items-center bg-slate-100/90 border border-slate-200/70 rounded-lg p-0.5 shadow-2xs">
                    <button
                      type="button"
                      onClick={handlePrevWeek}
                      disabled={!canPrevWeek}
                      className="p-1.5 hover:bg-white hover:shadow-2xs rounded-md text-slate-600 hover:text-slate-900 transition-all cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                      title="Tuần trước"
                    >
                      <span className="material-symbols-outlined text-[16px] block">chevron_left</span>
                    </button>

                    <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-800">
                      <span className="material-symbols-outlined text-emerald-600 text-[15px]">calendar_month</span>
                      <span>
                        {weekSlotLabel ? `${weekSlotLabel}: ` : "Tuần: "}
                        {weekRangeLabel}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleNextWeek}
                      disabled={!canNextWeek}
                      className="p-1.5 hover:bg-white hover:shadow-2xs rounded-md text-slate-600 hover:text-slate-900 transition-all cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                      title="Tuần sau"
                    >
                      <span className="material-symbols-outlined text-[16px] block">chevron_right</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleResetCurrentWeek}
                    className="px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50/90 hover:bg-emerald-100/80 border border-emerald-200/60 rounded-lg transition-colors cursor-pointer"
                  >
                    Về tuần thực đơn
                  </button>
                </div>

                {status && viewMode === "grid" && (
                  <MedicalApprovalBadge
                    label={status.label}
                    medical={status.medical}
                    rejected={plan?.status === "rejected"}
                    variant="compact"
                  />
                )}
              </div>

              {!weekInPlan ? (
                <div className="bg-white border border-slate-200/80 rounded-xl p-8 text-center shadow-2xs">
                  <span className="material-symbols-outlined text-4xl text-slate-300">calendar_today</span>
                  <h2 className="text-base font-semibold text-slate-900 mt-3">Chưa có thực đơn cho tuần đang xem</h2>
                  <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                    Tuần {weekRangeLabel} chưa được gán thực đơn. Bạn có thể chuyển sang tuần khác hoặc nhờ bác sĩ áp dụng thực đơn.
                  </p>
                </div>
              ) : viewMode === "grid" ? (
                <div className="bg-white border border-slate-200/80 rounded-xl shadow-2xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <div className="min-w-[960px] grid grid-cols-[80px_repeat(7,1fr)]">
                      <div className="sticky left-0 z-20 bg-slate-100 px-2 py-3 flex items-center justify-center text-[11px] font-semibold text-slate-600 border-r border-b-2 border-slate-300">
                        Bữa
                      </div>

                      {planDays.map((day) => (
                        <button
                          key={day.dayIndex}
                          type="button"
                          onClick={() => { setHighlightDayIndex(null); openDetail(day.dayIndex, setSelectedDayIndex, setViewMode); }}
                          className={`px-2.5 py-3 text-left transition-colors cursor-pointer border-b-2 border-r border-slate-200 last:border-r-0 ${
                              day.dayIndex === highlightDayIndex
                              ? "bg-blue-50 border-x-2 border-x-blue-500 border-t-2 border-t-blue-500 shadow-[inset_0_-2px_0_0_theme(colors.blue.400)]"
                              : day.isToday
                              ? "bg-teal-100 border-x-2 border-x-teal-500 border-b-teal-300 shadow-[inset_0_-2px_0_0_theme(colors.teal.400)]"
                              : "bg-slate-50 hover:bg-slate-100/90 border-slate-200"
                            }`}
                          title="Xem chi tiết ngày này"
                        >
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`text-xs font-bold ${day.isToday ? "text-teal-900" : "text-slate-800"}`}
                            >
                              {day.fullDayName}
                            </span>
                            <span
                              className={`text-[11px] tabular-nums ${day.isToday ? "text-teal-700 font-semibold" : "text-slate-500"}`}
                            >
                              {day.shortDate}
                            </span>
                            {day.isToday && (
                              <span className="text-[10px] font-bold text-white bg-teal-600 px-1.5 py-0.5 rounded shadow-xs">
                                Hôm nay
                              </span>
                            )}
                          </div>
                          <p
                            className={`mt-1.5 text-[10px] truncate tabular-nums ${day.isToday ? "text-teal-800 font-medium" : "text-slate-600"
                              }`}
                          >
                            {formatDayTotals(day.ui)}
                          </p>
                          {saltLimit != null && (day.ui.totalSalt ?? 0) > saltLimit && (
                            <p className="mt-0.5 text-[10px] font-semibold text-amber-800 flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[12px]">warning</span>
                              Muối vượt mục tiêu
                            </p>
                          )}
                        </button>
                      ))}

                      {MEAL_ROWS.map((row, rowIdx) => (
                        <React.Fragment key={row.slot}>
                          <div
                            className={`sticky left-0 z-20 px-2 py-4 flex flex-col items-center justify-center border-r border-slate-300 text-slate-700 ${rowIdx > 0 ? "border-t-[3px] border-t-slate-300" : "border-t border-t-slate-200"
                              } ${row.slot === "breakfast"
                                ? "bg-amber-50/70"
                                : row.slot === "lunch"
                                  ? "bg-sky-50/70"
                                  : "bg-indigo-50/60"
                              }`}
                          >
                            <span
                              className={`material-symbols-outlined text-[20px] ${row.slot === "breakfast"
                                  ? "text-amber-600"
                                  : row.slot === "lunch"
                                    ? "text-sky-600"
                                    : "text-indigo-600"
                                }`}
                            >
                              {row.icon}
                            </span>
                            <span className="text-xs font-bold mt-1 uppercase tracking-wide">{row.label}</span>
                          </div>

                          {planDays.map((day, dayIdx) => {
                            const items = day.ui[row.slot] as MealDishItem[];
                            const isLastRow = rowIdx === MEAL_ROWS.length - 1;
                            const canLog = weekInPlan && !day.isFuture;

                            return (
                              <div
                                key={`${day.dayIndex}-${row.slot}`}
                                role="button"
                                tabIndex={0}
                                onClick={() => openDetail(day.dayIndex, setSelectedDayIndex, setViewMode)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    openDetail(day.dayIndex, setSelectedDayIndex, setViewMode);
                                  }
                                }}
                                className={`relative p-2.5 min-h-[100px] text-left transition-colors cursor-pointer border-r border-slate-200 ${dayIdx === planDays.length - 1 ? "border-r-0" : ""
                                  } ${rowIdx > 0 ? "border-t-[3px] border-t-slate-300" : "border-t border-t-slate-200"
                                  } ${day.dayIndex === highlightDayIndex
                                    ? "bg-blue-50/50 border-x-2 border-x-blue-500 hover:bg-blue-100/50"
                                    : day.isToday
                                    ? "bg-teal-50/90 border-x-2 border-x-teal-500 hover:bg-teal-100/80"
                                    : "bg-white hover:bg-slate-50/80"
                                  } ${isLastRow && day.dayIndex === highlightDayIndex 
                                    ? "border-b-2 border-b-blue-500" 
                                    : isLastRow && day.isToday ? "border-b-2 border-b-teal-400" : ""}`}
                                title="Xem chi tiết bữa ăn"
                              >
                                {canLog && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openFoodLog(day, row.slot, row.label);
                                    }}
                                    className="absolute top-1.5 right-1.5 z-10 p-1 rounded-md text-emerald-700 bg-emerald-50/90 border border-emerald-200/70 hover:bg-emerald-100 transition-colors cursor-pointer"
                                    title="Ghi nhận bữa ăn"
                                    aria-label={`Ghi nhận bữa ăn ${row.label} ${day.shortDate}`}
                                  >
                                    <span className="material-symbols-outlined text-[16px] block">edit_note</span>
                                  </button>
                                )}
                                {items.length > 0 ? (
                                  <ul className="space-y-2 pr-6">
                                    {items.map((food, fIdx) => (
                                      <li key={fIdx}>
                                        <DishCard item={food} compact />
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <span className="text-slate-300 text-xs">—</span>
                                )}
                              </div>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>
              ) : selectedDay && plan ? (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex gap-0 overflow-x-auto border-b border-slate-200 bg-white rounded-t-xl px-1 pt-1">
                    {planDays.map((day) => (
                      <DayTabButton
                        key={day.dayIndex}
                        weekdayShort={day.weekdayShort}
                        shortDate={day.shortDate}
                        isSelected={day.dayIndex === selectedDayIndex}
                        isToday={day.isToday}
                        onClick={() => setSelectedDayIndex(day.dayIndex)}
                      />
                    ))}
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-4 sm:px-5 py-4 border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white space-y-4">
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base sm:text-lg font-bold text-slate-900">
                              {selectedDay.fullDayName}
                              <span className="ml-2 text-sm font-medium text-slate-500 tabular-nums">
                                {selectedDay.shortDate}
                              </span>
                            </h3>
                            {selectedDay.isToday && (
                              <span className="text-[10px] font-bold text-teal-800 bg-teal-100 px-2 py-0.5 rounded-md border border-teal-200">
                                Hôm nay
                              </span>
                            )}
                          </div>
                        </div>
                        {status && (
                          <MedicalApprovalBadge
                            label={status.label}
                            medical={status.medical}
                            rejected={plan?.status === "rejected"}
                            variant="prominent"
                          />
                        )}
                      </div>

                      <DayNutritionProgress
                        calories={selectedDay.ui.totalCalories ?? 0}
                        saltG={selectedDay.ui.totalSalt ?? 0}
                        targetCalories={profile?.target_kcal ?? null}
                        targetSaltG={saltLimit}
                      />
                    </div>

                    {(plan.swaps || []).filter((s) => s.day_index === selectedDay.dayIndex).length > 0 && (
                      <div className="px-4 sm:px-5 py-3 bg-sky-50 border-b border-sky-100 text-xs text-sky-950 space-y-1.5">
                        <p className="font-bold flex items-center gap-1 text-sky-900">
                          <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
                          Món đã điều chỉnh do tương tác thuốc
                        </p>
                        {(plan.swaps || [])
                          .filter((s) => s.day_index === selectedDay.dayIndex)
                          .map((s, idx) => (
                            <p key={idx} className="pl-5">
                              <span className="font-semibold capitalize">{s.slot}:</span> {(s.from || "—")} → {s.to}
                              {s.reason ? ` — ${s.reason}` : ""}
                            </p>
                          ))}
                      </div>
                    )}

                    <div className="p-4 sm:p-5 space-y-6">
                      {DETAIL_MEALS.map((meal) => {
                        const items = selectedDay.ui[meal.slot] as MealDishItem[];
                        const rawItems = slotItemsRaw(selectedDay.raw, meal.slot);

                        if (meal.slot === "snack" && items.length === 0) return null;

                        return (
                          <section key={meal.slot}>
                            <MealSectionHeader
                              label={meal.label}
                              icon={meal.icon}
                              action={
                                meal.slot !== "snack" &&
                                !selectedDay.isFuture &&
                                weekInPlan ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openFoodLog(
                                        selectedDay,
                                        meal.slot as Exclude<MealSlot, "snack">,
                                        meal.label
                                      )
                                    }
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">edit_note</span>
                                    Ghi nhận
                                  </button>
                                ) : undefined
                              }
                            />
                            {items.length === 0 ? (
                              <p className="text-sm text-slate-400 pl-10">Chưa có món trong buổi này</p>
                            ) : (
                              <ul className="space-y-3 pl-0 sm:pl-10">
                                {items.map((item, idx) => {
                                  const rawItem = rawItems[idx];
                                  return (
                                    <li key={`${meal.slot}-${item.foodId || item.name}-${idx}`}>
                                      <DishCard item={item} portion={rawItem?.portion} />
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </section>
                        );
                      })}
                    </div>

                    {(plan.citations?.length ?? 0) > 0 && (
                      <details className="px-4 sm:px-5 py-4 border-t border-slate-100 text-xs text-slate-600 bg-slate-50/50">
                        <summary className="cursor-pointer font-semibold text-slate-700 list-none flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px]">menu_book</span>
                          Nguồn tham khảo y khoa
                        </summary>
                        <ul className="mt-3 space-y-1 pl-5 list-disc text-slate-600">
                          {plan.citations.map((cite) => (
                            <li key={cite}>{cite}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </main>

      <FoodLogModal
        open={logContext != null}
        context={logContext}
        onClose={() => setLogContext(null)}
        onSaved={handleFoodLogSaved}
      />
    </>
  );
}

export default function PatientMealsPage() {
  return (
    <Suspense
      fallback={
        <>
          <TopBar title="Thực đơn bệnh nhân" />
          <main className="flex-1 w-full p-6 flex justify-center items-center bg-slate-50/50 min-h-[calc(100vh-64px)]">
            <p className="text-sm text-slate-500">Đang tải thực đơn…</p>
          </main>
        </>
      }
    >
      <PatientMealsContent />
    </Suspense>
  );
}
