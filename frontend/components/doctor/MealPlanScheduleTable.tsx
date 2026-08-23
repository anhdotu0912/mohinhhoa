"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { api } from "@/lib/api";
import {
  formatDateFull,
  parseFlexibleDate,
} from "@/lib/plan-expiry";
import { displaySlotTitle, firstEmptyScheduleSlot, slotAllowsAdd, slotTitle, visibleScheduleSlots } from "@/lib/plan-schedule-helpers";
import {
  buildGenerateHref,
  buildReviewHref,
  intentFromSlot,
  saveSlotIntent,
} from "@/lib/plan-slot-intent";
import {
  ApiError,
  type MealPlanOutput,
  type MealPlanScheduleOut,
  type MealPlanScheduleSlot,
  type ScheduleOccupancy,
  type ScheduleSlotKey,
} from "@/lib/types";

function occupancyLabel(
  occupancy: ScheduleOccupancy,
  plan?: MealPlanOutput | null
): string {
  if (plan?.status === "pending_review") return "Chờ duyệt";
  if (occupancy === "empty" && plan) {
    if (plan.status === "approved" || plan.status === "edited") return "Đã duyệt";
    return "Chưa xếp lịch";
  }
  switch (occupancy) {
    case "active":
      return "Đang áp dụng";
    case "upcoming":
      return "Đã lên lịch";
    case "past":
      return "Đã qua";
    default:
      return "Chưa có kế hoạch";
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

  const [picker, setPicker] = useState<{
    slot: MealPlanScheduleSlot;
    index: number;
    mode: "add" | "replace";
  } | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showUnassigned, setShowUnassigned] = useState(false);

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
    if (!picker) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !assigningId) {
        setPicker(null);
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
  }, [picker, assigningId]);

  const buildGenerateLink = (
    slot: MealPlanScheduleSlot,
    action: "add" | "replace"
  ) =>
    buildGenerateHref(patientId, {
      action,
      slotKey: slot.slot_key === "current" || slot.slot_key === "next" ? slot.slot_key : "empty",
      startsOn: slot.starts_on,
    });

  const persistSlotIntent = (
    slot: MealPlanScheduleSlot,
    action: "add" | "replace"
  ) => {
    saveSlotIntent(intentFromSlot(patientId, slot, action));
  };

  const closePicker = () => {
    if (assigningId) return;
    setPicker(null);
    setAssignError(null);
  };

  const assignPlanToSlot = async (
    plan: MealPlanOutput,
    slot: MealPlanScheduleSlot,
    index: number,
    mode: "add" | "replace"
  ) => {
    setAssigningId(plan.id);
    setAssignError(null);
    try {
      await api.applyMealPlan(plan.id, {
        start_date: slot.starts_on,
        replace_active: mode === "replace" || slot.occupancy !== "empty",
        slot_key: slot.slot_key,
      });
      onSelectSlot?.(slot);
      await onRefresh?.({ planId: plan.id, startsOn: slot.starts_on });
      setPicker(null);
      showToast(
        mode === "replace"
          ? `Đã thay thế thực đơn ${slotTitle(slot)} (${slotRangeLabel(slot)}).`
          : `Đã gán ${planTitle(plan)} vào ${slotTitle(slot)} (${slotRangeLabel(slot)}).`
      );
    } catch (err) {
      setAssignError(
        err instanceof ApiError ? err.message : "Không gán được thực đơn vào tuần."
      );
    } finally {
      setAssigningId(null);
    }
  };

  const displaySlots = visibleScheduleSlots(schedule);
  const shownPlanIds = new Set(
    displaySlots.map((slot) => slot.plan?.id).filter((id): id is string => Boolean(id))
  );
  const unassignedPlans = schedule.unassigned_plans.filter(
    (plan) => !shownPlanIds.has(plan.id)
  );
  const currentSlot =
    displaySlots.find((slot) => slot.slot_key === "current") ??
    schedule.slots.find((slot) => slot.slot_key === "current") ??
    null;
  const previewUnassigned = (plan: MealPlanOutput) => {
    onPreviewPlan?.(plan);
    if (currentSlot) onSelectSlot?.(currentSlot);
  };
  const isAssignable = (plan: MealPlanOutput) =>
    plan.status === "approved" || plan.status === "edited";
  const replacePlans = (() => {
    const occupyingId = picker?.slot.plan?.id;
    const fromOtherSlots = displaySlots
      .map((slot) => slot.plan)
      .filter((plan): plan is MealPlanOutput => Boolean(plan))
      .filter((plan) => plan.id !== occupyingId);
    const merged = [...unassignedPlans, ...fromOtherSlots];
    const seen = new Set<string>();
    return merged.filter((plan) => {
      if (seen.has(plan.id)) return false;
      seen.add(plan.id);
      return true;
    });
  })();
  const pickerPlans =
    picker?.mode === "replace" ? replacePlans : unassignedPlans;

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-3xl p-5 mb-6 shadow-xs">
      {toastMessage && (
        <div
          role="status"
          className="fixed top-20 right-6 z-[60] bg-emerald-800 text-white px-4 py-2.5 rounded-2xl shadow-xl border border-emerald-600 flex items-center gap-2 font-body text-sm animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <span className="material-symbols-outlined text-[20px] text-emerald-300">
            check_circle
          </span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="font-h2 text-sm font-bold text-on-surface flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary text-[20px]">
              calendar_view_week
            </span>
            Lịch trình thực đơn 3 tuần
          </h3>
          {schedule.active_plan && (
            <p className="text-xs text-on-surface-variant mt-0.5">
              Đang áp dụng: Plan <span className="font-mono font-medium">…{schedule.active_plan_id?.slice(-6)}</span>
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-900 border border-amber-500/20 hover:bg-amber-500/15 transition-all cursor-pointer"
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

      {/* 3 Week Interactive Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {displaySlots.map((slot, index) => {
          const isSelected = slot.starts_on === selectedStartsOn;
          const isActive = slot.occupancy === "active";
          const isUpcoming = slot.occupancy === "upcoming";
          const isPast = slot.occupancy === "past";

          return (
            <div
              key={`${slot.slot_key}-${slot.starts_on}-${index}`}
              onClick={() => onSelectSlot?.(slot)}
              className={`rounded-2xl p-4 border transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? "bg-primary/[0.03] border-primary ring-2 ring-primary/25 shadow-xs"
                  : "bg-surface-container-low/40 border-outline-variant/60 hover:border-primary/40 hover:bg-white"
              }`}
            >
              {/* Card Top */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-bold text-on-surface">
                    {displaySlotTitle(index)}
                  </span>
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      slot.plan?.status === "pending_review"
                        ? "bg-amber-500/10 text-amber-900 border-amber-500/20"
                        : isActive
                          ? "bg-emerald-500/15 text-emerald-900 border-emerald-500/30"
                          : isUpcoming
                            ? "bg-sky-500/15 text-sky-900 border-sky-500/25"
                            : isPast
                              ? "bg-gray-100 text-gray-700 border-gray-200"
                              : "bg-gray-100 text-gray-600 border-gray-200"
                    }`}
                  >
                    {occupancyLabel(slot.occupancy, slot.plan)}
                  </span>
                </div>

                <p className="text-xs text-on-surface-variant font-mono mb-3">
                  {slotRangeLabel(slot)}
                </p>

                {/* Plan Info or Empty State */}
                {slot.plan ? (
                  <div className="bg-white rounded-xl p-2.5 border border-outline-variant/40 mb-3">
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
                  <div className="bg-white/60 rounded-xl p-3 border border-dashed border-outline-variant text-center mb-3">
                    <p className="text-xs text-on-surface-variant italic">Chưa có thực đơn gán tuần này</p>
                  </div>
                )}
              </div>

              {/* Card Actions */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-outline-variant/30 mt-auto">
                <span className={`text-[11px] font-semibold ${isSelected ? "text-primary font-bold" : "text-on-surface-variant"}`}>
                  {isSelected ? "● Đang xem tuần này" : "Nhấp để xem tuần"}
                </span>

                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  {slot.actions.includes("replace") && (
                    <button
                      type="button"
                      onClick={() => {
                        setAssignError(null);
                        setPicker({ slot, index, mode: "replace" });
                      }}
                      className="px-2.5 py-1 rounded-lg border border-outline-variant hover:border-amber-300 bg-white hover:bg-amber-50 text-on-surface hover:text-amber-900 text-[11px] font-semibold transition-all cursor-pointer"
                    >
                      Đổi thực đơn
                    </button>
                  )}
                  {slotAllowsAdd(slot, schedule.today) && !slot.plan && (
                    <Link
                      href={buildGenerateLink(slot, "add")}
                      onClick={() => persistSlotIntent(slot, "add")}
                      className="px-2.5 py-1 rounded-lg bg-primary text-on-primary text-[11px] font-bold hover:bg-primary/90 transition-all flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                      Tạo AI
                    </Link>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Collapsible Unassigned Plans */}
      {showUnassigned && unassignedPlans.length > 0 && (
        <div className="mt-4 pt-4 border-t border-outline-variant/60 animate-in fade-in duration-200">
          <p className="text-xs font-bold text-on-surface mb-2.5 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-amber-700">
              pending_actions
            </span>
            Danh sách thực đơn đã tạo chưa xếp lịch ({unassignedPlans.length})
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {unassignedPlans.map((plan) => (
              <div
                key={plan.id}
                className="bg-surface-container-low/50 border border-outline-variant/60 rounded-xl p-3 flex flex-col justify-between gap-2"
              >
                <div>
                  <button
                    type="button"
                    className="w-full text-left cursor-pointer hover:text-primary transition-colors"
                    onClick={() => previewUnassigned(plan)}
                  >
                    <p className="text-xs font-bold text-on-surface">
                      {planTitle(plan)}
                    </p>
                    <p className="text-[11px] text-on-surface-variant mt-0.5">
                      {planStatusLabel(String(plan.status))}
                      {formatCreatedAt(plan.created_at) ? ` · ${formatCreatedAt(plan.created_at)}` : ""}
                    </p>
                  </button>
                </div>
                <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-outline-variant/30">
                  {plan.status === "pending_review" ? (
                    <Link
                      href={buildReviewHref(
                        patientId,
                        plan.id,
                        currentSlot ? intentFromSlot(patientId, currentSlot, "add") : null
                      )}
                      onClick={() => {
                        if (currentSlot) persistSlotIntent(currentSlot, "add");
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-600 text-white text-[11px] font-bold hover:bg-amber-700 transition-all"
                    >
                      Duyệt ngay
                    </Link>
                  ) : currentSlot ? (
                    <button
                      type="button"
                      onClick={() => {
                        setAssignError(null);
                        setPicker({
                          slot: currentSlot,
                          index: displaySlots.indexOf(currentSlot),
                          mode: "add",
                        });
                      }}
                      className="px-2.5 py-1 rounded-lg bg-primary text-on-primary text-[11px] font-bold hover:bg-primary/90 transition-all cursor-pointer"
                    >
                      Gán vào tuần này
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assign / Replace Modal */}
      {picker && (
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
            className="relative bg-surface-container-lowest border border-outline-variant rounded-3xl shadow-2xl w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-outline-variant/50 shrink-0">
              <div className="min-w-0">
                <h3
                  id={dialogTitleId}
                  className="text-sm font-bold text-on-surface"
                >
                  {picker.mode === "replace" ? "Thay thế thực đơn" : "Gán thực đơn vào"}{" "}
                  {slotTitle(picker.slot)}
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {slotRangeLabel(picker.slot)}
                  {pickerPlans.length > 0 ? ` · ${pickerPlans.length} thực đơn khả dụng` : ""}
                </p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={closePicker}
                disabled={Boolean(assigningId)}
                className="text-on-surface-variant hover:text-on-surface p-1.5 rounded-xl hover:bg-surface-container-low transition-colors cursor-pointer disabled:opacity-50"
                aria-label="Đóng"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {assignError && (
                <p className="mb-3 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-xl p-2.5">
                  {assignError}
                </p>
              )}

              {pickerPlans.length === 0 ? (
                <div className="py-8 text-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-[36px] text-outline mb-2">
                    menu_book
                  </span>
                  <p className="font-bold text-sm text-on-surface">
                    Chưa có thực đơn khác để chọn
                  </p>
                  <p className="text-xs mt-1 max-w-[36ch] mx-auto text-on-surface-variant">
                    {picker.mode === "replace"
                      ? "Chưa có thực đơn đã tạo nào khác. Bạn có thể tạo thực đơn AI mới cho tuần này."
                      : "Chỉ thực đơn đã duyệt và chưa xếp lịch mới gán được vào tuần này."}
                  </p>
                  <Link
                    href={buildGenerateLink(
                      picker.slot,
                      picker.mode === "replace" ? "replace" : "add"
                    )}
                    onClick={() =>
                      persistSlotIntent(
                        picker.slot,
                        picker.mode === "replace" ? "replace" : "add"
                      )
                    }
                    className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-all shadow-2xs"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      auto_awesome
                    </span>
                    Tạo thực đơn AI cho tuần này
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {pickerPlans.map((plan) => {
                    const kcal = avgDailyKcal(plan);
                    const created = formatCreatedAt(plan.created_at);
                    const busy = assigningId === plan.id;
                    const alreadyScheduled = displaySlots.find(
                      (slot) => slot.plan?.id === plan.id
                    );
                    return (
                      <div
                        key={plan.id}
                        className="p-3.5 rounded-2xl border border-outline-variant/50 bg-white hover:border-primary/40 hover:bg-primary/[0.01] transition-all flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-on-surface">
                            {planTitle(plan)}
                          </p>
                          <p className="text-[11px] text-on-surface-variant mt-0.5">
                            {planStatusLabel(String(plan.status))}
                            {kcal != null ? ` · ~${kcal.toLocaleString("vi-VN")} kcal/ngày` : ""}
                            {created ? ` · ${created}` : ""}
                          </p>
                          {alreadyScheduled && (
                            <p className="text-[10px] text-amber-800 mt-0.5">
                              Đang xếp ở {slotTitle(alreadyScheduled)}
                            </p>
                          )}
                        </div>
                        {isAssignable(plan) ? (
                          <button
                            type="button"
                            disabled={Boolean(assigningId)}
                            onClick={() =>
                              void assignPlanToSlot(
                                plan,
                                picker.slot,
                                picker.index,
                                picker.mode
                              )
                            }
                            className="shrink-0 px-3 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-50"
                          >
                            {busy
                              ? picker.mode === "replace"
                                ? "Đang thay…"
                                : "Đang gán…"
                              : picker.mode === "replace"
                                ? "Chọn thay thế"
                                : "Gán vào tuần này"}
                          </button>
                        ) : (
                          <Link
                            href={buildReviewHref(
                              patientId,
                              plan.id,
                              intentFromSlot(patientId, picker.slot, picker.mode)
                            )}
                            onClick={() => persistSlotIntent(picker.slot, picker.mode)}
                            className="shrink-0 px-3 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700"
                          >
                            Duyệt trước
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {pickerPlans.length > 0 && (
              <div className="px-6 py-3 border-t border-outline-variant/40 shrink-0 bg-surface-container-low/30">
                <Link
                  href={buildGenerateLink(
                    picker.slot,
                    picker.mode === "replace" ? "replace" : "add"
                  )}
                  onClick={() =>
                    persistSlotIntent(
                      picker.slot,
                      picker.mode === "replace" ? "replace" : "add"
                    )
                  }
                  className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    auto_awesome
                  </span>
                  Hoặc tạo thực đơn AI mới cho tuần này
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function buildHistoryGenerateHref(
  patientId: string,
  schedule: MealPlanScheduleOut | null
): string {
  const slot = schedule ? firstEmptyScheduleSlot(schedule) : null;
  if (slot) {
    return buildGenerateHref(patientId, {
      action: "add",
      slotKey: slot.slot_key as ScheduleSlotKey,
      startsOn: slot.starts_on,
    });
  }
  return `/doctor/patients/${encodeURIComponent(patientId)}/generate`;
}
