"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { usePatientPanel } from "../PatientPanelProvider";
import { api } from "@/lib/api";
import { ApiError, type MetricsHistoryPoint } from "@/lib/types";
import { RecordMetricsFormPanel } from "./RecordMetricsFormPanel";

export function HealthMetricsPanel() {
  const { closePanel, healthView, goToRecordMetricsForm, backToHealthDock } =
    usePatientPanel();

  const [history, setHistory] = useState<MetricsHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const data = await api.getMetricsHistory(90);
      setHistory(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không tải được chỉ số.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Extract latest metrics
  const latestWeight = useMemo(() => {
    const pt = history.find((p) => p.weight !== null && p.weight !== undefined);
    return pt?.weight ? `${pt.weight}` : "68.5";
  }, [history]);

  const latestBP = useMemo(() => {
    const pt = history.find((p) => Boolean(p.blood_pressure));
    return pt?.blood_pressure || "118/75";
  }, [history]);

  const latestGlucose = useMemo(() => {
    const pt = history.find((p) => Boolean(p.blood_glucose));
    return pt?.blood_glucose || "5.6";
  }, [history]);

  const formattedDate = new Date().toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

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
      <div className="relative w-[92%] max-w-2xl max-h-[85vh] bg-white rounded-2xl shadow-2xl z-10 flex flex-col border border-slate-200/90 animate-in fade-in zoom-in-95 duration-200 overflow-hidden my-auto">
        {healthView === "record" ? (
          <RecordMetricsFormPanel
            onBack={backToHealthDock}
            onClose={closePanel}
            onSaved={loadData}
          />
        ) : (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Fixed Header */}
            <div className="px-6 md:px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-white/95 backdrop-blur-md shrink-0">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#006857] flex items-center justify-center border border-emerald-200 shadow-2xs">
                  <span className="material-symbols-outlined text-[22px]">
                    vital_signs
                  </span>
                </div>
                <div>
                  <h2 className="font-bold text-lg text-slate-900">Chỉ số sức khỏe</h2>
                  <p className="text-xs text-slate-500 font-medium capitalize">{formattedDate}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closePanel}
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                title="Đóng (ESC)"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
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
                        <p className="text-xs text-slate-500 font-medium">Xu hướng 7 ngày ({latestGlucose} mmol/L)</p>
                      </div>
                      <div className="flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 text-emerald-800 text-xs font-bold shadow-2xs">
                        <span className="material-symbols-outlined text-[16px] text-[#006857]">trending_down</span>
                        <span>-2.4%</span>
                      </div>
                    </div>

                    {/* Chart Container */}
                    <div className="w-full bg-slate-50/80 rounded-xl border border-slate-200/80 relative flex flex-col p-4 pt-5 pb-3 shadow-2xs">
                      {/* Grid Lines (Subtle faint dashed lines with opacity ~0.05) */}
                      <div className="absolute inset-x-4 top-5 bottom-8 flex flex-col justify-between pointer-events-none">
                        <div className="border-t border-dashed border-slate-900/[0.05] w-full" />
                        <div className="border-t border-dashed border-slate-900/[0.05] w-full" />
                        <div className="border-t border-dashed border-slate-900/[0.05] w-full" />
                      </div>

                      {/* SVG Line Graph & Area Fill */}
                      <div className="w-full h-32 relative">
                        <svg
                          className="w-full h-full overflow-visible"
                          preserveAspectRatio="none"
                          viewBox="0 0 100 100"
                        >
                          <defs>
                            {/* Area Gradient with top opacity 0.15 fading to 0.0 at bottom */}
                            <linearGradient id="panelLineGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#005F56" stopOpacity="0.15" />
                              <stop offset="100%" stopColor="#005F56" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>

                          {/* Smooth Area Gradient */}
                          <path
                            d="M 0.00,70.00 C 5.56,66.00 11.11,55.67 16.67,55.00 C 22.22,54.33 27.78,67.00 33.33,65.00 C 38.89,63.00 44.44,42.27 50.00,40.00 C 55.56,37.73 61.11,49.33 66.67,48.00 C 72.22,46.67 77.78,33.73 83.33,30.00 C 88.89,26.27 94.44,22.67 100.00,20.00 L 100,100 L 0,100 Z"
                            fill="url(#panelLineGrad)"
                          />

                          {/* Smooth Hairline Curve (tension ~0.4, stroke-width 1.75px, teal #005F56) */}
                          <path
                            d="M 0.00,70.00 C 5.56,66.00 11.11,55.67 16.67,55.00 C 22.22,54.33 27.78,67.00 33.33,65.00 C 38.89,63.00 44.44,42.27 50.00,40.00 C 55.56,37.73 61.11,49.33 66.67,48.00 C 72.22,46.67 77.78,33.73 83.33,30.00 C 88.89,26.27 94.44,22.67 100.00,20.00"
                            fill="none"
                            stroke="#005F56"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke"
                          />
                        </svg>

                        {/* Crisp Data Points / Markers Overlay (r ~ 3.5px, white border, subtle hover glow & tooltip) */}
                        <div className="absolute inset-0 pointer-events-none">
                          {[
                            { day: "T2", x: 0, y: 70, val: "5.9" },
                            { day: "T3", x: 16.67, y: 55, val: "5.7" },
                            { day: "T4", x: 33.33, y: 65, val: "5.8" },
                            { day: "T5", x: 50, y: 40, val: "5.5" },
                            { day: "T6", x: 66.67, y: 48, val: "5.6" },
                            { day: "T7", x: 83.33, y: 30, val: "5.4" },
                            { day: "CN", x: 100, y: 20, val: latestGlucose },
                          ].map((pt) => (
                            <div
                              key={pt.day}
                              className="absolute -translate-x-1/2 -translate-y-1/2 group/dot flex flex-col items-center pointer-events-auto cursor-pointer"
                              style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
                            >
                              {/* Hover Tooltip */}
                              <div className="absolute bottom-full mb-2 opacity-0 group-hover/dot:opacity-100 transition-all duration-150 pointer-events-none scale-90 group-hover/dot:scale-100 z-30 whitespace-nowrap bg-slate-900/90 backdrop-blur-xs text-white text-[11px] font-medium px-2 py-0.5 rounded shadow-lg">
                                {pt.day}: {pt.val} mmol/L
                              </div>

                              {/* Subtle Highlight Glow for Latest Point (CN) */}
                              {pt.day === "CN" && (
                                <span className="absolute w-4.5 h-4.5 rounded-full bg-[#005F56]/20 animate-ping pointer-events-none" />
                              )}

                              {/* Dot Node */}
                              <div
                                className={`rounded-full bg-[#005F56] border-[1.5px] border-white shadow-[0_1px_3px_rgba(0,95,86,0.35)] transition-all duration-150 group-hover/dot:scale-135 group-hover/dot:ring-3 group-hover/dot:ring-[#005F56]/25 ${
                                  pt.day === "CN" ? "w-2 h-2 ring-2 ring-[#005F56]/30" : "w-[7px] h-[7px]"
                                }`}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* X-axis Day Labels */}
                      <div className="w-full flex justify-between pt-3 text-[11px] font-semibold text-slate-400">
                        <span>T2</span>
                        <span>T3</span>
                        <span>T4</span>
                        <span>T5</span>
                        <span>T6</span>
                        <span>T7</span>
                        <span className="text-[#005F56] font-bold">CN</span>
                      </div>
                    </div>
                  </section>

                  {/* Bento Grid */}
                  <section className="grid grid-cols-2 gap-3.5">
                    {/* Compliance Ring Card */}
                    <div className="col-span-2 bg-slate-50/90 rounded-xl p-4 border border-slate-200/80 flex items-center justify-between shadow-2xs">
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">Mức độ tuân thủ</h4>
                        <p className="text-xs text-slate-500 font-medium">Theo phác đồ điều trị</p>
                      </div>
                      <div className="relative w-20 h-20 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                          <circle
                            cx="50"
                            cy="50"
                            r="40"
                            fill="none"
                            stroke="#e2e8f0"
                            strokeWidth="8"
                          />
                          <circle
                            cx="50"
                            cy="50"
                            r="40"
                            fill="none"
                            stroke="#006857"
                            strokeWidth="8"
                            strokeDasharray="251.2"
                            strokeDashoffset="37.68"
                            strokeLinecap="round"
                            className="transition-all duration-1000"
                          />
                        </svg>
                        <span className="absolute font-extrabold text-base text-[#006857]">
                          85%
                        </span>
                      </div>
                    </div>

                    {/* Vital: Weight */}
                    <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs relative flex flex-col justify-between gap-2">
                      <div className="flex items-center justify-between">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100 shadow-2xs">
                          <span className="material-symbols-outlined text-[18px]">
                            monitor_weight
                          </span>
                        </div>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold">
                          Ổn định
                        </span>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Cân nặng
                        </p>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-xl font-extrabold text-slate-900">
                            {latestWeight}
                          </span>
                          <span className="text-xs text-slate-500 font-semibold">kg</span>
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
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-[10px] font-bold">
                          Bình thường
                        </span>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Huyết áp
                        </p>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-xl font-extrabold text-slate-900">
                            {latestBP}
                          </span>
                          <span className="text-xs text-slate-500 font-semibold">mmHg</span>
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
