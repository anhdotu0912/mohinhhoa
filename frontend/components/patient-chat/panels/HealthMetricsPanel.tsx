"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  type MetricClinicalStatus,
  type MetricDeltaCalculation,
} from "@/lib/metrics-series";
import { MetricsOverlayChart } from "@/components/patient/MetricsOverlayChart";
import { MetricsImprovementSummary } from "./MetricsImprovementSummary";
import { RecordMetricsFormPanel } from "./RecordMetricsFormPanel";

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

  const loadData = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [metricsData, profileData, scheduleData] = await Promise.allSettled([
        api.getMetricsHistory(90),
        api.getProfile(),
        api.getMyMealPlanSchedule(),
      ]);

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
      setError(err instanceof ApiError ? err.message : "Không tải được chỉ số sức khỏe.");
    } finally {
      setLoading(false);
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
    const pt = sortedHistory.find((p) => p.weight != null);
    return pt?.weight ?? profile?.weight ?? null;
  }, [sortedHistory, profile]);

  const latestBmi = useMemo(() => {
    const pt = [...sortedHistory].reverse().find((p) => p.bmi != null);
    return pt?.bmi ?? profile?.bmi ?? null;
  }, [sortedHistory, profile]);

  const baselineBmi = useMemo(() => {
    const pt = sortedHistory.find((p) => p.bmi != null);
    return pt?.bmi ?? profile?.bmi ?? null;
  }, [sortedHistory, profile]);

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
    const pt = sortedHistory.find(
      (p) => p.glucose_fasting != null || Boolean(p.blood_glucose)
    );
    if (!pt) {
      if (profile?.blood_glucose) {
        return parseGlucoseMmol(profile.blood_glucose);
      }
      return null;
    }
    if (pt.glucose_fasting != null) return pt.glucose_fasting;
    return parseGlucoseMmol(pt.blood_glucose);
  }, [sortedHistory, profile]);

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

  const handleSaved = (advice?: MetricsDeltaAdviceOut | null) => {
    setDeltaAdvice(advice ?? null);
    setSaveSuccess("Đã lưu và cập nhật chỉ số sức khỏe hôm nay thành công!");
    setTimeout(() => setSaveSuccess(null), 6000);
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
                  {/* Meal Plan Health Impact Header Card */}
                  <section className="bg-gradient-to-br from-[#006857] via-[#005446] to-[#043e34] rounded-2xl p-4 sm:p-5 text-white shadow-md relative overflow-hidden">
                    {/* Background Pattern */}
                    <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 to-transparent pointer-events-none" />

                    <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 bg-emerald-400/20 text-emerald-200 text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full border border-emerald-400/30">
                            <span className="material-symbols-outlined text-[13px]">verified</span>
                            Hiệu quả Thực đơn Dinh dưỡng
                          </span>
                        </div>
                        <h3 className="font-extrabold text-base sm:text-lg text-white leading-tight">
                          Đường huyết ổn định trong vùng an toàn
                        </h3>
                        <p className="text-xs text-emerald-100/90 leading-relaxed max-w-xl">
                          Chế độ ăn kiểm soát carbohydrate và GI thấp giúp giảm biên độ dao động
                          đường huyết và bảo vệ mạch máu trước biến chứng.
                        </p>
                      </div>

                      {/* Quick Highlight Stats */}
                      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3 shrink-0 bg-white/10 backdrop-blur-xs p-2.5 rounded-xl border border-white/15">
                        <div className="text-center px-2">
                          <p className="text-[10px] text-emerald-200 font-semibold uppercase tracking-wider">
                            Đường lúc đói
                          </p>
                          <p className="text-sm sm:text-base font-extrabold text-white mt-0.5 tabular-nums">
                            {latestGlucose != null ? `${latestGlucose} mmol/L` : "—"}
                          </p>
                          {impactSummary.glucoseDelta !== 0 && (
                            <p
                              className={`text-[10px] font-bold mt-0.5 ${
                                impactSummary.isGlucoseImproved
                                  ? "text-emerald-300"
                                  : "text-amber-300"
                              }`}
                            >
                              {impactSummary.isGlucoseImproved ? "↓ Giảm" : "↑ Tăng"}{" "}
                              {Math.abs(impactSummary.glucoseDelta)} mmol/L
                            </p>
                          )}
                        </div>

                        <div className="text-center px-2 border-l border-white/15">
                          <p className="text-[10px] text-emerald-200 font-semibold uppercase tracking-wider">
                            Trong chuẩn ADA
                          </p>
                          <p className="text-sm sm:text-base font-extrabold text-emerald-300 mt-0.5 tabular-nums">
                            {impactSummary.timeInRangePct}%
                          </p>
                          <p className="text-[10px] text-emerald-200/80 mt-0.5 font-medium">
                            Mục tiêu &gt; 70%
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Main Tab Navigation */}
                  <div className="flex items-center gap-1 border-b border-slate-200 text-xs font-bold">
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
                      <span>Biểu đồ &amp; Dự đoán</span>
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
                  {activeTab === "chart" && <MetricsOverlayChart history={history} />}

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

                  {/* 4 Enhanced Vital Tiles */}
                  <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
  const tones: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    rose: "bg-rose-50 text-rose-700 border-rose-100",
    amber: "bg-amber-50 text-amber-800 border-amber-100",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-100",
  };

  return (
    <div className="bg-white rounded-xl p-3.5 border border-slate-200/90 flex flex-col justify-between gap-2.5 min-w-0 shadow-2xs">
      <div className="flex items-center justify-between gap-1">
        <div
          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center border ${tones[tone]}`}
        >
          <span className="material-symbols-outlined text-[16px] sm:text-[18px]">{icon}</span>
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
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
          {label}
        </p>
        <div className="flex items-baseline gap-1 mt-0.5 min-w-0">
          <span className="text-lg sm:text-xl font-extrabold text-slate-900 tabular-nums truncate">
            {value ?? "—"}
          </span>
          {value && unit && (
            <span className="text-[11px] text-slate-500 font-semibold shrink-0">{unit}</span>
          )}
        </div>
      </div>

      {/* Delta indicator */}
      {delta && !delta.isNeutral ? (
        <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[10px]">
          <span className="text-slate-400">So với ban đầu:</span>
          <span
            className={`font-bold tabular-nums inline-flex items-center gap-0.5 ${
              delta.isImproved ? "text-emerald-700" : "text-amber-700"
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
