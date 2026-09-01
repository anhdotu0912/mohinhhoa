"use client";

import { useMemo, useRef, useState, type MouseEvent } from "react";
import type { MetricsHistoryPoint } from "@/lib/types";
import {
  METRIC_SERIES,
  parseBpPair,
  parseGlucoseMmol,
  type MetricSeriesDef,
  type MetricSeriesId,
} from "@/lib/metrics-series";

const VIEW_W = 640;
const VIEW_H = 168;
const PAD = { top: 16, right: 16, bottom: 12, left: 44 };
const HISTORY_DAYS = 7;
/** Minimum observed points in the 7-day window before we're willing to call a
 *  direction at all — below this, day-to-day noise dominates any real signal. */
const MIN_TREND_POINTS = 4;
/** How many future days the weight goal line reaches out to. */
const GOAL_LINE_DAYS = 7;
/** ADA Medical Nutrition Therapy: safe weight-loss pace is 0.5–1 kg/week; this
 *  is the midpoint used to draw the goal line. Unlike the old forecast, this
 *  number comes from a clinical guideline, not from extrapolating the
 *  patient's own noisy self-reported readings. */
const SAFE_WEIGHT_LOSS_KG_PER_WEEK = 0.75;

type DayPoint = {
  key: string;
  label: string;
  isToday: boolean;
  recordedAt?: string;
  values: Record<MetricSeriesId, number | null>;
  display: Record<MetricSeriesId, string | null>;
};

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function readSeriesValue(point: MetricsHistoryPoint, id: MetricSeriesId): number | null {
  const bp = parseBpPair(point.blood_pressure);
  switch (id) {
    case "weight":
      return point.weight ?? null;
    case "bmi":
      return point.bmi ?? null;
    case "waist":
      return point.waist_cm ?? null;
    case "systolic":
      return point.systolic ?? bp.sys;
    case "diastolic":
      return point.diastolic ?? bp.dia;
    case "glucose_fasting":
      return point.glucose_fasting ?? parseGlucoseMmol(point.blood_glucose);
    case "glucose_postprandial":
      return point.glucose_postprandial ?? null;
    case "hba1c":
      return point.hba1c ?? null;
    default:
      return null;
  }
}

function formatValue(id: MetricSeriesId, value: number | null, unit: string): string | null {
  if (value == null) return null;
  const text =
    id === "weight" || id === "bmi" || id === "hba1c" || id.startsWith("glucose")
      ? String(value)
      : String(Math.round(value));
  return unit ? `${text} ${unit}` : text;
}

function emptyValues(): Record<MetricSeriesId, number | null> {
  return {
    weight: null,
    glucose_fasting: null,
    glucose_postprandial: null,
    systolic: null,
    diastolic: null,
    bmi: null,
    waist: null,
    hba1c: null,
  };
}

function emptyDisplay(): Record<MetricSeriesId, string | null> {
  return {
    weight: null,
    glucose_fasting: null,
    glucose_postprandial: null,
    systolic: null,
    diastolic: null,
    bmi: null,
    waist: null,
    hba1c: null,
  };
}

function buildDays(history: MetricsHistoryPoint[]): DayPoint[] {
  const today = startOfLocalDay(new Date());
  const latestByDay = new Map<string, MetricsHistoryPoint>();
  for (const point of history) {
    const key = localDateKey(new Date(point.recorded_at));
    const prev = latestByDay.get(key);
    if (!prev || new Date(point.recorded_at) > new Date(prev.recorded_at)) {
      latestByDay.set(key, point);
    }
  }

  return Array.from({ length: HISTORY_DAYS }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (HISTORY_DAYS - 1 - i));
    const key = localDateKey(date);
    const isToday = i === HISTORY_DAYS - 1;
    const point = latestByDay.get(key);
    const values = emptyValues();
    const display = emptyDisplay();
    for (const series of METRIC_SERIES) {
      const value = point ? readSeriesValue(point, series.id) : null;
      values[series.id] = value;
      display[series.id] = formatValue(series.id, value, series.unit);
    }
    return {
      key,
      label: isToday
        ? "Hôm nay"
        : date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }),
      isToday,
      recordedAt: point?.recorded_at,
      values,
      display,
    };
  });
}

type LinearFit = { slope: number; rmse: number; firstIndex: number; lastIndex: number };

function computeLinearFit(values: Array<number | null>): LinearFit | null {
  const pts: { x: number; y: number }[] = [];
  values.forEach((v, x) => {
    if (v != null) pts.push({ x, y: v });
  });
  if (pts.length < MIN_TREND_POINTS) return null;
  const n = pts.length;
  const sumX = pts.reduce((s, p) => s + p.x, 0);
  const sumY = pts.reduce((s, p) => s + p.y, 0);
  const sumXY = pts.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = pts.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const residuals = pts.map((p) => p.y - (intercept + slope * p.x));
  const rmse = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / n);
  return { slope, rmse, firstIndex: pts[0].x, lastIndex: pts[pts.length - 1].x };
}

type TrendDirection = "up" | "down" | "stable";

/**
 * Purely qualitative trend classification — deliberately does NOT extrapolate
 * or surface any future value. A linear fit's total drift across the observed
 * span is compared against its own residual noise (rmse): if the drift is
 * smaller than the day-to-day noise, we call it "stable" rather than
 * asserting a direction we can't actually support. There is no validated
 * clinical model behind trend forecasting from a handful of self-reported
 * daily readings, so this only ever labels direction, never magnitude.
 */
function classifyTrend(fit: LinearFit | null): TrendDirection | null {
  if (!fit) return null;
  const span = fit.lastIndex - fit.firstIndex;
  if (span <= 0) return null;
  const totalDrift = fit.slope * span;
  const noiseFloor = Math.max(fit.rmse, 1e-6);
  if (Math.abs(totalDrift) < noiseFloor) return "stable";
  return totalDrift > 0 ? "up" : "down";
}

function yDomain(values: number[], extra: number[] = []): [number, number] {
  const all = [...values, ...extra];
  if (all.length === 0) return [0, 1];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = Math.max(max - min, 0.8);
  const pad = span * 0.18;
  return [min - pad, max + pad];
}

function plotX(index: number, n: number): number {
  const left = PAD.left;
  const right = VIEW_W - PAD.right;
  if (n <= 1) return (left + right) / 2;
  return left + (index / (n - 1)) * (right - left);
}

function plotY(value: number, domain: [number, number]): number {
  const [min, max] = domain;
  const t = max === min ? 0.5 : (value - min) / (max - min);
  return VIEW_H - PAD.bottom - t * (VIEW_H - PAD.top - PAD.bottom);
}

function linePath(
  days: DayPoint[],
  getValue: (d: DayPoint, i: number) => number | null,
  domain: [number, number],
  total = days.length
): string {
  let d = "";
  let drawing = false;
  days.forEach((day, i) => {
    const value = getValue(day, i);
    if (value == null) return;
    d += `${drawing ? "L" : "M"} ${plotX(i, total)} ${plotY(value, domain)} `;
    drawing = true;
  });
  return d.trim();
}

function observedCount(days: DayPoint[], id: MetricSeriesId): number {
  return days.filter((d) => d.values[id] != null).length;
}

function lastObservedIndexFor(days: DayPoint[], id: MetricSeriesId): number | null {
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].values[id] != null) return i;
  }
  return null;
}

type WeightGoal = {
  lastObservedIndex: number;
  /** Goal-line value at each rendered day index (null before the anchor point). */
  values: Array<number | null>;
};

/**
 * Deterministic reference line: from the patient's real last-recorded weight,
 * project forward at the ADA-recommended SAFE pace (not the patient's own
 * trend). This is fundamentally different from the forecast that was removed
 * — it never claims to know what will happen to the patient, it only draws
 * what the guideline-recommended pace looks like so they can compare their
 * real progress against a fixed, cited target rate.
 */
function computeWeightGoal(historyDays: DayPoint[], totalLength: number): WeightGoal | null {
  const lastIdx = lastObservedIndexFor(historyDays, "weight");
  if (lastIdx == null) return null;
  const lastValue = historyDays[lastIdx].values.weight;
  if (lastValue == null) return null;

  const bmiIdx = lastObservedIndexFor(historyDays, "bmi");
  const latestBmi = bmiIdx != null ? historyDays[bmiIdx].values.bmi : null;
  const suggestWeightLoss = (latestBmi ?? 23) >= 23;
  if (!suggestWeightLoss) return null;

  const perDay = -(SAFE_WEIGHT_LOSS_KG_PER_WEEK / 7);
  const values: Array<number | null> = Array.from({ length: totalLength }, (_, i) => {
    if (i < lastIdx) return null;
    return Math.round((lastValue + perDay * (i - lastIdx)) * 100) / 100;
  });
  return { lastObservedIndex: lastIdx, values };
}

function formatTick(value: number, series: MetricSeriesDef): string {
  if (series.id === "weight" || series.id.startsWith("glucose") || series.id === "hba1c" || series.id === "bmi") {
    return value.toFixed(1).replace(/\.0$/, "");
  }
  return String(Math.round(value));
}

/** Formats the fitted slope as a real, already-observed rate of change per day
 *  (e.g. "0.24 mmol/L/ngày") — a descriptive statistic of the past 7 days,
 *  never a projection of a future value. */
function formatRate(slopePerDay: number, series: MetricSeriesDef): string {
  const decimals = series.id === "systolic" || series.id === "diastolic" || series.id === "waist" ? 1 : 2;
  const magnitude = Math.abs(slopePerDay).toFixed(decimals);
  return series.unit ? `${magnitude} ${series.unit}/ngày` : `${magnitude}/ngày`;
}

const TREND_META: Record<TrendDirection, { icon: string; label: string }> = {
  up: { icon: "trending_up", label: "Đang tăng" },
  down: { icon: "trending_down", label: "Đang giảm" },
  stable: { icon: "trending_flat", label: "Đang ổn định" },
};

function TrendChip({ direction }: { direction: TrendDirection }) {
  const meta = TREND_META[direction];
  // All tracked series (glucose, BP, weight, BMI, waist, HbA1c) trend toward
  // their clinical target by decreasing — consistent with calculateMetricDelta
  // in metrics-series.ts, which uses the same "lower is better" convention.
  const isFavorable = direction !== "up";
  const classes = isFavorable
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : "bg-amber-50 text-amber-800 border-amber-200";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${classes}`}>
      <span className="material-symbols-outlined text-[14px]">{meta.icon}</span>
      {meta.label}
    </span>
  );
}

/** Tap-to-reveal explanation — keeps legend/disclaimer text out of the default
 *  view so the chart reads clean, while the full wording stays one tap away. */
function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        className="w-4 h-4 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer shrink-0"
        aria-label="Xem giải thích"
        aria-expanded={open}
      >
        <span className="material-symbols-outlined text-[14px]">info</span>
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-20 top-5 left-0 w-56 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[10.5px] leading-relaxed text-slate-600 shadow-[0_8px_20px_rgba(15,23,42,0.14)]"
        >
          {text}
        </span>
      )}
    </span>
  );
}

type Props = {
  history: MetricsHistoryPoint[];
  loading?: boolean;
};

export function MetricsOverlayChart({ history, loading = false }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState<MetricSeriesId>("glucose_fasting");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const historyDays = useMemo(() => buildDays(history), [history]);

  const weightGoal = useMemo(
    () => (focused === "weight" ? computeWeightGoal(historyDays, HISTORY_DAYS + GOAL_LINE_DAYS) : null),
    [historyDays, focused]
  );

  const days = useMemo(() => {
    if (!weightGoal) return historyDays;
    const goalDays: DayPoint[] = Array.from({ length: GOAL_LINE_DAYS }, (_, i) => {
      const dayNum = i + 1;
      return {
        key: `goal-${dayNum}`,
        label: dayNum === 1 ? "Mục tiêu" : dayNum === GOAL_LINE_DAYS ? `+${GOAL_LINE_DAYS} ngày` : "",
        isToday: false,
        values: emptyValues(),
        display: emptyDisplay(),
      };
    });
    return [...historyDays, ...goalDays];
  }, [historyDays, weightGoal]);

  const hasAny = historyDays.some((d) => METRIC_SERIES.some((s) => d.values[s.id] != null));
  const focusedSeries = METRIC_SERIES.find((s) => s.id === focused) ?? METRIC_SERIES[0];
  const visible = [focusedSeries];

  const focusedFit = useMemo(
    () => computeLinearFit(historyDays.map((d) => d.values[focused])),
    [historyDays, focused]
  );
  const focusedTrend = useMemo(() => classifyTrend(focusedFit), [focusedFit]);

  const focusedDomain = useMemo(() => {
    const observed = historyDays.map((d) => d.values[focused]).filter((v): v is number => v != null);
    const extra: number[] = [];
    if (focusedSeries.targetMax != null) extra.push(focusedSeries.targetMax);
    if (focusedSeries.targetMin != null) extra.push(focusedSeries.targetMin);
    if (weightGoal) extra.push(...weightGoal.values.filter((v): v is number => v != null));
    return yDomain(observed, extra);
  }, [historyDays, focused, focusedSeries, weightGoal]);

  const onChip = (id: MetricSeriesId) => {
    setFocused(id);
  };

  const onMove = (event: MouseEvent<HTMLDivElement>) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || days.length === 0) return;
    const x = event.clientX - rect.left;
    const left = rect.width * (PAD.left / VIEW_W);
    const right = rect.width * (1 - PAD.right / VIEW_W);
    const t = (x - left) / (right - left);
    const index = Math.round(Math.min(1, Math.max(0, t)) * (days.length - 1));
    setHoverIndex(index);
  };

  const ticks = [0, 0.5, 1].map((t) => focusedDomain[0] + t * (focusedDomain[1] - focusedDomain[0]));
  const focusedPointCount = observedCount(historyDays, focused);
  const canShowTrend = focusedPointCount >= MIN_TREND_POINTS && focusedTrend != null;
  const targetMax = focusedSeries.targetMax ?? null;
  const targetY = targetMax != null ? plotY(targetMax, focusedDomain) : null;

  return (
    <section className="space-y-3.5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-1">
            <h3 className="font-bold text-sm text-slate-900">Xu hướng 7 ngày qua</h3>
            <InfoTooltip
              text={`Nét liền là các lần đã ghi trong 7 ngày qua · đường ngang là mục tiêu lâm sàng${
                weightGoal ? " · nét chấm là đường mục tiêu tham khảo theo tốc độ an toàn ADA" : ""
              }`}
            />
          </div>
          <p className="text-xs text-slate-500 font-medium">Chọn 1 chỉ số để theo dõi</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {METRIC_SERIES.map((series) => {
          const isFocus = focused === series.id;
          return (
            <button
              key={series.id}
              type="button"
              onClick={() => onChip(series.id)}
              aria-pressed={isFocus}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                isFocus
                  ? "text-white shadow-2xs border-transparent scale-102"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border-slate-200"
              }`}
              style={
                isFocus
                  ? { backgroundColor: series.color, borderColor: series.color }
                  : undefined
              }
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: isFocus ? "#ffffff" : series.color }}
              />
              {series.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="h-40 rounded-xl bg-slate-50 border border-slate-200/80 animate-pulse" />
      ) : !hasAny ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-10 text-center">
          <p className="text-sm font-semibold text-slate-800">Chưa có dữ liệu 7 ngày qua</p>
          <p className="text-xs text-slate-500 mt-1">
            Bấm «Ghi nhận chỉ số mới» để bắt đầu theo dõi xu hướng.
          </p>
        </div>
      ) : (
        <div
          ref={wrapRef}
          className="relative rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 pt-4 pb-2 cursor-crosshair select-none"
          onMouseMove={onMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <div className="relative h-[168px] w-full">
            <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full h-full overflow-visible" role="img" aria-label="Biểu đồ chỉ số 7 ngày">
              {ticks.map((tick) => {
                const y = plotY(tick, focusedDomain);
                return (
                  <g key={tick}>
                    <line
                      x1={PAD.left}
                      x2={VIEW_W - PAD.right}
                      y1={y}
                      y2={y}
                      stroke="#94a3b8"
                      strokeOpacity="0.35"
                    />
                    <text
                      x={PAD.left - 8}
                      y={y}
                      textAnchor="end"
                      dominantBaseline="middle"
                      fill="#475569"
                      fontSize="11"
                      fontFamily="inherit"
                    >
                      {formatTick(tick, focusedSeries)}
                    </text>
                  </g>
                );
              })}

              <defs>
                <linearGradient id="safeZoneGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity="0.10" />
                  <stop offset="100%" stopColor="#10B981" stopOpacity="0.03" />
                </linearGradient>
              </defs>

              {/* Safe Target Zone Band — Clamped strictly within chart bounds */}
              {focusedSeries.targetMax != null && (() => {
                const chartTop = PAD.top;
                const chartBottom = VIEW_H - PAD.bottom;
                const rawTopY = plotY(focusedSeries.targetMax, focusedDomain);
                const rawBottomY = focusedSeries.targetMin != null
                  ? plotY(focusedSeries.targetMin, focusedDomain)
                  : chartBottom;
                const bandTop = Math.max(chartTop, Math.min(chartBottom, Math.min(rawTopY, rawBottomY)));
                const bandBottom = Math.max(chartTop, Math.min(chartBottom, Math.max(rawTopY, rawBottomY)));
                const safeHeight = Math.max(0, bandBottom - bandTop);

                return safeHeight > 0 ? (
                  <rect
                    x={PAD.left}
                    y={bandTop}
                    width={VIEW_W - PAD.left - PAD.right}
                    height={safeHeight}
                    fill="url(#safeZoneGrad)"
                    rx="3"
                  />
                ) : null;
              })()}

              {weightGoal && (
                <line
                  x1={plotX(weightGoal.lastObservedIndex, days.length)}
                  x2={plotX(weightGoal.lastObservedIndex, days.length)}
                  y1={PAD.top}
                  y2={VIEW_H - PAD.bottom}
                  stroke="#0F766E"
                  strokeOpacity="0.2"
                  strokeDasharray="3 4"
                />
              )}

              {visible.map((series) => {
                const domain = focusedDomain;
                const observedPath = linePath(days, (d) => d.values[series.id], domain, days.length);
                const goalPath =
                  series.id === "weight" && weightGoal
                    ? linePath(days, (_d, i) => weightGoal.values[i] ?? null, domain, days.length)
                    : "";
                return (
                  <g key={series.id}>
                    {goalPath && (
                      <path
                        d={goalPath}
                        fill="none"
                        stroke={series.color}
                        strokeWidth={1.75}
                        strokeDasharray="5 4"
                        strokeLinecap="round"
                        opacity={0.6}
                        vectorEffect="non-scaling-stroke"
                      />
                    )}
                    {observedPath && (
                      <path
                        d={observedPath}
                        fill="none"
                        stroke={series.color}
                        strokeWidth={series.id === focused ? 2.6 : 2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={series.id === focused ? 1 : 0.72}
                        vectorEffect="non-scaling-stroke"
                      />
                    )}
                    {days.map((day, i) => {
                      const value = day.values[series.id];
                      if (value == null) return null;
                      const active = hoverIndex === i;
                      return (
                        <circle
                          key={`${series.id}-${day.key}`}
                          cx={plotX(i, days.length)}
                          cy={plotY(value, domain)}
                          r={active || (day.isToday && series.id === focused) ? 5 : 3.5}
                          fill={series.color}
                          stroke="#ffffff"
                          strokeWidth="1.75"
                        />
                      );
                    })}
                  </g>
                );
              })}

              {targetY != null && targetMax != null && (
                <g>
                  <line
                    x1={PAD.left}
                    x2={VIEW_W - PAD.right}
                    y1={targetY}
                    y2={targetY}
                    stroke="#ffffff"
                    strokeWidth="5"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  <line
                    x1={PAD.left}
                    x2={VIEW_W - PAD.right}
                    y1={targetY}
                    y2={targetY}
                    stroke={focusedSeries.color}
                    strokeWidth="2.75"
                    strokeDasharray="8 5"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              )}

              {hoverIndex != null && (
                <line
                  x1={plotX(hoverIndex, days.length)}
                  x2={plotX(hoverIndex, days.length)}
                  y1={PAD.top - 4}
                  y2={VIEW_H - PAD.bottom + 4}
                  stroke="#334155"
                  strokeOpacity="0.28"
                />
              )}
            </svg>
            {targetY != null && targetMax != null && (
              <div
                className="pointer-events-none absolute z-[1] -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${((PAD.left + VIEW_W - PAD.right) / 2 / VIEW_W) * 100}%`,
                  top: `${(targetY / VIEW_H) * 100}%`,
                }}
              >
                <span
                  className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold tabular-nums shadow-[0_2px_8px_rgba(15,23,42,0.14)]"
                  style={{
                    color: focusedSeries.color,
                    border: `1.5px solid ${focusedSeries.color}`,
                  }}
                >
                  Mục tiêu {formatTick(targetMax, focusedSeries)}
                  {focusedSeries.unit ? ` ${focusedSeries.unit}` : ""}
                </span>
              </div>
            )}
          </div>

          <div className="relative h-5 mt-0.5">
            {days.map((day, i) =>
              day.label ? (
                <span
                  key={day.key}
                  className={`absolute top-0 whitespace-nowrap text-[11px] font-medium tabular-nums -translate-x-1/2 ${
                    day.isToday ? "text-[#006857] font-bold" : "text-slate-500"
                  }`}
                  style={{ left: `${(plotX(i, days.length) / VIEW_W) * 100}%` }}
                >
                  {day.label}
                </span>
              ) : null
            )}
          </div>

          {weightGoal && (
            <div className="mt-2 flex items-center gap-1 text-[11px] text-sky-800">
              <span className="inline-block w-3 border-t-2 border-dashed border-sky-500 shrink-0" />
              <span className="font-semibold">Đường mục tiêu ADA (~{SAFE_WEIGHT_LOSS_KG_PER_WEEK} kg/tuần)</span>
              <InfoTooltip text="Tính từ cân nặng thật gần nhất của bạn theo tốc độ giảm cân an toàn ADA — không phải dự đoán kết quả, chỉ để so sánh tiến độ thực tế với mục tiêu." />
            </div>
          )}

          {!canShowTrend ? (
            <div className="mt-2 p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200/70 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-emerald-800 font-medium">
                <span className="material-symbols-outlined text-[16px] text-[#006857]">tips_and_updates</span>
                <span>
                  {focusedPointCount === 0
                    ? `Chưa có dữ liệu ${focusedSeries.label.toLowerCase()} trong 7 ngày qua.`
                    : `Đã có dữ liệu ${focusedPointCount}/${MIN_TREND_POINTS} ngày trong tuần (mỗi ngày là 1 mốc). Ghi thêm các ngày tiếp theo để xem xu hướng.`}
                </span>
              </span>
              <span className="text-[11px] font-bold text-[#006857] shrink-0">
                Chuẩn: {focusedSeries.targetDesc}
              </span>
            </div>
          ) : (
            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-500 font-medium">Xu hướng {focusedSeries.label.toLowerCase()}:</span>
                  <TrendChip direction={focusedTrend as TrendDirection} />
                  <InfoTooltip text="Đây là thống kê mô tả dữ liệu bạn tự ghi trong 7 ngày qua, chỉ mang tính tham khảo — không phải dự đoán y khoa và không thay thế chỉ định của bác sĩ." />
                </div>
                <span className="text-[11px] font-semibold text-slate-700 shrink-0">Mục tiêu: {focusedSeries.targetDesc}</span>
              </div>
              {focusedTrend !== "stable" && focusedFit != null ? (
                <p className="text-[11px] text-slate-600">
                  Tốc độ thay đổi trung bình đã ghi nhận:{" "}
                  <span className="font-bold text-slate-800">
                    {formatRate(focusedFit.slope, focusedSeries)}
                  </span>{" "}
                  trong 7 ngày qua.
                </p>
              ) : (
                <p className="text-[11px] text-slate-600">
                  Dao động trong khoảng đo lường bình thường, chưa thấy xu hướng rõ rệt.
                </p>
              )}
            </div>
          )}

          {hoverIndex != null && days[hoverIndex] && (
            <div
              className="pointer-events-none absolute z-10 min-w-[190px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-[0_8px_24px_rgba(15,23,42,0.14)]"
              style={{
                left: `${(plotX(hoverIndex, days.length) / VIEW_W) * 100}%`,
                top: 8,
                transform:
                  hoverIndex > days.length / 2 ? "translateX(-108%)" : "translateX(8px)",
              }}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5 pb-1 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-900">
                  {days[hoverIndex].isToday
                    ? "Hôm nay"
                    : hoverIndex >= HISTORY_DAYS
                      ? `Mục tiêu +${hoverIndex - HISTORY_DAYS + 1} ngày`
                      : days[hoverIndex].label}
                </p>
              </div>
              <ul className="flex flex-col gap-1.5">
                {visible.map((series) => {
                  const isGoalDay = hoverIndex >= HISTORY_DAYS;
                  const goalVal =
                    series.id === "weight" && weightGoal ? weightGoal.values[hoverIndex] : null;
                  const observed = days[hoverIndex].display[series.id];
                  const text =
                    isGoalDay && goalVal != null
                      ? formatValue(series.id, goalVal, series.unit)
                      : (observed ?? "—");
                  return (
                    <li key={series.id} className="space-y-0.5">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: series.color }}
                          />
                          {series.label}
                        </span>
                        <span className="tabular-nums font-bold text-slate-900">{text}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 pl-3.5">
                        {isGoalDay && goalVal != null
                          ? "Đường mục tiêu tham khảo (ADA), không phải giá trị đã đo"
                          : `Chuẩn: ${series.targetDesc}`}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
