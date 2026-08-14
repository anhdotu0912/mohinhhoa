"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { TopBar } from "@/components/shared/TopBar";
import { doctorPatientToUi, type Patient } from "@/lib/mock-data";
import { api, assetUrl } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { mealPlanToUiItem } from "@/lib/meal-plan-mappers";
import { MealDishItem, MealPlanItem } from "@/lib/plans-store";
import { ApiError } from "@/lib/types";
import { asRouteId } from "@/lib/route-params";

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
  const [plan, setPlan] = useState<MealPlanItem | null>(null);
  const siblingVariants: MealPlanItem[] = [];

  // Active day index state (1-indexed)
  const [activeDayIndex, setActiveDayIndex] = useState<number>(1);

  const [status, setStatus] = useState(plan?.status || "pending");

  const daysList = plan?.days && plan.days.length > 0 ? plan.days : [];
  const currentDayData =
    daysList.find((d) => d.dayIndex === activeDayIndex) || daysList[0] || {
      dayIndex: 1,
      dayName: "Ngày 1",
      breakfast: plan?.breakfast || [],
      lunch: plan?.lunch || [],
      dinner: plan?.dinner || [],
      snack: [] as MealDishItem[],
      totalCalories: 0,
      totalSalt: 0,
      totalSugar: 0,
    };

  const [breakfast, setBreakfast] = useState<MealDishItem[]>(currentDayData.breakfast || []);
  const [lunch, setLunch] = useState<MealDishItem[]>(currentDayData.lunch || []);
  const [dinner, setDinner] = useState<MealDishItem[]>(currentDayData.dinner || []);
  const [snack, setSnack] = useState<MealDishItem[]>(currentDayData.snack || []);

  const [isEditingMenu, setIsEditingMenu] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // Edit item form state
  const [editingMealType, setEditingMealType] = useState<"breakfast" | "lunch" | "dinner" | "snack" | null>(null);
  const [newDishName, setNewDishName] = useState("");
  const [newDishCalories, setNewDishCalories] = useState("");
  const [newDishSalt, setNewDishSalt] = useState("");
  const [newDishSugar, setNewDishSugar] = useState("");

  const handleSelectDay = (dayIdx: number) => {
    setActiveDayIndex(dayIdx);
    const targetDay = daysList.find((d) => d.dayIndex === dayIdx) || daysList[0];
    if (targetDay) {
      setBreakfast(targetDay.breakfast || []);
      setLunch(targetDay.lunch || []);
      setDinner(targetDay.dinner || []);
      setSnack(targetDay.snack || []);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    setHydrated(true);
  }, []);

  const load = useCallback(async () => {
    if (!planId || !patientId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [planRow, patientRow] = await Promise.all([
        api.getMealPlan(planId),
        api.getDoctorPatient(patientId),
      ]);
      const uiPatient = {
        ...doctorPatientToUi(patientRow),
        avatar: assetUrl(patientRow.avatar) || doctorPatientToUi(patientRow).avatar,
      };
      const uiPlan = mealPlanToUiItem(planRow, {
        patientName: uiPatient.name,
        patientCode: uiPatient.id,
        condition: uiPatient.condition,
      });
      setPatient(uiPatient);
      setPlan(uiPlan);
      setStatus(uiPlan.status);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Không tải được thực đơn.");
    } finally {
      setLoading(false);
    }
  }, [planId, patientId]);

  useEffect(() => {
    if (!hydrated) return;
    if (!token || role !== "doctor") {
      router.replace("/login");
      return;
    }
    void load();
  }, [hydrated, token, role, router, load]);

  useEffect(() => {
    if (!plan) return;
    const day = plan.days.find((d) => d.dayIndex === activeDayIndex) || plan.days[0];
    if (!day) return;
    setBreakfast(day.breakfast || []);
    setLunch(day.lunch || []);
    setDinner(day.dinner || []);
    setSnack(day.snack || []);
  }, [plan, activeDayIndex]);

  const handleApprove = async () => {
    try {
      await api.reviewMealPlan(planId, { action: "approve" });
      setStatus("approved");
      showToast("Đã duyệt thực đơn.");
      setTimeout(() => {
        router.push("/doctor/reviews");
      }, 1200);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Không duyệt được thực đơn.");
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectReason.trim()) return;
    try {
      await api.reviewMealPlan(planId, { action: "reject", notes: rejectReason.trim() });
      setStatus("rejected");
      setRejectModalOpen(false);
      showToast("Đã từ chối thực đơn.");
      setTimeout(() => {
        router.push("/doctor/reviews");
      }, 1200);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Không từ chối được thực đơn.");
    }
  };

  const handleRemoveDish = (meal: "breakfast" | "lunch" | "dinner" | "snack", index: number) => {
    if (meal === "breakfast") setBreakfast(breakfast.filter((_, i) => i !== index));
    if (meal === "lunch") setLunch(lunch.filter((_, i) => i !== index));
    if (meal === "dinner") setDinner(dinner.filter((_, i) => i !== index));
    if (meal === "snack") setSnack(snack.filter((_, i) => i !== index));
  };

  const handleAddDish = () => {
    if (!editingMealType || !newDishName.trim()) return;
    const newItem = {
      name: newDishName.trim(),
      calories: Number(newDishCalories) || 100,
      salt: Number(newDishSalt) || 0,
      sugar: Number(newDishSugar) || 0,
    };
    if (editingMealType === "breakfast") setBreakfast([...breakfast, newItem]);
    if (editingMealType === "lunch") setLunch([...lunch, newItem]);
    if (editingMealType === "dinner") setDinner([...dinner, newItem]);
    if (editingMealType === "snack") setSnack([...snack, newItem]);

    setEditingMealType(null);
    setNewDishName("");
    setNewDishCalories("");
    setNewDishSalt("");
    setNewDishSugar("");
  };

  const dayCalories =
    breakfast.reduce((sum, item) => sum + item.calories, 0) +
    lunch.reduce((sum, item) => sum + item.calories, 0) +
    dinner.reduce((sum, item) => sum + item.calories, 0) +
    snack.reduce((sum, item) => sum + item.calories, 0);

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

  const applyAlternative = (
    meal: "breakfast" | "lunch" | "dinner" | "snack",
    index: number,
    alt: MealDishItem
  ) => {
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

  if (loadError || !plan || !patient) {
    return (
      <>
        <TopBar title="Chi tiết thực đơn" />
        <main className="p-lg">
          <p className="text-sm text-error mb-md">{loadError || "Không tìm thấy thực đơn."}</p>
          <Link href={`/doctor/patients/${patientId}`} className="text-xs font-semibold text-primary hover:underline">
            Quay lại hồ sơ bệnh nhân
          </Link>
        </main>
      </>
    );
  }

  return (
    <>
      <TopBar title={`Chi tiết thực đơn - ${plan.planTitle}`} />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-800 text-white px-md py-sm rounded-xl shadow-lg border border-emerald-600 flex items-center gap-xs font-body text-sm animate-slide-down">
          <span className="material-symbols-outlined text-[20px] text-emerald-300">
            check_circle
          </span>
          <span>{toastMessage}</span>
        </div>
      )}

      <main className="p-lg max-w-[1400px]">
        {/* Back Link */}
        <div className="mb-md flex items-center justify-between">
          <Link
            href={`/doctor/reviews/${patientId}`}
            className="inline-flex items-center gap-xs text-xs font-semibold text-primary hover:underline cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Quay lại Danh sách phương án thực đơn của {patient.name}
          </Link>
        </div>

        {/* Plan Header Summary Card */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-lg mb-md shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-md pb-md border-b border-outline-variant">
            <div className="flex items-center gap-md">
              <img
                src={patient.avatar}
                alt={patient.name}
                className="w-12 h-12 rounded-full object-cover border border-outline-variant shrink-0"
              />
              <div>
                <div className="flex items-center gap-xs flex-wrap">
                  <span className="bg-emerald-700 text-white text-[11px] px-2 py-0.5 rounded font-bold">
                    1 thực đơn • món thay thế
                  </span>
                  <h2 className="font-h1 text-h1 text-on-surface font-bold text-lg">
                    {patient.name}
                  </h2>
                  <span className="font-mono text-xs text-on-surface-variant">
                    ({patient.id})
                  </span>
                </div>
                <p className="font-caption text-caption text-on-surface-variant text-xs mt-0.5">
                  Chẩn đoán: {plan.condition} • Đợt tạo: {plan.createdAt}
                </p>
              </div>
            </div>

            {/* Status Pill & Edit Action */}
            <div className="flex items-center gap-sm">
              {status === "pending" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                  Chờ duyệt
                </span>
              )}
              {status === "approved" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <span className="material-symbols-outlined text-[14px]">
                    check_circle
                  </span>
                  Đã chọn duyệt
                </span>
              )}
              {status === "rejected" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-800 border border-red-200">
                  <span className="material-symbols-outlined text-[14px]">
                    cancel
                  </span>
                  Đã từ chối
                </span>
              )}
              {status === "unselected" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                  <span className="material-symbols-outlined text-[14px]">
                    remove_done
                  </span>
                  Không chọn
                </span>
              )}

              <button
                onClick={() => setIsEditingMenu(!isEditingMenu)}
                className={`px-md py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  isEditingMenu
                    ? "bg-emerald-50 border-emerald-500 text-emerald-800"
                    : "bg-surface-container-lowest border-outline-variant text-on-surface hover:bg-surface-variant"
                }`}
              >
                {isEditingMenu ? "Hoàn tất chỉnh sửa" : "Chỉnh sửa món ăn"}
              </button>
            </div>
          </div>

          {/* Title & Plan Overview Metrics */}
          <div className="pt-md flex flex-col md:flex-row md:items-center justify-between gap-md">
            <div>
              <h3 className="font-h2 text-h2 text-on-surface font-bold text-base mb-xs">
                {plan.planTitle}
              </h3>
              <p className="font-caption text-caption text-on-surface-variant text-xs">
                Mã thực đơn: <span className="font-mono">{plan.id}</span> • Tổng số ngày:{" "}
                <strong className="text-on-surface">{daysList.length || 7} ngày</strong>
              </p>
            </div>

            {/* Daily Nutrient Summary Box for active day */}
            <div className="flex items-center gap-md font-body text-xs bg-surface-container-low p-sm rounded-xl border border-outline-variant/60">
              <div>
                <span className="text-on-surface-variant block text-[10px] uppercase font-bold">
                  {currentDayData.dayName} - Calo
                </span>
                <strong className="text-on-surface font-bold text-sm">{dayCalories} kcal</strong>
              </div>
              <div className="w-[1px] h-6 bg-outline-variant" />
              <div>
                <span className="text-on-surface-variant block text-[10px] uppercase font-bold">
                  {currentDayData.dayName} - Muối
                </span>
                <strong className="text-on-surface font-bold text-sm">{daySalt.toFixed(1)} g</strong>
              </div>
              <div className="w-[1px] h-6 bg-outline-variant" />
              <div>
                <span className="text-on-surface-variant block text-[10px] uppercase font-bold">
                  {currentDayData.dayName} - Đường
                </span>
                <strong className="text-on-surface font-bold text-sm">{daySugar.toFixed(1)} g</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Sibling Variants Quick Selector Bar (placed directly ABOVE 'Chọn ngày xem') */}
        {siblingVariants.length > 0 && (
          <div className="bg-surface-container-low border border-outline-variant rounded-xl p-sm mb-md flex items-center justify-between gap-md flex-wrap">
            <div className="flex items-center gap-xs">
              <span className="material-symbols-outlined text-primary text-[18px]">
                compare
              </span>
              <span className="font-bold text-xs text-on-surface">
                So sánh các phương án khác cùng lần tạo:
              </span>
            </div>

            <div className="flex items-center gap-xs flex-wrap">
              {siblingVariants.map((v) => {
                const isCurrent = v.id === plan.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => router.push(`/doctor/reviews/${patientId}/${v.id}`)}
                    className={`px-md py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-xs border ${
                      isCurrent
                        ? "bg-emerald-700 text-white border-emerald-800 shadow-2xs font-bold"
                        : "bg-surface-container-lowest text-on-surface-variant hover:border-primary/50 border-outline-variant"
                    }`}
                  >
                    <span>Phương án {v.variantIndex || 1}/{v.totalVariants || 3}</span>
                    {v.status === "approved" && (
                      <span className="material-symbols-outlined text-[14px] text-emerald-300">check_circle</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* MULTI-DAY TABS NAVIGATION BAR */}
        {daysList.length > 0 && (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-sm mb-lg shadow-2xs overflow-x-auto">
            <div className="flex items-center gap-xs min-w-max">
              <span className="text-xs font-bold text-on-surface-variant px-sm flex items-center gap-xs">
                <span className="material-symbols-outlined text-[18px] text-primary">calendar_month</span>
                Chọn ngày xem:
              </span>

              {daysList.map((d) => {
                const isDayActive = d.dayIndex === activeDayIndex;
                return (
                  <button
                    key={d.dayIndex}
                    onClick={() => handleSelectDay(d.dayIndex)}
                    className={`px-md py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-xs ${
                      isDayActive
                        ? "bg-primary text-on-primary shadow-xs font-bold"
                        : "bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-variant"
                    }`}
                  >
                    <span>{d.dayName}</span>
                    <span className="text-[10px] opacity-80">({d.totalCalories || 1750} kcal)</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Warning Alerts */}
        {plan.warnings.length > 0 && (
          <div className="mb-lg p-md bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-sm">
            <span className="material-symbols-outlined text-[20px] text-amber-700 shrink-0 mt-0.5">
              warning
            </span>
            <div className="text-xs text-amber-900 leading-relaxed">
              <strong className="font-bold block mb-0.5">Cảnh báo từ AI Clinical Rules:</strong>
              {plan.warnings.map((w, idx) => (
                <p key={idx}>{w}</p>
              ))}
            </div>
          </div>
        )}

        {/* Main Content Layout: Meals (Left 2/3) + Citations & Actions (Right 1/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg mb-24">
          {/* Left Column: Meal Breakdown for selected day */}
          <div className="lg:col-span-2 space-y-md">
            {/* Day Title Header */}
            <div className="flex items-center justify-between pb-xs border-b border-outline-variant">
              <h3 className="font-h2 text-h2 font-bold text-on-surface text-base flex items-center gap-xs">
                <span>Chi tiết khẩu phần: {currentDayData.dayName}</span>
              </h3>
              <span className="text-xs text-on-surface-variant">
                Hiển thị {breakfast.length + lunch.length + dinner.length + snack.length} món ăn
              </span>
            </div>

            {/* 1. Bữa Sáng */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-md shadow-xs">
              <div className="flex items-center justify-between pb-sm border-b border-outline-variant/60 mb-sm">
                <div className="flex items-center gap-xs">
                  <span className="material-symbols-outlined text-amber-500 text-[20px]">
                    wb_sunny
                  </span>
                  <h4 className="font-h2 text-h2 text-on-surface font-bold text-sm">
                    Bữa sáng (07:00 - 08:00)
                  </h4>
                </div>
                {isEditingMenu && (
                  <button
                    onClick={() => setEditingMealType("breakfast")}
                    className="text-xs text-primary font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Thêm món
                  </button>
                )}
              </div>

              <div className="space-y-xs">
                {breakfast.length === 0 ? (
                  <p className="text-xs text-on-surface-variant italic p-xs">Chưa có món ăn</p>
                ) : (
                  breakfast.map((item, idx) => (
                    <DishRow
                      key={idx}
                      item={item}
                      isEditing={isEditingMenu}
                      onRemove={() => handleRemoveDish("breakfast", idx)}
                      onSwap={(alt) => applyAlternative("breakfast", idx, alt)}
                    />
                  ))
                )}
              </div>
            </div>

            {/* 2. Bữa Trưa */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-md shadow-xs">
              <div className="flex items-center justify-between pb-sm border-b border-outline-variant/60 mb-sm">
                <div className="flex items-center gap-xs">
                  <span className="material-symbols-outlined text-amber-600 text-[20px]">
                    sunny
                  </span>
                  <h4 className="font-h2 text-h2 text-on-surface font-bold text-sm">
                    Bữa trưa (11:30 - 12:30)
                  </h4>
                </div>
                {isEditingMenu && (
                  <button
                    onClick={() => setEditingMealType("lunch")}
                    className="text-xs text-primary font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Thêm món
                  </button>
                )}
              </div>

              <div className="space-y-xs">
                {lunch.length === 0 ? (
                  <p className="text-xs text-on-surface-variant italic p-xs">Chưa có món ăn</p>
                ) : (
                  lunch.map((item, idx) => (
                    <DishRow
                      key={idx}
                      item={item}
                      isEditing={isEditingMenu}
                      onRemove={() => handleRemoveDish("lunch", idx)}
                      onSwap={(alt) => applyAlternative("lunch", idx, alt)}
                    />
                  ))
                )}
              </div>
            </div>

            {/* 3. Bữa Tối */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-md shadow-xs">
              <div className="flex items-center justify-between pb-sm border-b border-outline-variant/60 mb-sm">
                <div className="flex items-center gap-xs">
                  <span className="material-symbols-outlined text-indigo-500 text-[20px]">
                    nights_stay
                  </span>
                  <h4 className="font-h2 text-h2 text-on-surface font-bold text-sm">
                    Bữa tối (18:00 - 19:00)
                  </h4>
                </div>
                {isEditingMenu && (
                  <button
                    onClick={() => setEditingMealType("dinner")}
                    className="text-xs text-primary font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Thêm món
                  </button>
                )}
              </div>

              <div className="space-y-xs">
                {dinner.length === 0 ? (
                  <p className="text-xs text-on-surface-variant italic p-xs">Chưa có món ăn</p>
                ) : (
                  dinner.map((item, idx) => (
                    <DishRow
                      key={idx}
                      item={item}
                      isEditing={isEditingMenu}
                      onRemove={() => handleRemoveDish("dinner", idx)}
                      onSwap={(alt) => applyAlternative("dinner", idx, alt)}
                    />
                  ))
                )}
              </div>
            </div>

            {/* 4. Bữa Phụ (nếu có) */}
            {snack.length > 0 && (
              <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-md shadow-xs">
                <div className="flex items-center justify-between pb-sm border-b border-outline-variant/60 mb-sm">
                  <div className="flex items-center gap-xs">
                    <span className="material-symbols-outlined text-teal-600 text-[20px]">
                      local_cafe
                    </span>
                    <h4 className="font-h2 text-h2 text-on-surface font-bold text-sm">
                      Bữa phụ (15:00 - 15:30)
                    </h4>
                  </div>
                  {isEditingMenu && (
                    <button
                      onClick={() => setEditingMealType("snack")}
                      className="text-xs text-primary font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">add</span>
                      Thêm món
                    </button>
                  )}
                </div>

                <div className="space-y-xs">
                  {                  snack.map((item, idx) => (
                    <DishRow
                      key={idx}
                      item={item}
                      isEditing={isEditingMenu}
                      onRemove={() => handleRemoveDish("snack", idx)}
                      onSwap={(alt) => applyAlternative("snack", idx, alt)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Clinical Citations & Guidelines */}
          <div className="space-y-md">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-md shadow-xs">
              <h4 className="font-h2 text-h2 text-on-surface font-bold text-sm mb-sm flex items-center gap-xs">
                <span className="material-symbols-outlined text-primary text-[18px]">
                  menu_book
                </span>
                Trích dẫn Y khoa & Guideline
              </h4>
              <ul className="space-y-xs text-xs text-on-surface-variant">
                {plan.citations.map((cite, idx) => (
                  <li key={idx} className="flex items-start gap-xs bg-surface-container-low/40 p-2 rounded-lg border border-outline-variant/40">
                    <span className="material-symbols-outlined text-[14px] text-primary shrink-0 mt-0.5">
                      verified
                    </span>
                    <span>{cite}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* Sticky Bottom Bar for Approval / Rejection Actions */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-surface-container-lowest/95 backdrop-blur-md border-t border-gray-200 shadow-[0_-2px_8px_rgba(0,0,0,0.05)] py-2.5 px-lg">
        <div className="max-w-[1400px] w-full mx-auto flex items-center justify-end gap-sm">
          <button
            onClick={() => setRejectModalOpen(true)}
            className="px-md py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95 flex items-center gap-xs shadow-2xs"
          >
            <span className="material-symbols-outlined text-[18px]">cancel</span>
            <span>Từ chối thực đơn này</span>
          </button>

          <button
            onClick={() => void handleApprove()}
            className="px-lg py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95 flex items-center gap-xs font-semibold"
          >
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <span>Duyệt thực đơn này</span>
          </button>
        </div>
      </div>

      {/* Add Dish Dialog Modal */}
      {editingMealType && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-md">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-lg max-w-md w-full shadow-2xl space-y-md">
            <h4 className="font-h2 text-h2 font-bold text-on-surface text-base">
              Thêm món ăn vào bữa {editingMealType === "breakfast" ? "sáng" : editingMealType === "lunch" ? "trưa" : editingMealType === "dinner" ? "tối" : "phụ"}
            </h4>
            <div className="space-y-sm text-xs">
              <div>
                <label className="block text-on-surface-variant font-medium mb-1">Tên món ăn</label>
                <input
                  type="text"
                  value={newDishName}
                  onChange={(e) => setNewDishName(e.target.value)}
                  placeholder="Ví dụ: Canh rau ngót nấu thịt băm"
                  className="w-full p-2 bg-surface-container-low border border-outline-variant rounded-lg"
                />
              </div>
              <div className="grid grid-cols-3 gap-xs">
                <div>
                  <label className="block text-on-surface-variant font-medium mb-1">Calo (kcal)</label>
                  <input
                    type="number"
                    value={newDishCalories}
                    onChange={(e) => setNewDishCalories(e.target.value)}
                    placeholder="120"
                    className="w-full p-2 bg-surface-container-low border border-outline-variant rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-on-surface-variant font-medium mb-1">Muối (g)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newDishSalt}
                    onChange={(e) => setNewDishSalt(e.target.value)}
                    placeholder="0.5"
                    className="w-full p-2 bg-surface-container-low border border-outline-variant rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-on-surface-variant font-medium mb-1">Đường (g)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newDishSugar}
                    onChange={(e) => setNewDishSugar(e.target.value)}
                    placeholder="0"
                    className="w-full p-2 bg-surface-container-low border border-outline-variant rounded-lg"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-sm pt-xs border-t border-outline-variant">
              <button
                onClick={() => setEditingMealType(null)}
                className="px-md py-2 border border-outline-variant rounded-lg text-xs font-semibold hover:bg-surface-container-low"
              >
                Hủy
              </button>
              <button
                onClick={handleAddDish}
                className="px-md py-2 bg-primary text-on-primary rounded-lg text-xs font-bold hover:bg-primary-container"
              >
                Thêm món
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-md">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-lg max-w-md w-full shadow-2xl space-y-md">
            <h4 className="font-h2 text-h2 font-bold text-on-surface text-base">
              Lý do từ chối thực đơn
            </h4>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Nhập lý do hoặc chỉ dẫn điều chỉnh cho AI..."
              className="w-full p-md bg-surface-container-low border border-outline-variant rounded-xl text-xs h-28 focus:outline-none focus:border-primary"
            />
            <div className="flex justify-end gap-sm pt-xs border-t border-outline-variant">
              <button
                onClick={() => setRejectModalOpen(false)}
                className="px-md py-2 border border-outline-variant rounded-lg text-xs font-semibold hover:bg-surface-container-low cursor-pointer"
              >
                Đóng
              </button>
              <button
                onClick={handleRejectConfirm}
                className="px-md py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 cursor-pointer"
              >
                Xác nhận từ chối
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
        <span className="font-medium text-on-surface font-body">{item.name}</span>
        <div className="flex items-center gap-md text-on-surface-variant shrink-0">
          <span>{item.calories} kcal</span>
          <span>Muối: {item.salt}g</span>
          {isEditing && (
            <button onClick={onRemove} className="text-red-500 hover:text-red-700 ml-xs p-1">
              <span className="material-symbols-outlined text-[16px]">delete</span>
            </button>
          )}
        </div>
      </div>
      {alts.length > 0 && (
        <div className="flex flex-wrap items-center gap-xs pl-1">
          <span className="text-[10px] uppercase font-bold text-on-surface-variant">Thay thế:</span>
          {alts.map((alt) => (
            <button
              key={alt.foodId || alt.name}
              type="button"
              onClick={() => onSwap(alt)}
              className="px-2 py-0.5 rounded-full border border-outline-variant text-[11px] text-on-surface-variant hover:border-primary hover:text-primary transition-colors"
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
