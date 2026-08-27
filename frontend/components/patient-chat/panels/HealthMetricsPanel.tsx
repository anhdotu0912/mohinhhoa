"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { usePatientPanel } from "../PatientPanelProvider";
import { api } from "@/lib/api";
import {
  ApiError,
  type MetricsDeltaAdviceOut,
  type MetricsHistoryPoint,
  type PatientComplianceOut,
} from "@/lib/types";
import { parseBpPair, parseGlucoseMmol } from "@/lib/metrics-series";
import { MetricsOverlayChart } from "@/components/patient/MetricsOverlayChart";
import { RecordMetricsFormPanel } from "./RecordMetricsFormPanel";

const COMPLIANCE_RING_RADIUS = 40;
const COMPLIANCE_RING_CIRCUMFERENCE = 2 * Math.PI * COMPLIANCE_RING_RADIUS;
const DAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function complianceRingOffset(pct: number | null | undefined): number {
  if (pct == null || Number.isNaN(pct)) return COMPLIANCE_RING_CIRCUMFERENCE;
  const clamped = Math.max(0, Math.min(100, pct));
  return COMPLIANCE_RING_CIRCUMFERENCE * (1 - clamped / 100);
}

export function HealthMetricsPanel() {
  const { closePanel, healthView, goToRecordMetricsForm, backToHealthDock } =
    usePatientPanel();

  const [history, setHistory] = useState<MetricsHistoryPoint[]>([]);
  const [compliance, setCompliance] = useState<PatientComplianceOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deltaAdvice, setDeltaAdvice] = useState<MetricsDeltaAdviceOut | null>(null);

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

  const latestWeight = useMemo(() => {
    const pt = [...history].reverse().find((p) => p.weight != null);
    return pt?.weight != null ? `${pt.weight}` : null;
  }, [history]);

  const latestBmi = useMemo(() => {
    const pt = [...history].reverse().find((p) => p.bmi != null);
    return pt?.bmi != null ? `${pt.bmi}` : null;
  }, [history]);

  const latestBP = useMemo(() => {
    const pt = [...history]
      .reverse()
      .find((p) => p.systolic != null || Boolean(p.blood_pressure));
    if (!pt) return null;
    if (pt.systolic != null && pt.diastolic != null) {
      return `${pt.systolic}/${pt.diastolic}`;
    }
    const parsed = parseBpPair(pt.blood_pressure);
    if (parsed.sys != null && parsed.dia != null) return `${parsed.sys}/${parsed.dia}`;
    return pt.blood_pressure ?? null;
  }, [history]);

  const latestGlucose = useMemo(() => {
    const pt = [...history]
      .reverse()
      .find((p) => p.glucose_fasting != null || Boolean(p.blood_glucose));
    if (!pt) return null;
    if (pt.glucose_fasting != null) return `${pt.glucose_fasting}`;
    const mmol = parseGlucoseMmol(pt.blood_glucose);
    return mmol != null ? `${mmol}` : pt.blood_glucose;
  }, [history]);

  const formattedDate = new Date().toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const adherencePct = compliance?.overall_adherence_pct ?? null;
  const adherenceLabel =
    adherencePct != null ? `${Math.round(adherencePct)}%` : "—";
  const complianceSeries = compliance?.daily_series?.slice(0, 7) ?? [];

  const handleSaved = (advice?: MetricsDeltaAdviceOut | null) => {
    setDeltaAdvice(advice ?? null);
    void loadData();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
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

      <div className="relative w-full max-w-3xl max-h-[94vh] sm:max-h-[90vh] bg-white rounded-2xl shadow-2xl z-10 flex flex-col border border-slate-200/90 overflow-hidden my-auto m-2 sm:m-0">
        {healthView === "record" ? (
          <RecordMetricsFormPanel
            onBack={backToHealthDock}
            onClose={closePanel}
            onSaved={handleSaved}
          />
        ) : (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="px-4 sm:px-6 md:px-8 py-3.5 sm:py-5 min-h-[64px] sm:min-h-[72px] border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-emerald-50 text-[#006857] flex items-center justify-center border border-emerald-200 shrink-0">
                  <span className="material-symbols-outlined text-[20px] sm:text-[24px]">
                    vital_signs
                  </span>
                </div>
                <div className="flex flex-col min-w-0">
                  <h2 className="font-bold text-base sm:text-xl text-slate-900 leading-tight truncate">
                    Chỉ số sức khỏe
                  </h2>
                  <p className="text-[11px] sm:text-[13px] text-slate-500 font-medium capitalize mt-0.5 truncate">
                    {formattedDate}
                  </p>
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

            <div className="p-3.5 sm:p-6 md:p-8 flex-1 overflow-y-auto custom-scrollbar space-y-4 sm:space-y-6">
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
                  <MetricsOverlayChart history={history} />

                  {deltaAdvice && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3.5">
                      <p className="text-[13px] font-semibold text-slate-900">
                        Nhận xét khi chỉ số đổi
                      </p>
                      <p className="text-sm text-slate-700 mt-1 leading-relaxed">
                        {deltaAdvice.message}
                      </p>
                      {deltaAdvice.citations.length > 0 && (
                        <p className="text-[11px] text-slate-500 mt-2">
                          Nguồn: {deltaAdvice.citations.join(", ")}
                        </p>
                      )}
                      {deltaAdvice.ask_doctor && (
                        <p className="text-xs font-semibold text-[#006857] mt-2">
                          Hãy trao đổi với bác sĩ nếu bạn lo ngại về diễn biến này.
                        </p>
                      )}
                    </div>
                  )}

                  <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <VitalTile icon="monitor_weight" tone="blue" label="Cân nặng" value={latestWeight} unit="kg" />
                    <VitalTile icon="favorite" tone="rose" label="Huyết áp" value={latestBP} unit="mmHg" />
                    <VitalTile icon="water_drop" tone="amber" label="Đường lúc đói" value={latestGlucose} unit="mmol/L" />
                    <VitalTile icon="straighten" tone="indigo" label="BMI" value={latestBmi} unit="" />
                  </section>

                  <section className="bg-slate-50/90 rounded-xl p-4 border border-slate-200/80 flex flex-col gap-3">
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
                                className={`w-full max-w-[18px] rounded-sm ${
                                  point.adherence_pct != null ? "bg-[#006857]/80" : "bg-slate-200"
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
                  </section>

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={goToRecordMetricsForm}
                      className="w-full bg-[#006857] hover:bg-[#005245] text-white font-bold text-sm py-3.5 rounded-xl shadow-[0_8px_18px_rgba(0,104,87,0.22)] transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[20px]">edit_calendar</span>
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

function VitalTile({
  icon,
  tone,
  label,
  value,
  unit,
}: {
  icon: string;
  tone: "blue" | "rose" | "amber" | "indigo";
  label: string;
  value: string | null;
  unit: string;
}) {
  const tones: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    rose: "bg-rose-50 text-rose-700 border-rose-100",
    amber: "bg-amber-50 text-amber-800 border-amber-100",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-100",
  };
  return (
    <div className="bg-white rounded-xl p-3.5 border border-slate-200/90 flex flex-col justify-between gap-2 min-w-0">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${tones[tone]}`}>
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
          {label}
        </p>
        <div className="flex items-baseline gap-1 mt-0.5 min-w-0">
          <span className="text-lg font-extrabold text-slate-900 tabular-nums truncate">
            {value ?? "—"}
          </span>
          {value && unit && (
            <span className="text-[11px] text-slate-500 font-semibold shrink-0">{unit}</span>
          )}
        </div>
      </div>
    </div>
  );
}
