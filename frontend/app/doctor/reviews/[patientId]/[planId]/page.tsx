"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { DayNutritionDashboard } from "@/components/doctor/DayNutritionDashboard";
import { TopBar } from "@/components/shared/TopBar";
import { doctorPatientToUi, type Patient } from "@/lib/mock-data";
import { api, assetUrl } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import {
  applyDaySlotsToPlan,
  computeNutritionWarningBundle,
  countHardNutritionWarnings,
  dayKcalBand,
  dayPlanToUi,
  flattenStructuredWarnings,
  mealKcalBand,
  mealPlanToEditedPayload,
  mealPlanToUiItem,
  slotCalories,
  targetsFromProfileSnapshot,
  type MealSlotKey,
  type NutritionWarningSlots,
} from "@/lib/meal-plan-mappers";
import { MealDishItem, MealPlanItem } from "@/lib/plans-store";
import { ApiError, type FoodCatalogItem, type MealPlanOutput } from "@/lib/types";
import { asRouteId } from "@/lib/route-params";
import { formatDateFull, formatDateIso, parseFlexibleDate } from "@/lib/plan-expiry";
import { buildHistoryHref } from "@/lib/plan-slot-intent";
import type { ApplyMode, MealPlanScheduleOut } from "@/lib/types";

type MealSlot = MealSlotKey;

const SLOT_LABELS: Record<MealSlot, { title: string; icon: string; iconClass: string }> = {
  breakfast: { title: "Bữa sáng (07:00 - 08:00)", icon: "wb_sunny", iconClass: "text-amber-500" },
  lunch: { title: "Bữa trưa (11:30 - 12:30)", icon: "sunny", iconClass: "text-amber-600" },
  dinner: { title: "Bữa tối (18:00 - 19:00)", icon: "nights_stay", iconClass: "text-indigo-500" },
  snack: { title: "Bữa phụ (15:30)", icon: "cookie", iconClass: "text-emerald-600" },
};

function clonePlan(plan: MealPlanOutput): MealPlanOutput {
  return structuredClone(plan);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function realAvatarUrl(avatar?: string | null): string | null {
  if (!avatar) return null;
  if (avatar.startsWith("https://api.dicebear.com")) return null;
  return assetUrl(avatar) || avatar;
}

function warningSlotsForDay(
  breakfast: MealDishItem[],
  lunch: MealDishItem[],
  dinner: MealDishItem[],
  snack: MealDishItem[]
): NutritionWarningSlots {
  return { breakfast, lunch, dinner, snack };
}

export default function PlanReviewDetailPage() {
  const router = useRouter();
  const params = useParams();

  const patientId = asRouteId(params?.patientId);
  const planId = asRouteId(params?.planId);

  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [rawPlan, setRawPlan] = useState<MealPlanOutput | null>(null);
  const [baselinePlan, setBaselinePlan] = useState<MealPlanOutput | null>(null);
  const [plan, setPlan] = useState<MealPlanItem | null>(null);

  const [activeDayIndex, setActiveDayIndex] = useState<number>(1);
  const [status, setStatus] = useState<MealPlanItem["status"]>("pending");

  const [breakfast, setBreakfast] = useState<MealDishItem[]>([]);
  const [lunch, setLunch] = useState<MealDishItem[]>([]);
  const [dinner, setDinner] = useState<MealDishItem[]>([]);
  const [snack, setSnack] = useState<MealDishItem[]>([]);
  const [dirty, setDirty] = useState(false);

  /** Slot đang mở chế độ chỉnh sửa món (null = đang xem). */
  const [editingSlot, setEditingSlot] = useState<MealSlot | null>(null);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showApplyPrompt, setShowApplyPrompt] = useState(false);
  const [applyingPlan, setApplyingPlan] = useState(false);
  const [patientSchedule, setPatientSchedule] = useState<MealPlanScheduleOut | null>(
    null
  );

  const [addingToSlot, setAddingToSlot] = useState<MealSlot | null>(null);
  const [foodQuery, setFoodQuery] = useState("");
  const [foodResults, setFoodResults] = useState<FoodCatalogItem[]>([]);
  const [foodTotal, setFoodTotal] = useState(0);
  const [foodLoading, setFoodLoading] = useState(false);
  const [foodError, setFoodError] = useState<string | null>(null);
  /** Mũi tên mở/thu gọn nội dung từng bữa. */
  const [expandedSlots, setExpandedSlots] = useState<Record<MealSlot, boolean>>({
    breakfast: true,
    lunch: true,
    dinner: true,
    snack: true,
  });

  const daysList = plan?.days && plan.days.length > 0 ? plan.days : [];
  const currentDayData =
    daysList.find((d) => d.dayIndex === activeDayIndex) || daysList[0] || null;

  const nutritionTargets = useMemo(
    () => targetsFromProfileSnapshot(rawPlan?.profile_snapshot),
    [rawPlan?.profile_snapshot]
  );

  const slotKcal = useMemo(
    () => ({
      breakfast: slotCalories(breakfast),
      lunch: slotCalories(lunch),
      dinner: slotCalories(dinner),
      snack: slotCalories(snack),
    }),
    [breakfast, lunch, dinner, snack]
  );

  const dayCalories =
    slotKcal.breakfast + slotKcal.lunch + slotKcal.dinner + slotKcal.snack;

  const daySalt =
    breakfast.reduce((sum, item) => sum + item.salt, 0) +
    lunch.reduce((sum, item) => sum + item.salt, 0) +
    dinner.reduce((sum, item) => sum + item.salt, 0) +
    snack.reduce((sum, item) => sum + item.salt, 0);

  const daySugar =
    breakfast.reduce((sum, item) => sum + item.sugar, 0) +
    lunch.reduce((sum, item) => sum + item.sugar, 0) +
    dinner.reduce((sum, item) => sum + item.sugar, 0) +
    snack.reduce((sum, item) => sum + item.sugar, 0);

  const activeWarningSlots = useMemo(
    () => warningSlotsForDay(breakfast, lunch, dinner, snack),
    [breakfast, lunch, dinner, snack]
  );

  const warningBundle = useMemo(
    () => computeNutritionWarningBundle(activeWarningSlots, nutritionTargets),
    [activeWarningSlots, nutritionTargets]
  );

  /** Hard breaches only — lưu plan + cổng duyệt. */
  const dayHardWarnings = useMemo(
    () => flattenStructuredWarnings(warningBundle.hard),
    [warningBundle.hard]
  );

  const warningsBySlot = {
    breakfast: warningBundle.hard.breakfast,
    lunch: warningBundle.hard.lunch,
    dinner: warningBundle.hard.dinner,
    snack: warningBundle.hard.snack,
  };
  const advisoryBySlot = {
    breakfast: warningBundle.advisory.breakfast,
    lunch: warningBundle.advisory.lunch,
    dinner: warningBundle.advisory.dinner,
    snack: warningBundle.advisory.snack,
  };
  const dayOnlyWarnings = warningBundle.hard.day;
  const dayAdvisoryWarnings = warningBundle.advisory.day;

  const dayBand = useMemo(
    () => dayKcalBand(nutritionTargets.targetKcal),
    [nutritionTargets.targetKcal]
  );

  const daySwaps = useMemo(() => {
    if (!rawPlan) return [];
    return (rawPlan.swaps || []).filter((s) => s.day_index === activeDayIndex);
  }, [rawPlan, activeDayIndex]);

  const hardWarningCount = useMemo(() => {
    if (!rawPlan) return 0;
    return rawPlan.days.reduce((n, d) => {
      if (d.day_index === activeDayIndex) {
        return n + dayHardWarnings.length;
      }
      const ui = dayPlanToUi(d);
      return (
        n +
        countHardNutritionWarnings(
          warningSlotsForDay(
            ui.breakfast || [],
            ui.lunch || [],
            ui.dinner || [],
            ui.snack || []
          ),
          nutritionTargets
        )
      );
    }, 0);
  }, [rawPlan, activeDayIndex, dayHardWarnings, nutritionTargets]);

  const canApprove =
    (status === "pending" || status === "edited") &&
    !editingSlot &&
    hardWarningCount === 0;
  const isReviewable = status === "pending" || status === "edited";
  const canEdit = isReviewable;

  const todayRangeLabel = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${formatDateFull(start)} – ${formatDateFull(end)}`;
  }, []);

  const chainApplyInfo = useMemo(() => {
    if (!patientSchedule) return { hasChain: false, nextStartLabel: null as string | null };
    const active = patientSchedule.active_plan;
    const upcoming = patientSchedule.slots.find(
      (slot) => slot.occupancy === "upcoming" && slot.plan
    );
    const chainEndIso = upcoming?.ends_on ?? active?.ends_on ?? null;
    if (!chainEndIso) return { hasChain: false, nextStartLabel: null };
    const chainEnd = parseFlexibleDate(chainEndIso);
    if (!chainEnd) return { hasChain: false, nextStartLabel: null };
    const nextStart = new Date(chainEnd);
    nextStart.setDate(nextStart.getDate() + 1);
    const nextEnd = new Date(nextStart);
    nextEnd.setDate(nextEnd.getDate() + 6);
    return {
      hasChain: true,
      nextStartLabel: `${formatDateFull(nextStart)} – ${formatDateFull(nextEnd)}`,
    };
  }, [patientSchedule]);

  const avatarSrc = realAvatarUrl(patient?.avatar);

  const syncSlotsFromPlan = useCallback((uiPlan: MealPlanItem, dayIdx: number) => {
    const day = uiPlan.days.find((d) => d.dayIndex === dayIdx) || uiPlan.days[0];
    if (!day) {
      setBreakfast([]);
      setLunch([]);
      setDinner([]);
      setSnack([]);
      return;
    }
    setBreakfast(day.breakfast || []);
    setLunch(day.lunch || []);
    setDinner(day.dinner || []);
    setSnack(day.snack || []);
  }, []);

  const applyRawToUi = useCallback(
    (nextRaw: MealPlanOutput, patientMeta: Patient, preferDay?: number) => {
      const uiPlan = mealPlanToUiItem(nextRaw, {
        patientName: patientMeta.name,
        patientCode: patientMeta.id,
        condition: patientMeta.condition,
      });
      setRawPlan(nextRaw);
      setBaselinePlan(clonePlan(nextRaw));
      setPlan(uiPlan);
      setStatus(uiPlan.status);
      const dayIdx =
        preferDay && uiPlan.days.some((d) => d.dayIndex === preferDay)
          ? preferDay
          : uiPlan.days[0]?.dayIndex || 1;
      setActiveDayIndex(dayIdx);
      syncSlotsFromPlan(uiPlan, dayIdx);
      setDirty(false);
      setEditingSlot(null);
    },
    [syncSlotsFromPlan]
  );

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    setHydrated(true);
    if (!patientId) return;
    void api.getPatientMealPlanSchedule(patientId).then(setPatientSchedule).catch(() => {
      setPatientSchedule(null);
    });
  }, [patientId]);

  const load = useCallback(async () => {
    if (!planId || !patientId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [planRow, patientRow] = await Promise.all([
        api.getMealPlan(planId),
        api.getDoctorPatient(patientId),
      ]);
      const mapped = doctorPatientToUi(patientRow);
      const uiPatient: Patient = {
        ...mapped,
        avatar: realAvatarUrl(patientRow.avatar) || "",
      };
      setPatient(uiPatient);
      applyRawToUi(planRow, uiPatient);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Không tải được thực đơn.");
    } finally {
      setLoading(false);
    }
  }, [planId, patientId, applyRawToUi]);

  useEffect(() => {
    if (!hydrated) return;
    if (!token || role !== "doctor") {
      router.replace("/login");
      return;
    }
    void load();
  }, [hydrated, token, role, router, load]);

  const commitActiveDayToDraft = useCallback(
    (base: MealPlanOutput): MealPlanOutput => {
      return applyDaySlotsToPlan(
        base,
        activeDayIndex,
        {
          breakfast,
          lunch,
          dinner,
          snack,
        },
        { warnings: dayHardWarnings }
      );
    },
    [activeDayIndex, breakfast, lunch, dinner, snack, dayHardWarnings]
  );

  const handleSelectDay = (dayIdx: number) => {
    if (!rawPlan || !patient) return;
    if (dayIdx === activeDayIndex) return;
    if (editingSlot) {
      showToast("Hãy lưu hoặc hủy chỉnh sửa bữa đang mở trước khi đổi ngày.");
      return;
    }

    let nextRaw = rawPlan;
    if (dirty) {
      nextRaw = commitActiveDayToDraft(rawPlan);
      setRawPlan(nextRaw);
      const uiPlan = mealPlanToUiItem(nextRaw, {
        patientName: patient.name,
        patientCode: patient.id,
        condition: patient.condition,
      });
      setPlan(uiPlan);
      setActiveDayIndex(dayIdx);
      syncSlotsFromPlan(uiPlan, dayIdx);
      return;
    }

    setActiveDayIndex(dayIdx);
    if (plan) syncSlotsFromPlan(plan, dayIdx);
  };

  const markDirty = () => setDirty(true);

  const handleApplyWithMode = async (mode: ApplyMode) => {
    setApplyingPlan(true);
    try {
      const applied = await api.applyMealPlan(planId, { apply_mode: mode });
      showToast("Đã áp dụng thực đơn.");
      setShowApplyPrompt(false);
      router.push(buildHistoryHref(patientId, applied.starts_on ?? formatDateIso(new Date())));
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "Không áp dụng được thực đơn."
      );
    } finally {
      setApplyingPlan(false);
    }
  };

  const handleApprove = async () => {
    if (editingSlot) {
      showToast("Hãy lưu hoặc hủy chỉnh sửa trước khi duyệt.");
      return;
    }
    if (hardWarningCount > 0) {
      showToast("Còn vi phạm ràng buộc lâm sàng — xử lý hết trước khi duyệt.");
      return;
    }
    if (!isReviewable) return;

    setSaving(true);
    try {
      // Persist dismissed warnings / unsaved dish edits before approve.
      if (dirty) {
        await persistDraftIfNeeded();
      }
      await api.reviewMealPlan(planId, { action: "approve" });
      setStatus("approved");
      showToast("Đã duyệt thực đơn.");
      setShowApplyPrompt(true);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Không duyệt được thực đơn.");
      if (err instanceof ApiError && err.code === "PLAN_ALREADY_REVIEWED") {
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSkipApply = () => {
    setShowApplyPrompt(false);
    router.push(`/doctor/patients/${patientId}/history`);
  };

  const handleRejectConfirm = async () => {
    if (!rejectReason.trim() || !isReviewable) return;
    setSaving(true);
    try {
      await api.reviewMealPlan(planId, {
        action: "reject",
        notes: rejectReason.trim(),
      });
      setStatus("rejected");
      setRejectModalOpen(false);
      showToast("Đã từ chối thực đơn.");
      setTimeout(() => {
        router.push(`/doctor/patients/${patientId}/meals`);
      }, 1200);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Không từ chối được thực đơn.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!rawPlan || !patient) return;
    setSaving(true);
    try {
      await persistDraftIfNeeded();
      showToast("Đã lưu chỉnh sửa thực đơn.");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Không lưu được chỉnh sửa.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (!baselinePlan || !patient) {
      setEditingSlot(null);
      setDirty(false);
      return;
    }
    applyRawToUi(clonePlan(baselinePlan), patient, activeDayIndex);
  };

  const startEditSlot = (slot: MealSlot) => {
    if (!canEdit) return;
    if (editingSlot && editingSlot !== slot && dirty) {
      showToast("Hãy lưu hoặc hủy chỉnh sửa bữa hiện tại trước.");
      return;
    }
    setEditingSlot(slot);
  };

  const finishEditSlot = () => {
    if (dirty) {
      void handleSaveEdit();
      return;
    }
    setEditingSlot(null);
  };

  const persistDraftIfNeeded = async (): Promise<MealPlanOutput | null> => {
    if (!rawPlan || !patient) return null;
    const draft = dirty || editingSlot ? commitActiveDayToDraft(rawPlan) : rawPlan;
    if (!dirty && draft === rawPlan) return draft;

    const payload = mealPlanToEditedPayload(draft);
    await api.reviewMealPlan(planId, {
      action: "edit",
      notes: editingSlot
        ? "Bác sĩ đã chỉnh sửa khẩu phần trên UI."
        : "Bác sĩ đã xác nhận xử lý cảnh báo dinh dưỡng.",
      edited_plan: payload,
    });
    const refreshed = await api.getMealPlan(planId);
    applyRawToUi(refreshed, patient, activeDayIndex);
    return refreshed;
  };

  const handleRemoveDish = (meal: MealSlot, index: number) => {
    markDirty();
    if (meal === "breakfast") setBreakfast((list) => list.filter((_, i) => i !== index));
    if (meal === "lunch") setLunch((list) => list.filter((_, i) => i !== index));
    if (meal === "dinner") setDinner((list) => list.filter((_, i) => i !== index));
    if (meal === "snack") setSnack((list) => list.filter((_, i) => i !== index));
  };

  const openAddDish = (slot: MealSlot) => {
    setAddingToSlot(slot);
    setFoodQuery("");
    setFoodError(null);
  };

  const closeAddDish = () => {
    setAddingToSlot(null);
    setFoodQuery("");
    setFoodError(null);
  };

  useEffect(() => {
    if (!addingToSlot) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setFoodLoading(true);
      setFoodError(null);
      void api
        .searchFoods({ q: foodQuery.trim(), limit: 50 })
        .then((res) => {
          if (cancelled) return;
          setFoodResults(res.items);
          setFoodTotal(res.total);
        })
        .catch((err) => {
          if (cancelled) return;
          setFoodResults([]);
          setFoodTotal(0);
          setFoodError(
            err instanceof ApiError ? err.message : "Không tải được danh sách món."
          );
        })
        .finally(() => {
          if (!cancelled) setFoodLoading(false);
        });
    }, foodQuery ? 250 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [addingToSlot, foodQuery]);

  const handlePickFood = (food: FoodCatalogItem) => {
    if (!addingToSlot) return;
    const saltG = Math.round(((food.macros?.sodium_mg ?? 0) / 1000) * 10) / 10;
    const newItem: MealDishItem = {
      name: food.name,
      calories: Math.round(food.kcal || 0),
      salt: saltG,
      sugar: 0,
      carbG: food.macros?.carb_g ?? 0,
      foodId: food.id,
      alternatives: [],
    };
    markDirty();
    if (addingToSlot === "breakfast") setBreakfast((list) => [...list, newItem]);
    if (addingToSlot === "lunch") setLunch((list) => [...list, newItem]);
    if (addingToSlot === "dinner") setDinner((list) => [...list, newItem]);
    if (addingToSlot === "snack") setSnack((list) => [...list, newItem]);
    closeAddDish();
    showToast(`Đã thêm «${food.name}».`);
  };

  const toggleSlotExpanded = (slot: MealSlot) => {
    setExpandedSlots((prev) => ({ ...prev, [slot]: !prev[slot] }));
  };

  const targetSaltG =
    nutritionTargets.sodiumDailyMg != null
      ? Math.round((nutritionTargets.sodiumDailyMg / 1000) * 10) / 10
      : 5;
  const targetSugarG = 25;
  const applyAlternative = (meal: MealSlot, index: number, alt: MealDishItem) => {
    markDirty();
    const replace = (list: MealDishItem[]) => {
      const current = list[index];
      if (!current) return list;
      const next = [...list];
      next[index] = {
        ...alt,
        alternatives: [
          { ...current, alternatives: [] },
          ...(current.alternatives || []).filter((a) => a.name !== alt.name),
        ],
      };
      return next;
    };
    if (meal === "breakfast") setBreakfast(replace);
    if (meal === "lunch") setLunch(replace);
    if (meal === "dinner") setDinner(replace);
    if (meal === "snack") setSnack(replace);
  };

  const slotSwaps = (slot: MealSlot) =>
    daySwaps.filter((s) => s.slot === slot);

  const renderMealSection = (slot: MealSlot, items: MealDishItem[]) => {
    const meta = SLOT_LABELS[slot];
    const isEditing = editingSlot === slot;
    const slotWarnings = warningsBySlot[slot];
    const slotAdvisory = advisoryBySlot[slot];
    const swaps = slotSwaps(slot);
    const expanded = expandedSlots[slot];
    const mealKcal = slotKcal[slot];
    const band = mealKcalBand(nutritionTargets.targetKcal, slot);
    const inBand = mealKcal >= band.lower && mealKcal <= band.upper;
    const mealShare =
      dayCalories > 0 ? Math.round((mealKcal / dayCalories) * 100) : 0;

    return (
      <div
        key={slot}
        className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-xs"
      >
        <div className="flex items-center justify-between gap-sm pb-sm border-b border-outline-variant/60">
          <div className="flex items-center gap-xs min-w-0 flex-1">
            <button
              type="button"
              onClick={() => toggleSlotExpanded(slot)}
              className="flex items-center gap-0.5 shrink-0 rounded-lg border border-outline-variant px-1 py-0.5 text-on-surface-variant hover:bg-surface-variant cursor-pointer"
              aria-label={expanded ? `Thu gọn ${meta.title}` : `Mở rộng ${meta.title}`}
              title={expanded ? "Thu gọn" : "Mở rộng để xem chi tiết kcal"}
            >
              <span className="material-symbols-outlined text-[18px]">
                {expanded ? "keyboard_arrow_up" : "keyboard_arrow_down"}
              </span>
            </button>
            <span className={`material-symbols-outlined text-[20px] ${meta.iconClass}`}>
              {meta.icon}
            </span>
            <div className="min-w-0">
              <h4 className="font-h2 text-h2 text-on-surface font-bold text-sm leading-tight">
                {meta.title}
              </h4>
              <p className="text-[11px] text-on-surface-variant mt-0.5">
                <strong
                  className={`font-bold text-sm tabular-nums ${
                    inBand ? "text-on-surface" : "text-amber-800"
                  }`}
                >
                  {mealKcal} kcal
                </strong>
                <span className="ml-1 tabular-nums">
                  · gợi ý {band.lower}–{band.upper} kcal
                </span>
                <span className="ml-1">· {items.length} món</span>
              </p>
            </div>
            {slotWarnings.length > 0 && (
              <span className="text-[10px] font-bold text-red-800 bg-red-100 border border-red-200 px-1.5 py-0.5 rounded shrink-0">
                {slotWarnings.length} vi phạm
              </span>
            )}
            {slotAdvisory.length > 0 && slotWarnings.length === 0 && (
              <span className="text-[10px] font-medium text-sky-800 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded shrink-0">
                {slotAdvisory.length} gợi ý
              </span>
            )}
          </div>
          {canEdit && (
            <div className="flex items-center gap-xs shrink-0">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={() => openAddDish(slot)}
                    className="text-xs text-primary font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Thêm món
                  </button>
                  {dirty && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      disabled={saving}
                      className="px-2 py-1 rounded-lg text-[11px] font-semibold border border-outline-variant text-on-surface-variant hover:bg-surface-variant cursor-pointer disabled:opacity-50"
                    >
                      Hủy
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={finishEditSlot}
                    disabled={saving}
                    className="px-2 py-1 rounded-lg text-[11px] font-bold border border-emerald-500 bg-emerald-50 text-emerald-800 cursor-pointer disabled:opacity-50"
                  >
                    {dirty ? (saving ? "Đang lưu…" : "Lưu") : "Xong"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => startEditSlot(slot)}
                  disabled={saving || (editingSlot !== null && editingSlot !== slot)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-outline-variant text-on-surface hover:bg-surface-variant cursor-pointer disabled:opacity-50 flex items-center gap-0.5"
                >
                  <span className="material-symbols-outlined text-[14px]">edit</span>
                  Chỉnh sửa món ăn
                </button>
              )}
            </div>
          )}
        </div>

        {expanded && (
          <div className="pt-sm space-y-sm">
            <div>
              <div className="flex items-center justify-between text-[10px] text-on-surface-variant mb-1 tabular-nums">
                <span>0</span>
                <span>
                  Mục tiêu bữa ~{band.target} · khoảng {band.lower}–{band.upper}
                </span>
                <span>{band.upper}+</span>
              </div>
              <div className="relative h-2 rounded-full bg-surface-container-low overflow-hidden">
                {/* Vùng gợi ý */}
                <div
                  className="absolute inset-y-0 bg-emerald-200/70"
                  style={{
                    left: `${(band.lower / Math.max(band.upper * 1.2, 1)) * 100}%`,
                    width: `${((band.upper - band.lower) / Math.max(band.upper * 1.2, 1)) * 100}%`,
                  }}
                />
                <div
                  className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${
                    inBand ? "bg-primary/80" : "bg-amber-500/80"
                  }`}
                  style={{
                    width: `${Math.min(100, (mealKcal / Math.max(band.upper * 1.2, 1)) * 100)}%`,
                  }}
                />
              </div>
              <p className="text-[10px] text-on-surface-variant mt-1">
                {inBand
                  ? "Kalo bữa đang trong khoảng gợi ý."
                  : mealKcal < band.lower
                    ? `Còn thiếu khoảng ${band.lower - mealKcal}–${band.upper - mealKcal} kcal để vào ngưỡng.`
                    : `Cần giảm khoảng ${mealKcal - band.upper}–${mealKcal - band.lower} kcal để vào ngưỡng.`}
                {dayCalories > 0 ? ` · ${mealShare}% tổng ngày.` : null}
              </p>
            </div>

            {slotWarnings.length > 0 && (
              <div className="p-3 bg-rose-50/80 border border-rose-200/70 rounded-lg space-y-1">
                <div className="flex items-center gap-1.5 text-rose-800">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  <strong className="text-[11px] font-bold">Vi phạm lâm sàng</strong>
                </div>
                {slotWarnings.map((w) => (
                  <p key={w} className="text-xs text-rose-900 leading-relaxed">
                    {w}
                  </p>
                ))}
              </div>
            )}

            {slotAdvisory.length > 0 && (
              <div className="p-3 bg-slate-100 border border-slate-200/80 rounded-lg space-y-1">
                <div className="flex items-center gap-1.5 text-slate-800">
                  <span className="material-symbols-outlined text-[16px]">info</span>
                  <strong className="text-[11px] font-bold">Gợi ý (không chặn duyệt)</strong>
                </div>
                {slotAdvisory.map((w) => (
                  <p key={w} className="text-xs text-slate-700 leading-relaxed">
                    {w}
                  </p>
                ))}
              </div>
            )}

            {swaps.length > 0 && (
              <div className="p-3 bg-slate-100 border border-slate-200/80 rounded-lg text-xs text-slate-800 space-y-1">
                <strong className="font-bold block text-[11px] text-slate-900">
                  Đổi món do tương tác thuốc–thực phẩm
                </strong>
                {swaps.map((s, idx) => (
                  <p key={idx} className="text-slate-700">
                    {(s.from || "—") + " → " + s.to}
                    {s.reason ? ` — ${s.reason}` : ""}
                  </p>
                ))}
              </div>
            )}

            <div className="space-y-xs">
              {items.length === 0 ? (
                <p className="text-xs text-on-surface-variant italic p-xs">Chưa có món ăn</p>
              ) : (
                items.map((item, idx) => (
                  <DishRow
                    key={`${slot}-${item.foodId || item.name}-${idx}`}
                    item={item}
                    isEditing={isEditing}
                    onRemove={() => handleRemoveDish(slot, idx)}
                    onSwap={(alt) => applyAlternative(slot, idx, alt)}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (!hydrated || !token || role !== "doctor") {
    return null;
  }

  if (loading) {
    return (
      <>
        <TopBar title="Chi tiết thực đơn" />
        <main className="p-lg text-sm text-on-surface-variant">Đang tải thực đơn…</main>
      </>
    );
  }

  if (loadError || !plan || !patient || !rawPlan) {
    return (
      <>
        <TopBar title="Chi tiết thực đơn" />
        <main className="p-lg">
          <p className="text-sm text-error mb-md">{loadError || "Không tìm thấy thực đơn."}</p>
          <Link
            href={`/doctor/patients/${patientId}`}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Quay lại hồ sơ bệnh nhân
          </Link>
        </main>
      </>
    );
  }

  return (
    <>
      <TopBar title={`Chi tiết thực đơn - ${plan.planTitle}`} />

      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-800 text-white px-md py-sm rounded-lg shadow-lg border border-emerald-600 flex items-center gap-xs font-body text-sm animate-slide-down">
          <span className="material-symbols-outlined text-[20px] text-emerald-300">
            check_circle
          </span>
          <span>{toastMessage}</span>
        </div>
      )}

      <main className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 pb-28">
        <div className="flex items-center justify-between">
          <Link
            href={`/doctor/patients/${patientId}/meals`}
            className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Quay lại danh sách thực đơn của {patient.name}
          </Link>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-6 shadow-subtle">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-outline-variant/40">
            <div className="flex items-center gap-4 min-w-0">
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt={patient.name}
                  className="w-12 h-12 rounded-full object-cover ring-2 ring-outline-variant/40 shrink-0"
                />
              ) : (
                <div
                  className="w-12 h-12 rounded-full ring-2 ring-primary/20 shrink-0 bg-primary/10 text-primary flex items-center justify-center text-sm font-bold"
                  aria-hidden
                >
                  {initials(patient.name)}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-h1 text-h1 text-on-surface font-bold text-lg truncate">
                    {patient.name}
                  </h2>
                  <span className="font-mono text-xs text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-md">
                    {patient.id}
                  </span>
                </div>
                <p className="font-caption text-caption text-on-surface-variant text-xs mt-0.5 font-medium">
                  Chẩn đoán: {plan.condition || "—"}
                  {plan.createdAt ? ` • Đợt tạo: ${plan.createdAt}` : ""}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {status === "pending" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200/70">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  Chờ duyệt
                </span>
              )}
              {status === "approved" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/70">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                  Đã duyệt
                </span>
              )}
              {status === "edited" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold bg-sky-50 text-sky-800 border border-sky-200/70">
                  <span className="material-symbols-outlined text-[14px]">edit_note</span>
                  Đã chỉnh sửa
                </span>
              )}
              {status === "rejected" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200/70">
                  <span className="material-symbols-outlined text-[14px]">cancel</span>
                  Đã từ chối
                </span>
              )}
              {hardWarningCount > 0 && isReviewable && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200/70">
                  {hardWarningCount} vi phạm lâm sàng
                </span>
              )}
            </div>
          </div>

          <div className="pt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-h2 text-h2 text-on-surface font-bold text-base">
                {plan.planTitle}
              </h3>
              <p className="font-caption text-caption text-on-surface-variant text-xs mt-0.5">
                Mã thực đơn: <span className="font-mono font-semibold text-primary">{plan.id}</span> • Tổng số ngày:{" "}
                <strong className="text-on-surface">{daysList.length} ngày</strong>
              </p>
            </div>
          </div>
        </div>

        {showApplyPrompt && (
          <div className="p-5 rounded-xl border border-primary/30 bg-primary/5 flex flex-col gap-4 shadow-2xs">
            <div>
              <p className="text-sm font-bold text-on-surface">
                Áp dụng thực đơn cho bệnh nhân?
              </p>
              <p className="text-xs text-on-surface-variant mt-1">
                Thực đơn đã duyệt — chọn thời điểm bắt đầu 7 ngày, hoặc bỏ qua để xếp lịch sau
                trên trang lịch sử.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row flex-wrap gap-2">
              <button
                type="button"
                disabled={applyingPlan}
                onClick={() => void handleApplyWithMode("from_today")}
                className="px-4 py-2.5 rounded-lg bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-all shadow-2xs disabled:opacity-50 cursor-pointer text-left"
              >
                {applyingPlan ? "Đang áp dụng..." : "Bắt đầu hôm nay"}
                <span className="block text-[10px] font-medium opacity-90 mt-0.5">
                  {todayRangeLabel}
                  {patientSchedule?.active_plan
                    ? " · thay thế thực đơn đang chạy"
                    : ""}
                </span>
              </button>
              {chainApplyInfo.hasChain && (
                <button
                  type="button"
                  disabled={applyingPlan}
                  onClick={() => void handleApplyWithMode("after_current")}
                  className="px-4 py-2.5 rounded-lg border border-primary/40 bg-white text-primary text-xs font-bold hover:bg-primary/5 transition-all disabled:opacity-50 cursor-pointer text-left"
                >
                  Xếp tiếp nối
                  <span className="block text-[10px] font-medium text-on-surface-variant mt-0.5">
                    {chainApplyInfo.nextStartLabel}
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={handleSkipApply}
                className="px-4 py-2.5 rounded-lg border border-outline-variant/60 text-xs font-semibold hover:bg-surface-container-low transition-colors cursor-pointer"
              >
                Bỏ qua
              </button>
            </div>
          </div>
        )}

        {daysList.length > 0 && (
          <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-3 shadow-2xs overflow-x-auto">
            <div className="flex items-center gap-2 min-w-max">
              <span className="text-xs font-bold text-on-surface-variant px-2 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-primary">
                  calendar_month
                </span>
                Chọn ngày xem:
              </span>
              {daysList.map((d) => {
                const isDayActive = d.dayIndex === activeDayIndex;
                const kcalLabel =
                  isDayActive ? dayCalories : d.totalCalories ?? 0;
                const dayWarnCount = isDayActive
                  ? dayHardWarnings.length
                  : countHardNutritionWarnings(
                      warningSlotsForDay(
                        d.breakfast || [],
                        d.lunch || [],
                        d.dinner || [],
                        d.snack || []
                      ),
                      nutritionTargets
                    );
                return (
                  <button
                    key={d.dayIndex}
                    type="button"
                    onClick={() => handleSelectDay(d.dayIndex)}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      isDayActive
                        ? "bg-primary text-on-primary shadow-2xs font-bold"
                        : "bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
                    }`}
                  >
                    <span>{d.dayName}</span>
                    <span className="text-[10px] opacity-80 tabular-nums">({kcalLabel} kcal)</span>
                    {!!dayWarnCount && (
                      <span
                        className={`text-[10px] font-bold ${
                          isDayActive ? "text-amber-100" : "text-amber-700"
                        }`}
                      >
                        !
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <DayNutritionDashboard
          dayLabel={currentDayData?.dayName || `Ngày ${activeDayIndex}`}
          calories={dayCalories}
          saltG={daySalt}
          sugarG={daySugar}
          targetCalories={nutritionTargets.targetKcal}
          targetSaltG={targetSaltG}
          targetSugarG={targetSugarG}
          mealBreakdown={slotKcal}
          dayWarnings={dayOnlyWarnings}
          dayAdvisoryWarnings={dayAdvisoryWarnings}
          kcalLower={dayBand.lower}
          kcalUpper={dayBand.upper}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/40">
              <h3 className="font-h2 text-h2 font-bold text-on-surface text-base">
                Chi tiết khẩu phần: {currentDayData?.dayName || `Ngày ${activeDayIndex}`}
              </h3>
              <span className="text-xs text-on-surface-variant font-medium">
                {breakfast.length + lunch.length + dinner.length + snack.length} món ăn
              </span>
            </div>

            {renderMealSection("breakfast", breakfast)}
            {renderMealSection("lunch", lunch)}
            {renderMealSection("dinner", dinner)}
            {renderMealSection("snack", snack)}
          </div>

          <div className="space-y-4">
            <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-5 shadow-subtle">
              <h4 className="font-h2 text-h2 text-on-surface font-bold text-sm mb-3 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[18px]">
                  menu_book
                </span>
                Trích dẫn Y khoa & Guideline
              </h4>
              {plan.citations.length === 0 ? (
                <p className="text-xs text-on-surface-variant italic">
                  Thực đơn này chưa có citation từ RAG.
                </p>
              ) : (
                <ul className="space-y-2 text-xs text-on-surface-variant">
                  {plan.citations.map((cite, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 bg-surface-container-low/40 p-2.5 rounded-lg border border-outline-variant/40 font-medium"
                    >
                      <span className="material-symbols-outlined text-[15px] text-primary shrink-0 mt-0.5">
                        verified
                      </span>
                      <span className="break-words leading-relaxed">{cite}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </main>

      {isReviewable && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-surface-container-lowest/95 backdrop-blur-md border-t border-outline-variant/40 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] py-3 px-6 md:px-8">
          <div className="max-w-7xl w-full mx-auto flex flex-col sm:flex-row sm:items-center justify-end gap-3">
            {editingSlot ? (
              <p className="text-xs text-on-surface-variant sm:mr-auto font-medium">
                Đang chỉnh sửa bữa — bấm «Xong» hoặc «Lưu» trên bữa đó rồi mới duyệt /
                từ chối.
              </p>
            ) : hardWarningCount > 0 ? (
              <p className="text-xs text-rose-800 sm:mr-auto font-semibold">
                Còn {hardWarningCount} vi phạm ràng buộc lâm sàng trên toàn bộ thực đơn —
                chỉnh món đến khi hết vi phạm rồi mới duyệt được.
              </p>
            ) : dirty ? (
              <p className="text-xs text-on-surface-variant sm:mr-auto font-medium">
                Có thay đổi chưa lưu — sẽ được lưu khi bạn duyệt.
              </p>
            ) : status === "edited" ? (
              <p className="text-xs text-on-surface-variant sm:mr-auto font-medium">
                Thực đơn đã chỉnh sửa — sẵn sàng duyệt nếu không còn vi phạm lâm sàng.
              </p>
            ) : null}
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setRejectModalOpen(true)}
                disabled={saving || !!editingSlot}
                className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95 flex items-center gap-1 shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[18px]">cancel</span>
                <span>Từ chối thực đơn này</span>
              </button>
              <button
                type="button"
                onClick={() => void handleApprove()}
                disabled={saving || !canApprove}
                className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-on-primary rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                <span>{saving ? "Đang xử lý…" : "Duyệt thực đơn này"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {addingToSlot && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-4 max-h-[85vh] flex flex-col animate-scaleUp overflow-hidden">
            <div className="flex items-start justify-between gap-3">
              <h4 className="font-h2 text-h2 font-bold text-on-surface text-base">
                Thêm món vào{" "}
                {addingToSlot === "breakfast"
                  ? "bữa sáng"
                  : addingToSlot === "lunch"
                    ? "bữa trưa"
                    : addingToSlot === "dinner"
                      ? "bữa tối"
                      : "bữa phụ"}
              </h4>
              <button
                type="button"
                onClick={closeAddDish}
                className="text-on-surface-variant hover:text-on-surface p-1.5 rounded-lg hover:bg-surface-container-low transition-colors cursor-pointer"
                aria-label="Đóng"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="relative">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant">
                search
              </span>
              <input
                type="search"
                value={foodQuery}
                onChange={(e) => setFoodQuery(e.target.value)}
                placeholder="Tìm món trong catalog (vd: ức gà, cơm lứt…)"
                autoFocus
                className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low border border-outline-variant/60 rounded-lg text-xs focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-2xs"
              />
            </div>

            <p className="text-[11px] text-on-surface-variant font-medium">
              {foodLoading
                ? "Đang tải danh sách món…"
                : foodError
                  ? foodError
                  : `Hiển thị ${foodResults.length}/${foodTotal} món từ database`}
            </p>

            <div className="flex-1 min-h-0 overflow-y-auto border border-outline-variant/60 rounded-lg divide-y divide-outline-variant/40 max-h-[50vh]">
              {!foodLoading && foodResults.length === 0 ? (
                <p className="text-xs text-on-surface-variant italic p-6 text-center">
                  Không tìm thấy món phù hợp.
                </p>
              ) : (
                foodResults.map((food) => {
                  const saltG =
                    Math.round(((food.macros?.sodium_mg ?? 0) / 1000) * 10) / 10;
                  return (
                    <button
                      key={food.id}
                      type="button"
                      onClick={() => handlePickFood(food)}
                      className="w-full text-left px-4 py-3 hover:bg-surface-container-low/60 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-on-surface break-words">
                            {food.name}
                          </p>
                          <p className="text-[11px] text-on-surface-variant mt-0.5">
                            {food.portion || "—"}
                            {food.category ? ` · ${food.category}` : ""}
                          </p>
                        </div>
                        <div className="text-right shrink-0 text-[11px] text-on-surface-variant font-medium tabular-nums">
                          <p className="font-bold text-on-surface">
                            {Math.round(food.kcal)} kcal
                          </p>
                          <p>Muối {saltG}g</p>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-outline-variant/40">
              <button
                type="button"
                onClick={closeAddDish}
                className="px-4 py-2 border border-outline-variant/60 rounded-lg text-xs font-semibold hover:bg-surface-container-low transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-4 animate-scaleUp overflow-hidden">
            <h4 className="font-h2 text-h2 font-bold text-on-surface text-base">
              Lý do từ chối thực đơn
            </h4>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Nhập lý do hoặc chỉ dẫn điều chỉnh…"
              className="w-full p-3.5 bg-surface-container-low border border-outline-variant/60 rounded-lg text-xs h-28 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none transition-all"
            />
            <div className="flex justify-end gap-3 pt-3 border-t border-outline-variant/40">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="px-4 py-2 border border-outline-variant/60 rounded-lg text-xs font-semibold hover:bg-surface-container-low transition-colors cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => void handleRejectConfirm()}
                disabled={!rejectReason.trim() || saving}
                className="px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
              >
                {saving ? "Đang gửi…" : "Xác nhận từ chối"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DishRow({
  item,
  isEditing,
  onRemove,
  onSwap,
}: {
  item: MealDishItem;
  isEditing: boolean;
  onRemove: () => void;
  onSwap: (alt: MealDishItem) => void;
}) {
  const alts = item.alternatives || [];
  return (
    <div className="p-3 bg-surface-container-low/40 border border-outline-variant/40 rounded-lg text-xs space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="font-bold text-on-surface font-body break-words min-w-0 text-xs">
          {item.name}
        </span>
        <div className="flex items-center gap-3 text-on-surface-variant shrink-0 font-medium">
          <span className="tabular-nums font-bold text-on-surface">{item.calories} kcal</span>
          <span className="tabular-nums">Muối: {item.salt}g</span>
          {isEditing && (
            <button
              type="button"
              onClick={onRemove}
              className="text-rose-500 hover:text-rose-700 ml-1 p-1 rounded-lg hover:bg-rose-50 transition-colors"
              aria-label={`Xóa ${item.name}`}
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
            </button>
          )}
        </div>
      </div>
      {alts.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-outline-variant/30">
          <span className="text-[10px] uppercase font-bold text-on-surface-variant">
            Thay thế:
          </span>
          {alts.map((alt) => (
            <button
              key={alt.foodId || alt.name}
              type="button"
              onClick={() => onSwap(alt)}
              disabled={!isEditing}
              className="px-2.5 py-0.5 rounded-md border border-outline-variant/60 text-[11px] font-medium text-on-surface-variant hover:border-primary hover:text-primary transition-all disabled:opacity-60 disabled:cursor-default shadow-2xs"
              title={`${alt.calories} kcal`}
            >
              {alt.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
