"use client";

import React, { useMemo } from "react";
import {
  ResponsiveContainer,
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
import type { ComplianceDayPoint } from "@/lib/types";

const DAY_SHORT = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"] as const;
const DAY_FULL = [
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
  "Chủ Nhật",
] as const;

const TARGET_PCT = 85;
const FILL_HIGH = "#006857";
const FILL_HIGH_SELECTED = "#005245";
const FILL_LOW = "#d97706";
const FILL_LOW_SELECTED = "#b45309";
const FILL_EMPTY = "#cbd5e1";

export interface WeeklyAdherencePoint {
  dayIndex: number;
  label: string;
  full: string;
  date: string;
  dateLabel: string;
  pct: number | null;
  barValue: number | null;
  hasData: boolean;
  isToday: boolean;
  isFuture: boolean;
  isSelected: boolean;
}

interface WeeklyAdherenceChartProps {
  series: ComplianceDayPoint[];
  todayDateStr: string;
  selectedDayIndex: number;
  onSelectDay: (index: number) => void;
  loading?: boolean;
  targetPct?: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: WeeklyAdherencePoint }>;
  targetPct: number;
}

const emptySubscribe = () => () => {};

function parseLocalDate(iso: string): Date | null {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function toIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function mondayOfWeek(today: Date): Date {
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

function formatWeekRange(start: Date, end: Date): string {
  const fmt = (d: Date) => `${d.getDate()}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  return `${fmt(start)} – ${fmt(end)}`;
}

function barFill(row: WeeklyAdherencePoint, targetPct: number): string {
  if (!row.hasData) return FILL_EMPTY;
  const high = (row.pct ?? 0) >= targetPct;
  if (row.isSelected) return high ? FILL_HIGH_SELECTED : FILL_LOW_SELECTED;
  return high ? FILL_HIGH : FILL_LOW;
}

function ChartTooltip({ active, payload, targetPct }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;

  let status: { text: string; className: string };
  if (row.isFuture) {
    status = { text: "Chưa tới", className: "text-slate-300" };
  } else if (!row.hasData) {
    status = { text: "Chưa ghi nhận", className: "text-slate-300" };
  } else if ((row.pct ?? 0) >= targetPct) {
    status = { text: "Đạt chuẩn", className: "text-emerald-400" };
  } else {
    status = { text: "Cần lưu ý", className: "text-amber-400" };
  }

  const pctClass = row.hasData
    ? (row.pct ?? 0) >= targetPct
      ? "text-emerald-400"
      : "text-amber-400"
    : "text-slate-300";

  return (
    <div className="bg-slate-900 text-white px-3 py-2.5 rounded-xl shadow-[0_8px_24px_rgba(15,23,42,0.28)] border border-slate-700 text-xs flex flex-col gap-1 z-50 pointer-events-none">
      <div className="flex items-center justify-between gap-4 border-b border-slate-700/80 pb-1">
        <span className="font-semibold text-slate-200">
          {row.full}
          <span className="text-slate-400 font-medium"> · {row.dateLabel}</span>
        </span>
        <span className={`font-bold tabular-nums ${pctClass}`}>
          {row.hasData ? `${row.pct}%` : "—"}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4 pt-0.5 text-[11px]">
        <span className="text-slate-400">Đánh giá</span>
        <span className={`font-semibold ${status.className}`}>{status.text}</span>
      </div>
    </div>
  );
}

interface PctLabelProps {
  x?: number;
  y?: number;
  width?: number;
  index?: number;
  chartData: WeeklyAdherencePoint[];
  targetPct: number;
}

function PctLabel({ x = 0, y = 0, width = 0, index = 0, chartData, targetPct }: PctLabelProps) {
  const row = chartData[index];
  if (!row?.hasData || row.pct == null) return null;
  const fill = row.pct >= targetPct ? FILL_HIGH_SELECTED : FILL_LOW_SELECTED;
  return (
    <text
      x={x + width / 2}
      y={y - 6}
      textAnchor="middle"
      fill={fill}
      fontSize={10}
      fontWeight={700}
      fontFamily="inherit"
      className="tabular-nums"
    >
      {row.pct}%
    </text>
  );
}

interface DayTickProps {
  x?: number;
  y?: number;
  payload?: { value: string; index: number };
  chartData: WeeklyAdherencePoint[];
}

function DayTick({ x = 0, y = 0, payload, chartData }: DayTickProps) {
  const row = chartData[payload?.index ?? -1];
  if (!row) return null;
  const active = row.isSelected || row.isToday;
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        dy={12}
        textAnchor="middle"
        fontSize={11}
        fontWeight={active ? 800 : 600}
        fill={active ? FILL_HIGH : row.isFuture ? "#94a3b8" : "#64748b"}
        fontFamily="inherit"
      >
        {row.label}
      </text>
      {row.isToday && <circle cx={0} cy={22} r={2.25} fill={FILL_HIGH} />}
    </g>
  );
}

export function mapComplianceWeek(
  series: ComplianceDayPoint[],
  todayDateStr: string,
  selectedDayIndex: number
): WeeklyAdherencePoint[] {
  const today = parseLocalDate(todayDateStr);
  if (!today) return [];
  const monday = mondayOfWeek(today);
  const byDate = new Map(series.map((point) => [point.date, point.adherence_pct]));

  return DAY_SHORT.map((label, dayIndex) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + dayIndex);
    const iso = toIsoDate(date);
    const pct = byDate.has(iso) ? (byDate.get(iso) ?? null) : null;
    const hasData = pct != null;
    return {
      dayIndex,
      label,
      full: DAY_FULL[dayIndex],
      date: iso,
      dateLabel: `${date.getDate()}/${String(date.getMonth() + 1).padStart(2, "0")}`,
      pct,
      barValue: hasData ? Math.max(pct, 1) : 0,
      hasData,
      isToday: iso === todayDateStr,
      isFuture: iso > todayDateStr,
      isSelected: dayIndex === selectedDayIndex,
    };
  });
}

export function WeeklyAdherenceChart({
  series,
  todayDateStr,
  selectedDayIndex,
  onSelectDay,
  loading = false,
  targetPct = TARGET_PCT,
}: WeeklyAdherenceChartProps) {
  const mounted = React.useSyncExternalStore(emptySubscribe, () => true, () => false);

  const chartData = useMemo(
    () => mapComplianceWeek(series, todayDateStr, selectedDayIndex),
    [series, todayDateStr, selectedDayIndex]
  );

  const weekRange = useMemo(() => {
    if (chartData.length < 7) return "";
    const start = parseLocalDate(chartData[0].date);
    const end = parseLocalDate(chartData[6].date);
    if (!start || !end) return "";
    return formatWeekRange(start, end);
  }, [chartData]);

  const weekPct = useMemo(() => {
    const scored = chartData.filter((row) => row.hasData).map((row) => row.pct as number);
    if (scored.length === 0) return null;
    return Math.round(scored.reduce((sum, pct) => sum + pct, 0) / scored.length);
  }, [chartData]);

  const badge =
    weekPct == null
      ? { label: "Chưa có dữ liệu", className: "text-slate-600 bg-slate-100 border-slate-200" }
      : weekPct >= targetPct
        ? { label: `${weekPct}% đạt chuẩn`, className: "text-[#006857] bg-emerald-50 border-emerald-200" }
        : { label: `${weekPct}% cần lưu ý`, className: "text-amber-800 bg-amber-50 border-amber-200" };

  const loggedCount = chartData.filter((row) => row.hasData).length;

  return (
    <section
      aria-labelledby="weekly-adherence-heading"
      className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 flex flex-col gap-3"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="weekly-adherence-heading" className="text-sm font-bold text-slate-900">
            Tuân thủ tuần này
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {weekRange}
            {loggedCount > 0 ? ` · ${loggedCount}/7 ngày đã ghi` : " · Ghi nhận bữa để hiện biểu đồ"}
          </p>
        </div>
        <span
          className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full border tabular-nums ${badge.className}`}
        >
          {badge.label}
        </span>
      </header>
      <p className="sr-only">
        {weekPct == null
          ? "Chưa có dữ liệu tuân thủ tuần này."
          : `Trung bình tuân thủ tuần này ${weekPct} phần trăm, dựa trên ${loggedCount} ngày đã ghi nhận.`}
      </p>

      <div className="h-44 w-full">
        {loading || !mounted ? (
          <div
            className="h-full w-full rounded-lg bg-white/70 border border-slate-200/70 animate-pulse"
            aria-hidden
          />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 18, right: 10, left: 0, bottom: 10 }}
              barCategoryGap="22%"
              className="cursor-pointer"
              onClick={(state) => {
                const index = state.activeTooltipIndex;
                if (typeof index === "number") {
                  onSelectDay(index);
                  return;
                }
                if (typeof index === "string" && index !== "") {
                  const parsed = Number(index);
                  if (Number.isFinite(parsed)) onSelectDay(parsed);
                }
              }}
            >
              <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="4 4" />
              <ReferenceArea y1={targetPct} y2={100} fill={FILL_HIGH} fillOpacity={0.07} />
              <ReferenceLine
                y={targetPct}
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
                content={<ChartTooltip targetPct={targetPct} />}
                cursor={{ fill: "#e2e8f0", opacity: 0.45 }}
              />
              <Bar
                dataKey="barValue"
                name="Tuân thủ"
                radius={[6, 6, 0, 0]}
                maxBarSize={32}
                minPointSize={0}
                isAnimationActive
                animationDuration={240}
                background={{ fill: "#e2e8f0", radius: 6 }}
                label={<PctLabel chartData={chartData} targetPct={targetPct} />}
              >
                {chartData.map((row) => (
                  <Cell
                    key={row.date}
                    fill={barFill(row, targetPct)}
                    stroke={row.isSelected ? FILL_HIGH : "transparent"}
                    strokeWidth={row.isSelected ? 2 : 0}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[11px] text-slate-600 pt-0.5">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#006857]" />
          Đạt chuẩn (≥{targetPct}%)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-600" />
          Cần lưu ý
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-slate-300" />
          Chưa ghi
        </span>
        <span className="inline-flex items-center gap-1.5 ml-auto text-slate-500">
          <span className="w-3 border-t border-dashed border-emerald-600" />
          Vùng mục tiêu
        </span>
      </div>
    </section>
  );
}
