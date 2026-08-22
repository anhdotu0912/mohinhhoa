"use client";

import React, { useState } from "react";
import { MOCK_GROCERY_DATA } from "@/lib/patient-chat-mock-data";

export function IngredientMapCard() {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  const toggleCheck = (item: string) => {
    setCheckedItems((prev) => ({ ...prev, [item]: !prev[item] }));
  };

  return (
    <div className="w-full flex flex-col gap-3 mt-1">
      <div className="relative w-full h-[300px] sm:h-[340px] rounded-xl overflow-hidden border border-slate-200/90 shadow-sm group">
        {/* Map Background */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={`Bản đồ khu vực ${MOCK_GROCERY_DATA.area}`}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
          src="https://lh3.googleusercontent.com/aida/AP1WRLsnhs73lx5eAAXRyw7Bu_ZV7RSdf9mjYbGocN3tHREgTPF62MPK734Bk3i-doRMQ1LBgz4a548SLRQhyjDnYKtbLDnEqh8k2urWnfDPaYS6jVNpmErlXP5PUgCXYM4TpxzTjMIeNyKkkHl-z2dKplByfYTJTm7ZTRdnMeq8Gn2dSG8EMKvrPakA7_jP77_ZhXrA-UHd2og2vDzyCV0rf2_Ek3UeQ_eTVFd2czr6u5_ik_aKgIpnqqSlRMyY"
        />

        {/* Pulse Marker */}
        <div className="absolute top-[52%] left-[48%] z-10 flex items-center justify-center transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="w-4 h-4 bg-[#006857] rounded-full border-2 border-white shadow-md z-10" />
          <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-60 w-10 h-10 -ml-3 -mt-3" />
        </div>

        {/* Nearest Stores Box */}
        <div className="absolute top-3 right-3 w-56 sm:w-64 bg-white/95 backdrop-blur-xl p-3.5 rounded-xl border border-white/80 shadow-lg z-20">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="material-symbols-outlined text-[16px] text-[#006857]">storefront</span>
            <h4 className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
              ĐIỂM MUA GẦN BẠN NHẤT
            </h4>
          </div>
          <div className="space-y-2">
            {MOCK_GROCERY_DATA.stores.map((store, index) => (
              <div key={store.name} className="flex items-start gap-2 p-1 rounded-md hover:bg-slate-50 transition-colors">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-[#006857] flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5 shadow-2xs">
                  {index + 1}
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-slate-900 leading-tight truncate">
                    {store.name}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium mt-0.5">
                    Cách {store.distance} • Thực phẩm sạch
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* View Full Map Button */}
        <button
          type="button"
          onClick={() => window.open(`https://www.google.com/maps/search/siêu+thị+thực+phẩm+gần+đây`, "_blank")}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-white/95 hover:bg-[#006857] text-[#006857] hover:text-white px-4 py-2 rounded-full text-xs font-bold shadow-md backdrop-blur-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 border border-white/80"
        >
          <span className="material-symbols-outlined text-[17px]">open_in_new</span>
          Mở bản đồ chỉ đường chi tiết
        </button>
      </div>

      {/* Suggested Ingredients List with Checkboxes */}
      <div className="bg-slate-50/90 border border-slate-200/90 rounded-xl p-3.5 flex flex-col gap-2.5 shadow-2xs">
        <div className="flex items-center justify-between">
          <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[17px] text-[#006857]">shopping_bag</span>
            Danh sách nguyên liệu cần chuẩn bị ({MOCK_GROCERY_DATA.items.length} món):
          </span>
          <span className="text-[11px] text-slate-500 font-medium">
            Đã chọn {Object.values(checkedItems).filter(Boolean).length}/{MOCK_GROCERY_DATA.items.length}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {MOCK_GROCERY_DATA.items.map((item) => {
            const isChecked = Boolean(checkedItems[item]);
            return (
              <button
                key={item}
                type="button"
                onClick={() => toggleCheck(item)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  isChecked
                    ? "bg-emerald-100/80 border-emerald-300 text-emerald-900 line-through opacity-80"
                    : "bg-white border-slate-200 text-slate-800 hover:border-emerald-400 shadow-2xs"
                }`}
              >
                <span className="material-symbols-outlined text-[15px] text-[#006857]">
                  {isChecked ? "check_box" : "check_box_outline_blank"}
                </span>
                {item}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

