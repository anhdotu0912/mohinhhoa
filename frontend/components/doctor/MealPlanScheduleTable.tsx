"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { api } from "@/lib/api";
import {
  formatDateFull,
  parseFlexibleDate,
} from "@/lib/plan-expiry";
import {
  displaySlotTitle,
  slotAllowsAdd,
  visibleScheduleSlots,
} from "@/lib/plan-schedule-helpers";
import { buildReviewHref } from "@/lib/plan-slot-intent";
import {
  ApiError,
  type ApplyMode,
  type MealPlanOutput,
  type MealPlanScheduleOut,
  type MealPlanScheduleSlot,
  type ScheduleOccupancy,
} from "@/lib/types";

function occupancyLabel(occupancy: ScheduleOccupancy): string {
  switch (occupancy) {
    case "active":
      return "Đang áp dụng";
    case "upcoming":
      return "Đã lên lịch";
    case "past":
      return "Hoàn thành";
    default:
      return "Chưa có thực đơn";
  }
}

function slotRangeLabel(slot: MealPlanScheduleSlot): string {
  const start = parseFlexibleDate(slot.starts_on);
  const end = parseFlexibleDate(slot.ends_on);
  if (!start || !end) return `${slot.starts_on} – ${slot.ends_on}`;
  return `${formatDateFull(start)} – ${formatDateFull(end)}`;
}

function planTitle(plan: MealPlanOutput): string {
  return `Thực đơn ${plan.days?.length ?? 7} ngày`;
}

function planStatusLabel(status: string): string {
  if (status === "edited") return "Đã chỉnh sửa";
  if (status === "approved") return "Đã duyệt";
  if (status === "pending_review") return "Chờ duyệt";
  if (status === "rejected") return "Từ chối";
  return status;
}

function avgDailyKcal(plan: MealPlanOutput): number | null {
  if (!plan.days?.length) return null;
  const total = plan.days.reduce((sum, day) => sum + (day.totals?.kcal ?? 0), 0);
  if (total <= 0) return null;
  return Math.round(total / plan.days.length);
}

function formatCreatedAt(iso?: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function hasChainPlan(schedule: MealPlanScheduleOut): boolean {
  return Boolean(
    schedule.active_plan?.ends_on ||
      schedule.slots.some((slot) => slot.occupancy === "upcoming" && slot.plan)
  );
}

interface MealPlanScheduleTableProps {
  patientId: string;
  schedule: MealPlanScheduleOut;
  selectedStartsOn?: string | null;
  onSelectSlot?: (slot: MealPlanScheduleSlot) => void;
  onPreviewPlan?: (plan: MealPlanOutput) => void;
  onRefresh?: (applied?: {
    planId: string;
    startsOn: string;
  }) => void | Promise<void>;
}

export function MealPlanScheduleTable({
  patientId,
  schedule,
  selectedStartsOn,
  onSelectSlot,
  onPreviewPlan,
  onRefresh,
}: MealPlanScheduleTableProps) {
  const dialogTitleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showUnassigned, setShowUnassigned] = useState(false);

  const reviewHref = `/doctor/patients/${encodeURIComponent(patientId)}/meals`;
  const chainAvailable = hasChainPlan(schedule);

  const showToast = (message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(message);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 3200);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!pickerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !assigningId) {
        setPickerOpen(false);
        setAssignError(null);
      }
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [pickerOpen, assigningId]);

  const closePicker = () => {
    if (assigningId) return;
    setPickerOpen(false);
    setAssignError(null);
  };

  const applyPlan = async (plan: MealPlanOutput, mode: ApplyMode) => {
    setAssigningId(plan.id);
    setAssignError(null);
    try {
      const applied = await api.applyMealPlan(plan.id, { apply_mode: mode });
      const startsOn = applied.starts_on ?? schedule.today;
      if (currentSlot) onSelectSlot?.(currentSlot);
      await onRefresh?.({ planId: plan.id, startsOn });
      setPickerOpen(false);
      showToast(
        mode === "from_today"
          ? `Đã áp dụng ${planTitle(plan)} từ hôm nay.`
          : `Đã xếp tiếp nối ${planTitle(plan)}.`
      );
    } catch (err) {
      setAssignError(
        err instanceof ApiError ? err.message : "Không áp dụng được thực đơn."
      );
    } finally {
      setAssigningId(null);
    }
  };

  const extendPlan = async (plan: MealPlanOutput) => {
    const mode: ApplyMode = schedule.active_plan ? "after_current" : "from_today";
    await applyPlan(plan, mode);
  };

  const displaySlots = visibleScheduleSlots(schedule);
  const shownPlanIds = new Set(
    displaySlots.map((slot) => slot.plan?.id).filter((id): id is string => Boolean(id))
  );
  const unassignedPlans = schedule.unassigned_plans.filter(
    (plan) => !shownPlanIds.has(plan.id)
  );
  const assignableUnassigned = unassignedPlans.filter(
    (plan) => plan.status === "approved" || plan.status === "edited"
  );
  const currentSlot =
    displaySlots.find((slot) => slot.slot_key === "current") ??
    schedule.slots.find((slot) => slot.slot_key === "current") ??
    null;

  const previewUnassigned = (plan: MealPlanOutput) => {
    onPreviewPlan?.(plan);
    if (currentSlot) onSelectSlot?.(currentSlot);
  };

  return (
    <div className="rounded-xl border border-teal-100 bg-white p-4 shadow-xs">
      {toastMessage && (
        <div
          role="status"
          className="fixed top-[calc(var(--doctor-nav-height,64px)+1rem)] right-6 z-[60] bg-emerald-800 text-white px-4 py-2.5 rounded-lg shadow-xl border border-emerald-600 flex items-center gap-2 font-body text-sm animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <span className="material-symbols-outlined text-[20px] text-emerald-300">
            check_circle
          </span>
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-teal-50/50 px-3 py-2.5">
        <div>
          <h3 className="font-h2 text-sm font-bold text-on-surface flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary text-[20px]">
              calendar_view_week
            </span>
            Lịch thực đơn 7 ngày
          </h3>
          {schedule.active_plan && (
            <p className="text-xs text-on-surface-variant mt-0.5">
              Đang áp dụng: Plan{" "}
              <span className="font-mono font-medium">
                …{schedule.active_plan_id?.slice(-6)}
              </span>
              {schedule.active_plan.starts_on && schedule.active_plan.ends_on
                ? ` (${schedule.active_plan.starts_on} – ${schedule.active_plan.ends_on})`
                : ""}
            </p>
          )}
        </div>

        {unassignedPlans.length > 0 && (
          <button
            type="button"
            onClick={() => setShowUnassigned(!showUnassigned)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-amber-500/10 text-amber-900 border border-amber-500/20 hover:bg-amber-500/15 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px] text-amber-700">
              pending_actions
            </span>
            <span>{unassignedPlans.length} thực đơn chưa xếp lịch</span>
            <span className="material-symbols-outlined text-[14px]">
              {showUnassigned ? "expand_less" : "expand_more"}
            </span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {displaySlots.map((slot, index) => {
          const isSelected = slot.starts_on === selectedStartsOn;
          const isActive = slot.occupancy === "active";
          const isUpcoming = slot.occupancy === "upcoming";
          const isPast = slot.occupancy === "past";

          return (
            <div
              key={`${slot.slot_key}-${slot.starts_on}-${index}`}
              onClick={() => onSelectSlot?.(slot)}
              className={`rounded-xl p-4 border transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? "border-teal-400 bg-teal-50/70 ring-2 ring-teal-600/15 shadow-xs"
                  : isActive
                    ? "border-emerald-200 bg-emerald-50/40 hover:border-emerald-400"
                    : isUpcoming
                      ? "border-sky-200 bg-sky-50/40 hover:border-sky-400"
                      : "border-slate-200 bg-slate-50/60 hover:border-teal-300"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-bold text-on-surface">
                    {displaySlotTitle(index)}
                  </span>
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                      isActive
                        ? "bg-emerald-500/15 text-emerald-900 border-emerald-500/30"
                        : isUpcoming
                          ? "bg-sky-500/15 text-sky-900 border-sky-500/25"
                          : isPast
                            ? "bg-gray-100 text-gray-700 border-gray-200"
                            : "bg-gray-100 text-gray-600 border-gray-200"
                    }`}
                  >
                    {occupancyLabel(slot.occupancy)}
                  </span>
                </div>

                <p className="text-xs text-on-surface-variant font-mono mb-3">
                  {slotRangeLabel(slot)}
                </p>

                {slot.plan ? (
                  <div className="bg-white rounded-lg p-2.5 border border-outline-variant/40 mb-3">
                    <p className="text-xs font-bold text-on-surface truncate">
                      {planTitle(slot.plan)}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-on-surface-variant mt-1">
                      <span>{planStatusLabel(String(slot.plan.status))}</span>
                      {avgDailyKcal(slot.plan) && (
                        <span className="font-mono font-medium text-emerald-800">
                          ~{avgDailyKcal(slot.plan)?.toLocaleString("vi-VN")} kcal/ngày
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white/60 rounded-lg p-3 border border-dashed border-outline-variant text-center mb-3">
                    <p className="text-xs text-on-surface-variant italic">
                      Chưa có thực đơn trong chu kỳ này
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-outline-variant/30 mt-auto">
                <span
                  className={`text-[11px] font-semibold ${isSelected ? "text-primary font-bold" : "text-on-surface-variant"}`}
                >
                  {isSelected ? "● Đang xem" : "Nhấp để xem"}
                </span>

                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  {isPast && slot.plan && (
                    <span className="text-[10px] text-on-surface-variant italic px-1">
                      Chỉ xem
                    </span>
                  )}
                  {isActive && slot.plan && (
                    <>
                      <button
                        type="button"
                        disabled={Boolean(assigningId)}
                        onClick={() => void extendPlan(slot.plan!)}
                        className="px-2.5 py-1 rounded-lg border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-900 text-[11px] font-semibold transition-all cursor-pointer disabled:opacity-50"
                      >
                        Gia hạn 7 ngày
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAssignError(null);
                          setPickerOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-lg border border-outline-variant hover:border-amber-300 bg-white hover:bg-amber-50 text-on-surface hover:text-amber-900 text-[11px] font-semibold transition-all cursor-pointer"
                      >
                        Đổi thực đơn
                      </button>
                    </>
                  )}
                  {slotAllowsAdd(slot, schedule.today) && !slot.plan && (
                    <Link
                      href={reviewHref}
                      className="px-2.5 py-1 rounded-lg bg-primary text-on-primary text-[11px] font-bold hover:bg-primary/90 transition-all flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                      Duyệt
                    </Link>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showUnassigned && unassignedPlans.length > 0 && (
        <div className="mt-4 pt-4 border-t border-outline-variant/60 animate-in fade-in duration-200">
          <p className="text-xs font-bold text-on-surface mb-2.5 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-amber-700">
              pending_actions
            </span>
            Thực đơn chưa xếp lịch ({unassignedPlans.length})
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {unassignedPlans.map((plan) => (
              <div
                key={plan.id}
                className="bg-surface-container-low/50 border border-outline-variant/60 rounded-lg p-3 flex flex-col justify-between gap-2"
              >
                <div>
                  <button
                    type="button"
                    className="w-full text-left cursor-pointer hover:text-primary transition-colors"
                    onClick={() => previewUnassigned(plan)}
                  >
                    <p className="text-xs font-bold text-on-surface">{planTitle(plan)}</p>
                    <p className="text-[11px] text-on-surface-variant mt-0.5">
                      {planStatusLabel(String(plan.status))}
                      {formatCreatedAt(plan.created_at)
                        ? ` · ${formatCreatedAt(plan.created_at)}`
                        : ""}
                    </p>
                  </button>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1.5 border-t border-outline-variant/30">
                  {plan.status === "pending_review" ? (
                    <Link
                      href={buildReviewHref(patientId, plan.id)}
                      className="px-2.5 py-1 rounded-lg bg-amber-600 text-white text-[11px] font-bold hover:bg-amber-700 transition-all"
                    >
                      Duyệt ngay
                    </Link>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={Boolean(assigningId)}
                        onClick={() => void applyPlan(plan, "from_today")}
                        className="px-2.5 py-1 rounded-lg bg-primary text-on-primary text-[11px] font-bold hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-50"
                      >
                        Bắt đầu hôm nay
                      </button>
                      {chainAvailable && (
                        <button
                          type="button"
                          disabled={Boolean(assigningId)}
                          onClick={() => void applyPlan(plan, "after_current")}
                          className="px-2.5 py-1 rounded-lg border border-primary/40 text-primary text-[11px] font-bold hover:bg-primary/5 transition-all cursor-pointer disabled:opacity-50"
                        >
                          Tiếp nối
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Đóng danh sách thực đơn"
            className="absolute inset-0 bg-on-surface/40 backdrop-blur-xs cursor-pointer"
            onClick={closePicker}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            className="relative bg-surface-container-lowest border border-outline-variant rounded-xl shadow-2xl w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-outline-variant/50 shrink-0">
              <div className="min-w-0">
                <h3 id={dialogTitleId} className="text-sm font-bold text-on-surface">
                  Đổi thực đơn đang áp dụng
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Chọn bản đã duyệt chưa xếp lịch — sẽ bắt đầu từ hôm nay và cắt chu kỳ hiện tại.
                  {assignableUnassigned.length > 0
                    ? ` · ${assignableUnassigned.length} thực đơn khả dụng`
                    : ""}
                </p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={closePicker}
                disabled={Boolean(assigningId)}
                className="text-on-surface-variant hover:text-on-surface p-1.5 rounded-lg hover:bg-surface-container-low transition-colors cursor-pointer disabled:opacity-50"
                aria-label="Đóng"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {assignError && (
                <p className="mb-3 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg p-2.5">
                  {assignError}
                </p>
              )}

              {assignableUnassigned.length === 0 ? (
                <div className="py-8 text-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-[36px] text-outline mb-2">
                    menu_book
                  </span>
                  <p className="font-bold text-sm text-on-surface">
                    Chưa có thực đơn đã duyệt khác
                  </p>
                  <p className="text-xs mt-1 max-w-[36ch] mx-auto">
                    Bệnh nhân tạo bản AI; bác sĩ kiểm tra, duyệt rồi chọn lịch áp dụng.
                  </p>
                  <Link
                    href={reviewHref}
                    className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-all shadow-2xs"
                  >
                    <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                    Xem thực đơn chờ duyệt
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {assignableUnassigned.map((plan) => {
                    const kcal = avgDailyKcal(plan);
                    const created = formatCreatedAt(plan.created_at);
                    const busy = assigningId === plan.id;
                    return (
                      <div
                        key={plan.id}
                        className="p-3.5 rounded-lg border border-outline-variant/50 bg-white hover:border-primary/40 hover:bg-primary/[0.01] transition-all flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-on-surface">{planTitle(plan)}</p>
                          <p className="text-[11px] text-on-surface-variant mt-0.5">
                            {planStatusLabel(String(plan.status))}
                            {kcal != null
                              ? ` · ~${kcal.toLocaleString("vi-VN")} kcal/ngày`
                              : ""}
                            {created ? ` · ${created}` : ""}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={Boolean(assigningId)}
                          onClick={() => void applyPlan(plan, "from_today")}
                          className="shrink-0 px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-50"
                        >
                          {busy ? "Đang áp dụng…" : "Bắt đầu hôm nay"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {assignableUnassigned.length > 0 && (
              <div className="px-6 py-3 border-t border-outline-variant/40 shrink-0 bg-surface-container-low/30">
                <Link
                  href={reviewHref}
                  className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                >
                  <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                  Xem các bản dự thảo chờ duyệt
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function buildHistoryReviewHref(patientId: string): string {
  return `/doctor/patients/${encodeURIComponent(patientId)}/meals`;
}
