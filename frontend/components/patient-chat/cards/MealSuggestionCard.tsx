"use client";

import React from "react";
import Link from "next/link";
import type { MealPreviewOut } from "@/lib/types";

interface MealSuggestionCardProps {
  preview: MealPreviewOut;
  onApplyPlan?: (id: string) => void;
  isApplied?: boolean;
}

const DEFAULT_MEAL_IMAGES: Record<string, string> = {
  breakfast:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCy63oLuOJDAmaKRpjFVopv89rdYQENESNjmE7aq_Ocq5jrHK-FH4GgCQR9vK5YZKE3RLentfO1lbIteBFsDnqnrIzn4LYFvI8taELitugsX2t_WedQhDlwtNFs5y9hU2pIiXrC7lePguTix4QtDrL0g3dW0dBVdyMRmIFNu-q5hrSD3rHRDJuBreht0dKaUxvrTNLQ65jCCGDQv-UyRxlfu-xHsVEgiGRWTVTxHlL_H-pkvO10wV_OkQ",
  lunch:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuADxt27IKTLgeBaUZZGmclNHqa1yxJ5BdE0hwQFPCghtzkBs-pLnXxtW9rJx9oEEHdsi2YcdIOOe-sJ_ieXqF3meSXctDnCBu_bdGF6O00ujRzs-_rwLYj9GMPyExtZbk6BybfRiv4tdGIw277x0dhVDL-038JXsqgcXBovCGlm_GNZ49AuvnZ74ZowOiWHC9-1EtExtZZAYUgEh-yrRUXoED48SXWnpqysR-Isco73Nyy02z2BTLtdmw",
  dinner:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuD2oStqvUJaJYckUh0nABnEJ8Ct080LnSnLWI4sl5w6O9GOHregWxmfd5Kv18OPXYPh3r6OLpxuRI9X7zxLm8gxXIqGIBGjVCQJN7KsNoDmYo_EVCUf90JZkUVFlrbTBFU1m_dX_RW3fMInFSM5ldv15Fv4EYzGjOnB2xGQOg6r2NILwjFncmEUHwMc9Gn66Z6roL-wOe1RtpO9zdnVpk5wYh_AXeLPxp7HmrOXOGRVtdwEKAbLW8hq6g",
};

const SLOT_TAGS: Record<string, { label: string; bg: string; text: string }[]> = {
  breakfast: [
    { label: "High Protein", bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-800" },
    { label: "Low GI", bg: "bg-blue-50 border-blue-200", text: "text-blue-800" },
  ],
  lunch: [
    { label: "Omega-3", bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-800" },
    { label: "Low Salt", bg: "bg-rose-50 border-rose-200", text: "text-rose-800" },
  ],
  dinner: [
    { label: "High Fiber", bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-800" },
    { label: "Lean Meat", bg: "bg-amber-50 border-amber-200", text: "text-amber-800" },
  ],
};

export function MealSuggestionCard({
  preview,
  onApplyPlan,
  isApplied = false,
}: MealSuggestionCardProps) {
  let totalKcal = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;

  const mealsList = preview?.meals || [];

  for (const meal of mealsList) {
    const items = meal?.items;
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        if (item?.kcal) totalKcal += item.kcal;
        if (item?.macros?.protein_g) totalProtein += item.macros.protein_g;
        if (item?.macros?.carb_g) totalCarbs += item.macros.carb_g;
        if (item?.macros?.fat_g) totalFat += item.macros.fat_g;
      }
    } else {
      // Fallback for legacy format or flat object
      const legacy = meal as unknown as {
        calories?: number;
        carb_g?: number;
        protein_g?: number;
        fat_g?: number;
      };
      if (legacy?.calories) totalKcal += legacy.calories;
      if (legacy?.protein_g) totalProtein += legacy.protein_g;
      if (legacy?.carb_g) totalCarbs += legacy.carb_g;
      if (legacy?.fat_g) totalFat += legacy.fat_g;
    }
  }

  totalKcal = Math.round(totalKcal);

  return (
    <div className="w-full flex flex-col gap-3.5 my-2">
      {/* Horizontal Slider of Meals */}
      <div className="w-full overflow-x-auto no-scrollbar pb-1">
        <div className="flex gap-3 w-max">
          {mealsList.map((meal) => {
            const items = Array.isArray(meal?.items) ? meal.items : [];
            const firstItem = items[0];
            const legacy = meal as unknown as {
              dish_name?: string;
              calories?: number;
            };
            const itemName = firstItem?.name || legacy?.dish_name || meal?.label || "Món ăn";
            const itemKcal = Math.round(
              items.length > 0
                ? items.reduce((acc, it) => acc + (it?.kcal || 0), 0)
                : legacy?.calories || 0
            );
            const imageSrc =
              DEFAULT_MEAL_IMAGES[meal?.slot] || DEFAULT_MEAL_IMAGES.lunch;
            const tags = SLOT_TAGS[meal?.slot] || [
              { label: "Cân bằng", bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-800" },
              { label: "Chuẩn y khoa", bg: "bg-blue-50 border-blue-200", text: "text-blue-800" },
            ];

            return (
              <div
                key={meal?.slot || itemName}
                className="w-[260px] sm:w-[280px] bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-xs shrink-0 flex flex-col hover:shadow-md hover:border-emerald-300 transition-all duration-200 group"
              >
                <div className="h-32 w-full relative overflow-hidden bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageSrc}
                    alt={itemName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-2.5 left-2.5 bg-white/90 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-white/70 shadow-xs">
                    <span className="text-[11px] font-bold text-slate-900">{meal?.label || "Bữa ăn"}</span>
                  </div>
                </div>

                <div className="p-3.5 flex flex-col gap-2 flex-grow">
                  <h3 className="font-bold text-[14px] text-slate-900 line-clamp-1 group-hover:text-[#006857] transition-colors" title={itemName}>
                    {itemName}
                  </h3>

                  <div className="flex items-center gap-1.5 text-slate-600">
                    <span className="material-symbols-outlined text-[16px] text-amber-600">
                      local_fire_department
                    </span>
                    <span className="text-xs font-semibold">{itemKcal > 0 ? `${itemKcal} kcal` : "Dinh dưỡng chuẩn"}</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
                    {tags.map((tag) => (
                      <span
                        key={tag.label}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${tag.bg} ${tag.text}`}
                      >
                        {tag.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Nutrition Summary Bar & Actions */}
      <div className="bg-slate-50/90 border border-slate-200/90 rounded-xl p-3.5 flex flex-col gap-3 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#006857]">
            <span className="material-symbols-outlined text-[18px]">nutrition</span>
            <span>Tổng giá trị dinh dưỡng đề xuất</span>
          </div>
          {preview.plan_status === "approved" ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-[11px] font-bold">
              <span className="material-symbols-outlined text-[13px]">verified</span>
              Bác sĩ đã duyệt
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-[11px] font-bold">
              <span className="material-symbols-outlined text-[13px]">pending</span>
              Chờ bác sĩ duyệt
            </span>
          )}
        </div>

        {/* 4 Macros Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 flex items-center gap-2 shadow-2xs">
            <div className="w-7 h-7 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[17px]">local_fire_department</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-medium">Năng lượng</span>
              <span className="font-bold text-slate-900">{totalKcal > 0 ? `${totalKcal} kcal` : "1.650 kcal"}</span>
            </div>
          </div>

          <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 flex items-center gap-2 shadow-2xs">
            <div className="w-7 h-7 rounded-md bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[17px]">egg_alt</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-medium">Chất đạm</span>
              <span className="font-bold text-slate-900">{totalProtein > 0 ? `${Math.round(totalProtein)}g` : "75g"}</span>
            </div>
          </div>

          <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 flex items-center gap-2 shadow-2xs">
            <div className="w-7 h-7 rounded-md bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[17px]">grain</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-medium">Đường bột</span>
              <span className="font-bold text-slate-900">{totalCarbs > 0 ? `${Math.round(totalCarbs)}g` : "180g"}</span>
            </div>
          </div>

          <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 flex items-center gap-2 shadow-2xs">
            <div className="w-7 h-7 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[17px]">opacity</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-medium">Chất béo</span>
              <span className="font-bold text-slate-900">{totalFat > 0 ? `${Math.round(totalFat)}g` : "45g"}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          {onApplyPlan && (
            <button
              type="button"
              disabled={isApplied}
              onClick={() => onApplyPlan(preview.meal_plan_id)}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl transition-all text-xs font-bold shadow-xs cursor-pointer ${
                isApplied
                  ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                  : "bg-gradient-to-r from-[#006857] to-emerald-600 hover:from-[#005245] hover:to-emerald-700 text-white active:scale-95 shadow-emerald-700/20"
              }`}
            >
              <span className="material-symbols-outlined text-[17px]">
                {isApplied ? "check_circle" : "bookmark_add"}
              </span>
              {isApplied ? "Đã áp dụng vào thực đơn của bạn" : "Áp dụng thực đơn này"}
            </button>
          )}
          <Link
            href={`/patient/meals?plan_id=${preview.meal_plan_id}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-200 hover:border-emerald-500 rounded-xl transition-colors text-slate-700 hover:text-[#006857] text-xs font-bold shadow-2xs"
          >
            <span className="material-symbols-outlined text-[17px]">restaurant_menu</span>
            Xem chi tiết tại Thực đơn
          </Link>
        </div>
      </div>
    </div>
  );
}


