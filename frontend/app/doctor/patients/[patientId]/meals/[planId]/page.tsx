"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { DayNutritionDashboard, MealMetricRow } from "@/components/doctor/DayNutritionDashboard";
import { GuidelineReader } from "@/components/doctor/GuidelineReader";
import { doctorPatientToUi, type Patient } from "@/lib/mock-data";
import { doctorChartHref } from "@/lib/doctor-routes";
import { api, assetUrl } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import {
  applyDaySlotsToPlan,
  computeNutritionWarningBundle,
  countHardNutritionWarnings,
  dayKcalBand,
  dayPlanToUi,
  flattenStructuredWarnings,
  formatPortionLabel,
  formatQty,
  mealPlanToEditedPayload,
  mealPlanToUiItem,
  mergeNutritionTargets,
  slotCalories,
  slotCarbG,
  slotProteinG,
  slotFatG,
  slotSaltG,
  slotSugarG,
  type MealSlotKey,
  type NutritionWarningSlots,
} from "@/lib/meal-plan-mappers";
import { MealDishItem, MealPlanItem } from "@/lib/plans-store";
import { NutrientChips } from "@/components/shared/NutrientChips";
import { toNutrientValues } from "@/lib/nutrient-display";
import { ApiError, type ApplyMode, type FoodCatalogItem, type GuidelineSourceOut, type MealPlanOutput, type MealPlanScheduleOut } from "@/lib/types";
import { asRouteId } from "@/lib/route-params";
import { formatDateFull, formatDateIso, parseFlexibleDate } from "@/lib/plan-expiry";
import { buildHistoryHref } from "@/lib/plan-slot-intent";

type MealSlot = MealSlotKey;

const SLOT_LABELS: Record<MealSlot, { title: string; icon: string; iconClass: string }> = {
  breakfast: { title: "Bữa sáng", icon: "wb_sunny", iconClass: "text-amber-500" },
  lunch: { title: "Bữa trưa", icon: "sunny", iconClass: "text-amber-600" },
  dinner: { title: "Bữa tối", icon: "nights_stay", iconClass: "text-indigo-500" },
  snack: { title: "Bữa phụ", icon: "cookie", iconClass: "text-emerald-600" },
};

function clonePlan(plan: MealPlanOutput): MealPlanOutput {
  return structuredClone(plan);
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
  const [openCitation, setOpenCitation] = useState<string | null>(null);
  const [citationLoading, setCitationLoading] = useState(false);
  const [citationError, setCitationError] = useState<string | null>(null);
  const [citationData, setCitationData] = useState<GuidelineSourceOut | null>(null);

  const daysList = plan?.days && plan.days.length > 0 ? plan.days : [];
  const currentDayData =
    daysList.find((d) => d.dayIndex === activeDayIndex) || daysList[0] || null;

  const nutritionTargets = useMemo(
    () =>
      mergeNutritionTargets(rawPlan?.profile_snapshot, {
        targetKcal: patient?.targetKcal,
        saltDailyG: patient?.saltDailyG,
        sugarDailyG: patient?.sugarDailyG,
        carbPerMeal: patient?.carbPerMeal,
        sodiumDaily: patient?.sodiumDaily,
      }),
    [
      rawPlan?.profile_snapshot,
      patient?.targetKcal,
      patient?.saltDailyG,
      patient?.sugarDailyG,
      patient?.carbPerMeal,
      patient?.sodiumDaily,
    ]
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

  const slotCarb = useMemo(
    () => ({
      breakfast: slotCarbG(breakfast),
      lunch: slotCarbG(lunch),
      dinner: slotCarbG(dinner),
      snack: slotCarbG(snack),
    }),
    [breakfast, lunch, dinner, snack]
  );

  const slotProtein = useMemo(
    () => ({
      breakfast: slotProteinG(breakfast),
      lunch: slotProteinG(lunch),
      dinner: slotProteinG(dinner),
      snack: slotProteinG(snack),
    }),
    [breakfast, lunch, dinner, snack]
  );

  const slotFat = useMemo(
    () => ({
      breakfast: slotFatG(breakfast),
      lunch: slotFatG(lunch),
      dinner: slotFatG(dinner),
      snack: slotFatG(snack),
    }),
    [breakfast, lunch, dinner, snack]
  );

  const slotSugar = useMemo(
    () => ({
      breakfast: slotSugarG(breakfast),
      lunch: slotSugarG(lunch),
      dinner: slotSugarG(dinner),
      snack: slotSugarG(snack),
    }),
    [breakfast, lunch, dinner, snack]
  );

  const slotSalt = useMemo(
    () => ({
      breakfast: slotSaltG(breakfast),
      lunch: slotSaltG(lunch),
      dinner: slotSaltG(dinner),
      snack: slotSaltG(snack),
    }),
    [breakfast, lunch, dinner, snack]
  );

  const dayCalories =
    slotKcal.breakfast + slotKcal.lunch + slotKcal.dinner + slotKcal.snack;

  const dayCarb = useMemo(() => {
    const sum = slotCarb.breakfast + slotCarb.lunch + slotCarb.dinner + slotCarb.snack;
    return Math.round(sum * 10) / 10;
  }, [slotCarb]);

  const dayProtein = useMemo(() => {
    const sum = slotProtein.breakfast + slotProtein.lunch + slotProtein.dinner + slotProtein.snack;
    return Math.round(sum * 10) / 10;
  }, [slotProtein]);

  const dayFat = useMemo(() => {
    const sum = slotFat.breakfast + slotFat.lunch + slotFat.dinner + slotFat.snack;
    return Math.round(sum * 10) / 10;
  }, [slotFat]);

  const daySalt = useMemo(() => {
    const sodiumMg = [...breakfast, ...lunch, ...dinner, ...snack].reduce(
      (sum, item) => sum + (item.sodiumMg ?? item.salt * 1000),
      0
    );
    return Math.round((sodiumMg / 1000) * 10) / 10;
  }, [breakfast, lunch, dinner, snack]);

  const daySugar = useMemo(() => {
    const sum = [...breakfast, ...lunch, ...dinner, ...snack].reduce(
      (total, item) => total + (item.sugar || 0),
      0
    );
    return Math.round(sum * 10) / 10;
  }, [breakfast, lunch, dinner, snack]);

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

  const closeCitation = useCallback(() => {
    setOpenCitation(null);
    setCitationData(null);
    setCitationError(null);
    setCitationLoading(false);
  }, []);

  const handleOpenCitation = (sourceId: string) => {
    setOpenCitation(sourceId);
    setCitationData(null);
    setCitationError(null);
    setCitationLoading(true);
    void api
      .getGuidelineSource(sourceId)
      .then((data) => {
        setCitationData(data);
        setCitationError(null);
      })
      .catch((err) => {
        setCitationData(null);
        setCitationError(
          err instanceof ApiError ? err.message : "Không tải được nội dung trích dẫn."
        );
      })
      .finally(() => setCitationLoading(false));
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
    const saltG = (food.macros?.sodium_mg ?? 0) / 1000;
    const newItem: MealDishItem = {
      name: food.name,
      portion: food.portion || "",
      calories: food.kcal || 0,
      salt: saltG,
      sodiumMg: food.macros?.sodium_mg ?? 0,
      sugar: food.macros?.sugar_g ?? 0,
      fat: food.macros?.fat_g ?? 0,
      carbG: food.macros?.carb_g ?? 0,
      proteinG: food.macros?.protein_g ?? 0,
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

  const targetSaltG = nutritionTargets.saltDisplayG ?? null;
  const targetSugarG = nutritionTargets.sugarDisplayLimit ?? null;
  const applyAlternative = (meal: MealSlot, index: number, alt: MealDishItem) => {
    if (!canEdit) return;
    if (editingSlot && editingSlot !== meal) {
      showToast("Hãy lưu hoặc hủy chỉnh sửa bữa hiện tại trước.");
      return;
    }
    markDirty();
    setEditingSlot(meal);
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
    showToast(`Đã đổi sang «${alt.name}».`);
  };

  const slotSwaps = (slot: MealSlot) =>
    daySwaps.filter((s) => s.slot === slot);

  const renderMealSection = (slot: MealSlot, items: MealDishItem[]) => {
    const meta = SLOT_LABELS[slot];
    const isEditing = editingSlot === slot;
    const slotWarnings = warningsBySlot[slot];
    const slotAdvisory = advisoryBySlot[slot];
    const swaps = slotSwaps(slot);
    const mealKcal = slotKcal[slot];
    const mealSugar = slotSugar[slot];
    const mealSalt = slotSalt[slot];
    const mealCarb = slotCarb[slot];
    const carbLimit = nutritionTargets.carbDisplayLimit ?? null;

    return (
      <div
        key={slot}
        className="min-w-0 overflow-hidden rounded-xl border border-slate-200/80 bg-white"
      >
        <div className={`flex flex-wrap items-center justify-between gap-2 border-b px-3.5 py-2.5 ${slot === "breakfast" ? "border-amber-100 bg-amber-50/70" : slot === "lunch" ? "border-teal-100 bg-teal-50/70" : slot === "dinner" ? "border-sky-100 bg-sky-50/70" : "border-violet-100 bg-violet-50/70"}`}>
          <div className="flex min-w-0 items-center gap-2">
            <span className={`material-symbols-outlined text-[20px] ${meta.iconClass}`}>
              {meta.icon}
            </span>
            <h4 className="text-lg font-bold leading-tight text-slate-900">
              {meta.title}
            </h4>
            {slotWarnings.length > 0 && (
              <span className="text-sm font-bold text-rose-800 bg-rose-50 border border-rose-200 px-2 py-1 rounded shrink-0">
                {slotWarnings.length} vi phạm
              </span>
            )}
          </div>
          {canEdit && (
            <div className="flex flex-wrap items-center gap-2">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={() => openAddDish(slot)}
                    className="text-sm text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Thêm món
                  </button>
                  {dirty && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      disabled={saving}
                      className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-outline-variant text-on-surface-variant hover:bg-surface-variant cursor-pointer disabled:opacity-50"
                    >
                      Hủy
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={finishEditSlot}
                    disabled={saving}
                    className="px-3 py-1.5 rounded-lg text-sm font-bold border border-emerald-500 bg-emerald-50 text-emerald-800 cursor-pointer disabled:opacity-50"
                  >
                    {dirty ? (saving ? "Đang lưu…" : "Lưu") : "Xong"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => startEditSlot(slot)}
                  disabled={saving || (editingSlot !== null && editingSlot !== slot)}
                  className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-outline-variant text-on-surface hover:bg-surface-variant cursor-pointer disabled:opacity-50 flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">edit</span>
                  Sửa món
                </button>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2.5 px-3.5 py-3">
          <MealMetricRow
            kcal={mealKcal}
            saltG={mealSalt}
            sugarG={mealSugar}
            carbG={mealCarb}
            carbLimit={carbLimit}
          />

          {slotWarnings.length > 0 && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg space-y-1">
              {slotWarnings.map((w) => (
                <p key={w} className="text-sm text-rose-900 leading-relaxed">
                  {w}
                </p>
              ))}
            </div>
          )}

          {slotAdvisory.length > 0 && (
            <div className="p-2.5 bg-surface-container-low border border-outline-variant rounded-lg space-y-1">
              {slotAdvisory.map((w) => (
                <p key={w} className="text-sm text-on-surface-variant leading-relaxed">
                  {w}
                </p>
              ))}
            </div>
          )}

          {swaps.length > 0 && (
            <div className="p-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-xs space-y-1">
              <strong className="font-bold block text-[11px] text-on-surface">
                Đổi món do tương tác thuốc–thực phẩm
              </strong>
              {swaps.map((s, idx) => (
                <p key={idx} className="text-on-surface-variant">
                  {(s.from || "—") + " → " + s.to}
                  {s.reason ? ` — ${s.reason}` : ""}
                </p>
              ))}
            </div>
          )}

          <div className="space-y-3">
            {items.length === 0 ? (
              <p className="text-xs text-on-surface-variant italic p-xs">Chưa có món ăn</p>
            ) : (
              items.map((item, idx) => (
                <DishRow
                  key={`${slot}-${item.foodId || item.name}-${idx}`}
                  item={item}
                  isEditing={isEditing}
                  canSwap={canEdit && (editingSlot === null || editingSlot === slot)}
                  onRemove={() => handleRemoveDish(slot, idx)}
                  onSwap={(alt) => applyAlternative(slot, idx, alt)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  if (!hydrated || !token || role !== "doctor") {
    return null;
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-4 text-sm text-on-surface-variant sm:px-6">
        Đang tải thực đơn…
      </main>
    );
  }

  if (loadError || !plan || !patient || !rawPlan) {
    return (
      <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-4 sm:px-6">
        <p className="text-sm text-error mb-md">{loadError || "Không tìm thấy thực đơn."}</p>
        <Link
          href={doctorChartHref(patientId, "meals")}
          className="text-sm font-semibold text-primary hover:underline"
        >
          Quay lại danh sách thực đơn
        </Link>
      </main>
    );
  }

  return (
    <>
      {toastMessage && (
        <div className="fixed top-[calc(var(--doctor-nav-height,64px)+1rem)] right-6 z-50 bg-emerald-800 text-white px-md py-sm rounded-lg shadow-lg border border-emerald-600 flex items-center gap-xs font-body text-sm animate-slide-down">
          <span className="material-symbols-outlined text-[20px] text-emerald-300">
            check_circle
          </span>
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="mx-auto w-full max-w-[1240px] px-4 pt-3 sm:px-6">
        <div className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-100 bg-white px-3.5 py-2.5">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {status === "pending" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200/70">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Chờ duyệt
              </span>
            )}
            {status === "approved" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/70">
                <span className="material-symbols-outlined text-[13px]">check_circle</span>
                Đã duyệt
              </span>
            )}
            {status === "edited" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-sky-50 text-sky-800 border border-sky-200/70">
                <span className="material-symbols-outlined text-[13px]">edit_note</span>
                Đã chỉnh sửa
              </span>
            )}
            {status === "rejected" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200/70">
                <span className="material-symbols-outlined text-[13px]">cancel</span>
                Đã từ chối
              </span>
            )}
            {hardWarningCount > 0 && isReviewable && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200/70">
                {hardWarningCount} vi phạm lâm sàng
              </span>
            )}
            {plan.createdAt ? (
              <span className="text-xs text-slate-500">
                Tạo {plan.createdAt}
              </span>
            ) : null}
          </div>

          {/* Right: Review helper notice & action buttons */}
          {isReviewable && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2.5 shrink-0">
              {editingSlot ? (
                <span className="text-[11px] text-amber-800 bg-amber-50/90 px-2.5 py-1 rounded-md border border-amber-200/70 font-medium">
                  Đang sửa bữa — bấm «Xong»/«Lưu» trước khi duyệt
                </span>
              ) : hardWarningCount > 0 ? (
                <span className="text-[11px] text-rose-800 bg-rose-50/90 px-2.5 py-1 rounded-md border border-rose-200/70 font-semibold">
                  Còn {hardWarningCount} vi phạm cần xử lý trước khi duyệt
                </span>
              ) : dirty ? (
                <span className="text-[11px] text-on-surface-variant font-medium">
                  Có thay đổi chưa lưu (sẽ lưu khi duyệt)
                </span>
              ) : null}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRejectModalOpen(true)}
                  disabled={saving || !!editingSlot}
                  className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95 flex items-center gap-1 shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[16px]">cancel</span>
                  <span>Từ chối</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleApprove()}
                  disabled={saving || !canApprove}
                  className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-on-primary rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  <span>{saving ? "Đang xử lý…" : "Duyệt thực đơn"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1240px] flex-1 space-y-4 px-4 pb-8 pt-3 text-sm sm:px-6">
        {showApplyPrompt && (
          <div className="flex flex-col gap-3 rounded-xl border border-teal-200 bg-teal-50/60 p-3.5">
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
          <div className="flex flex-col items-center gap-2">
              <span className="flex w-fit items-center gap-1.5 text-xs font-semibold text-slate-600">
                <span className="material-symbols-outlined text-[18px] text-primary">
                  calendar_month
                </span>
                Chọn ngày xem
              </span>
            <div className="w-fit max-w-full overflow-x-auto rounded-xl border border-teal-100 bg-white p-1 custom-scrollbar">
            <div role="group" aria-label="Ngày trong thực đơn" className="flex w-max items-center gap-1">
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
                    aria-pressed={isDayActive}
                    aria-label={`${d.dayName}, ${Math.round(kcalLabel)} kcal${dayWarnCount ? `, ${dayWarnCount} cảnh báo` : ""}`}
                    onClick={() => handleSelectDay(d.dayIndex)}
                    className={`flex min-w-[94px] flex-none flex-col items-center gap-0.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                      isDayActive
                        ? "bg-primary text-on-primary shadow-2xs font-bold"
                        : "text-slate-600 hover:bg-teal-50 hover:text-teal-800"
                    }`}
                  >
                    <span>{d.dayName}{!!dayWarnCount ? " !" : ""}</span>
                    <span className="text-[11px] font-medium opacity-80 tabular-nums">{Math.round(kcalLabel)} kcal</span>
                  </button>
                );
              })}
            </div>
            </div>
          </div>
        )}

        <DayNutritionDashboard
          dayLabel={currentDayData?.dayName || `Ngày ${activeDayIndex}`}
          calories={dayCalories}
          carbG={dayCarb}
          saltG={daySalt}
          sugarG={daySugar}
          targetCalories={nutritionTargets.targetKcal}
          targetSaltG={targetSaltG}
          targetSugarG={targetSugarG}
          mealCarbG={slotCarb}
          carbPerMealLimit={nutritionTargets.carbDisplayLimit ?? null}
          dayWarnings={dayOnlyWarnings}
          dayAdvisoryWarnings={dayAdvisoryWarnings}
          kcalLower={dayBand.lower}
          kcalUpper={dayBand.upper}
        />

        <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
              <h3 className="text-base font-bold text-slate-900">
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

          <aside className="min-w-0 rounded-xl border border-teal-100 bg-white p-3.5" aria-label="Nguồn tham khảo thực đơn">
            <div>
              <h4 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-900">
                <span className="material-symbols-outlined text-primary text-[18px]">
                  menu_book
                </span>
                Nguồn tham khảo
              </h4>
              {plan.citations.length === 0 ? (
                <p className="text-xs text-on-surface-variant italic">
                  Thực đơn này chưa có citation từ RAG.
                </p>
              ) : (
                <ul className="space-y-2 text-xs text-on-surface-variant">
                  {plan.citations.map((cite, idx) => (
                    <li key={idx}>
                      <button
                        type="button"
                        onClick={() => handleOpenCitation(cite)}
                        className="flex w-full items-start gap-2 rounded-lg border border-slate-100 bg-slate-50/60 p-2.5 text-left font-medium hover:border-teal-200 hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                      >
                        <span className="material-symbols-outlined text-[15px] text-primary shrink-0 mt-0.5">
                          menu_book
                        </span>
                        <span className="min-w-0">
                          <span className="break-words text-xs leading-relaxed text-slate-700 [overflow-wrap:anywhere]">
                            {cite}
                          </span>
                          <span className="block text-[10px] text-primary font-semibold mt-0.5">
                            Xem nội dung
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      </main>

      {addingToSlot && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-5 sm:p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[85vh] flex flex-col animate-scaleUp overflow-hidden">
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
                  return (
                    <button
                      key={food.id}
                      type="button"
                      onClick={() => handlePickFood(food)}
                      className="w-full min-w-0 text-left px-3.5 py-2.5 hover:bg-surface-container-low/60 transition-colors cursor-pointer"
                    >
                      <div className="flex flex-col gap-2 min-w-0">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-on-surface leading-snug">
                            {food.name}
                          </p>
                          <p className="text-[11px] text-on-surface-variant mt-0.5">
                            {food.portion || "—"}
                            {food.category ? ` · ${food.category}` : ""}
                          </p>
                        </div>
                        <NutrientChips
                          values={toNutrientValues({
                            kcal: food.kcal,
                            carbG: food.macros?.carb_g,
                            sodiumMg: food.macros?.sodium_mg,
                            sugarG: food.macros?.sugar_g,
                          })}
                          omit={["protein", "fat"]}
                          layer="summary"
                          compact
                        />
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

      {openCitation && (
        <GuidelineReader
          sourceId={openCitation}
          loading={citationLoading}
          error={citationError}
          data={citationData}
          onClose={closeCitation}
        />
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
  canSwap,
  onRemove,
  onSwap,
}: {
  item: MealDishItem;
  isEditing: boolean;
  canSwap: boolean;
  onRemove: () => void;
  onSwap: (alt: MealDishItem) => void;
}) {
  const alts = item.alternatives || [];
  const portion = formatPortionLabel(item.portion);
  return (
    <div className="min-w-0 space-y-2.5 rounded-2xl border border-teal-100 bg-slate-50/60 p-3.5 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="break-words text-[17px] font-semibold leading-relaxed text-slate-900 sm:text-lg">
            {item.name}
          </span>
          {portion ? (
            <p className="mt-1 text-[15px] leading-relaxed tabular-nums text-slate-700">
              Khẩu phần {portion}
            </p>
          ) : null}
        </div>
        <div className="flex items-start gap-2 text-on-surface-variant shrink-0 font-medium">
          {isEditing && (
            <button
              type="button"
              onClick={onRemove}
              className="text-rose-500 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-50 transition-colors"
              aria-label={`Xóa ${item.name}`}
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
            </button>
          )}
        </div>
      </div>
      <NutrientChips
        values={toNutrientValues({
          kcal: item.calories,
          carbG: item.carbG,
          saltG: item.salt,
          sodiumMg: item.sodiumMg,
          sugarG: item.sugar,
        })}
        omit={["protein", "fat"]}
        layer="detail"
        className="gap-2 [&>span]:px-2.5 [&>span]:py-1.5 [&>span]:text-sm [&_.material-symbols-outlined]:text-base [&>span>span:last-child]:text-slate-600"
      />
      {alts.length > 0 && (
        <details className="group pt-1 text-sm">
          <summary className="w-fit cursor-pointer rounded py-1 text-[15px] font-semibold text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">Đổi món · {alts.length} lựa chọn</summary>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {alts.map((alt) => (
            <button
              key={alt.foodId || alt.name}
              type="button"
              onClick={() => onSwap(alt)}
              disabled={!canSwap}
              className="px-3 py-1.5 rounded-md border border-outline-variant/60 text-sm font-medium text-on-surface hover:border-primary hover:text-primary transition-all disabled:opacity-60 disabled:cursor-default cursor-pointer"
              title={`Đổi sang ${alt.name} · ${formatQty(alt.calories)} kcal`}
            >
              {alt.name}
            </button>
          ))}
          </div>
        </details>
      )}
    </div>
  );
}
