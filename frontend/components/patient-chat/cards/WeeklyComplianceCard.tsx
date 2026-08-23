"use client";

import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { usePatientPanel } from "../PatientPanelProvider";
import {
  MOCK_COMPLIANCE_DATA,
  calculateAverageCompliance,
  type DailyComplianceDetail,
} from "@/lib/patient-chat-mock-data";

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    dataKey: string;
    payload: DailyComplianceDetail;
  }>;
  label?: string;
  viewMode: "trend" | "breakdown";
}

function CustomTooltip({ active, payload, viewMode }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  const dayNames: Record<string, string> = {
    T2: "Thứ Hai",
    T3: "Thứ Ba",
    T4: "Thứ Tư",
    T5: "Thứ Năm",
    T6: "Thứ Sáu",
    T7: "Thứ Bảy",
    CN: "Chủ Nhật",
  };

  return (
    <div className="bg-slate-900/95 backdrop-blur-md text-white px-3.5 py-2.5 rounded-xl shadow-xl border border-slate-700 text-xs flex flex-col gap-1 z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
      <div className="flex items-center justify-between gap-3 border-b border-slate-700/80 pb-1 font-semibold text-slate-200">
        <span>{dayNames[data.day] || data.day}</span>
        <span className="text-emerald-400 font-bold">{data.pct}% tuân thủ</span>
      </div>

      {viewMode === "trend" ? (
        <div className="flex flex-col gap-0.5 pt-0.5 text-[11px] text-slate-300">
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400">Mục tiêu:</span>
            <span className="font-medium text-slate-200">{data.target}%</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400">Đánh giá:</span>
            <span
              className={`font-semibold ${
                data.pct >= data.target ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              {data.pct >= data.target ? "Đạt chuẩn y khoa" : "Dưới ngưỡng"}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1 pt-1 text-[11px]">
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2 h-2 rounded-full bg-[#006857]" />
              Đúng thực đơn:
            </span>
            <span className="font-semibold text-white">{data.onPlan} bữa</span>
          </div>
          {data.offPlan > 0 && (
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                Món ngoài:
              </span>
              <span className="font-semibold text-blue-300">{data.offPlan} món</span>
            </div>
          )}
          {data.skipped > 0 && (
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                Chưa ghi:
              </span>
              <span className="font-semibold text-slate-300">{data.skipped} bữa</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Custom Top Dot with Percentage Label directly above
interface CustomDotProps {
  cx?: number;
  cy?: number;
  value?: number;
  index?: number;
  stroke?: string;
}

function CustomizedDot(props: CustomDotProps) {
  const { cx, cy, value, index } = props;
  if (cx === undefined || cy === undefined) return null;

  const isLatest = index === MOCK_COMPLIANCE_DATA.details.length - 1;

  return (
    <g>
      {/* Halo for latest dot */}
      {isLatest && (
        <circle
          cx={cx}
          cy={cy}
          r={9}
          fill="#006857"
          opacity={0.18}
          className="animate-pulse"
        />
      )}
      {/* Outer shadow dot */}
      <circle
        cx={cx}
        cy={cy}
        r={4.5}
        fill="#006857"
        stroke="#ffffff"
        strokeWidth={2}
        className="drop-shadow-xs"
      />
      {/* Number Label strictly centered above dot */}
      <text
        x={cx}
        y={cy - 10}
        textAnchor="middle"
        fill="#005245"
        fontSize={11}
        fontWeight={700}
        fontFamily="inherit"
      >
        {value}%
      </text>
    </g>
  );
}

const emptySubscribe = () => () => {};

export function WeeklyComplianceCard() {
  const { openPanel } = usePatientPanel();
  const mounted = React.useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [viewMode, setViewMode] = useState<"trend" | "breakdown">("trend");

  const chartData = useMemo(() => MOCK_COMPLIANCE_DATA.details, []);

  // Calculate dynamic weekly average
  const overallPct = useMemo(() => {
    return calculateAverageCompliance(MOCK_COMPLIANCE_DATA);
  }, []);

  // Performance status badge
  const statusBadge = useMemo(() => {
    if (overallPct >= 90) {
      return {
        label: "Xuất sắc",
        icon: "verified",
        style: "bg-emerald-50 text-[#006857] border-emerald-200/90",
      };
    }
    if (overallPct >= 80) {
      return {
        label: "Đạt mục tiêu",
        icon: "trending_up",
        style: "bg-emerald-50 text-emerald-800 border-emerald-200",
      };
    }
    return {
      label: "Cần cải thiện",
      icon: "info",
      style: "bg-amber-50 text-amber-800 border-amber-200",
    };
  }, [overallPct]);

  return (
    <div className="w-full bg-white border border-slate-200/90 rounded-2xl p-4.5 sm:p-5 shadow-xs flex flex-col gap-4 mt-1">
      {/* Card Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline gap-2.5">
            <span className="text-3xl sm:text-4xl font-extrabold text-[#006857] tracking-tight">
              {overallPct}%
            </span>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Tỷ lệ tuân thủ tuần này
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                (Trung bình 7 ngày gần nhất)
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-600 mt-0.5">
            {overallPct >= 85
              ? "Bạn đang duy trì thói quen dinh dưỡng rất tốt theo phác đồ điều trị."
              : "Hãy tiếp tục bám sát thực đơn đề xuất để tối ưu hiệu quả kiểm soát bệnh lý."}
          </p>
        </div>

        {/* Status Badge & View Mode Toggle */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-2xs ${statusBadge.style}`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {statusBadge.icon}
            </span>
            <span>{statusBadge.label}</span>
          </div>

          {/* Mode Switcher */}
          <div className="inline-flex p-0.5 rounded-lg bg-slate-100 border border-slate-200/80 text-[11px] font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => setViewMode("trend")}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                viewMode === "trend"
                  ? "bg-white text-[#006857] font-bold shadow-2xs"
                  : "hover:text-slate-900"
              }`}
            >
              Đường xu hướng
            </button>
            <button
              type="button"
              onClick={() => setViewMode("breakdown")}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                viewMode === "breakdown"
                  ? "bg-white text-[#006857] font-bold shadow-2xs"
                  : "hover:text-slate-900"
              }`}
            >
              Chi tiết bữa
            </button>
          </div>
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div className="w-full h-44 sm:h-48 pt-3 pb-1 relative">
        {!mounted ? (
          <div className="w-full h-full flex items-center justify-center bg-slate-50/60 rounded-xl animate-pulse text-xs text-slate-400">
            Đang chuẩn bị biểu đồ...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {viewMode === "trend" ? (
              <AreaChart
                data={chartData}
                margin={{ top: 22, right: 20, left: 20, bottom: 4 }}
              >
                <defs>
                  <linearGradient id="patientComplianceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#006857" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#006857" stopOpacity={0.01} />
                  </linearGradient>
                </defs>

                {/* Target Baseline (85% Standard Goal) */}
                <ReferenceLine
                  y={85}
                  stroke="#10b981"
                  strokeDasharray="3 3"
                  strokeOpacity={0.4}
                />

                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fontWeight: 700, fill: "#64748b" }}
                  dy={8}
                />
                <YAxis hide domain={[60, 105]} />

                <Tooltip
                  content={<CustomTooltip viewMode="trend" />}
                  cursor={{ stroke: "#006857", strokeWidth: 1, strokeDasharray: "3 3", strokeOpacity: 0.3 }}
                />

                <Area
                  type="monotone"
                  dataKey="pct"
                  stroke="#006857"
                  strokeWidth={2.75}
                  fill="url(#patientComplianceGrad)"
                  dot={<CustomizedDot />}
                  activeDot={{
                    r: 6,
                    fill: "#006857",
                    stroke: "#ffffff",
                    strokeWidth: 2,
                  }}
                  isAnimationActive={true}
                  animationDuration={800}
                />
              </AreaChart>
            ) : (
              <BarChart
                data={chartData}
                margin={{ top: 16, right: 16, left: 16, bottom: 4 }}
                barSize={24}
              >
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fontWeight: 700, fill: "#64748b" }}
                  dy={8}
                />
                <YAxis hide domain={[0, 3]} />

                <Tooltip
                  content={<CustomTooltip viewMode="breakdown" />}
                  cursor={{ fill: "#f1f5f9", opacity: 0.6 }}
                />

                {/* Stacked Bars representing meal slots */}
                <Bar
                  dataKey="onPlan"
                  name="Đúng thực đơn"
                  stackId="meals"
                  fill="#006857"
                  radius={[0, 0, 4, 4]}
                />
                <Bar
                  dataKey="offPlan"
                  name="Món ngoài thực đơn"
                  stackId="meals"
                  fill="#3b82f6"
                />
                <Bar
                  dataKey="skipped"
                  name="Chưa ghi nhận"
                  stackId="meals"
                  fill="#cbd5e1"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>

      {/* Synchronized Legend and Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-3.5 border-t border-slate-100">
        {/* Synchronized Legend depending on View Mode */}
        {viewMode === "trend" ? (
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-3 h-1.5 rounded-full bg-[#006857]" />
              <span className="font-semibold text-slate-700">Tỷ lệ tuân thủ thực đơn (%)</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="w-3 border-t border-dashed border-emerald-500" />
              <span className="text-[11px]">Mục tiêu 85%</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3.5 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-[#006857]" />
              <span className="font-semibold text-slate-700">Đúng thực đơn</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-[#3b82f6]" />
              <span className="font-semibold text-slate-700">Món ngoài</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-slate-300" />
              <span className="font-medium text-slate-500">Chưa ghi nhận</span>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => openPanel("menu")}
          className="inline-flex items-center gap-1.5 text-[#006857] hover:text-[#005245] text-xs font-bold transition-colors cursor-pointer group shrink-0"
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
