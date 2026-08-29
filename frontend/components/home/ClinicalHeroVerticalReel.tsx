"use client";

import React, { useState } from "react";
import Link from "next/link";

interface ReelCard {
  id: string;
  tag: string;
  tagColor: string;
  title: string;
  subtitle: string;
  badgeText: string;
  badgeIcon: string;
  badgeType: "emerald" | "rose" | "amber" | "sky";
  content: React.ReactNode;
  footerNote: string;
}

const CARDS_COLUMN_1: ReelCard[] = [
  {
    id: "card-meal-rag",
    tag: "Tư vấn Thực đơn RAG y văn",
    tagColor: "bg-teal-100 text-[#0f766e] border-teal-200",
    title: "Bún chả nướng điều chỉnh",
    subtitle: "Cá nhân hóa cho Bệnh nhân Đái tháo đường Type 2",
    badgeText: "Bác sĩ đã duyệt",
    badgeIcon: "verified",
    badgeType: "emerald",
    content: (
      <div className="space-y-2.5">
        <div className="flex items-center justify-between bg-teal-50/70 p-2.5 rounded-xl border border-teal-100 text-xs">
          <span className="text-slate-700 font-medium">Khẩu phần mục tiêu:</span>
          <span className="font-bold text-[#0f766e] bg-white px-2 py-0.5 rounded border border-teal-200">
            520 kcal • Carbs 42g • Đạm 32g
          </span>
        </div>
        <div className="space-y-1.5 text-xs text-slate-700">
          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200/80">
            <span className="font-medium">Bún tươi (100g ~ 1/2 bát)</span>
            <span className="text-slate-500 font-semibold">110 kcal</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-teal-50/50 border border-teal-200/70">
            <span className="font-medium text-[#0f766e]">Chả thịt nạc nướng không mỡ (120g)</span>
            <span className="text-[#0f766e] font-semibold">220 kcal</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200/80">
            <span className="font-medium">Rau sống các loại (150g)</span>
            <span className="text-slate-500 font-semibold">35 kcal</span>
          </div>
        </div>
      </div>
    ),
    footerNote: "Thứ tự ăn chuẩn y khoa: Rau sống ➔ Thịt nạc ➔ Bún tươi (giảm 40% đỉnh đường huyết)",
  },
  {
    id: "card-drug-alert",
    tag: "HITL Guardrails Dược thư",
    tagColor: "bg-rose-100 text-rose-700 border-rose-200",
    title: "Cảnh báo Xung đột Thuốc - Thực phẩm",
    subtitle: "Rà soát tương tác theo Dược thư Quốc gia & FDA",
    badgeText: "Cảnh báo cao",
    badgeIcon: "warning",
    badgeType: "rose",
    content: (
      <div className="space-y-2 text-xs">
        <div className="p-2.5 rounded-xl bg-rose-50/80 border border-rose-200 space-y-1">
          <div className="flex items-center gap-1.5 text-rose-900 font-bold">
            <span className="material-symbols-outlined text-[15px] text-rose-600">block</span>
            <span>Amlodipine 5mg + Bưởi chùm (Grapefruit)</span>
          </div>
          <p className="text-slate-600 text-[11px] leading-relaxed">
            Ức chế enzym CYP3A4 ruột non, làm tăng nồng độ thuốc gây tụt huyết áp kịch phát.
          </p>
        </div>
        <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200 space-y-1">
          <div className="flex items-center gap-1.5 text-amber-900 font-bold">
            <span className="material-symbols-outlined text-[15px] text-amber-600">no_drinks</span>
            <span>Metformin 500mg + Rượu bia có cồn</span>
          </div>
          <p className="text-slate-600 text-[11px] leading-relaxed">
            Tăng nguy cơ nhiễm toan lactic và gây hạ đường huyết ban đêm.
          </p>
        </div>
      </div>
    ),
    footerNote: "Tự động rà soát ngay khi bệnh nhân khai báo đơn thuốc mới",
  },
  {
    id: "card-doctor-instruction",
    tag: "Chỉ định Bác sĩ điều trị",
    tagColor: "bg-sky-100 text-sky-800 border-sky-200",
    title: "Lời dặn BS.CKII Nguyễn Thu Trang",
    subtitle: "Khoa Nội tiết - Dinh dưỡng Lâm sàng",
    badgeText: "Y lệnh mới nhất",
    badgeIcon: "clinical_notes",
    badgeType: "sky",
    content: (
      <div className="p-3 rounded-xl bg-sky-50/70 border border-sky-200 text-xs text-sky-950 leading-relaxed italic space-y-1.5">
        <p>
          “Chỉ số HbA1c của bác đã cải thiện rất tốt (từ 7.6% xuống 7.2%). Hãy tiếp tục duy trì khẩu phần ăn trưa ít tinh bột nhanh và uống đủ 2L nước mỗi ngày.”
        </p>
        <div className="flex items-center justify-between text-[11px] text-sky-700 not-italic pt-1 font-semibold">
          <span>Hẹn tái khám: 15/09/2026</span>
          <span>Bệnh viện Đại học Y Dược</span>
        </div>
      </div>
    ),
    footerNote: "Đồng bộ tức thời qua Cổng Clinician Portal của Bác sĩ",
  },
];

const CARDS_COLUMN_2: ReelCard[] = [
  {
    id: "card-compliance-chart",
    tag: "Theo dõi Tuân thủ Dinh dưỡng",
    tagColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
    title: "Báo cáo Tuân thủ Tuần này",
    subtitle: "Mục tiêu Bác sĩ đề ra: ≥ 80%",
    badgeText: "Đạt 85% • Xuất sắc",
    badgeIcon: "insights",
    badgeType: "emerald",
    content: (
      <div className="space-y-2.5">
        <div className="grid grid-cols-7 gap-1 text-center">
          {[
            { day: "T2", pct: 90, ok: true },
            { day: "T3", pct: 85, ok: true },
            { day: "T4", pct: 80, ok: true },
            { day: "T5", pct: 75, ok: false },
            { day: "T6", pct: 95, ok: true },
            { day: "T7", pct: 85, ok: true },
            { day: "CN", pct: 85, ok: true },
          ].map((item, i) => (
            <div
              key={i}
              className={`p-1.5 rounded-lg border flex flex-col items-center gap-0.5 text-[10px] ${
                item.ok
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : "bg-amber-50 border-amber-200 text-amber-900"
              }`}
            >
              <span className="font-bold text-slate-500">{item.day}</span>
              <span className="font-extrabold">{item.pct}%</span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${item.ok ? "bg-emerald-500" : "bg-amber-500"}`}
              ></span>
            </div>
          ))}
        </div>
        <div className="text-xs text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-200 flex items-center justify-between">
          <span className="text-slate-600">Đường huyết lúc đói:</span>
          <span className="font-bold text-emerald-700 flex items-center gap-1">
            <span className="material-symbols-outlined text-[15px]">trending_down</span>
            6.5 - 7.0 mmol/L (Ổn định)
          </span>
        </div>
      </div>
    ),
    footerNote: "Tự động so khớp từng bữa ăn từ Nhật ký 3-Slot Food Log",
  },
  {
    id: "card-vietnamese-rag",
    tag: "CSDL 1.200+ Món ăn Việt",
    tagColor: "bg-teal-100 text-[#0f766e] border-teal-200",
    title: "Định lượng Món ăn Truyền thống",
    subtitle: "RAG y văn Viện Dinh Dưỡng Quốc Gia",
    badgeText: "Chuẩn Calo & GI",
    badgeIcon: "database",
    badgeType: "emerald",
    content: (
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-slate-900 font-bold">Phở bò tái</div>
          <div className="text-[11px] text-teal-700 font-semibold mt-0.5">380 kcal</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Ít bánh, nhiều hành</div>
        </div>
        <div className="p-2 rounded-xl bg-teal-50/60 border border-teal-200">
          <div className="text-slate-900 font-bold">Canh chua cá</div>
          <div className="text-[11px] text-[#0f766e] font-semibold mt-0.5">145 kcal</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Giảm 50% muối</div>
        </div>
        <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-slate-900 font-bold">Thịt kho trứng</div>
          <div className="text-[11px] text-teal-700 font-semibold mt-0.5">260 kcal</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Dùng thịt nạc</div>
        </div>
      </div>
    ),
    footerNote: "Định lượng chính xác GI, GL, Natri, Kali & Purin cho từng món ăn",
  },
  {
    id: "card-metrics-timeseries",
    tag: "Chuỗi Thời gian Sinh hiệu",
    tagColor: "bg-sky-100 text-sky-800 border-sky-200",
    title: "Tiến độ Kiểm soát Bệnh lý",
    subtitle: "Biến thiên HbA1c và Huyết áp tâm thu/tâm trương",
    badgeText: "Cải thiện rõ rệt",
    badgeIcon: "trending_up",
    badgeType: "sky",
    content: (
      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-slate-600 font-medium">Chỉ số HbA1c (3 tháng):</span>
          <span className="font-bold text-[#0f766e] bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
            7.6% ➔ 7.2% (-0.4%)
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-600 font-medium">Huyết áp trung bình:</span>
          <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
            128/82 mmHg
          </span>
        </div>
        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
          <div className="bg-[#0f766e] h-full rounded-full w-[78%]"></div>
        </div>
      </div>
    ),
    footerNote: "Minh bạch kết quả điều trị giúp người bệnh duy trì động lực",
  },
];

function CardRender({ card }: { card: ReelCard }) {
  const badgeClasses = {
    emerald: "bg-emerald-100 text-emerald-800 border-emerald-300",
    rose: "bg-rose-100 text-rose-800 border-rose-300",
    amber: "bg-amber-100 text-amber-900 border-amber-300",
    sky: "bg-sky-100 text-sky-900 border-sky-300",
  }[card.badgeType];

  return (
    <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-lg hover:shadow-xl hover:border-teal-400 transition-all group flex flex-col justify-between select-none">
      <div>
        {/* Card Header Tag & Badge */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${card.tagColor}`}>
            {card.tag}
          </span>
          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${badgeClasses}`}>
            <span className="material-symbols-outlined text-[13px]">{card.badgeIcon}</span>
            <span>{card.badgeText}</span>
          </span>
        </div>

        {/* Card Title */}
        <h4 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight group-hover:text-[#0f766e] transition-colors mb-0.5">
          {card.title}
        </h4>
        <p className="text-[11px] text-slate-500 mb-3">{card.subtitle}</p>

        {/* Card Specific Content Body */}
        {card.content}
      </div>

      {/* Card Footer Clinical Traceability */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-1.5 text-[10px] text-slate-500">
        <span className="material-symbols-outlined text-[14px] text-[#0f766e]">verified_user</span>
        <span className="truncate">{card.footerNote}</span>
      </div>
    </div>
  );
}

export function ClinicalHeroVerticalReel() {
  const [isPaused, setIsPaused] = useState(false);

  return (
    <div
      className="relative w-full h-[540px] sm:h-[600px] overflow-hidden rounded-3xl border border-slate-200/80 bg-slate-900/5 shadow-2xl p-2 sm:p-3"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Top and Bottom Smooth Fade Masks */}
      <div className="absolute inset-0 pointer-events-none z-20 mask-gradient-y" />

      {/* Floating Status Pill */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-slate-900/80 backdrop-blur-md border border-slate-700/80 text-white px-3.5 py-1 rounded-full text-xs font-semibold flex items-center gap-2 shadow-lg">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span>Hệ sinh thái Dinh dưỡng Lâm sàng AI &amp; Bác sĩ</span>
        <span className="text-[10px] text-emerald-300/80 font-mono hidden sm:inline">• Trực quan hóa</span>
      </div>

      {/* Controls Overlay Button at bottom */}
      <div className="absolute bottom-4 right-4 z-30 flex items-center gap-2">
        <Link
          href="/patient"
          className="bg-[#0f766e] hover:bg-[#115e59] text-white text-xs font-bold px-3.5 py-1.5 rounded-xl shadow-md transition-all flex items-center gap-1 hover:scale-105 active:scale-95"
        >
          <span>Khám phá Cổng Bệnh nhân</span>
          <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
        </Link>
      </div>

      {/* Dual Column Vertical Marquee Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 h-full">
        
        {/* Column 1: Scrolling Upwards */}
        <div className="overflow-hidden h-full">
          <div
            className="flex flex-col gap-3 animate-marquee-vertical-up"
            style={{ animationPlayState: isPaused ? "paused" : "running" }}
          >
            {/* Duplicated 2 times for seamless infinite loop */}
            {[...CARDS_COLUMN_1, ...CARDS_COLUMN_1].map((card, idx) => (
              <CardRender key={`col1-${card.id}-${idx}`} card={card} />
            ))}
          </div>
        </div>

        {/* Column 2: Scrolling Downwards (Hidden on very small mobile for clean single column) */}
        <div className="hidden sm:block overflow-hidden h-full">
          <div
            className="flex flex-col gap-3 animate-marquee-vertical-down"
            style={{ animationPlayState: isPaused ? "paused" : "running" }}
          >
            {/* Duplicated 2 times for seamless infinite loop */}
            {[...CARDS_COLUMN_2, ...CARDS_COLUMN_2].map((card, idx) => (
              <CardRender key={`col2-${card.id}-${idx}`} card={card} />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
