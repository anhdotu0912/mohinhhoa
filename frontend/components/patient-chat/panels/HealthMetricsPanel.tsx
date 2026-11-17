"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { usePatientPanel } from "../PatientPanelProvider";
import { api } from "@/lib/api";
import {
  ApiError,
  type MealPlanOutput,
  type MetricsDeltaAdviceOut,
  type MetricsHistoryPoint,
  type PatientProfile,
} from "@/lib/types";
import {
  parseBpPair,
  parseGlucoseMmol,
  getMetricClinicalStatus,
  calculateMetricDelta,
  findBaselinePoint,
  type MetricClinicalStatus,
  type MetricDeltaCalculation,
} from "@/lib/metrics-series";
import { MetricsOverlayChart } from "@/components/patient/MetricsOverlayChart";
import { MetricsImprovementSummary } from "./MetricsImprovementSummary";
import { RecordMetricsFormPanel } from "./RecordMetricsFormPanel";
import { mergeSavedMetric } from "@/lib/metrics-daily";

type MainViewTab = "chart" | "comparison" | "nutrition" | "roadmap";

export function HealthMetricsPanel() {
  const { closePanel, healthView, goToRecordMetricsForm, backToHealthDock } =
    usePatientPanel();

  const [history, setHistory] = useState<MetricsHistoryPoint[]>([]);
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [activePlan, setActivePlan] = useState<MealPlanOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deltaAdvice, setDeltaAdvice] = useState<MetricsDeltaAdviceOut | null>(null);
  const [activeTab, setActiveTab] = useState<MainViewTab>("chart");
  const loadRequest = useRef(0);

  const loadData = useCallback(async (silent = false) => {
    const request = ++loadRequest.current;
    setError(null);
    if (!silent) setLoading(true);
    try {
      const [metricsData, profileData, scheduleData] = await Promise.allSettled([
        api.getMetricsHistory(90),
        api.getProfile(),
        api.getMyMealPlanSchedule(),
      ]);
      if (request !== loadRequest.current) return;

      if (metricsData.status === "fulfilled") {
        setHistory(metricsData.value);
      } else {
        throw metricsData.reason;
      }

      if (profileData.status === "fulfilled") {
        setProfile(profileData.value);
      }

      if (scheduleData.status === "fulfilled") {
        setActivePlan(scheduleData.value.active_plan ?? null);
      }
    } catch (err) {
      if (request === loadRequest.current) setError(err instanceof ApiError ? err.message : "Không tải được chỉ số sức khỏe.");
    } finally {
      if (request === loadRequest.current && !silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Baseline and Latest values calculation
  const sortedHistory = useMemo(
    () =>
      [...history].sort(
        (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
      ),
    [history]
  );

  const latestWeight = useMemo(() => {
    const pt = [...sortedHistory].reverse().find((p) => p.weight != null);
    return pt?.weight ?? profile?.weight ?? null;
  }, [sortedHistory, profile]);

  const baselineWeight = useMemo(() => {
    const pt = findBaselinePoint(sortedHistory, (p) => p.weight != null, activePlan);
    return pt?.weight ?? profile?.weight ?? null;
  }, [sortedHistory, profile, activePlan]);

  const latestBmi = useMemo(() => {
    const pt = [...sortedHistory].reverse().find((p) => p.bmi != null);
    return pt?.bmi ?? profile?.bmi ?? null;
  }, [sortedHistory, profile]);

  const baselineBmi = useMemo(() => {
    const pt = findBaselinePoint(sortedHistory, (p) => p.bmi != null, activePlan);
    return pt?.bmi ?? profile?.bmi ?? null;
  }, [sortedHistory, profile, activePlan]);

  const latestBP = useMemo(() => {
    const pt = [...sortedHistory]
      .reverse()
      .find((p) => p.systolic != null || Boolean(p.blood_pressure));
    if (!pt) {
      if (profile?.blood_pressure) {
        return parseBpPair(profile.blood_pressure);
      }
      return { sys: null, dia: null };
    }
    if (pt.systolic != null && pt.diastolic != null) {
      return { sys: pt.systolic, dia: pt.diastolic };
    }
    return parseBpPair(pt.blood_pressure);
  }, [sortedHistory, profile]);

  const latestGlucose = useMemo(() => {
    const pt = [...sortedHistory]
      .reverse()
      .find((p) => p.glucose_fasting != null || Boolean(p.blood_glucose));
    if (!pt) {
      if (profile?.blood_glucose) {
        return parseGlucoseMmol(profile.blood_glucose);
      }
      return null;
    }
    if (pt.glucose_fasting != null) return pt.glucose_fasting;
    return parseGlucoseMmol(pt.blood_glucose);
  }, [sortedHistory, profile]);

  const baselineGlucose = useMemo(() => {
    const pt = findBaselinePoint(
      sortedHistory,
      (p) => p.glucose_fasting != null || Boolean(p.blood_glucose),
      activePlan
    );
    if (!pt) {
      if (profile?.blood_glucose) {
        return parseGlucoseMmol(profile.blood_glucose);
      }
      return null;
    }
    if (pt.glucose_fasting != null) return pt.glucose_fasting;
    return parseGlucoseMmol(pt.blood_glucose);
  }, [sortedHistory, profile, activePlan]);

  // Overall Health Impact Summary
  const impactSummary = useMemo(() => {
    const glucosePoints = sortedHistory
      .map((p) => p.glucose_fasting ?? parseGlucoseMmol(p.blood_glucose))
      .filter((v): v is number => v != null);

    const inRangeCount = glucosePoints.filter((g) => g >= 4.4 && g <= 7.2).length;
    const timeInRangePct =
      glucosePoints.length > 0 ? Math.round((inRangeCount / glucosePoints.length) * 100) : 100;

    const glucoseDelta =
      latestGlucose != null && baselineGlucose != null ? latestGlucose - baselineGlucose : 0;

    const glucoseDeltaPct =
      baselineGlucose != null && baselineGlucose > 0
        ? Math.round(((latestGlucose ?? baselineGlucose) - baselineGlucose) / baselineGlucose * 100)
        : 0;

    return {
      recordedDays: sortedHistory.length,
      timeInRangePct,
      latestGlucose,
      baselineGlucose,
      glucoseDelta: Math.round(glucoseDelta * 10) / 10,
      glucoseDeltaPct,
      isGlucoseImproved: glucoseDelta <= 0,
    };
  }, [sortedHistory, latestGlucose, baselineGlucose]);

  // Deltas for tiles
  const weightDelta = useMemo(
    () => calculateMetricDelta("weight", latestWeight, baselineWeight, "kg"),
    [latestWeight, baselineWeight]
  );
  const glucoseDelta = useMemo(
    () => calculateMetricDelta("glucose_fasting", latestGlucose, baselineGlucose, "mmol/L"),
    [latestGlucose, baselineGlucose]
  );
  const bmiDelta = useMemo(
    () => calculateMetricDelta("bmi", latestBmi, baselineBmi, ""),
    [latestBmi, baselineBmi]
  );

  // Statuses for tiles
  const weightStatus = useMemo(
    () => (latestBmi ? getMetricClinicalStatus("bmi", latestBmi) : null),
    [latestBmi]
  );
  const glucoseStatus = useMemo(
    () => (latestGlucose ? getMetricClinicalStatus("glucose_fasting", latestGlucose) : null),
    [latestGlucose]
  );
  const bpStatus = useMemo(
    () => (latestBP.sys ? getMetricClinicalStatus("systolic", latestBP.sys) : null),
    [latestBP.sys]
  );
  const bmiStatus = useMemo(
    () => (latestBmi ? getMetricClinicalStatus("bmi", latestBmi) : null),
    [latestBmi]
  );

  const formattedDate = new Date().toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const handleSaved = (advice?: MetricsDeltaAdviceOut | null, entry?: MetricsHistoryPoint) => {
    if (entry) {
      setHistory((previous) => mergeSavedMetric(previous, entry));
      setLoading(false);
    }
    setActiveTab("chart");
    setDeltaAdvice(advice ?? null);
    setSaveSuccess("Đã lưu và cập nhật chỉ số sức khỏe hôm nay thành công!");
    setTimeout(() => setSaveSuccess(null), 6000);
    void loadData(Boolean(entry));
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
            {/* Header */}
            <div className="px-4 sm:px-6 md:px-8 py-3.5 sm:py-5 min-h-[64px] sm:min-h-[72px] border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-emerald-50 text-[#006857] flex items-center justify-center border border-emerald-200 shrink-0">
                  <span className="material-symbols-outlined text-[20px] sm:text-[24px]">
                    vital_signs
                  </span>
                </div>
                <div className="flex flex-col min-w-0">
                  <h2 className="font-bold text-base sm:text-xl text-slate-900 leading-tight truncate">
                    Chỉ số sức khỏe &amp; Hiệu quả Thực đơn
                  </h2>
                  <p className="text-[11px] sm:text-[13px] text-slate-500 font-medium capitalize mt-0.5 truncate">
                    {formattedDate} · Kiểm soát ĐTĐ Type 2
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

            <div className="p-3.5 sm:p-6 md:p-8 flex-1 overflow-y-auto custom-scrollbar space-y-4 sm:space-y-5">
              {saveSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-800 flex items-center justify-between gap-2 shadow-2xs animate-in fade-in slide-in-from-top-1">
                  <span className="flex items-center gap-2 font-semibold">
                    <span className="material-symbols-outlined text-[18px] text-[#006857]">
                      check_circle
                    </span>
                    {saveSuccess}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSaveSuccess(null)}
                    className="text-emerald-600 hover:text-emerald-900 cursor-pointer p-0.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              )}

              {loading && (
                <div className="py-12 text-center text-xs text-slate-500">
                  <span className="material-symbols-outlined animate-spin text-[24px] text-[#006857] mb-2">
                    progress_activity
                  </span>
                  <p>Đang tải chỉ số sức khỏe &amp; phân tích hiệu quả...</p>
                </div>
              )}

              {error && !loading && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                  {error}
                </div>
              )}

              {!loading && (
                <>
                  {/* 4 Vital Metric Cards at Top */}
                  <section className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                    <EnhancedVitalTile
                      icon="monitor_weight"
                      tone="blue"
                      label="Cân nặng"
                      value={latestWeight != null ? `${latestWeight}` : null}
                      unit="kg"
                      delta={weightDelta}
                      status={weightStatus}
                    />
                    <EnhancedVitalTile
                      icon="favorite"
                      tone="rose"
                      label="Huyết áp"
                      value={
                        latestBP.sys != null && latestBP.dia != null
                          ? `${latestBP.sys}/${latestBP.dia}`
                          : null
                      }
                      unit="mmHg"
                      status={bpStatus}
                    />
                    <EnhancedVitalTile
                      icon="water_drop"
                      tone="amber"
                      label="Đường lúc đói"
                      value={latestGlucose != null ? `${latestGlucose}` : null}
                      unit="mmol/L"
                      delta={glucoseDelta}
                      status={glucoseStatus}
                    />
                    <EnhancedVitalTile
                      icon="straighten"
                      tone="indigo"
                      label="BMI"
                      value={latestBmi != null ? `${latestBmi}` : null}
                      unit=""
                      delta={bmiDelta}
                      status={bmiStatus}
                    />
                  </section>

                  {/* Main Tab Navigation */}
                  <div className="flex items-center gap-1 border-b border-slate-200 text-xs font-bold pt-1">
                    <button
                      type="button"
                      onClick={() => setActiveTab("chart")}
                      className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                        activeTab === "chart"
                          ? "border-[#006857] text-[#006857]"
                          : "border-transparent text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">show_chart</span>
                      <span>Biểu đồ theo ngày</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("comparison")}
                      className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                        activeTab === "comparison"
                          ? "border-[#006857] text-[#006857]"
                          : "border-transparent text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">compare_arrows</span>
                      <span>Trước vs Hiện tại</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("nutrition")}
                      className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                        activeTab === "nutrition"
                          ? "border-[#006857] text-[#006857]"
                          : "border-transparent text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">science</span>
                      <span>Cơ chế Dinh dưỡng</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("roadmap")}
                      className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                        activeTab === "roadmap"
                          ? "border-[#006857] text-[#006857]"
                          : "border-transparent text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">flag</span>
                      <span>Lộ trình</span>
                    </button>
                  </div>

                  {/* Active Tab Content */}
                  {activeTab === "chart" && <MetricsOverlayChart history={history} onRecord={goToRecordMetricsForm} />}

                  {activeTab !== "chart" && (
                    <MetricsImprovementSummary
                      history={history}
                      profile={profile}
                      activePlan={activePlan}
                      activeTab={activeTab}
                      onSelectTab={(t) => setActiveTab(t)}
                      onRecordClick={goToRecordMetricsForm}
                    />
                  )}

                  {/* Delta Advice Alert if applicable */}
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

                  {/* Action Button */}
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

function EnhancedVitalTile({
  icon,
  tone,
  label,
  value,
  unit,
  delta,
  status,
}: {
  icon: string;
  tone: "blue" | "rose" | "amber" | "indigo";
  label: string;
  value: string | null;
  unit: string;
  delta?: MetricDeltaCalculation | null;
  status?: MetricClinicalStatus | null;
}) {
  return (
    <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/90 flex flex-col justify-between gap-2 min-w-0 shadow-2xs">
      <div className="flex items-center justify-between gap-1">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100 text-slate-700 border border-slate-200/80">
          <span className="material-symbols-outlined text-[16px]">{icon}</span>
        </div>
        {status && (
          <span
            className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${status.badgeClass} truncate`}
          >
            {status.shortLabel}
          </span>
        )}
      </div>

      <div className="min-w-0">
        <p className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider truncate">
          {label}
        </p>
        <div className="flex items-baseline gap-1 mt-0.5 min-w-0">
          <span className="text-base sm:text-lg font-extrabold text-slate-900 tabular-nums truncate">
            {value ?? "—"}
          </span>
          {value && unit && (
            <span className="text-[10px] text-slate-500 font-semibold shrink-0">{unit}</span>
          )}
        </div>
      </div>

      {/* Delta indicator */}
      {delta && !delta.isNeutral ? (
        <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[10px]">
          <span className="text-slate-400">So ban đầu:</span>
          <span
            className={`font-bold tabular-nums inline-flex items-center gap-0.5 ${
              delta.isImproved ? "text-emerald-700" : "text-slate-700"
            }`}
          >
            {delta.isImproved ? "↓" : "↑"} {delta.formattedDelta}
          </span>
        </div>
      ) : (
        <div className="pt-1 border-t border-slate-100 text-[10px] text-slate-400 text-right">
          Ổn định
        </div>
      )}
    </div>
  );
}
