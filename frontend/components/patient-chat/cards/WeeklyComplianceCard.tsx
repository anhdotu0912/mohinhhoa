"use client";

import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  CartesianGrid,
} from "recharts";
import { usePatientPanel } from "../PatientPanelProvider";
import type { WeeklyComplianceOut } from "@/lib/types";
import {
  mapComplianceWeek,
  toIsoDate,
  parseLocalDate,
  formatWeekRange,
  barFill,
  ChartTooltip,
  PctLabel,
  DayTick,
  TARGET_PCT,
  FILL_HIGH,
  type WeeklyAdherencePoint,
} from "../WeeklyAdherenceChart";

interface WeeklyComplianceCardProps {
  data: WeeklyComplianceOut;
}

interface TrendDotProps {
  cx?: number;
  cy?: number;
  payload?: WeeklyAdherencePoint;
}

function TrendDot({ cx, cy, payload }: TrendDotProps) {
  if (cx === undefined || cy === undefined || !payload?.hasData || payload.pct == null) {
    return null;
  }
  const isHigh = payload.pct >= TARGET_PCT;
  const fillColor = isHigh ? "#006857" : "#d97706";

  return (
    <g>
      {payload.isToday && (
        <circle cx={cx} cy={cy} r={8} fill={fillColor} opacity={0.2} className="animate-pulse" />
      )}
      <circle
        cx={cx}
        cy={cy}
        r={4}
        fill={fillColor}
        stroke="#ffffff"
        strokeWidth={2}
        className="drop-shadow-xs"
      />
      <text
        x={cx}
        y={cy - 8}
        textAnchor="middle"
        fill={fillColor}
        fontSize={10}
        fontWeight={700}
        fontFamily="inherit"
        className="tabular-nums"
      >
        {payload.pct}%
      </text>
    </g>
  );
}

const emptySubscribe = () => () => {};

export function WeeklyComplianceCard({ data }: WeeklyComplianceCardProps) {
  const { openPanel } = usePatientPanel();
  const mounted = React.useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [viewMode, setViewMode] = useState<"trend" | "bar">("trend");

  const todayDateStr = useMemo(() => toIsoDate(new Date()), []);
  const currentDayOfWeekIdx = (new Date().getDay() + 6) % 7;

  // Map to the current calendar week (Monday to Sunday)
  const chartData = useMemo(
    () => mapComplianceWeek(data.daily_series ?? [], todayDateStr, currentDayOfWeekIdx),
    [data.daily_series, todayDateStr, currentDayOfWeekIdx]
  );

  const weekRange = useMemo(() => {
    if (chartData.length < 7) return "";
    const start = parseLocalDate(chartData[0].date);
    const end = parseLocalDate(chartData[6].date);
    if (!start || !end) return "";
    return formatWeekRange(start, end);
  }, [chartData]);

  // Overall compliance calculated strictly on this week's logged days
  const weekPct = useMemo(() => {
    const scored = chartData
      .filter((row) => row.hasData && row.pct != null)
      .map((row) => row.pct as number);
    if (scored.length === 0) return data.overall_adherence_pct ?? null;
    return Math.round(scored.reduce((sum, pct) => sum + pct, 0) / scored.length);
  }, [chartData, data.overall_adherence_pct]);

  const loggedCount = useMemo(
    () => chartData.filter((row) => row.hasData).length,
    [chartData]
  );

  const statusBadge = useMemo(() => {
    if (weekPct == null) {
      return {
        label: "Chưa có dữ liệu",
        icon: "info",
        style: "bg-slate-100 text-slate-600 border-slate-200",
      };
    }
    if (weekPct >= 90) {
      return {
        label: "Xuất sắc",
        icon: "verified",
        style: "bg-emerald-50 text-[#006857] border-emerald-200/90",
      };
    }
    if (weekPct >= TARGET_PCT) {
      return {
        label: "Đạt mục tiêu",
        icon: "trending_up",
        style: "bg-emerald-50 text-emerald-800 border-emerald-200",
      };
    }
    return {
      label: "Cần lưu ý",
      icon: "warning",
      style: "bg-amber-50 text-amber-800 border-amber-200",
    };
  }, [weekPct]);

  return (
    <div className="w-full bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-5 shadow-xs flex flex-col gap-3.5 sm:gap-4 mt-1">
      {/* Header Info & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-4xl font-extrabold text-[#006857] tracking-tight">
              {weekPct != null ? `${weekPct}%` : "—"}
            </span>
            <div className="flex flex-col">
              <span className="text-[11px] sm:text-xs font-bold text-slate-800 uppercase tracking-wider">
                Tỷ lệ tuân thủ tuần này
              </span>
              <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium">
                {weekRange ? `(Tuần: ${weekRange} · ${loggedCount}/7 ngày đã ghi)` : "(Tuần hiện tại)"}
              </span>
            </div>
          </div>
          <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5">
            {weekPct == null
              ? "Hãy ghi nhận bữa ăn trong thực đơn để theo dõi mức độ tuân thủ dinh dưỡng."
              : weekPct >= TARGET_PCT
              ? "Bạn đang duy trì thói quen dinh dưỡng rất tốt theo phác đồ điều trị tuần này."
              : "Hãy tiếp tục bám sát thực đơn đề xuất để tối ưu hiệu quả kiểm soát đường huyết."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Status Badge */}
          <div
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border shadow-2xs shrink-0 ${statusBadge.style}`}
          >
            <span className="material-symbols-outlined text-[16px]">{statusBadge.icon}</span>
            <span>{statusBadge.label}</span>
          </div>

          {/* Mode Switcher: Xu hướng (Area) vs Cột (Bar) */}
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
              onClick={() => setViewMode("bar")}
              className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                viewMode === "bar"
                  ? "bg-white text-[#006857] font-bold shadow-2xs"
                  : "hover:text-slate-900"
              }`}
            >
              Cột
            </button>
          </div>
        </div>
      </div>

      {/* Chart Section (Trend or Bar) */}
      <div className="w-full h-44 sm:h-48 pt-1 pb-1 relative min-w-0">
        {!mounted ? (
          <div className="w-full h-full flex items-center justify-center bg-slate-50/60 rounded-xl animate-pulse text-xs text-slate-400">
            Đang chuẩn bị biểu đồ...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {viewMode === "trend" ? (
              <AreaChart
                data={chartData}
                margin={{ top: 20, right: 14, left: 0, bottom: 8 }}
                className="cursor-pointer"
                onClick={() => openPanel("menu")}
              >
                <defs>
                  <linearGradient id="patientWeeklyTrendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#006857" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#006857" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="4 4" />
                <ReferenceArea y1={TARGET_PCT} y2={100} fill={FILL_HIGH} fillOpacity={0.07} />
                <ReferenceLine
                  y={TARGET_PCT}
                  stroke="#059669"
                  strokeDasharray="4 4"
                  strokeOpacity={0.7}
                />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  height={32}
                  tick={<DayTick chartData={chartData} />}
                />
                <YAxis
                  domain={[0, 100]}
                  ticks={[0, 50, 100]}
                  width={28}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 600, fill: "#94a3b8" }}
                  tickFormatter={(value: number) => `${value}`}
                />
                <Tooltip
                  content={<ChartTooltip targetPct={TARGET_PCT} />}
                  cursor={{
                    stroke: "#006857",
                    strokeWidth: 1,
                    strokeDasharray: "3 3",
                    strokeOpacity: 0.35,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="pct"
                  name="Tuân thủ"
                  stroke="#006857"
                  strokeWidth={2.5}
                  fill="url(#patientWeeklyTrendGrad)"
                  dot={<TrendDot />}
                  activeDot={{
                    r: 5.5,
                    fill: "#006857",
                    stroke: "#ffffff",
                    strokeWidth: 2,
                  }}
                  connectNulls
                  isAnimationActive
                  animationDuration={350}
                />
              </AreaChart>
            ) : (
              <BarChart
                data={chartData}
                margin={{ top: 18, right: 10, left: 0, bottom: 8 }}
                barCategoryGap="22%"
                className="cursor-pointer"
                onClick={() => openPanel("menu")}
              >
                <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="4 4" />
                <ReferenceArea y1={TARGET_PCT} y2={100} fill={FILL_HIGH} fillOpacity={0.07} />
                <ReferenceLine
                  y={TARGET_PCT}
                  stroke="#059669"
                  strokeDasharray="4 4"
                  strokeOpacity={0.7}
                />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  height={32}
                  tick={<DayTick chartData={chartData} />}
                />
                <YAxis
                  domain={[0, 100]}
                  ticks={[0, 50, 100]}
                  width={28}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 600, fill: "#94a3b8" }}
                  tickFormatter={(value: number) => `${value}`}
                />
                <Tooltip
                  content={<ChartTooltip targetPct={TARGET_PCT} />}
                  cursor={{ fill: "#e2e8f0", opacity: 0.45 }}
                />
                <Bar
                  dataKey="barValue"
                  name="Tuân thủ"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={32}
                  minPointSize={0}
                  isAnimationActive
                  animationDuration={300}
                  background={{ fill: "#e2e8f0", radius: 6 }}
                  label={<PctLabel chartData={chartData} targetPct={TARGET_PCT} />}
                >
                  {chartData.map((row) => (
                    <Cell
                      key={row.date}
                      fill={barFill(row, TARGET_PCT)}
                      stroke={row.isSelected ? FILL_HIGH : "transparent"}
                      strokeWidth={row.isSelected ? 2 : 0}
                    />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer Legend & Action */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-3.5 border-t border-slate-100">
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[11px] text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#006857]" />
            Đạt chuẩn (≥{TARGET_PCT}%)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#d97706]" />
            Cần lưu ý
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#cbd5e1]" />
            Chưa ghi
          </span>
          <span className="inline-flex items-center gap-1.5 text-slate-500">
            <span className="w-3 border-t border-dashed border-emerald-600" />
            Vùng mục tiêu
          </span>
        </div>

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
