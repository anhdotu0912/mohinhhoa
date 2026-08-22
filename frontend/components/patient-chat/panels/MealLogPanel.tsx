"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePatientPanel } from "../PatientPanelProvider";
import { api } from "@/lib/api";
import { ApiError, type MealPlanOutput, type FoodLogEntry } from "@/lib/types";

const DEFAULT_MEAL_IMAGES: Record<string, string> = {
  morning:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCy63oLuOJDAmaKRpjFVopv89rdYQENESNjmE7aq_Ocq5jrHK-FH4GgCQR9vK5YZKE3RLentfO1lbIteBFsDnqnrIzn4LYFvI8taELitugsX2t_WedQhDlwtNFs5y9hU2pIiXrC7lePguTix4QtDrL0g3dW0dBVdyMRmIFNu-q5hrSD3rHRDJuBreht0dKaUxvrTNLQ65jCCGDQv-UyRxlfu-xHsVEgiGRWTVTxHlL_H-pkvO10wV_OkQ",
  breakfast:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCy63oLuOJDAmaKRpjFVopv89rdYQENESNjmE7aq_Ocq5jrHK-FH4GgCQR9vK5YZKE3RLentfO1lbIteBFsDnqnrIzn4LYFvI8taELitugsX2t_WedQhDlwtNFs5y9hU2pIiXrC7lePguTix4QtDrL0g3dW0dBVdyMRmIFNu-q5hrSD3rHRDJuBreht0dKaUxvrTNLQ65jCCGDQv-UyRxlfu-xHsVEgiGRWTVTxHlL_H-pkvO10wV_OkQ",
  noon:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuADxt27IKTLgeBaUZZGmclNHqa1yxJ5BdE0hwQFPCghtzkBs-pLnXxtW9rJx9oEEHdsi2YcdIOOe-sJ_ieXqF3meSXctDnCBu_bdGF6O00ujRzs-_rwLYj9GMPyExtZbk6BybfRiv4tdGIw277x0dhVDL-038JXsqgcXBovCGlm_GNZ49AuvnZ74ZowOiWHC9-1EtExtZZAYUgEh-yrRUXoED48SXWnpqysR-Isco73Nyy02z2BTLtdmw",
  lunch:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuADxt27IKTLgeBaUZZGmclNHqa1yxJ5BdE0hwQFPCghtzkBs-pLnXxtW9rJx9oEEHdsi2YcdIOOe-sJ_ieXqF3meSXctDnCBu_bdGF6O00ujRzs-_rwLYj9GMPyExtZbk6BybfRiv4tdGIw277x0dhVDL-038JXsqgcXBovCGlm_GNZ49AuvnZ74ZowOiWHC9-1EtExtZZAYUgEh-yrRUXoED48SXWnpqysR-Isco73Nyy02z2BTLtdmw",
  evening:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuD2oStqvUJaJYckUh0nABnEJ8Ct080LnSnLWI4sl5w6O9GOHregWxmfd5Kv18OPXYPh3r6OLpxuRI9X7zxLm8gxXIqGIBGjVCQJN7KsNoDmYo_EVCUf90JZkUVFlrbTBFU1m_dX_RW3fMInFSM5ldv15Fv4EYzGjOnB2xGQOg6r2NILwjFncmEUHwMc9Gn66Z6roL-wOe1RtpO9zdnVpk5wYh_AXeLPxp7HmrOXOGRVtdwEKAbLW8hq6g",
  dinner:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuD2oStqvUJaJYckUh0nABnEJ8Ct080LnSnLWI4sl5w6O9GOHregWxmfd5Kv18OPXYPh3r6OLpxuRI9X7zxLm8gxXIqGIBGjVCQJN7KsNoDmYo_EVCUf90JZkUVFlrbTBFU1m_dX_RW3fMInFSM5ldv15Fv4EYzGjOnB2xGQOg6r2NILwjFncmEUHwMc9Gn66Z6roL-wOe1RtpO9zdnVpk5wYh_AXeLPxp7HmrOXOGRVtdwEKAbLW8hq6g",
};

const SLOT_NAMES: Record<string, string> = {
  morning: "Bữa sáng",
  breakfast: "Bữa sáng",
  noon: "Bữa trưa",
  lunch: "Bữa trưa",
  evening: "Bữa tối",
  dinner: "Bữa tối",
};

const DAY_LABELS = [
  "Thứ 2",
  "Thứ 3",
  "Thứ 4",
  "Thứ 5",
  "Thứ 6",
  "Thứ 7",
  "Chủ nhật",
];

function normalizeSlot(slot: string): "morning" | "noon" | "evening" {
  if (slot === "breakfast" || slot === "morning") return "morning";
  if (slot === "lunch" || slot === "noon") return "noon";
  if (slot === "dinner" || slot === "evening") return "evening";
  return "noon";
}

export function MealLogPanel() {
  const { closePanel } = usePatientPanel();

  const [mealPlan, setMealPlan] = useState<MealPlanOutput | null>(null);
  const [foodLogs, setFoodLogs] = useState<FoodLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Custom log inline inputs
  const [customSlot, setCustomSlot] = useState<string | null>(null);
  const [customNote, setCustomNote] = useState("");
  const [savingSlot, setSavingSlot] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [plan, logs] = await Promise.all([
        api.getMyMealPlan().catch(() => null),
        api.listFoodLogs().catch(() => []),
      ]);
      setMealPlan(plan);
      setFoodLogs(logs);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không tải được thực đơn.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Determine today's day plan
  const now = new Date();
  const todayDayOfWeek = (now.getDay() + 6) % 7; // 0 = Mon, 6 = Sun
  const todayDateStr = now.toISOString().slice(0, 10);

  const todayDayPlan =
    mealPlan?.days?.find((d) => d.day_index === todayDayOfWeek) ||
    mealPlan?.days?.[0] ||
    null;

  // Determine logged status for each slot today
  const isSlotLogged = useCallback(
    (slotKey: string) => {
      const target = normalizeSlot(slotKey);
      return foodLogs.some((log) => {
        const logDate = new Date(log.logged_at).toISOString().slice(0, 10);
        return logDate === todayDateStr && log.slot === target;
      });
    },
    [foodLogs, todayDateStr]
  );

  const handleLogPlanned = async (slotKey: string) => {
    if (!mealPlan || !todayDayPlan) return;
    setSavingSlot(slotKey);
    try {
      const slot = normalizeSlot(slotKey);
      await api.createFoodLog({
        meal_plan_id: mealPlan.id,
        day_index: todayDayPlan.day_index,
        slot,
        type: "as_planned",
      });
      await loadData();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Không thể ghi nhận bữa ăn.");
    } finally {
      setSavingSlot(null);
    }
  };

  const handleLogCustom = async (slotKey: string) => {
    if (!mealPlan || !todayDayPlan || !customNote.trim()) return;
    setSavingSlot(slotKey);
    try {
      const slot = normalizeSlot(slotKey);
      await api.createFoodLog({
        meal_plan_id: mealPlan.id,
        day_index: todayDayPlan.day_index,
        slot,
        type: "custom",
        note: customNote.trim(),
      });
      setCustomSlot(null);
      setCustomNote("");
      await loadData();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Không thể ghi nhận bữa ăn.");
    } finally {
      setSavingSlot(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Đóng bảng thực đơn"
        onClick={closePanel}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") closePanel();
        }}
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity cursor-pointer"
      />

      {/* Centered Modal Card Dialog */}
      <div className="relative w-[92%] max-w-2xl max-h-[85vh] bg-white rounded-2xl shadow-2xl z-10 flex flex-col border border-slate-200/90 animate-in fade-in zoom-in-95 duration-200 overflow-hidden my-auto">
        {/* Fixed Header */}
        <div className="px-6 md:px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-white/95 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#006857] flex items-center justify-center border border-emerald-200 shadow-2xs">
              <span className="material-symbols-outlined text-[22px]">
                fact_check
              </span>
            </div>
            <div>
              <h2 className="font-bold text-lg text-slate-900">Ghi nhận tuân thủ</h2>
              <p className="text-xs text-slate-500 font-medium">Kế hoạch dinh dưỡng &amp; thực đơn hôm nay</p>
            </div>
          </div>
          <button
            type="button"
            onClick={closePanel}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            title="Đóng (ESC)"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 md:p-8 flex-1 overflow-y-auto custom-scrollbar space-y-6">
          {/* Mini 7-day Compliance Chart */}
          <div className="bg-slate-50/90 border border-slate-200/80 rounded-xl p-3.5 flex flex-col gap-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Mức độ tuân thủ tuần này
              </span>
              <span className="text-xs font-extrabold text-[#006857] bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 shadow-2xs">
                92% Đạt chuẩn
              </span>
            </div>

            <div className="h-20 w-full bg-white rounded-lg flex items-end justify-between px-3 py-2 gap-1.5 border border-slate-200/60 shadow-2xs">
              <div className="flex-1 bg-emerald-600/30 rounded-t-xs h-[60%]" title="T2: 60%" />
              <div className="flex-1 bg-emerald-600/30 rounded-t-xs h-[75%]" title="T3: 75%" />
              <div className="flex-1 bg-emerald-600/30 rounded-t-xs h-[50%]" title="T4: 50%" />
              <div className="flex-1 bg-emerald-600/30 rounded-t-xs h-[85%]" title="T5: 85%" />
              <div className="flex-1 bg-emerald-600/30 rounded-t-xs h-[70%]" title="T6: 70%" />
              <div className="flex-1 bg-[#006857] rounded-t-xs h-[95%]" title="T7: 95%" />
              <div className="flex-1 bg-emerald-300/40 rounded-t-xs h-[40%]" title="CN: 40%" />
            </div>

            <div className="flex justify-between text-[11px] text-slate-500 font-bold px-1">
              <span>T2</span>
              <span>T3</span>
              <span>T4</span>
              <span>T5</span>
              <span>T6</span>
              <span>T7</span>
              <span className="text-[#006857]">CN</span>
            </div>
          </div>

          {/* Meals Today Section */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Thực đơn hôm nay ({DAY_LABELS[todayDayOfWeek]})
              </h3>
              {mealPlan && (
                <Link
                  href={`/patient/meals?plan_id=${mealPlan.id}`}
                  className="text-xs font-bold text-[#006857] hover:underline flex items-center gap-0.5"
                >
                  Xem tuần
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </Link>
              )}
            </div>

            {loading && (
              <div className="py-8 text-center text-xs text-slate-500">
                <span className="material-symbols-outlined animate-spin text-[24px] text-[#006857] mb-2">
                  progress_activity
                </span>
                <p>Đang tải thực đơn hôm nay...</p>
              </div>
            )}

            {error && !loading && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                {error}
              </div>
            )}

            {!loading && !error && (!todayDayPlan || !todayDayPlan.meals?.length) && (
              <div className="p-6 bg-slate-50 rounded-xl text-center text-xs text-slate-500 border border-slate-200">
                Chưa có thực đơn được kích hoạt cho hôm nay.
              </div>
            )}

            {!loading &&
              todayDayPlan?.meals?.map((meal) => {
                const slotKey = meal.slot;
                const slotTitle = SLOT_NAMES[slotKey] || slotKey;
                const firstItem = meal.items?.[0];
                const dishName = firstItem?.name || "Món ăn dinh dưỡng";
                const totalKcal = meal.items?.reduce((acc, it) => acc + (it.kcal || 0), 0) || 0;
                const imageSrc = DEFAULT_MEAL_IMAGES[slotKey] || DEFAULT_MEAL_IMAGES.noon;
                const isLogged = isSlotLogged(slotKey);
                const isSaving = savingSlot === slotKey;
                const isCustomOpen = customSlot === slotKey;

                return (
                  <div
                    key={slotKey}
                    className="p-3.5 border border-slate-200/90 rounded-xl bg-white shadow-2xs hover:shadow-xs transition-shadow flex flex-col gap-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-200/60 shadow-2xs">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={imageSrc}
                            alt={dishName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            {slotTitle}
                          </span>
                          <span
                            className="text-sm font-bold text-slate-900 truncate"
                            title={dishName}
                          >
                            {dishName}
                          </span>
                          {totalKcal > 0 && (
                            <span className="text-[11px] text-slate-500 font-semibold mt-0.5">
                              {totalKcal} kcal
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status / Action Buttons */}
                      <div>
                        {isLogged ? (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 rounded-full text-xs font-bold shrink-0 border border-emerald-200 shadow-2xs">
                            <span className="material-symbols-outlined text-[16px] text-[#006857]">check_circle</span>
                            <span>Đã ghi nhận</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => void handleLogPlanned(slotKey)}
                              className="px-3.5 py-1.5 bg-[#006857] hover:bg-[#005245] text-white rounded-lg text-xs font-bold transition-all shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
                            >
                              {isSaving ? "Lưu..." : "Ăn đúng"}
                            </button>
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => {
                                setCustomSlot(isCustomOpen ? null : slotKey);
                                setCustomNote("");
                              }}
                              className="px-3.5 py-1.5 border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors active:scale-95 disabled:opacity-50 cursor-pointer"
                            >
                              Ăn khác
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Inline Custom Meal Note Input */}
                    {isCustomOpen && !isLogged && (
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex flex-col gap-2 animate-in fade-in duration-200">
                        <label className="text-xs font-bold text-slate-700">
                          Bạn đã ăn món gì cho {slotTitle.toLowerCase()}?
                        </label>
                        <input
                          type="text"
                          value={customNote}
                          onChange={(e) => setCustomNote(e.target.value)}
                          placeholder="Ví dụ: Phở bò tái, 1 ly nước cam..."
                          className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                          autoFocus
                        />
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setCustomSlot(null)}
                            className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 font-semibold cursor-pointer"
                          >
                            Hủy
                          </button>
                          <button
                            type="button"
                            disabled={!customNote.trim() || isSaving}
                            onClick={() => void handleLogCustom(slotKey)}
                            className="px-3.5 py-1.5 bg-[#006857] hover:bg-[#005245] text-white rounded-lg text-xs font-bold disabled:opacity-50 transition-colors cursor-pointer shadow-xs"
                          >
                            {isSaving ? "Đang lưu..." : "Xác nhận"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
