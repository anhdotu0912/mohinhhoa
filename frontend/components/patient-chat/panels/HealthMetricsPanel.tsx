"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { usePatientPanel } from "../PatientPanelProvider";
import { api } from "@/lib/api";
import { ApiError, type MetricsHistoryPoint, type PatientComplianceOut } from "@/lib/types";
import { RecordMetricsFormPanel } from "./RecordMetricsFormPanel";

const COMPLIANCE_RING_RADIUS = 40;
const COMPLIANCE_RING_CIRCUMFERENCE = 2 * Math.PI * COMPLIANCE_RING_RADIUS;
const DAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function complianceRingOffset(pct: number | null | undefined): number {
  if (pct == null || Number.isNaN(pct)) return COMPLIANCE_RING_CIRCUMFERENCE;
  const clamped = Math.max(0, Math.min(100, pct));
  return COMPLIANCE_RING_CIRCUMFERENCE * (1 - clamped / 100);
}

function parseGlucoseValue(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const num = parseFloat(raw.replace(/[^\d.]/g, ""));
  return Number.isFinite(num) ? num : null;
}

interface GlucoseChartPoint {
  label: string;
  value: number;
  x: number;
  y: number;
  display: string;
  isLatest: boolean;
}

function buildGlucoseSparkline(history: MetricsHistoryPoint[]): {
  points: GlucoseChartPoint[];
  linePath: string;
  areaPath: string;
  trendPct: number | null;
} {
  const withGlucose = history
    .map((p) => ({
      point: p,
      glucose: parseGlucoseValue(p.blood_glucose),
    }))
    .filter((p) => p.glucose != null)
    .sort(
      (a, b) =>
        new Date(a.point.recorded_at).getTime() - new Date(b.point.recorded_at).getTime()
    );

  const recent = withGlucose.slice(-7);

  if (recent.length === 0) {
    return { points: [], linePath: "", areaPath: "", trendPct: null };
  }

  const values = recent.map((p) => p.glucose!);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points: GlucoseChartPoint[] = recent.map((entry, i) => {
    const x = recent.length === 1 ? 50 : (i / (recent.length - 1)) * 100;
    const y = 15 + (1 - (entry.glucose! - min) / range) * 70;
    const date = new Date(entry.point.recorded_at);
    const dayOfWeek = (date.getDay() + 6) % 7;
    const label =
      DAY_LABELS[dayOfWeek] ??
      date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
    return {
      label,
      value: entry.glucose!,
      x,
      y,
      display: entry.point.blood_glucose ?? String(entry.glucose),
      isLatest: i === recent.length - 1,
    };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");
  const areaPath = `${linePath} L 100,100 L 0,100 Z`;

  let trendPct: number | null = null;
  if (points.length >= 2) {
    const first = points[0].value;
    const last = points[points.length - 1].value;
    if (first !== 0) {
      trendPct = ((last - first) / first) * 100;
    }
  }

  return { points, linePath, areaPath, trendPct };
}

export function HealthMetricsPanel() {
  const { closePanel, healthView, goToRecordMetricsForm, backToHealthDock } =
    usePatientPanel();

  const [history, setHistory] = useState<MetricsHistoryPoint[]>([]);
  const [compliance, setCompliance] = useState<PatientComplianceOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [metricsData, complianceData] = await Promise.all([
        api.getMetricsHistory(90),
        api.getMyCompliance(7).catch(() => null),
      ]);
      setHistory(metricsData);
      setCompliance(complianceData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không tải được chỉ số.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Extract latest metrics (history assumed newest-first from API)
  const latestWeight = useMemo(() => {
    const pt = history.find((p) => p.weight != null && p.weight !== undefined);
    return pt?.weight != null ? `${pt.weight}` : null;
  }, [history]);

  const latestBP = useMemo(() => {
    const pt = history.find((p) => Boolean(p.blood_pressure));
    return pt?.blood_pressure ?? null;
  }, [history]);

  const latestGlucose = useMemo(() => {
    const pt = history.find((p) => Boolean(p.blood_glucose));
    return pt?.blood_glucose ?? null;
  }, [history]);

  const glucoseSparkline = useMemo(() => buildGlucoseSparkline(history), [history]);

  const formattedDate = new Date().toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const adherencePct = compliance?.overall_adherence_pct ?? null;
  const adherenceLabel =
    adherencePct != null ? `${Math.round(adherencePct)}%` : "—";
  const complianceSeries = compliance?.daily_series?.slice(0, 7) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Đóng bảng chỉ số sức khỏe"
        onClick={closePanel}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") closePanel();
        }}
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity cursor-pointer"
      />

      {/* Centered Modal Card Dialog */}
      <div className="relative w-full max-w-2xl max-h-[88vh] bg-white rounded-2xl shadow-2xl z-10 flex flex-col border border-slate-200/90 animate-in fade-in zoom-in-95 duration-200 overflow-hidden my-auto">
        {healthView === "record" ? (
          <RecordMetricsFormPanel
            onBack={backToHealthDock}
            onClose={closePanel}
            onSaved={loadData}
          />
        ) : (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Fixed Header */}
            <div className="px-6 sm:px-8 py-4 sm:py-5 min-h-[72px] sm:min-h-[78px] border-b border-slate-100 flex items-center justify-between bg-white/95 backdrop-blur-md shrink-0">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-emerald-50 text-[#006857] flex items-center justify-center border border-emerald-200 shadow-2xs shrink-0">
                  <span className="material-symbols-outlined text-[22px] sm:text-[24px]">
                    vital_signs
                  </span>
                </div>
                <div className="flex flex-col">
                  <h2 className="font-bold text-lg sm:text-xl text-slate-900 leading-tight">Chỉ số sức khỏe</h2>
                  <p className="text-xs sm:text-[13px] text-slate-500 font-medium capitalize mt-0.5">{formattedDate}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closePanel}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
                title="Đóng (ESC)"
              >
                <span className="material-symbols-outlined text-[20px] sm:text-[22px]">close</span>
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 md:p-8 flex-1 overflow-y-auto custom-scrollbar space-y-6">
              {loading && (
                <div className="py-12 text-center text-xs text-slate-500">
                  <span className="material-symbols-outlined animate-spin text-[24px] text-[#006857] mb-2">
                    progress_activity
                  </span>
                  <p>Đang tải chỉ số sức khỏe...</p>
                </div>
              )}

              {error && !loading && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                  {error}
                </div>
              )}

              {!loading && (
                <>
                  {/* Blood Glucose Sparkline Section */}
                  <section className="space-y-3.5">
                    <div className="flex items-end justify-between">
                      <div>
                        <h3 className="font-bold text-sm text-slate-900">Đường huyết</h3>
                        <p className="text-xs text-slate-500 font-medium">
                          Xu hướng 7 ngày ({latestGlucose ?? "—"} mmol/L)
                        </p>
                      </div>
                      {glucoseSparkline.trendPct != null && (
                        <div
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-bold shadow-2xs ${
                            glucoseSparkline.trendPct <= 0
                              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                              : "bg-amber-50 border-amber-200 text-amber-800"
                          }`}
                        >
                          <span
                            className={`material-symbols-outlined text-[16px] ${
                              glucoseSparkline.trendPct <= 0 ? "text-[#006857]" : "text-amber-700"
                            }`}
                          >
                            {glucoseSparkline.trendPct <= 0 ? "trending_down" : "trending_up"}
                          </span>
                          <span>
                            {glucoseSparkline.trendPct > 0 ? "+" : ""}
                            {glucoseSparkline.trendPct.toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Chart Container */}
                    <div className="w-full bg-slate-50/80 rounded-xl border border-slate-200/80 relative flex flex-col p-4 pt-5 pb-3 shadow-2xs">
                      {glucoseSparkline.points.length === 0 ? (
                        <div className="py-10 text-center text-xs text-slate-400 font-medium">
                          Chưa có chỉ số đường huyết
                        </div>
                      ) : (
                        <>
                          <div className="absolute inset-x-4 top-5 bottom-8 flex flex-col justify-between pointer-events-none">
                            <div className="border-t border-dashed border-slate-900/[0.05] w-full" />
                            <div className="border-t border-dashed border-slate-900/[0.05] w-full" />
                            <div className="border-t border-dashed border-slate-900/[0.05] w-full" />
                          </div>

                          <div className="w-full h-32 relative">
                            <svg
                              className="w-full h-full overflow-visible"
                              preserveAspectRatio="none"
                              viewBox="0 0 100 100"
                            >
                              <defs>
                                <linearGradient id="panelLineGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#005F56" stopOpacity="0.15" />
                                  <stop offset="100%" stopColor="#005F56" stopOpacity="0.0" />
                                </linearGradient>
                              </defs>

                              <path d={glucoseSparkline.areaPath} fill="url(#panelLineGrad)" />
                              <path
                                d={glucoseSparkline.linePath}
                                fill="none"
                                stroke="#005F56"
                                strokeWidth="1.75"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                vectorEffect="non-scaling-stroke"
                              />
                            </svg>

                            <div className="absolute inset-0 pointer-events-none">
                              {glucoseSparkline.points.map((pt) => (
                                <div
                                  key={`${pt.label}-${pt.x}`}
                                  className="absolute -translate-x-1/2 -translate-y-1/2 group/dot flex flex-col items-center pointer-events-auto cursor-pointer"
                                  style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
                                >
                                  <div className="absolute bottom-full mb-2 opacity-0 group-hover/dot:opacity-100 transition-all duration-150 pointer-events-none scale-90 group-hover/dot:scale-100 z-30 whitespace-nowrap bg-slate-900/90 backdrop-blur-xs text-white text-[11px] font-medium px-2 py-0.5 rounded shadow-lg">
                                    {pt.label}: {pt.display} mmol/L
                                  </div>

                                  {pt.isLatest && (
                                    <span className="absolute w-4.5 h-4.5 rounded-full bg-[#005F56]/20 animate-ping pointer-events-none" />
                                  )}

                                  <div
                                    className={`rounded-full bg-[#005F56] border-[1.5px] border-white shadow-[0_1px_3px_rgba(0,95,86,0.35)] transition-all duration-150 group-hover/dot:scale-135 group-hover/dot:ring-3 group-hover/dot:ring-[#005F56]/25 ${
                                      pt.isLatest
                                        ? "w-2 h-2 ring-2 ring-[#005F56]/30"
                                        : "w-[7px] h-[7px]"
                                    }`}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="w-full flex justify-between pt-3 text-[11px] font-semibold text-slate-400">
                            {glucoseSparkline.points.map((pt, i) => (
                              <span
                                key={`${pt.label}-axis-${i}`}
                                className={pt.isLatest ? "text-[#005F56] font-bold" : ""}
                              >
                                {pt.label}
                              </span>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </section>

                  {/* Bento Grid */}
                  <section className="grid grid-cols-2 gap-3.5">
                    {/* Compliance Ring Card */}
                    <div className="col-span-2 bg-slate-50/90 rounded-xl p-4 border border-slate-200/80 flex flex-col gap-3 shadow-2xs">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h4 className="font-bold text-sm text-slate-900">Mức độ tuân thủ</h4>
                          <p className="text-xs text-slate-500 font-medium">
                            Tuần này — cùng nguồn với báo cáo chat
                          </p>
                        </div>
                        <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                            <circle
                              cx="50"
                              cy="50"
                              r={COMPLIANCE_RING_RADIUS}
                              fill="none"
                              stroke="#e2e8f0"
                              strokeWidth="8"
                            />
                            <circle
                              cx="50"
                              cy="50"
                              r={COMPLIANCE_RING_RADIUS}
                              fill="none"
                              stroke="#006857"
                              strokeWidth="8"
                              strokeDasharray={COMPLIANCE_RING_CIRCUMFERENCE}
                              strokeDashoffset={complianceRingOffset(adherencePct)}
                              strokeLinecap="round"
                              className="transition-all duration-1000"
                            />
                          </svg>
                          <span className="absolute font-extrabold text-base text-[#006857]">
                            {adherenceLabel}
                          </span>
                        </div>
                      </div>

                      {complianceSeries.length > 0 && (
                        <div className="flex items-end justify-between gap-1 h-10 pt-1 border-t border-slate-200/70">
                          {complianceSeries.map((point, index) => {
                            const barHeight =
                              point.adherence_pct != null
                                ? Math.max(4, Math.round((point.adherence_pct / 100) * 32))
                                : 4;
                            return (
                              <div
                                key={point.date}
                                className="flex-1 flex flex-col items-center gap-1 min-w-0"
                                title={
                                  point.adherence_pct != null
                                    ? `${DAY_LABELS[index] ?? point.date}: ${point.adherence_pct}%`
                                    : `${DAY_LABELS[index] ?? point.date}: chưa có dữ liệu`
                                }
                              >
                                <div
                                  className={`w-full max-w-[18px] rounded-sm transition-all ${
                                    point.adherence_pct != null
                                      ? "bg-[#006857]/80"
                                      : "bg-slate-200"
                                  }`}
                                  style={{ height: `${barHeight}px` }}
                                />
                                <span className="text-[9px] font-semibold text-slate-400 truncate w-full text-center">
                                  {DAY_LABELS[index] ?? ""}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Vital: Weight */}
                    <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs relative flex flex-col justify-between gap-2">
                      <div className="flex items-center justify-between">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100 shadow-2xs">
                          <span className="material-symbols-outlined text-[18px]">
                            monitor_weight
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Cân nặng
                        </p>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-xl font-extrabold text-slate-900">
                            {latestWeight ?? "—"}
                          </span>
                          {latestWeight && (
                            <span className="text-xs text-slate-500 font-semibold">kg</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Vital: Blood Pressure */}
                    <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs relative flex flex-col justify-between gap-2">
                      <div className="flex items-center justify-between">
                        <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-100 shadow-2xs">
                          <span className="material-symbols-outlined text-[18px]">
                            favorite
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Huyết áp
                        </p>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-xl font-extrabold text-slate-900">
                            {latestBP ?? "—"}
                          </span>
                          {latestBP && (
                            <span className="text-xs text-slate-500 font-semibold">mmHg</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Action Area */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={goToRecordMetricsForm}
                      className="w-full bg-gradient-to-r from-[#006857] to-emerald-600 hover:from-[#005245] hover:to-emerald-700 text-white font-bold text-sm py-3.5 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-emerald-700/20"
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        edit_calendar
                      </span>
                      <span>Ghi nhận chỉ số mới</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
