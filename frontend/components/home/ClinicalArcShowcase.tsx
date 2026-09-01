"use client";

import React, { useState, useEffect } from "react";

interface ShowcaseItem {
  id: string;
  title: string;
  category: string;
  icon: string;
  previewBadge: string;
  renderScreen: () => React.ReactNode;
}

export function ClinicalArcShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const items: ShowcaseItem[] = [
    {
      id: "chatbot",
      title: "Trợ lý AI Dinh dưỡng",
      category: "RAG Y văn & HITL",
      icon: "smart_toy",
      previewBadge: "Bác sĩ kiểm duyệt",
      renderScreen: () => (
        <div className="space-y-3">
          {/* User question */}
          <div className="flex items-start gap-2.5 justify-end">
            <div className="bg-[#0f766e] text-white text-xs px-3.5 py-2 rounded-2xl rounded-tr-xs shadow-xs max-w-[85%]">
              Bác bị tiểu đường Type 2, bữa trưa có ăn được 1 bát bún chả không cháu?
            </div>
            <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[11px] font-bold shrink-0">
              BN
            </div>
          </div>

          {/* AI Clinical Response */}
          <div className="flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-full bg-teal-100 text-[#0f766e] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[14px]">smart_toy</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 text-slate-800 text-xs p-3 rounded-2xl rounded-tl-xs space-y-2 max-w-[90%] shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-200/70 pb-1.5 text-[11px]">
                <span className="font-bold text-[#0f766e] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">verified</span>
                  Khuyến nghị chuẩn y khoa
                </span>
                <span className="text-[10px] text-slate-500">Nguồn: ADA 2026</span>
              </div>
              <p className="text-[11.5px] leading-relaxed text-slate-700">
                Bác <strong>hoàn toàn có thể ăn</strong> nhưng cần điều chỉnh:
              </p>
              <ul className="space-y-1 text-[11px] text-slate-600 list-disc pl-4">
                <li>Bún tươi: Tối đa <strong>100g</strong> (khoảng 1/2 bát) để kiểm soát chỉ số Glycemic Load.</li>
                <li>Ưu tiên thịt nạc nướng không mỡ và ăn kèm đĩa rau sống lớn trước.</li>
              </ul>
              <div className="pt-1.5 flex items-center justify-between text-[10.5px] font-medium text-slate-500 border-t border-slate-200/70">
                <span>Khẩu phần ước tính: 480 kcal</span>
                <span className="text-teal-700 font-semibold">Tải lượng đường: Thấp (GL 12)</span>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "meal-plan",
      title: "Tạo Thực đơn Cá nhân hoá",
      category: "Thực đơn 7 ngày",
      icon: "restaurant_menu",
      previewBadge: "Chuẩn Calo & Macros",
      renderScreen: () => (
        <div className="space-y-3">
          {/* Target Macro Summary */}
          <div className="grid grid-cols-4 gap-1.5 text-center bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-medium">Tổng Calo</span>
              <span className="text-xs font-extrabold text-slate-900">1.650 kcal</span>
            </div>
            <div className="flex flex-col border-l border-slate-200">
              <span className="text-[10px] text-slate-500 font-medium">Carbs</span>
              <span className="text-xs font-extrabold text-teal-700">185g (45%)</span>
            </div>
            <div className="flex flex-col border-l border-slate-200">
              <span className="text-[10px] text-slate-500 font-medium">Protein</span>
              <span className="text-xs font-extrabold text-teal-700">82g (20%)</span>
            </div>
            <div className="flex flex-col border-l border-slate-200">
              <span className="text-[10px] text-slate-500 font-medium">Chất béo</span>
              <span className="text-xs font-extrabold text-slate-700">64g (35%)</span>
            </div>
          </div>

          {/* Meal breakdown */}
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-teal-50 text-[#0f766e] flex items-center justify-center text-[10px] font-bold">
                  S
                </span>
                <div>
                  <div className="font-semibold text-slate-800 text-[11.5px]">Cháo yến mạch ức gà xé &amp; nấm</div>
                  <div className="text-[10px] text-slate-500">380 kcal • GI 45 (Thấp)</div>
                </div>
              </div>
              <span className="text-[11px] font-bold text-[#0f766e] bg-teal-50 px-2 py-0.5 rounded border border-teal-100">
                07:00
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-teal-50 text-[#0f766e] flex items-center justify-center text-[10px] font-bold">
                  T
                </span>
                <div>
                  <div className="font-semibold text-slate-800 text-[11.5px]">Cơm gạo lứt + Cá lóc kho tộ + Rau luộc</div>
                  <div className="text-[10px] text-slate-500">550 kcal • Giảm 50% muối</div>
                </div>
              </div>
              <span className="text-[11px] font-bold text-[#0f766e] bg-teal-50 px-2 py-0.5 rounded border border-teal-100">
                12:00
              </span>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "safety-guard",
      title: "Rà soát Tương tác Thuốc",
      category: "Dược thư Quốc gia",
      icon: "shield",
      previewBadge: "An toàn Y khoa HITL",
      renderScreen: () => (
        <div className="space-y-2.5">
          <div className="p-3 rounded-xl bg-white border border-rose-200 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-rose-700 font-bold text-xs">
                <span className="material-symbols-outlined text-[16px]">warning</span>
                Phát hiện Xung đột Thuốc - Thực phẩm
              </div>
              <span className="text-[10px] font-bold uppercase text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                Mức độ cao
              </span>
            </div>
            <div className="text-[11.5px] text-rose-950 font-medium bg-rose-50/50 p-2 rounded-lg border border-rose-100">
              Đơn thuốc: <span className="font-bold text-rose-900">Amlodipine 5mg</span> × Thực phẩm: <span className="font-bold text-rose-900">Bưởi chùm (Grapefruit)</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              <strong>Cơ chế dược lý:</strong> Furanocoumarins trong bưởi ức chế enzym CYP3A4 tại ruột non, làm tăng nồng độ Amlodipine trong máu gấp 2-3 lần, dẫn đến tụt huyết áp quá mức.
            </p>
            <div className="text-[10.5px] font-semibold text-teal-800 bg-teal-50 p-2 rounded-lg border border-teal-100 flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px] text-[#0f766e]">check_circle</span>
              Khuyến nghị thay thế: Dùng cam sành hoặc táo ta an toàn.
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "metrics-tracker",
      title: "Theo dõi Sinh hiệu",
      category: "Chuỗi Thời gian",
      icon: "monitoring",
      previewBadge: "Cập nhật liên tục",
      renderScreen: () => (
        <div className="space-y-2.5">
          {/* Simple Clean Metrics Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[11px] text-slate-500 mb-1">HbA1c</div>
              <div className="text-lg font-bold text-slate-900 flex items-center gap-1.5">
                <span>7.2%</span>
                <span className="text-[11px] font-semibold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200/60">
                  -0.4%
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[11px] text-slate-500 mb-1">Huyết áp</div>
              <div className="text-lg font-bold text-slate-900 flex items-center gap-1.5">
                <span>125/80</span>
                <span className="text-[11px] text-slate-400 font-normal">mmHg</span>
              </div>
            </div>
          </div>

          {/* Simple Single Adherence Line */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-600">Tuân thủ thực đơn tuần:</span>
            <span className="font-bold text-[#0f766e]">88%</span>
          </div>
        </div>
      ),
    },
  ];

  // Auto transition every 6 seconds if not hovered
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % items.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isPaused, items.length]);

  const activeItem = items[activeIndex];


  return (
    <div
      className="relative w-full max-w-[580px] mx-auto lg:max-w-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* 1. Curved 1/4 Arc Track Background (Visual Guide) */}
      <div className="hidden sm:block absolute -left-12 top-1/2 -translate-y-1/2 w-48 h-96 pointer-events-none z-0">
        <svg className="w-full h-full" viewBox="0 0 120 280">
          <path
            d="M 110 20 A 130 130 0 0 0 110 260"
            fill="none"
            stroke="#0f766e"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity="0.25"
          />
        </svg>
      </div>

      <div className="relative z-10 flex flex-col gap-4">
        {/* Top Control Tabs with 1/4 Arc Status Indicator */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {items.map((item, idx) => {
            const isActive = idx === activeIndex;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveIndex(idx)}
                className={`relative flex items-center gap-2 p-2.5 rounded-xl text-left transition-all text-xs font-semibold ${
                  isActive
                    ? "bg-white text-[#0f766e] shadow-md border border-teal-200/90"
                    : "bg-white/60 hover:bg-white/90 text-slate-600 hover:text-slate-900 border border-slate-200/60"
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    isActive ? "bg-[#0f766e] text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">{item.icon}</span>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="truncate text-[11px] leading-tight font-bold">{item.title}</span>
                  <span className="truncate text-[9.5px] text-slate-400 font-normal">{item.category}</span>
                </div>

                {/* Active indicator bar */}
                {isActive && (
                  <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#0f766e] rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Main Active Mockup Screen Card (Elevated Medical High-Craft) */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xl relative overflow-hidden transition-all">
          {/* Card Top Meta Header */}
          <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-slate-900">{activeItem.title}</span>
              <span className="text-[10px] text-slate-400">• {activeItem.category}</span>
            </div>

            <div className="flex items-center gap-1 text-[11px] font-bold text-[#0f766e] bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200/80">
              <span className="material-symbols-outlined text-[13px]">verified_user</span>
              <span>{activeItem.previewBadge}</span>
            </div>
          </div>

          {/* Interactive Screen Content with Smooth Reveal */}
          <div key={activeItem.id} className="animate-card-reveal min-h-[190px] flex flex-col justify-center">
            {activeItem.renderScreen()}
          </div>

          {/* Card Bottom Micro-Nav / Status Indicator */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px] text-[#0f766e]">lock</span>
              <span>Bảo mật y tế &amp; RAG Grounded</span>
            </div>

            {/* Orbit Step Dots */}
            <div className="flex items-center gap-1.5">
              {items.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Xem màn hình ${i + 1}`}
                  onClick={() => setActiveIndex(i)}
                  className={`transition-all rounded-full ${
                    i === activeIndex
                      ? "w-5 h-1.5 bg-[#0f766e]"
                      : "w-1.5 h-1.5 bg-slate-300 hover:bg-slate-400"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
