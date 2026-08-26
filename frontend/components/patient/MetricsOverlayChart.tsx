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
const FORECAST_DAYS = 7;

type DayPoint = {
  key: string;
  label: string;
  isToday: boolean;
  isForecast: boolean;
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

  const historyDays: DayPoint[] = Array.from({ length: HISTORY_DAYS }, (_, i) => {
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
      isForecast: false,
      recordedAt: point?.recorded_at,
      values,
      display,
    };
  });

  const forecastDays: DayPoint[] = Array.from({ length: FORECAST_DAYS }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() + i + 1);
    return {
      key: `f-${localDateKey(date)}`,
      label:
        i === 0
          ? "Dự kiến"
          : i === FORECAST_DAYS - 1
            ? date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })
            : "",
      isToday: false,
      isForecast: true,
      values: emptyValues(),
      display: emptyDisplay(),
    };
  });

  return [...historyDays, ...forecastDays];
}

function linearForecast(values: Array<number | null>): Array<number | null> {
  const pts: { x: number; y: number }[] = [];
  values.forEach((value, x) => {
    if (value != null) pts.push({ x, y: value });
  });
  if (pts.length < 3) return values.map(() => null);
  const n = pts.length;
  const sumX = pts.reduce((s, p) => s + p.x, 0);
  const sumY = pts.reduce((s, p) => s + p.y, 0);
  const sumXY = pts.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = pts.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return values.map(() => null);
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return values.map((value, x) => {
    if (x < HISTORY_DAYS) return null;
    return intercept + slope * x;
  });
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
  total = days.length,
  startIndex = 0
): string {
  let d = "";
  let drawing = false;
  days.forEach((day, i) => {
    const value = getValue(day, startIndex + i);
    if (value == null) return;
    d += `${drawing ? "L" : "M"} ${plotX(startIndex + i, total)} ${plotY(value, domain)} `;
    drawing = true;
  });
  return d.trim();
}

function observedCount(days: DayPoint[], id: MetricSeriesId): number {
  return days.filter((d) => d.values[id] != null).length;
}

function formatTick(value: number, series: MetricSeriesDef): string {
  if (series.id === "weight" || series.id.startsWith("glucose") || series.id === "hba1c" || series.id === "bmi") {
    return value.toFixed(1).replace(/\.0$/, "");
  }
  return String(Math.round(value));
}

type Props = {
  history: MetricsHistoryPoint[];
  loading?: boolean;
};

export function MetricsOverlayChart({ history, loading = false }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState<Record<MetricSeriesId, boolean>>(() =>
    Object.fromEntries(METRIC_SERIES.map((s) => [s.id, s.defaultOn])) as Record<
      MetricSeriesId,
      boolean
    >
  );
  const [focused, setFocused] = useState<MetricSeriesId>("glucose_fasting");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const days = useMemo(() => buildDays(history), [history]);
  const historyDays = days.slice(0, HISTORY_DAYS);

  const forecasts = useMemo(() => {
    const map = {} as Record<MetricSeriesId, Array<number | null>>;
    for (const series of METRIC_SERIES) {
      const observed = historyDays.map((d) => d.values[series.id]);
      const padded = [...observed, ...Array.from({ length: FORECAST_DAYS }, () => null)];
      map[series.id] = linearForecast(padded);
    }
    return map;
  }, [historyDays]);

  const hasAny = historyDays.some((d) => METRIC_SERIES.some((s) => d.values[s.id] != null));
  const focusedSeries = METRIC_SERIES.find((s) => s.id === focused) ?? METRIC_SERIES[0];
  const visible = METRIC_SERIES.filter((s) => enabled[s.id]);

  const focusedDomain = useMemo(() => {
    const observed = historyDays
      .map((d) => d.values[focused])
      .filter((v): v is number => v != null);
    const forecast = (forecasts[focused] ?? []).filter((v): v is number => v != null);
    const extra: number[] = [];
    if (focusedSeries.targetMax != null) extra.push(focusedSeries.targetMax);
    return yDomain(observed, [...forecast, ...extra]);
  }, [historyDays, forecasts, focused, focusedSeries]);

  const seriesDomain = useMemo(() => {
    const map = {} as Record<MetricSeriesId, [number, number]>;
    for (const series of METRIC_SERIES) {
      const observed = historyDays
        .map((d) => d.values[series.id])
        .filter((v): v is number => v != null);
      const forecast = (forecasts[series.id] ?? []).filter((v): v is number => v != null);
      const extra: number[] = [];
      if (series.targetMax != null) extra.push(series.targetMax);
      map[series.id] = yDomain(observed, [...forecast, ...extra]);
    }
    return map;
  }, [historyDays, forecasts]);

  const onChip = (id: MetricSeriesId) => {
    const isOn = enabled[id];
    if (isOn && focused === id) {
      const remaining = visible.filter((s) => s.id !== id);
      setEnabled((prev) => ({ ...prev, [id]: false }));
      if (remaining[0]) setFocused(remaining[0].id);
      return;
    }
    if (isOn) {
      setFocused(id);
      return;
    }
    setEnabled((prev) => ({ ...prev, [id]: true }));
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
  const canForecastFocused = focusedPointCount >= 3;
  const targetMax = focusedSeries.targetMax ?? null;
  const targetY = targetMax != null ? plotY(targetMax, focusedDomain) : null;

  return (
    <section className="space-y-3.5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 className="font-bold text-sm text-slate-900">Xu hướng 7 ngày</h3>
          <p className="text-xs text-slate-500 font-medium">
            Nét liền là đã ghi · nét đứt tới là dự kiến · đường ngang là mục tiêu
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {METRIC_SERIES.map((series) => {
          const on = enabled[series.id];
          const isFocus = focused === series.id;
          return (
            <button
              key={series.id}
              type="button"
              onClick={() => onChip(series.id)}
              aria-pressed={on}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                on
                  ? isFocus
                    ? "text-white border-transparent"
                    : "bg-white text-slate-800 border-slate-200"
                  : "bg-slate-50 text-slate-400 border-slate-200"
              }`}
              style={
                on && isFocus
                  ? { backgroundColor: series.color, borderColor: series.color }
                  : on
                    ? { boxShadow: `inset 0 0 0 1px ${series.color}33` }
                    : undefined
              }
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: on ? series.color : "#cbd5e1" }}
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
            Bấm «Ghi nhận chỉ số mới» để bắt đầu theo dõi và dự đoán xu hướng.
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
            <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full h-full overflow-visible" role="img" aria-label="Biểu đồ nhiều chỉ số 7 ngày">
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

              <line
                x1={plotX(HISTORY_DAYS - 1, days.length)}
                x2={plotX(HISTORY_DAYS - 1, days.length)}
                y1={PAD.top}
                y2={VIEW_H - PAD.bottom}
                stroke="#0F766E"
                strokeOpacity="0.25"
                strokeDasharray="3 4"
              />

              {visible.map((series) => {
                const domain = series.id === focused ? focusedDomain : seriesDomain[series.id];
                const pointCount = observedCount(historyDays, series.id);
                const observedPath = linePath(
                  days.slice(0, HISTORY_DAYS),
                  (d) => d.values[series.id],
                  domain,
                  days.length,
                  0
                );
                const lastObservedIndex = [...historyDays]
                  .map((d, i) => (d.values[series.id] != null ? i : -1))
                  .filter((i) => i >= 0)
                  .pop();
                const hasForecast = pointCount >= 3;
                const forecastPath = hasForecast
                  ? linePath(
                      days,
                      (d, i) => {
                        if (!d.isForecast) {
                          return i === lastObservedIndex ? d.values[series.id] : null;
                        }
                        return forecasts[series.id]?.[i] ?? null;
                      },
                      domain,
                      days.length,
                      0
                    )
                  : "";
                return (
                  <g key={series.id}>
                    {forecastPath && (
                      <path
                        d={forecastPath}
                        fill="none"
                        stroke={series.color}
                        strokeWidth={series.id === focused ? 2.25 : 1.75}
                        strokeDasharray="6 5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={series.id === focused ? 0.95 : 0.55}
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
                    {historyDays.map((day, i) => {
                      const value = day.values[series.id];
                      if (value == null) return null;
                      const active = hoverIndex === i;
                      return (
                        <circle
                          key={`${series.id}-${day.key}`}
                          cx={plotX(i, days.length)}
                          cy={plotY(value, domain)}
                          r={active || (day.isToday && series.id === focused) ? 4.5 : 3.2}
                          fill={series.color}
                          stroke="#ffffff"
                          strokeWidth="1.5"
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

          {!canForecastFocused && (
            <p className="text-[11px] text-slate-500 font-medium pt-1">
              Cần thêm lần ghi để dự đoán {focusedSeries.label.toLowerCase()}.
            </p>
          )}

          {hoverIndex != null && days[hoverIndex] && (
            <div
              className="pointer-events-none absolute z-10 min-w-[176px] rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-[0_8px_24px_rgba(15,23,42,0.12)]"
              style={{
                left: `${(plotX(hoverIndex, days.length) / VIEW_W) * 100}%`,
                top: 8,
                transform:
                  hoverIndex > days.length / 2 ? "translateX(-108%)" : "translateX(8px)",
              }}
            >
              <p className="text-xs font-semibold text-slate-900 mb-1.5">
                {days[hoverIndex].isForecast
                  ? `Dự kiến ${days[hoverIndex].label || ""}`.trim()
                  : days[hoverIndex].isToday
                    ? "Hôm nay"
                    : days[hoverIndex].label}
              </p>
              <ul className="flex flex-col gap-1">
                {visible.map((series) => {
                  const observed = days[hoverIndex].display[series.id];
                  const forecastVal = forecasts[series.id]?.[hoverIndex];
                  const text = days[hoverIndex].isForecast
                    ? forecastVal != null
                      ? formatValue(series.id, Math.round(forecastVal * 10) / 10, series.unit)
                      : "—"
                    : (observed ?? "—");
                  return (
                    <li key={series.id} className="flex items-center justify-between gap-3 text-xs">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: series.color }} />
                        {series.label}
                      </span>
                      <span className="tabular-nums font-medium text-slate-900">{text}</span>
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
