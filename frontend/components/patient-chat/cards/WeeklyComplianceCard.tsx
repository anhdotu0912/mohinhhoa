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
import type { WeeklyComplianceOut } from "@/lib/types";

interface DailyComplianceDetail {
  day: string;
  pct: number;
  onPlan: number;
  offPlan: number;
  skipped: number;
  target: number;
}

interface WeeklyComplianceCardProps {
  data: WeeklyComplianceOut;
}

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

const DAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const DAY_NAMES: Record<string, string> = {
  T2: "Thứ Hai",
  T3: "Thứ Ba",
  T4: "Thứ Tư",
  T5: "Thứ Năm",
  T6: "Thứ Sáu",
  T7: "Thứ Bảy",
  CN: "Chủ Nhật",
};

function mapComplianceToChart(data: WeeklyComplianceOut): DailyComplianceDetail[] {
  const series = data.daily_series ?? [];
  return series.slice(0, 7).map((point, index) => {
    const pct = point.adherence_pct ?? 0;
    const hasData = point.adherence_pct != null;
    const onPlan = hasData ? Math.max(0, Math.min(3, Math.round((pct / 100) * 3))) : 0;
    let dayLabel = `D${index + 1}`;
    if (point.date) {
      const [year, month, day] = point.date.split("-").map(Number);
      if (year && month && day) {
        const d = new Date(year, month - 1, day);
        const dayOfWeekIndex = (d.getDay() + 6) % 7;
        dayLabel = DAY_LABELS[dayOfWeekIndex] ?? dayLabel;
      }
    }
    return {
      day: dayLabel,
      pct: hasData ? pct : 0,
      onPlan,
      offPlan: 0,
      skipped: hasData ? Math.max(0, 3 - onPlan) : 3,
      target: 85,
    };
  });
}

function CustomTooltip({ active, payload, viewMode }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const row = payload[0].payload;

  return (
    <div className="bg-slate-900/95 backdrop-blur-md text-white px-3.5 py-2.5 rounded-xl shadow-xl border border-slate-700 text-xs flex flex-col gap-1 z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
      <div className="flex items-center justify-between gap-3 border-b border-slate-700/80 pb-1 font-semibold text-slate-200">
        <span>{DAY_NAMES[row.day] || row.day}</span>
        <span className="text-emerald-400 font-bold">{row.pct}% tuân thủ</span>
      </div>

      {viewMode === "trend" ? (
        <div className="flex flex-col gap-0.5 pt-0.5 text-[11px] text-slate-300">
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400">Mục tiêu:</span>
            <span className="font-medium text-slate-200">{row.target}%</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400">Đánh giá:</span>
            <span
              className={`font-semibold ${
                row.pct >= row.target ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              {row.pct >= row.target ? "Đạt chuẩn y khoa" : "Dưới ngưỡng"}
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
            <span className="font-semibold text-white">{row.onPlan} bữa</span>
          </div>
          {row.offPlan > 0 && (
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                Món ngoài:
              </span>
              <span className="font-semibold text-blue-300">{row.offPlan} món</span>
            </div>
          )}
          {row.skipped > 0 && (
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                Chưa ghi:
              </span>
              <span className="font-semibold text-slate-300">{row.skipped} bữa</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface CustomDotProps {
  cx?: number;
  cy?: number;
  value?: number | number[];
  payload?: { pct?: number; day?: string };
  index?: number;
  dataLength: number;
}

function CustomizedDot({ cx, cy, value, payload, index, dataLength }: CustomDotProps) {
  if (cx === undefined || cy === undefined) return null;

  const isLatest = index === dataLength - 1;
  const numValue =
    payload?.pct != null
      ? payload.pct
      : Array.isArray(value)
      ? value[1] ?? value[0]
      : typeof value === "number"
      ? value
      : 0;

  return (
    <g>
      {isLatest && (
        <circle cx={cx} cy={cy} r={9} fill="#006857" opacity={0.18} className="animate-pulse" />
      )}
      <circle
        cx={cx}
        cy={cy}
        r={4.5}
        fill="#006857"
        stroke="#ffffff"
        strokeWidth={2}
        className="drop-shadow-xs"
      />
      <text
        x={cx}
        y={cy - 10}
        textAnchor="middle"
        fill="#005245"
        fontSize={11}
        fontWeight={700}
        fontFamily="inherit"
      >
        {numValue}%
      </text>
    </g>
  );
}

const emptySubscribe = () => () => {};

export function WeeklyComplianceCard({ data }: WeeklyComplianceCardProps) {
  const { openPanel } = usePatientPanel();
  const mounted = React.useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [viewMode, setViewMode] = useState<"trend" | "breakdown">("trend");

  const chartData = useMemo(() => mapComplianceToChart(data), [data]);

  const overallPct = useMemo(() => {
    if (data.overall_adherence_pct != null) return data.overall_adherence_pct;
    const scored = (data.daily_series ?? [])
      .map((row) => row.adherence_pct)
      .filter((pct): pct is number => pct != null);
    if (scored.length === 0) return 0;
    return Math.round(scored.reduce((sum, pct) => sum + pct, 0) / scored.length);
  }, [data]);

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
    <div className="w-full bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-5 shadow-xs flex flex-col gap-3.5 sm:gap-4 mt-1">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-4xl font-extrabold text-[#006857] tracking-tight">
              {overallPct}%
            </span>
            <div className="flex flex-col">
              <span className="text-[11px] sm:text-xs font-bold text-slate-800 uppercase tracking-wider">
                Tỷ lệ tuân thủ tuần
              </span>
              <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium">
                (Trung bình 7 ngày gần nhất)
              </span>
            </div>
          </div>
          <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5">
            {overallPct >= 85
              ? "Bạn đang duy trì thói quen dinh dưỡng rất tốt theo phác đồ điều trị."
              : "Hãy tiếp tục bám sát thực đơn đề xuất để tối ưu hiệu quả kiểm soát bệnh lý."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[11px] sm:text-xs font-bold border shadow-2xs ${statusBadge.style}`}
          >
            <span className="material-symbols-outlined text-[15px] sm:text-[16px]">{statusBadge.icon}</span>
            <span>{statusBadge.label}</span>
          </div>

          <div className="inline-flex p-0.5 rounded-lg bg-slate-100 border border-slate-200/80 text-[10px] sm:text-[11px] font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => setViewMode("trend")}
              className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                viewMode === "trend"
                  ? "bg-white text-[#006857] font-bold shadow-2xs"
                  : "hover:text-slate-900"
              }`}
            >
              Xu hướng
            </button>
            <button
              type="button"
              onClick={() => setViewMode("breakdown")}
              className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
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

      <div className="w-full h-40 sm:h-48 pt-2 pb-1 relative min-w-0">
        {!mounted || chartData.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center bg-slate-50/60 rounded-xl animate-pulse text-xs text-slate-400">
            {chartData.length === 0
              ? "Chưa có dữ liệu tuân thủ tuần này."
              : "Đang chuẩn bị biểu đồ..."}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {viewMode === "trend" ? (
              <AreaChart data={chartData} margin={{ top: 22, right: 20, left: 20, bottom: 4 }}>
                <defs>
                  <linearGradient id="patientComplianceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#006857" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#006857" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <ReferenceLine y={85} stroke="#10b981" strokeDasharray="3 3" strokeOpacity={0.4} />
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
                  cursor={{
                    stroke: "#006857",
                    strokeWidth: 1,
                    strokeDasharray: "3 3",
                    strokeOpacity: 0.3,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="pct"
                  stroke="#006857"
                  strokeWidth={2.75}
                  fill="url(#patientComplianceGrad)"
                  dot={<CustomizedDot dataLength={chartData.length} />}
                  activeDot={{
                    r: 6,
                    fill: "#006857",
                    stroke: "#ffffff",
                    strokeWidth: 2,
                  }}
                  isAnimationActive
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
                <Bar dataKey="onPlan" name="Đúng thực đơn" stackId="meals" fill="#006857" radius={[0, 0, 4, 4]} />
                <Bar dataKey="offPlan" name="Món ngoài thực đơn" stackId="meals" fill="#3b82f6" />
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

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-3.5 border-t border-slate-100">
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
