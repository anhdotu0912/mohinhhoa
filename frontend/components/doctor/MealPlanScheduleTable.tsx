"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { api } from "@/lib/api";
import {
  formatDateFull,
  formatDateShort,
  parseFlexibleDate,
} from "@/lib/plan-expiry";
import { firstEmptyScheduleSlot } from "@/lib/plan-schedule-helpers";
import { buildGenerateHref } from "@/lib/plan-slot-intent";
import {
  ApiError,
  type MealPlanOutput,
  type MealPlanScheduleOut,
  type MealPlanScheduleSlot,
  type ScheduleOccupancy,
  type ScheduleSlotKey,
} from "@/lib/types";

function slotTitle(slot: MealPlanScheduleSlot, index: number): string {
  if (slot.slot_key === "current") return "Tuần này";
  if (slot.slot_key === "next") return "Tuần sau";
  if (slot.occupancy === "empty" && index >= 2) return "Tuần trống tiếp theo";
  if (slot.occupancy === "upcoming") return "Tuần đã xếp";
  return "Tuần trước";
}

function occupancyLabel(occupancy: ScheduleOccupancy): string {
  switch (occupancy) {
    case "active":
      return "ĐANG ÁP DỤNG";
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
  return `${formatDateShort(start)} – ${formatDateFull(end)}`;
}

function planTitle(plan: MealPlanOutput): string {
  return `Thực đơn ${plan.days?.length ?? 7} ngày`;
}

function planStatusLabel(status: string): string {
  if (status === "edited") return "Đã chỉnh sửa";
  if (status === "approved") return "Đã duyệt";
  return "Đã duyệt";
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
  onRefresh,
}: MealPlanScheduleTableProps) {
  const displaySlots = schedule.slots.slice(0, 4);
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
      slotKey: slot.slot_key,
      startsOn: slot.starts_on,
    });

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
          ? `Đã thay thế thực đơn ${slotTitle(slot, index)} (${slotRangeLabel(slot)}).`
          : `Đã gán ${planTitle(plan)} vào ${slotTitle(slot, index)} (${slotRangeLabel(slot)}).`
      );
    } catch (err) {
      setAssignError(
        err instanceof ApiError ? err.message : "Không gán được thực đơn vào tuần."
      );
    } finally {
      setAssigningId(null);
    }
  };

  const unassignedPlans = schedule.unassigned_plans;
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

  const columnClass = (slot: MealPlanScheduleSlot) => {
    if (slot.starts_on === selectedStartsOn) return "bg-primary/10";
    if (slot.occupancy === "active") return "bg-primary/5";
    return "";
  };

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-md mb-md shadow-xs">
      {toastMessage && (
        <div
          role="status"
          className="fixed top-20 right-6 z-[60] bg-emerald-800 text-white px-md py-sm rounded-xl shadow-lg border border-emerald-600 flex items-center gap-xs font-body text-sm"
        >
          <span className="material-symbols-outlined text-[20px] text-emerald-300">
            check_circle
          </span>
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-sm mb-md">
        <div>
          <h3 className="font-h2 text-base font-bold text-on-surface flex items-center gap-xs">
            <span className="material-symbols-outlined text-primary text-[20px]">
              calendar_view_week
            </span>
            Lịch trình thực đơn theo tuần
          </h3>
          {schedule.active_plan && (
            <p className="text-xs text-on-surface-variant mt-1">
              Đang áp dụng: Plan{" "}
              <span className="font-mono">
                …{schedule.active_plan_id?.slice(-6)}
              </span>
              {schedule.active_plan.starts_on && schedule.active_plan.ends_on
                ? ` · ${schedule.active_plan.starts_on} – ${schedule.active_plan.ends_on}`
                : ""}
            </p>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-xs">
          <thead>
            <tr className="border-b border-outline-variant">
              <th className="p-sm text-left text-on-surface-variant font-semibold w-[120px]">
                {" "}
              </th>
              {displaySlots.map((slot, index) => (
                <th
                  key={`${slot.slot_key}-${slot.starts_on}-${index}`}
                  className={`p-sm text-left font-semibold cursor-pointer ${
                    slot.starts_on === selectedStartsOn || slot.occupancy === "active"
                      ? "text-primary border-t-2 border-primary"
                      : "text-on-surface"
                  } ${columnClass(slot)}`}
                  onClick={() => onSelectSlot?.(slot)}
                >
                  <div>{slotTitle(slot, index)}</div>
                  <div className="font-normal text-on-surface-variant mt-0.5">
                    {slotRangeLabel(slot)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            <tr>
              <td className="p-sm font-semibold text-on-surface-variant">Thực đơn</td>
              {displaySlots.map((slot, index) => (
                <td
                  key={`plan-${slot.starts_on}-${index}`}
                  className={`p-sm ${columnClass(slot)}`}
                >
                  {slot.plan ? (
                    <button
                      type="button"
                      onClick={() => onSelectSlot?.(slot)}
                      className="font-semibold text-on-surface text-left hover:text-primary cursor-pointer"
                    >
                      {planTitle(slot.plan)}
                    </button>
                  ) : (
                    <span className="text-on-surface-variant italic">(trống)</span>
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-sm font-semibold text-on-surface-variant">Trạng thái</td>
              {displaySlots.map((slot, index) => (
                <td
                  key={`status-${slot.starts_on}-${index}`}
                  className={`p-sm ${columnClass(slot)}`}
                >
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      slot.occupancy === "active"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : slot.occupancy === "upcoming"
                          ? "bg-sky-50 text-sky-800 border-sky-200"
                          : "bg-surface-container-high text-on-surface-variant border-outline-variant"
                    }`}
                  >
                    {occupancyLabel(slot.occupancy)}
                  </span>
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-sm font-semibold text-on-surface-variant">Hành động</td>
              {displaySlots.map((slot, index) => (
                <td
                  key={`actions-${slot.starts_on}-${index}`}
                  className={`p-sm ${columnClass(slot)}`}
                >
                  <div className="flex flex-wrap gap-xs">
                    {slot.actions.includes("view") && slot.plan && (
                      <button
                        type="button"
                        onClick={() => onSelectSlot?.(slot)}
                        className="px-sm py-1 rounded-lg border border-outline-variant text-on-surface hover:border-primary transition-colors cursor-pointer"
                      >
                        Xem nội dung
                      </button>
                    )}
                    {slot.actions.includes("replace") && (
                      <button
                        type="button"
                        onClick={() => {
                          setAssignError(null);
                          setPicker({ slot, index, mode: "replace" });
                        }}
                        className="px-sm py-1 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-400 transition-colors cursor-pointer"
                      >
                        Thay thế
                      </button>
                    )}
                    {slot.actions.includes("add") && (
                      <button
                        type="button"
                        onClick={() => {
                          setAssignError(null);
                          setPicker({ slot, index, mode: "add" });
                        }}
                        className="px-sm py-1 rounded-lg bg-primary text-on-primary font-semibold hover:bg-primary-container transition-colors cursor-pointer"
                      >
                        Thêm thực đơn
                      </button>
                    )}
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {picker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Đóng danh sách thực đơn"
            className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm cursor-pointer"
            onClick={closePicker}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            className="relative bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-2xl w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden"
          >
            <div className="flex items-start justify-between gap-sm px-5 pt-5 pb-4 border-b border-outline-variant shrink-0">
              <div className="min-w-0">
                <h3
                  id={dialogTitleId}
                  className="text-sm font-bold text-on-surface"
                >
                  {picker.mode === "replace" ? "Thay thế thực đơn" : "Gán thực đơn vào"}{" "}
                  {slotTitle(picker.slot, picker.index)}
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {slotRangeLabel(picker.slot)}
                  {pickerPlans.length > 0
                    ? ` · ${pickerPlans.length} thực đơn đã tạo`
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

            <div className="flex-1 overflow-y-auto">
              {assignError && (
                <p className="mx-5 mt-4 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-sm py-xs">
                  {assignError}
                </p>
              )}

              {pickerPlans.length === 0 ? (
                <div className="px-5 py-10 text-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-[40px] text-outline mb-sm">
                    menu_book
                  </span>
                  <p className="font-semibold text-sm text-on-surface">
                    Chưa có thực đơn khác để chọn
                  </p>
                  <p className="text-xs mt-xs max-w-[36ch] mx-auto">
                    {picker.mode === "replace"
                      ? "Chưa có thực đơn đã tạo nào khác. Tạo thực đơn AI mới rồi quay lại thay thế."
                      : "Chỉ thực đơn đã duyệt và chưa xếp lịch mới gán được vào tuần này."}
                  </p>
                  <Link
                    href={buildGenerateLink(
                      picker.slot,
                      picker.mode === "replace" ? "replace" : "add"
                    )}
                    className="inline-flex items-center gap-xs mt-md px-md py-2 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      auto_awesome
                    </span>
                    Tạo thực đơn AI cho tuần này
                  </Link>
                </div>
              ) : (
                <ul className="divide-y divide-outline-variant/70">
                  {pickerPlans.map((plan) => {
                    const kcal = avgDailyKcal(plan);
                    const created = formatCreatedAt(plan.created_at);
                    const busy = assigningId === plan.id;
                    const alreadyScheduled = displaySlots.find(
                      (slot) => slot.plan?.id === plan.id
                    );
                    return (
                      <li key={plan.id} className="px-5 py-3.5">
                        <div className="flex items-start justify-between gap-md">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-on-surface">
                              {planTitle(plan)}
                            </p>
                            <p className="text-[11px] text-on-surface-variant mt-0.5">
                              {planStatusLabel(String(plan.status))}
                              {kcal != null
                                ? ` · ${kcal.toLocaleString("vi-VN")} kcal/ngày`
                                : ""}
                              {created ? ` · ${created}` : ""}
                            </p>
                            {alreadyScheduled ? (
                              <p className="text-[11px] text-amber-800 mt-1">
                                Đang xếp ở {slotTitle(alreadyScheduled, displaySlots.indexOf(alreadyScheduled))}
                              </p>
                            ) : null}
                          </div>
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
                            className="shrink-0 px-sm py-1.5 rounded-lg bg-primary text-on-primary text-[11px] font-semibold hover:bg-primary-container transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {busy
                              ? picker.mode === "replace"
                                ? "Đang thay…"
                                : "Đang gán…"
                              : picker.mode === "replace"
                                ? "Chọn thay thế"
                                : "Gán vào tuần này"}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {pickerPlans.length > 0 && (
              <div className="px-5 py-3 border-t border-outline-variant shrink-0 bg-surface-container-low/40">
                <Link
                  href={buildGenerateLink(
                    picker.slot,
                    picker.mode === "replace" ? "replace" : "add"
                  )}
                  className="inline-flex items-center gap-xs text-xs font-semibold text-primary hover:underline"
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
