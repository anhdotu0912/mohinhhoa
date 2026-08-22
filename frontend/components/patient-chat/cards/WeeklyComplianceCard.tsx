"use client";

import React from "react";
import { usePatientPanel } from "../PatientPanelProvider";
import { MOCK_COMPLIANCE_DATA } from "@/lib/patient-chat-mock-data";

export function WeeklyComplianceCard() {
  const { openPanel } = usePatientPanel();

  return (
    <div className="w-full bg-white border border-slate-200/90 rounded-xl p-4.5 shadow-xs flex flex-col gap-4 mt-1">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-[#006857] tracking-tight">
              {MOCK_COMPLIANCE_DATA.overallPct}%
            </span>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Tỉ lệ tuân thủ tuần này
            </span>
          </div>
          <p className="text-xs text-slate-600">
            Bạn đang duy trì thói quen dinh dưỡng rất tốt theo phác đồ điều trị.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold shadow-2xs">
          <span className="material-symbols-outlined text-[15px] text-[#006857]">trending_up</span>
          <span>Đạt mục tiêu</span>
        </div>
      </div>

      {/* SVG Chart Area */}
      <div className="relative w-full h-36 mt-3">
        <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="compliance-gradient" x1="0%" x2="0%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Area fill */}
          <path
            d="M 0 100 L 0 50 C 16.6 40, 16.6 40, 33.3 35 C 50 30, 50 30, 66.6 25 C 83.3 15, 83.3 15, 100 15 L 100 100 Z"
            fill="url(#compliance-gradient)"
          />

          {/* Line */}
          <path
            d="M 0 50 C 16.6 40, 16.6 40, 33.3 35 C 50 30, 50 30, 66.6 25 C 83.3 15, 83.3 15, 100 15"
            fill="none"
            stroke="#006857"
            strokeLinecap="round"
            strokeWidth="3"
          />

          {/* Data points */}
          {[
            { x: 0, y: 50, val: "80%" },
            { x: 16.6, y: 40, val: "85%" },
            { x: 33.3, y: 35, val: "88%" },
            { x: 50, y: 30, val: "90%" },
            { x: 66.6, y: 25, val: "90%" },
            { x: 83.3, y: 15, val: "95%" },
            { x: 100, y: 15, val: "95%" },
          ].map((pt, idx) => (
            <g key={idx}>
              <circle cx={pt.x} cy={pt.y} r="2.5" fill="#006857" stroke="#ffffff" strokeWidth="1" />
              <text
                x={pt.x}
                y={pt.y - 6}
                textAnchor="middle"
                fontSize="6"
                fontWeight="bold"
                fill="#006857"
              >
                {pt.val}
              </text>
            </g>
          ))}
        </svg>

        {/* Days X-axis */}
        <div className="absolute -bottom-6 left-0 w-full flex justify-between px-1 text-[11px] text-slate-500 font-semibold">
          {MOCK_COMPLIANCE_DATA.days.map((day, idx) => (
            <span
              key={day}
              className={idx === MOCK_COMPLIANCE_DATA.days.length - 1 ? "font-bold text-[#006857]" : ""}
            >
              {day}
            </span>
          ))}
        </div>
      </div>

      {/* Legend and Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-6 border-t border-slate-100 mt-2">
        <div className="flex flex-wrap gap-3.5">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#006857]" />
            <span className="text-[11px] text-slate-700 font-medium">Đúng thực đơn</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span className="text-[11px] text-slate-700 font-medium">Món ngoài thực đơn</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
            <span className="text-[11px] text-slate-500 font-medium">Chưa ghi nhận</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => openPanel("menu")}
          className="text-[#006857] hover:text-[#005245] text-xs font-bold flex items-center gap-1 cursor-pointer group"
        >
          <span>Xem chi tiết tại Thực đơn</span>
          <span className="material-symbols-outlined text-[16px] group-hover:translate-x-0.5 transition-transform">
            arrow_forward
          </span>
        </button>
      </div>
    </div>
  );
}

