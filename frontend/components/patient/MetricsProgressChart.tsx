"use client";

import { useMemo, useRef, useState, type MouseEvent } from "react";
import type { MetricsHistoryPoint } from "@/lib/types";

const VIEW_W = 640;
const VIEW_H = 88;
const PAD = { top: 14, right: 28, bottom: 14, left: 48 };

type MetricId = "weight" | "bp" | "glucose";

type MetricDef = {
  id: MetricId;
  label: string;
  unit: string;
  color: string;
};

const METRICS: MetricDef[] = [
  { id: "weight", label: "Cân nặng", unit: "kg", color: "#2F8F7A" },
  { id: "bp", label: "Huyết áp", unit: "mmHg", color: "#4A90D9" },
  { id: "glucose", label: "Đường huyết", unit: "mg/dL", color: "#8B7355" },
];

type DayPoint = {
  key: string;
  label: string;
  isToday: boolean;
  recordedAt?: string;
  weight: number | null;
  bp: number | null;
  bpLabel: string | null;
  glucose: number | null;
  glucoseLabel: string | null;
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

function parseLeadingNumber(value?: string | null): number | null {
  if (!value) return null;
  const match = value.match(/[\d.]+/);
  if (!match) return null;
  const n = parseFloat(match[0]);
  return Number.isFinite(n) ? n : null;
}

function parseGlucoseMgDl(raw?: string | null): number | null {
  const n = parseLeadingNumber(raw);
  if (n == null) return null;
  if (/mmol/i.test(raw ?? "")) return Math.round(n * 18.018 * 10) / 10;
  return n;
}

function formatYTick(value: number, id: MetricId): string {
  if (id === "weight") return value.toFixed(1).replace(/\.0$/, "");
  if (id === "glucose" && !Number.isInteger(value)) return value.toFixed(1);
  return String(Math.round(value));
}

function yDomain(values: number[], id: MetricId): [number, number] {
  if (values.length === 0) return [0, 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const minPad = id === "weight" ? 0.8 : id === "bp" ? 8 : 8;
  const span = Math.max(max - min, minPad);
  const pad = span * 0.18;
  return [min - pad, max + pad];
}

function yTicks(domain: [number, number], id: MetricId): number[] {
  const [min, max] = domain;
  const count = 3;
  return Array.from({ length: count }, (_, i) => {
    const raw = min + ((max - min) * i) / (count - 1);
    if (id === "weight") return Math.round(raw * 10) / 10;
    return Math.round(raw);
  });
}

function plotX(index: number, n: number): number {
  const left = PAD.left;
  const right = VIEW_W - PAD.right;
  if (n <= 1) return (left + right) / 2;
  return left + (index / (n - 1)) * (right - left);
}

function plotY(value: number, domain: [number, number]): number {
  const top = PAD.top;
  const bottom = VIEW_H - PAD.bottom;
  const [min, max] = domain;
  const t = max === min ? 0.5 : (value - min) / (max - min);
  return bottom - t * (bottom - top);
}

function linePath(
  days: DayPoint[],
  getValue: (d: DayPoint) => number | null,
  domain: [number, number]
): string {
  let d = "";
  let drawing = false;
  days.forEach((day, i) => {
    const value = getValue(day);
    if (value == null) {
      drawing = false;
      return;
    }
    const cmd = drawing ? "L" : "M";
    d += `${cmd} ${plotX(i, days.length)} ${plotY(value, domain)} `;
    drawing = true;
  });
  return d.trim();
}

function buildWeek(history: MetricsHistoryPoint[]): DayPoint[] {
  const today = startOfLocalDay(new Date());
  const latestByDay = new Map<string, MetricsHistoryPoint>();
  for (const point of history) {
    const key = localDateKey(new Date(point.recorded_at));
    const prev = latestByDay.get(key);
    if (!prev || new Date(point.recorded_at) > new Date(prev.recorded_at)) {
      latestByDay.set(key, point);
    }
  }

  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - i));
    const key = localDateKey(date);
    const isToday = i === 6;
    const point = latestByDay.get(key);
    return {
      key,
      label: isToday
        ? "Hôm nay"
        : date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }),
      isToday,
      recordedAt: point?.recorded_at,
      weight: point?.weight ?? null,
      bp: parseLeadingNumber(point?.blood_pressure),
      bpLabel: point?.blood_pressure ?? null,
      glucose: parseGlucoseMgDl(point?.blood_glucose),
      glucoseLabel: point?.blood_glucose ?? null,
    };
  });
}

function metricValue(day: DayPoint, id: MetricId): number | null {
  if (id === "weight") return day.weight;
  if (id === "bp") return day.bp;
  return day.glucose;
}

function metricDisplay(day: DayPoint, id: MetricId): string | null {
  if (id === "weight") return day.weight != null ? `${day.weight} kg` : null;
  if (id === "bp") return day.bpLabel;
  return day.glucoseLabel;
}

function latestFor(days: DayPoint[], id: MetricId): string {
  for (let i = days.length - 1; i >= 0; i -= 1) {
    const text = metricDisplay(days[i], id);
    if (text) return text;
  }
  return "—";
}

type Props = {
  history: MetricsHistoryPoint[];
  loading?: boolean;
};

export function MetricsProgressChart({ history, loading = false }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const days = useMemo(() => buildWeek(history), [history]);
  const hasAny = days.some(
    (d) => d.weight != null || d.bp != null || d.glucose != null
  );

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

  return (
    <section className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-subtle p-card-padding">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-5 pb-4 border-b border-outline-variant">
        <div>
          <h2 className="font-h2 text-h2 text-on-surface font-semibold text-lg">
            Biểu đồ tiến triển
          </h2>
          <p className="text-xs text-on-surface-variant mt-1">
            Mỗi ngày lấy lần ghi nhận gần nhất. Trục đứng riêng cho từng chỉ số.
          </p>
        </div>
        <span className="text-xs text-on-surface-variant shrink-0">7 ngày qua</span>
      </div>

      {loading ? (
        <p className="text-sm text-on-surface-variant">Đang tải...</p>
      ) : !hasAny ? (
        <p className="text-sm text-on-surface-variant">
          Chưa có dữ liệu biểu đồ trong 7 ngày qua. Bấm «Ghi nhận chỉ số mới» để bắt đầu theo dõi.
        </p>
      ) : (
        <div
          ref={wrapRef}
          className="relative cursor-crosshair select-none"
          onMouseMove={onMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <div className="flex flex-col gap-4">
            {METRICS.map((metric) => {
              const values = days
                .map((d) => metricValue(d, metric.id))
                .filter((v): v is number => v != null);
              const domain = yDomain(values, metric.id);
              const ticks = yTicks(domain, metric.id);
              const path = linePath(days, (d) => metricValue(d, metric.id), domain);
              const empty = values.length === 0;

              return (
                <div key={metric.id}>
                  <div className="flex items-baseline justify-between gap-3 mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: metric.color }}
                      />
                      <span className="text-xs font-semibold text-on-surface">
                        {metric.label}{" "}
                        <span className="font-normal text-on-surface-variant">({metric.unit})</span>
                      </span>
                    </div>
                    <span
                      className="text-sm font-semibold tabular-nums text-on-surface shrink-0"
                      style={{ color: empty ? undefined : metric.color }}
                    >
                      {latestFor(days, metric.id)}
                    </span>
                  </div>

                  <div className="relative h-[88px] w-full overflow-visible">
                    {empty ? (
                      <div className="absolute inset-0 flex items-center pl-[48px] text-xs text-on-surface-variant">
                        Chưa ghi nhận {metric.label.toLowerCase()} trong 7 ngày qua
                      </div>
                    ) : (
                      <svg
                        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
                        className="w-full h-full overflow-visible"
                        role="img"
                        aria-label={`${metric.label} 7 ngày qua`}
                      >
                        {ticks.map((tick) => {
                          const y = plotY(tick, domain);
                          return (
                            <g key={`${metric.id}-${tick}`}>
                              <line
                                x1={PAD.left}
                                x2={VIEW_W - PAD.right}
                                y1={y}
                                y2={y}
                                stroke="#bdc9c4"
                                strokeOpacity="0.45"
                              />
                              <text
                                x={PAD.left - 8}
                                y={y}
                                textAnchor="end"
                                dominantBaseline="middle"
                                fill="#3e4945"
                                fontSize="11"
                                fontFamily="inherit"
                              >
                                {formatYTick(tick, metric.id)}
                              </text>
                            </g>
                          );
                        })}

                        {hoverIndex != null && (
                          <line
                            x1={plotX(hoverIndex, days.length)}
                            x2={plotX(hoverIndex, days.length)}
                            y1={PAD.top - 4}
                            y2={VIEW_H - PAD.bottom + 4}
                            stroke={metric.color}
                            strokeOpacity="0.28"
                          />
                        )}

                        <path
                          d={path}
                          fill="none"
                          stroke={metric.color}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />

                        {days.map((day, i) => {
                          const value = metricValue(day, metric.id);
                          if (value == null) return null;
                          const active = hoverIndex === i;
                          return (
                            <circle
                              key={day.key}
                              cx={plotX(i, days.length)}
                              cy={plotY(value, domain)}
                              r={active ? 5 : 4}
                              fill={metric.color}
                              stroke="#ffffff"
                              strokeWidth="2"
                            />
                          );
                        })}
                      </svg>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="relative h-5 mt-1">
            {days.map((day, i) => (
              <span
                key={day.key}
                className={`absolute top-0 whitespace-nowrap text-[11px] tabular-nums -translate-x-1/2 ${
                  day.isToday ? "text-[#2F8F7A] font-semibold" : "text-on-surface-variant"
                }`}
                style={{ left: `${(plotX(i, days.length) / VIEW_W) * 100}%` }}
              >
                {day.label}
              </span>
            ))}
          </div>

          {hoverIndex != null && (
            <div
              className="pointer-events-none absolute z-10 min-w-[168px] rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 shadow-subtle"
              style={{
                left: `${(plotX(hoverIndex, days.length) / VIEW_W) * 100}%`,
                bottom: 28,
                transform:
                  hoverIndex > days.length / 2 ? "translateX(-100%)" : "translateX(8px)",
              }}
            >
              <p className="text-xs font-semibold text-on-surface mb-1.5">
                {days[hoverIndex].isToday ? "Hôm nay" : days[hoverIndex].label}
              </p>
              <ul className="flex flex-col gap-1">
                {METRICS.map((metric) => (
                  <li key={metric.id} className="flex items-center justify-between gap-3 text-xs">
                    <span className="flex items-center gap-1.5 text-on-surface-variant">
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: metric.color }}
                      />
                      {metric.label}
                    </span>
                    <span className="tabular-nums font-medium text-on-surface">
                      {metricDisplay(days[hoverIndex], metric.id) ?? "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
