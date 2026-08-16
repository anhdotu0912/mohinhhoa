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
import { formatDateIso } from "@/lib/plan-expiry";
import { firstEmptyScheduleSlot } from "@/lib/plan-schedule-helpers";
import {
  clearSlotIntent,
  loadSlotIntent,
  saveSlotIntent,
  type MealPlanSlotIntent,
  type SlotIntentKey,
} from "@/lib/plan-slot-intent";
import { useQueueStore } from "@/lib/queue-store";

type MealSlot = MealSlotKey;

const SLOT_LABELS: Record<MealSlot, { title: string; icon: string; iconClass: string }> = {
  breakfast: { title: "Bữa sáng (07:00 - 08:00)", icon: "wb_sunny", iconClass: "text-amber-500" },
  lunch: { title: "Bữa trưa (11:30 - 12:30)", icon: "sunny", iconClass: "text-amber-600" },
  dinner: { title: "Bữa tối (18:00 - 19:00)", icon: "nights_stay", iconClass: "text-indigo-500" },
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

function existingSnackDishes(plan: MealPlanOutput, dayIndex: number): MealDishItem[] {
  const day = plan.days.find((d) => d.day_index === dayIndex);
  const snack = day?.meals.find((m) => m.slot === "snack");
  if (!snack) return [];
  return snack.items.map((item) => ({
    name: item.name,
    calories: Math.round(item.kcal),
    salt: Math.round(((item.macros?.sodium_mg ?? 0) / 1000) * 10) / 10,
    sugar: 0,
    carbG: item.macros?.carb_g ?? 0,
    foodId: item.food_id,
    alternatives: [],
  }));
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
  const [dirty, setDirty] = useState(false);

  /** Slot đang mở chế độ chỉnh sửa món (null = đang xem). */
  const [editingSlot, setEditingSlot] = useState<MealSlot | null>(null);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showApplyPrompt, setShowApplyPrompt] = useState(false);
  const [applyStartDate, setApplyStartDate] = useState(() =>
    formatDateIso(new Date())
  );
  const [applyingPlan, setApplyingPlan] = useState(false);
  const [slotIntent, setSlotIntent] = useState<MealPlanSlotIntent | null>(null);
  const [suggestedSlotKey, setSuggestedSlotKey] = useState<SlotIntentKey | null>(
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
  });

  const daysList = plan?.days && plan.days.length > 0 ? plan.days : [];
  const currentDayData =
    daysList.find((d) => d.dayIndex === activeDayIndex) || daysList[0] || null;

  const nutritionTargets = useMemo(
    () => targetsFromProfileSnapshot(rawPlan?.profile_snapshot),
    [rawPlan?.profile_snapshot]
  );

  const snackItems = useMemo(() => {
    if (!rawPlan) return currentDayData?.snack || [];
    return existingSnackDishes(rawPlan, activeDayIndex);
  }, [rawPlan, activeDayIndex, currentDayData?.snack]);

  const slotKcal = useMemo(
    () => ({
      breakfast: slotCalories(breakfast),
      lunch: slotCalories(lunch),
      dinner: slotCalories(dinner),
      snack: slotCalories(snackItems),
    }),
    [breakfast, lunch, dinner, snackItems]
  );

  const dayCalories =
    slotKcal.breakfast + slotKcal.lunch + slotKcal.dinner + slotKcal.snack;

  const daySalt =
    breakfast.reduce((sum, item) => sum + item.salt, 0) +
    lunch.reduce((sum, item) => sum + item.salt, 0) +
    dinner.reduce((sum, item) => sum + item.salt, 0) +
    snackItems.reduce((sum, item) => sum + item.salt, 0);

  const daySugar =
    breakfast.reduce((sum, item) => sum + item.sugar, 0) +
    lunch.reduce((sum, item) => sum + item.sugar, 0) +
    dinner.reduce((sum, item) => sum + item.sugar, 0);

  const activeWarningSlots = useMemo(
    () => warningSlotsForDay(breakfast, lunch, dinner, snackItems),
    [breakfast, lunch, dinner, snackItems]
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
  };
  const advisoryBySlot = {
    breakfast: warningBundle.advisory.breakfast,
    lunch: warningBundle.advisory.lunch,
    dinner: warningBundle.advisory.dinner,
  };
  const dayOnlyWarnings = warningBundle.hard.day;
  const dayAdvisoryWarnings = warningBundle.advisory.day;

  const dayBand = useMemo(
    () => dayKcalBand(nutritionTargets.targetKcal),
    [nutritionTargets.targetKcal]
  );

  const daySwaps = useMemo(() => {
    if (!rawPlan) return [];
    return (rawPlan.swaps || []).filter(
      (s) => s.day_index === activeDayIndex && s.slot !== "snack"
    );
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

  const avatarSrc = realAvatarUrl(patient?.avatar);

  const syncSlotsFromPlan = useCallback((uiPlan: MealPlanItem, dayIdx: number) => {
    const day = uiPlan.days.find((d) => d.dayIndex === dayIdx) || uiPlan.days[0];
    if (!day) {
      setBreakfast([]);
      setLunch([]);
      setDinner([]);
      return;
    }
    setBreakfast(day.breakfast || []);
    setLunch(day.lunch || []);
    setDinner(day.dinner || []);
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

    const fromStorage = loadSlotIntent(patientId);
    if (fromStorage) {
      setSlotIntent(fromStorage);
      setApplyStartDate(fromStorage.startsOn);
      return;
    }

    const job = useQueueStore
      .getState()
      .jobs.find(
        (j) =>
          j.patientId === patientId &&
          j.slotIntent &&
          j.planIds?.includes(planId ?? "") &&
          (j.status === "completed" || j.status === "processing")
      );
    if (job?.slotIntent) {
      setSlotIntent(job.slotIntent);
      setApplyStartDate(job.slotIntent.startsOn);
      saveSlotIntent(job.slotIntent);
      return;
    }

    void api.getPatientMealPlanSchedule(patientId).then((sched) => {
      const emptySlot = firstEmptyScheduleSlot(sched);
      if (emptySlot) {
        setApplyStartDate(emptySlot.starts_on);
        setSuggestedSlotKey(emptySlot.slot_key);
      }
    });
  }, [patientId, planId]);

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
          snack: existingSnackDishes(base, activeDayIndex),
        },
        { warnings: dayHardWarnings }
      );
    },
    [activeDayIndex, breakfast, lunch, dinner, dayHardWarnings]
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
      if (slotIntent) {
        setApplyingPlan(true);
        try {
          await api.applyMealPlan(planId, {
            start_date: slotIntent.startsOn,
            replace_active: slotIntent.replaceActive,
            slot_key: slotIntent.slotKey,
          });
          clearSlotIntent();
          showToast("Đã áp dụng thực đơn vào lịch tuần.");
          router.push(`/doctor/history/${patientId}`);
        } catch (applyErr) {
          showToast(
            applyErr instanceof ApiError
              ? applyErr.message
              : "Không áp dụng được thực đơn."
          );
          setShowApplyPrompt(true);
        } finally {
          setApplyingPlan(false);
        }
      } else {
        setShowApplyPrompt(true);
      }
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Không duyệt được thực đơn.");
    } finally {
      setSaving(false);
    }
  };

  const handleApplyAfterApprove = async () => {
    if (!applyStartDate) return;
    const slotKey = slotIntent?.slotKey ?? suggestedSlotKey ?? undefined;
    const replaceActive =
      slotIntent?.replaceActive ?? (slotKey === "current");
    setApplyingPlan(true);
    try {
      await api.applyMealPlan(planId, {
        start_date: applyStartDate,
        replace_active: replaceActive,
        slot_key: slotKey,
      });
      clearSlotIntent();
      showToast("Đã áp dụng thực đơn.");
      setShowApplyPrompt(false);
      router.push(`/doctor/history/${patientId}`);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "Không áp dụng được thực đơn."
      );
    } finally {
      setApplyingPlan(false);
    }
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
        router.push("/doctor/reviews");
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
        className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-md shadow-xs"
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
              <div className="p-sm bg-red-50 border border-red-200 rounded-xl space-y-xs">
                <div className="flex items-center gap-xs text-red-900">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  <strong className="text-[11px] font-bold">Vi phạm lâm sàng</strong>
                </div>
                {slotWarnings.map((w) => (
                  <p key={w} className="text-xs text-red-950 leading-relaxed">
                    {w}
                  </p>
                ))}
              </div>
            )}

            {slotAdvisory.length > 0 && (
              <div className="p-sm bg-sky-50 border border-sky-200 rounded-xl space-y-xs">
                <div className="flex items-center gap-xs text-sky-900">
                  <span className="material-symbols-outlined text-[16px]">info</span>
                  <strong className="text-[11px] font-bold">Gợi ý (không chặn duyệt)</strong>
                </div>
                {slotAdvisory.map((w) => (
                  <p key={w} className="text-xs text-sky-950 leading-relaxed">
                    {w}
                  </p>
                ))}
              </div>
            )}

            {swaps.length > 0 && (
              <div className="p-sm bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-950 space-y-1">
                <strong className="font-bold block text-[11px]">
                  Đổi món do tương tác thuốc–thực phẩm
                </strong>
                {swaps.map((s, idx) => (
                  <p key={idx}>
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
        <div className="fixed top-20 right-6 z-50 bg-emerald-800 text-white px-md py-sm rounded-xl shadow-lg border border-emerald-600 flex items-center gap-xs font-body text-sm animate-slide-down">
          <span className="material-symbols-outlined text-[20px] text-emerald-300">
            check_circle
          </span>
          <span>{toastMessage}</span>
        </div>
      )}

      <main className="p-lg max-w-[1400px] pb-28">
        <div className="mb-md flex items-center justify-between">
          <Link
            href={`/doctor/reviews/${patientId}`}
            className="inline-flex items-center gap-xs text-xs font-semibold text-primary hover:underline cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Quay lại danh sách thực đơn của {patient.name}
          </Link>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-lg mb-md shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-md pb-md border-b border-outline-variant">
            <div className="flex items-center gap-md min-w-0">
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt={patient.name}
                  className="w-12 h-12 rounded-full object-cover border border-outline-variant shrink-0"
                />
              ) : (
                <div
                  className="w-12 h-12 rounded-full border border-outline-variant shrink-0 bg-primary-container/30 text-primary flex items-center justify-center text-sm font-bold"
                  aria-hidden
                >
                  {initials(patient.name)}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-xs flex-wrap">
                  <h2 className="font-h1 text-h1 text-on-surface font-bold text-lg truncate">
                    {patient.name}
                  </h2>
                  <span className="font-mono text-xs text-on-surface-variant">({patient.id})</span>
                </div>
                <p className="font-caption text-caption text-on-surface-variant text-xs mt-0.5">
                  Chẩn đoán: {plan.condition || "—"}
                  {plan.createdAt ? ` • Đợt tạo: ${plan.createdAt}` : ""}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-sm flex-wrap">
              {status === "pending" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  Chờ duyệt
                </span>
              )}
              {status === "approved" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                  Đã duyệt
                </span>
              )}
              {status === "edited" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                  <span className="material-symbols-outlined text-[14px]">edit_note</span>
                  Đã chỉnh sửa
                </span>
              )}
              {status === "rejected" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-800 border border-red-200">
                  <span className="material-symbols-outlined text-[14px]">cancel</span>
                  Đã từ chối
                </span>
              )}
              {hardWarningCount > 0 && isReviewable && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-900 border border-red-300">
                  {hardWarningCount} vi phạm lâm sàng
                </span>
              )}
            </div>
          </div>

          <div className="pt-md flex flex-col md:flex-row md:items-center justify-between gap-md">
            <div>
              <h3 className="font-h2 text-h2 text-on-surface font-bold text-base mb-xs">
                {plan.planTitle}
              </h3>
              <p className="font-caption text-caption text-on-surface-variant text-xs">
                Mã thực đơn: <span className="font-mono">{plan.id}</span> • Tổng số ngày:{" "}
                <strong className="text-on-surface">{daysList.length} ngày</strong>
              </p>
            </div>
          </div>
        </div>

        {showApplyPrompt && (
          <div className="mb-lg p-md rounded-xl border border-primary/30 bg-primary/5 flex flex-col sm:flex-row sm:items-end gap-md">
            <div className="flex-1">
              <p className="text-sm font-semibold text-on-surface">
                {slotIntent
                  ? "Áp dụng thực đơn vào lịch tuần?"
                  : "Áp dụng thực đơn từ ngày nào?"}
              </p>
              <p className="text-xs text-on-surface-variant mt-0.5 mb-sm">
                {slotIntent
                  ? `Thực đơn đã duyệt — sẽ gán từ ${applyStartDate} (7 ngày) hoặc bỏ qua để xếp lịch sau trên trang lịch sử.`
                  : suggestedSlotKey
                    ? `Tuần này đang có thực đơn — đề xuất gán từ ${applyStartDate} (tuần trống tiếp theo). Có thể bỏ qua và gán sau trên trang lịch sử.`
                    : "Thực đơn đã duyệt — chọn ngày bắt đầu (7 ngày) hoặc bỏ qua để xếp lịch sau trên trang lịch sử."}
              </p>
              {!slotIntent && !suggestedSlotKey && (
                <input
                  type="date"
                  value={applyStartDate}
                  onChange={(e) => setApplyStartDate(e.target.value)}
                  className="rounded-lg border border-outline-variant px-sm py-xs text-sm bg-surface"
                />
              )}
            </div>
            <div className="flex gap-xs shrink-0">
              <button
                type="button"
                disabled={applyingPlan}
                onClick={() => void handleApplyAfterApprove()}
                className="px-md py-sm rounded-lg bg-primary text-on-primary text-xs font-semibold disabled:opacity-50 cursor-pointer"
              >
                {applyingPlan ? "Đang áp dụng..." : "Áp dụng luôn"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowApplyPrompt(false);
                  router.push(
                    slotIntent
                      ? `/doctor/history/${patientId}`
                      : "/doctor/reviews"
                  );
                }}
                className="px-md py-sm rounded-lg border border-outline-variant text-xs cursor-pointer"
              >
                Bỏ qua
              </button>
            </div>
          </div>
        )}

        {daysList.length > 0 && (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-sm mb-lg shadow-2xs overflow-x-auto">
            <div className="flex items-center gap-xs min-w-max">
              <span className="text-xs font-bold text-on-surface-variant px-sm flex items-center gap-xs">
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
                    className={`px-md py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-xs ${
                      isDayActive
                        ? "bg-primary text-on-primary shadow-xs font-bold"
                        : "bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-variant"
                    }`}
                  >
                    <span>{d.dayName}</span>
                    <span className="text-[10px] opacity-80">({kcalLabel} kcal)</span>
                    {!!dayWarnCount && (
                      <span
                        className={`text-[10px] ${
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
          <div className="lg:col-span-2 space-y-md">
            <div className="flex items-center justify-between pb-xs border-b border-outline-variant">
              <h3 className="font-h2 text-h2 font-bold text-on-surface text-base">
                Chi tiết khẩu phần: {currentDayData?.dayName || `Ngày ${activeDayIndex}`}
              </h3>
              <span className="text-xs text-on-surface-variant">
                {breakfast.length + lunch.length + dinner.length} món ăn
              </span>
            </div>

            {renderMealSection("breakfast", breakfast)}
            {renderMealSection("lunch", lunch)}
            {renderMealSection("dinner", dinner)}
          </div>

          <div className="space-y-md">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-md shadow-xs">
              <h4 className="font-h2 text-h2 text-on-surface font-bold text-sm mb-sm flex items-center gap-xs">
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
                <ul className="space-y-xs text-xs text-on-surface-variant">
                  {plan.citations.map((cite, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-xs bg-surface-container-low/40 p-2 rounded-lg border border-outline-variant/40"
                    >
                      <span className="material-symbols-outlined text-[14px] text-primary shrink-0 mt-0.5">
                        verified
                      </span>
                      <span className="break-words">{cite}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </main>

      {isReviewable && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-surface-container-lowest/95 backdrop-blur-md border-t border-gray-200 shadow-[0_-2px_8px_rgba(0,0,0,0.05)] py-2.5 px-lg">
          <div className="max-w-[1400px] w-full mx-auto flex flex-col sm:flex-row sm:items-center justify-end gap-sm">
            {editingSlot ? (
              <p className="text-xs text-on-surface-variant sm:mr-auto">
                Đang chỉnh sửa bữa — bấm «Xong» hoặc «Lưu» trên bữa đó rồi mới duyệt /
                từ chối.
              </p>
            ) : hardWarningCount > 0 ? (
              <p className="text-xs text-red-800 sm:mr-auto">
                Còn {hardWarningCount} vi phạm ràng buộc lâm sàng trên toàn bộ thực đơn —
                chỉnh món đến khi hết vi phạm rồi mới duyệt được.
              </p>
            ) : dirty ? (
              <p className="text-xs text-on-surface-variant sm:mr-auto">
                Có thay đổi chưa lưu — sẽ được lưu khi bạn duyệt.
              </p>
            ) : status === "edited" ? (
              <p className="text-xs text-on-surface-variant sm:mr-auto">
                Thực đơn đã chỉnh sửa — sẵn sàng duyệt nếu không còn vi phạm lâm sàng.
              </p>
            ) : null}
            <div className="flex items-center justify-end gap-sm">
              <button
                type="button"
                onClick={() => setRejectModalOpen(true)}
                disabled={saving || !!editingSlot}
                className="px-md py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95 flex items-center gap-xs shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[18px]">cancel</span>
                <span>Từ chối thực đơn này</span>
              </button>
              <button
                type="button"
                onClick={() => void handleApprove()}
                disabled={saving || !canApprove}
                className="px-lg py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95 flex items-center gap-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                <span>{saving ? "Đang xử lý…" : "Duyệt thực đơn này"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {addingToSlot && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-md">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-lg max-w-lg w-full shadow-2xl space-y-md max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between gap-sm">
              <h4 className="font-h2 text-h2 font-bold text-on-surface text-base">
                Thêm món vào{" "}
                {addingToSlot === "breakfast"
                  ? "bữa sáng"
                  : addingToSlot === "lunch"
                    ? "bữa trưa"
                    : "bữa tối"}
              </h4>
              <button
                type="button"
                onClick={closeAddDish}
                className="text-on-surface-variant hover:text-on-surface cursor-pointer"
                aria-label="Đóng"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant">
                search
              </span>
              <input
                type="search"
                value={foodQuery}
                onChange={(e) => setFoodQuery(e.target.value)}
                placeholder="Tìm món trong catalog (vd: ức gà, cơm lứt…)"
                autoFocus
                className="w-full pl-9 pr-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-xs focus:outline-none focus:border-primary"
              />
            </div>

            <p className="text-[11px] text-on-surface-variant">
              {foodLoading
                ? "Đang tải danh sách món…"
                : foodError
                  ? foodError
                  : `Hiển thị ${foodResults.length}/${foodTotal} món từ database`}
            </p>

            <div className="flex-1 min-h-0 overflow-y-auto border border-outline-variant rounded-xl divide-y divide-outline-variant/60 max-h-[50vh]">
              {!foodLoading && foodResults.length === 0 ? (
                <p className="text-xs text-on-surface-variant italic p-md">
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
                      className="w-full text-left px-md py-sm hover:bg-surface-container-low transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-sm">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-on-surface break-words">
                            {food.name}
                          </p>
                          <p className="text-[11px] text-on-surface-variant mt-0.5">
                            {food.portion || "—"}
                            {food.category ? ` · ${food.category}` : ""}
                          </p>
                        </div>
                        <div className="text-right shrink-0 text-[11px] text-on-surface-variant">
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

            <div className="flex justify-end pt-xs border-t border-outline-variant">
              <button
                type="button"
                onClick={closeAddDish}
                className="px-md py-2 border border-outline-variant rounded-lg text-xs font-semibold hover:bg-surface-container-low cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-md">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-lg max-w-md w-full shadow-2xl space-y-md">
            <h4 className="font-h2 text-h2 font-bold text-on-surface text-base">
              Lý do từ chối thực đơn
            </h4>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Nhập lý do hoặc chỉ dẫn điều chỉnh…"
              className="w-full p-md bg-surface-container-low border border-outline-variant rounded-xl text-xs h-28 focus:outline-none focus:border-primary"
            />
            <div className="flex justify-end gap-sm pt-xs border-t border-outline-variant">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="px-md py-2 border border-outline-variant rounded-lg text-xs font-semibold hover:bg-surface-container-low cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => void handleRejectConfirm()}
                disabled={!rejectReason.trim() || saving}
                className="px-md py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 cursor-pointer disabled:opacity-50"
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
    <div className="p-sm bg-surface-container-low/50 rounded-xl text-xs space-y-xs">
      <div className="flex items-center justify-between gap-sm">
        <span className="font-medium text-on-surface font-body break-words min-w-0">
          {item.name}
        </span>
        <div className="flex items-center gap-md text-on-surface-variant shrink-0">
          <span className="tabular-nums font-semibold text-on-surface">{item.calories} kcal</span>
          <span>Muối: {item.salt}g</span>
          {isEditing && (
            <button
              type="button"
              onClick={onRemove}
              className="text-red-500 hover:text-red-700 ml-xs p-1"
              aria-label={`Xóa ${item.name}`}
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
            </button>
          )}
        </div>
      </div>
      {alts.length > 0 && (
        <div className="flex flex-wrap items-center gap-xs pl-1">
          <span className="text-[10px] uppercase font-bold text-on-surface-variant">
            Thay thế:
          </span>
          {alts.map((alt) => (
            <button
              key={alt.foodId || alt.name}
              type="button"
              onClick={() => onSwap(alt)}
              disabled={!isEditing}
              className="px-2 py-0.5 rounded-full border border-outline-variant text-[11px] text-on-surface-variant hover:border-primary hover:text-primary transition-colors disabled:opacity-60 disabled:cursor-default"
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
