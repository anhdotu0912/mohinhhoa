"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/shared/TopBar";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { formatDateIso } from "@/lib/plan-expiry";
import { pickDefaultSlot, visibleScheduleSlots } from "@/lib/plan-schedule-helpers";
import type { AlertOut, DayPlan, FoodLogEntry, MealPlanOutput } from "@/lib/types";

const SLOT_META: Record<string, { label: string; time: string; icon: string }> = {
  breakfast: { label: "Sáng", time: "07:00", icon: "wb_sunny" },
  lunch: { label: "Trưa", time: "12:00", icon: "wb_twilight" },
  dinner: { label: "Tối", time: "18:30", icon: "mode_night" },
};

function todayDayIndex(plan: MealPlanOutput): number | null {
  const todayIso = formatDateIso(new Date());
  const match = plan.days.find((d) => d.date === todayIso);
  if (match) return match.day_index;
  if (plan.starts_on) {
    const start = new Date(plan.starts_on);
    const today = new Date();
    start.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diff = Math.floor((today.getTime() - start.getTime()) / (86400000));
    if (diff >= 0 && diff < plan.days.length) return diff + 1;
  }
  return plan.days[0]?.day_index ?? null;
}

function mealSummary(day: DayPlan | undefined, slot: string) {
  const meal = day?.meals.find((m) => m.slot === slot);
  if (!meal || meal.items.length === 0) {
    return { title: "Chưa có món", detail: "—", kcal: 0, salt: 0 };
  }
  const kcal = meal.items.reduce((sum, item) => sum + (item.kcal || 0), 0);
  const saltMg = meal.items.reduce((sum, item) => sum + (item.macros?.sodium_mg || 0), 0);
  return {
    title: meal.items.map((i) => i.name).join(", "),
    detail: meal.items.map((i) => i.portion).filter(Boolean).join(" · ") || "Theo thực đơn đã duyệt",
    kcal: Math.round(kcal),
    salt: Math.round((saltMg / 1000) * 10) / 10,
  };
}

function weeklyAdherence(logs: FoodLogEntry[]): number {
  if (logs.length === 0) return 0;
  const cutoff = Date.now() - 7 * 86400000;
  const recent = logs.filter((log) => new Date(log.logged_at).getTime() >= cutoff);
  if (recent.length === 0) return 0;
  const planned = recent.filter((log) => log.type === "as_planned").length;
  return Math.round((planned / recent.length) * 100);
}

export default function PatientDashboardPage() {
  const displayName = useAuthStore((s) => s.displayName);
  const [alerts, setAlerts] = useState<AlertOut[]>([]);
  const [plan, setPlan] = useState<MealPlanOutput | null>(null);
  const [foodLogs, setFoodLogs] = useState<FoodLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const [alertRows, scheduleRes, logs] = await Promise.all([
          api.listAlerts().catch(() => [] as AlertOut[]),
          api.getMyMealPlanSchedule().catch(() => null),
          api.listFoodLogs().catch(() => [] as FoodLogEntry[]),
        ]);
        if (cancelled) return;
        setAlerts(alertRows.slice(0, 3));
        setFoodLogs(logs);

        const slots = scheduleRes ? visibleScheduleSlots(scheduleRes) : [];
        const active =
          slots.find((s) => s.plan && (s.plan.status === "approved" || s.plan.status === "edited"))
            ?.plan ??
          pickDefaultSlot(scheduleRes ?? { patient_id: "", active_plan: null, unassigned_plans: [], slots: [] })?.plan ??
          null;
        if (!active) {
          try {
            const latest = await api.getMyMealPlan();
            if (!cancelled) setPlan(latest);
          } catch {
            if (!cancelled) setPlan(null);
          }
        } else if (!cancelled) {
          setPlan(active);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const greeting = displayName?.trim() ? `Chào, ${displayName}` : "Chào bạn";
  const topAlert = alerts[0];
  const adherencePct = useMemo(() => weeklyAdherence(foodLogs), [foodLogs]);
  const dayIndex = plan ? todayDayIndex(plan) : null;
  const todayPlan = plan?.days.find((d) => d.day_index === dayIndex);

  const rows = ["breakfast", "lunch", "dinner"].map((slot) => ({
    slot,
    meta: SLOT_META[slot],
    ...mealSummary(todayPlan, slot),
  }));

  return (
    <>
      <TopBar title={greeting} />
      <main className="flex-1 p-md md:p-lg lg:p-xl flex flex-col gap-section-gap max-w-container-max-width mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg items-start">
          <div className="lg:col-span-8 flex flex-col gap-lg">
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] overflow-hidden">
              <div className="p-card-padding border-b border-outline-variant flex justify-between items-center bg-surface-bright">
                <h2 className="font-h2 text-h2 text-on-surface">Kế hoạch hôm nay</h2>
                <Link href="/patient/meals" className="text-primary font-label text-label hover:underline">
                  Xem tất cả
                </Link>
              </div>
              <div className="p-card-padding flex flex-col gap-0 divide-y divide-outline-variant/50">
                {loading ? (
                  <p className="text-sm text-on-surface-variant py-md">Đang tải thực đơn…</p>
                ) : !plan ? (
                  <p className="text-sm text-on-surface-variant py-md">
                    Chưa có thực đơn.{" "}
                    <Link href="/patient/meals" className="text-primary hover:underline">
                      Xem thực đơn
                    </Link>
                  </p>
                ) : (
                  rows.map(({ slot, meta, title, detail, kcal, salt }) => (
                    <div
                      key={slot}
                      className="py-md first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-md group"
                    >
                      <div className="flex items-start gap-md">
                        <div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center text-primary shrink-0">
                          <span className="material-symbols-outlined">{meta.icon}</span>
                        </div>
                        <div>
                          <div className="font-caption text-caption text-on-surface-variant mb-xs">
                            {meta.label} ({meta.time})
                          </div>
                          <div className="font-body-bold text-body-bold text-on-surface">{title}</div>
                          <div className="font-caption text-caption text-on-surface-variant mt-xs line-clamp-1">
                            {detail}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-sm items-center sm:justify-end shrink-0 pl-16 sm:pl-0">
                        <span className="px-2 py-1 rounded-full bg-surface-variant text-on-surface font-caption text-caption whitespace-nowrap">
                          {kcal} kcal
                        </span>
                        <span
                          className={`px-2 py-1 rounded-full font-caption text-caption whitespace-nowrap ${
                            salt > 1.2
                              ? "bg-error-container text-on-error-container"
                              : "bg-[#E5F4EC] text-[#006857]"
                          }`}
                        >
                          {salt}g Muối
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-lg">
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] p-card-padding flex flex-col items-center justify-center">
              <h3 className="font-body-bold text-body-bold text-on-surface mb-lg text-center w-full">
                Tiến độ tuân thủ tuần này
              </h3>
              <div className="relative w-40 h-40 flex items-center justify-center mb-md">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle className="stroke-surface-container-high" cx="50" cy="50" fill="none" r="40" strokeWidth="8" />
                  <circle
                    className="stroke-[#2F8F7A] transition-all duration-1000 ease-in-out"
                    cx="50"
                    cy="50"
                    fill="none"
                    r="40"
                    strokeDasharray="251.2"
                    strokeDashoffset={251.2 - (251.2 * adherencePct) / 100}
                    strokeLinecap="round"
                    strokeWidth="8"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-h1 text-h1 text-on-surface">{adherencePct}%</span>
                  <span className="font-caption text-caption text-on-surface-variant">
                    {adherencePct >= 75 ? "Khá tốt" : "Cần cố gắng"}
                  </span>
                </div>
              </div>
              <p className="font-caption text-caption text-on-surface-variant text-center">
                Dựa trên nhật ký ăn uống 7 ngày gần nhất.
              </p>
            </div>

            {topAlert ? (
              <div className="bg-[#FFF8E1] rounded-xl border border-[#FFE082] p-card-padding flex flex-col gap-sm">
                <div className="flex items-start gap-sm">
                  <span className="material-symbols-outlined text-[#F57F17]">warning</span>
                  <div className="flex-1">
                    <h3 className="font-body-bold text-body-bold text-[#F57F17] mb-xs">{topAlert.severity}</h3>
                    <p className="font-body text-body text-on-surface mb-md">
                      {topAlert.drug} + {topAlert.food}: {topAlert.mechanism}
                    </p>
                    <Link className="font-label text-label text-primary hover:underline flex items-center gap-xs" href="/patient/notifications">
                      Xem chi tiết
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-card-padding">
                <p className="font-caption text-caption text-on-surface-variant text-center">
                  Không có cảnh báo tương tác thuốc–thực phẩm gần đây.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
