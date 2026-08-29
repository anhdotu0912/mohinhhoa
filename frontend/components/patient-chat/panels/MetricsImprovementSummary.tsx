"use client";

import React from "react";
import {
  METRIC_SERIES,
  calculateMetricDelta,
  getMetricClinicalStatus,
  type MetricSeriesId,
} from "@/lib/metrics-series";
import type { MealPlanOutput, MetricsHistoryPoint, PatientProfile } from "@/lib/types";

interface MetricsImprovementSummaryProps {
  history: MetricsHistoryPoint[];
  profile?: PatientProfile | null;
  activePlan?: MealPlanOutput | null;
  activeTab: "comparison" | "nutrition" | "roadmap";
  onSelectTab?: (tab: "comparison" | "nutrition" | "roadmap") => void;
  onRecordClick?: () => void;
}

export function MetricsImprovementSummary({
  history,
  profile,
  activePlan,
  activeTab,
}: MetricsImprovementSummaryProps) {
  // Find earliest and latest records
  const sorted = [...history].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );

  const getMetricValue = (
    point: MetricsHistoryPoint | null | undefined,
    id: MetricSeriesId
  ): number | null => {
    if (!point) return null;
    switch (id) {
      case "weight":
        return point.weight ?? null;
      case "bmi":
        return point.bmi ?? null;
      case "waist":
        return point.waist_cm ?? null;
      case "systolic":
        return point.systolic ?? null;
      case "diastolic":
        return point.diastolic ?? null;
      case "glucose_fasting":
        return point.glucose_fasting ?? null;
      case "glucose_postprandial":
        return point.glucose_postprandial ?? null;
      case "hba1c":
        return point.hba1c ?? null;
      default:
        return null;
    }
  };

  const getBaselineValue = (id: MetricSeriesId): number | null => {
    for (const p of sorted) {
      const val = getMetricValue(p, id);
      if (val != null) return val;
    }
    if (!profile) return null;
    if (id === "weight" && profile.weight != null) return profile.weight;
    if (id === "bmi" && profile.bmi != null) return profile.bmi;
    return null;
  };

  const getLatestValue = (id: MetricSeriesId): number | null => {
    for (let i = sorted.length - 1; i >= 0; i--) {
      const val = getMetricValue(sorted[i], id);
      if (val != null) return val;
    }
    return getBaselineValue(id);
  };

  const coreSeries: MetricSeriesId[] = [
    "glucose_fasting",
    "glucose_postprandial",
    "hba1c",
    "systolic",
    "weight",
    "bmi",
  ];

  // Dynamic values extracted from active doctor-approved plan & profile
  const isDoctorApproved =
    profile?.constraints_status === "confirmed";
  const targetKcal = profile?.target_kcal || 1600;
  const treatmentGoals = profile?.treatment_goals || [];
  const diseases = profile?.disease || ["Đái tháo đường Type 2"];
  const hasHypertension = diseases.some((d) => /huyết áp|hypertension/i.test(d));
  const hasOverweight = (getLatestValue("bmi") ?? 23) >= 23;
  const currentWeight = getLatestValue("weight");
  const targetWeightLoss = hasOverweight ? "1.5 – 2.0 kg/tháng" : "Duy trì ổn định";

  // Calculate average carb from active plan if available
  const avgCarbG = activePlan?.days?.length
    ? Math.round(
        activePlan.days.reduce((s, d) => s + (d.totals?.carb_g || 0), 0) /
          activePlan.days.length
      )
    : 180;

  return (
    <div className="space-y-4">
      {/* Doctor Approval & Treatment Goals Ribbon */}
      <div className="bg-gradient-to-r from-emerald-50/90 via-teal-50/50 to-white rounded-xl p-3.5 sm:p-4 border border-emerald-200/80 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#006857] text-white flex items-center justify-center shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-[18px]">
                {isDoctorApproved ? "verified_user" : "clinical_notes"}
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-xs sm:text-sm text-slate-900 leading-tight">
                  {isDoctorApproved
                    ? "Thực đơn đã được Bác sĩ phê duyệt"
                    : "Thực đơn dinh dưỡng cá nhân hóa"}
                </h4>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                    isDoctorApproved
                      ? "bg-emerald-100/80 text-emerald-800 border-emerald-300"
                      : "bg-amber-50 text-amber-800 border-amber-200"
                  }`}
                >
                  {isDoctorApproved ? "Chuẩn Y khoa" : "Gợi ý AI"}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Năng lượng: <span className="font-bold text-[#006857]">{targetKcal} kcal/ngày</span> · Carb: ~<span className="font-bold text-[#006857]">{avgCarbG}g/ngày</span>
                {hasHypertension && " · Giảm muối (<5g/ngày)"}
              </p>
            </div>
          </div>
        </div>

        {treatmentGoals.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-1.5 border-t border-emerald-100/80">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Mục tiêu Bác sĩ:
            </span>
            {treatmentGoals.map((goal, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 text-[11px] font-medium bg-white text-slate-700 px-2.5 py-0.5 rounded-lg border border-slate-200/90 shadow-2xs"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#006857]" />
                {goal}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tab 1: Comparison Before vs After */}
      {activeTab === "comparison" && (
        <div className="space-y-3">
          <div className="p-3.5 bg-emerald-50/60 border border-emerald-200/80 rounded-xl flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#006857] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[18px]">verified</span>
            </div>
            <div className="text-xs space-y-0.5">
              <p className="font-bold text-slate-900">
                Hiệu quả đối chiếu lâm sàng theo chuẩn ADA &amp; Bộ Y Tế
              </p>
              <p className="text-slate-600 leading-relaxed">
                So sánh sự thay đổi giữa chỉ số khởi điểm và lần ghi nhận gần nhất khi bạn duy trì
                thực đơn dinh dưỡng kiểm soát đường huyết.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {coreSeries.map((seriesId) => {
              const def = METRIC_SERIES.find((s) => s.id === seriesId)!;
              const baseline = getBaselineValue(seriesId);
              const latest = getLatestValue(seriesId);
              const delta = calculateMetricDelta(seriesId, latest, baseline, def.unit);
              const status = getMetricClinicalStatus(seriesId, latest);

              return (
                <div
                  key={seriesId}
                  className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-2xs space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: def.color }}
                      />
                      <span className="font-bold text-xs text-slate-900 truncate">
                        {def.label}
                      </span>
                    </div>
                    {status && (
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${status.badgeClass}`}
                      >
                        <span className="material-symbols-outlined text-[12px]">
                          {status.icon}
                        </span>
                        {status.shortLabel}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-1 bg-slate-50/90 rounded-lg p-2 text-center border border-slate-100">
                    <div>
                      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                        Ban đầu
                      </p>
                      <p className="text-xs font-bold text-slate-700 mt-0.5 tabular-nums">
                        {baseline != null ? `${baseline} ${def.unit}` : "—"}
                      </p>
                    </div>

                    <div className="border-x border-slate-200/60 px-1">
                      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                        Hiện tại
                      </p>
                      <p className="text-xs font-extrabold text-[#006857] mt-0.5 tabular-nums">
                        {latest != null ? `${latest} ${def.unit}` : "—"}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                        Mục tiêu
                      </p>
                      <p className="text-xs font-semibold text-slate-600 mt-0.5 tabular-nums truncate">
                        {def.targetDesc}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-0.5">
                    <div className="flex items-center gap-1 text-slate-500 truncate">
                      <span className="material-symbols-outlined text-[14px] text-slate-400 shrink-0">
                        info
                      </span>
                      <span className="truncate">{def.clinicalGuideline}</span>
                    </div>

                    {delta && !delta.isNeutral ? (
                      <span
                        className={`font-bold shrink-0 ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] ${
                          delta.isImproved
                            ? "bg-emerald-100/80 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {delta.isImproved ? "↓ Cải thiện" : "↑ Tăng"} {delta.formattedDelta}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-medium shrink-0 ml-1 text-[10px]">
                        Ổn định
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Nutrition Science & Mechanism */}
      {activeTab === "nutrition" && (
        <div className="space-y-3">
          <div className="bg-gradient-to-r from-emerald-900 to-[#005245] rounded-xl p-4 text-white shadow-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="material-symbols-outlined text-emerald-300 text-[20px]">
                local_pharmacy
              </span>
              <h4 className="font-bold text-sm text-white">
                Cơ chế can thiệp dinh dưỡng cá nhân hóa ({targetKcal} kcal/ngày)
              </h4>
            </div>
            <p className="text-xs text-emerald-100/90 leading-relaxed">
              Thực đơn tuần này được thiết kế riêng cho bệnh lý{" "}
              <strong className="text-white">{diseases.join(", ")}</strong>, đáp ứng mục tiêu điều
              trị của Bác sĩ:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-2xs space-y-1.5">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200">
                <span className="material-symbols-outlined text-[18px]">grain</span>
              </div>
              <h5 className="font-bold text-xs text-slate-900">
                1. Phân bổ Carb GI thấp (~{avgCarbG}g/ngày)
              </h5>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Chia đều tinh bột hấp thu chậm vào 3 bữa chính và 1 bữa phụ, ngăn chặn hiện tượng
                tăng đường huyết sau ăn đột ngột.
              </p>
            </div>

            <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-2xs space-y-1.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
                <span className="material-symbols-outlined text-[18px]">eco</span>
              </div>
              <h5 className="font-bold text-xs text-slate-900">
                2. Tăng cường chất xơ hòa tan (&gt; 25g/ngày)
              </h5>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Rau xanh, nấm và các loại hạt làm chậm hấp thu đường tại ruột non, cải thiện chuyển
                hóa mỡ máu và độ nhạy insulin.
              </p>
            </div>

            <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-2xs space-y-1.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200">
                <span className="material-symbols-outlined text-[18px]">set_meal</span>
              </div>
              <h5 className="font-bold text-xs text-slate-900">
                3. Đạm nạc &amp; Axit béo Omega-3
              </h5>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Ức gà, cá béo, đậu hũ duy trì khối cơ nạc, giúp no lâu và giảm nguy cơ xơ vữa mạch
                vành ở bệnh nhân tiểu đường.
              </p>
            </div>

            <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-2xs space-y-1.5">
              <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-200">
                <span className="material-symbols-outlined text-[18px]">favorite</span>
              </div>
              <h5 className="font-bold text-xs text-slate-900">
                {hasHypertension ? "4. Hạn chế muối & Natri (< 2000mg)" : "4. Kiểm soát đường tự do & Natri"}
              </h5>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                {hasHypertension
                  ? "Chế độ giảm muối theo phác đồ DASH giúp hạ huyết áp tâm thu 5–8 mmHg và giảm áp lực lọc thận."
                  : "Loại bỏ đường tinh luyện và giảm muối giúp bảo vệ chức năng tim mạch và thận."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Dynamic Milestones Roadmap */}
      {activeTab === "roadmap" && (
        <div className="space-y-3">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start justify-between gap-3">
            <div>
              <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5 mb-1">
                <span className="material-symbols-outlined text-[#006857] text-[18px]">
                  timeline
                </span>
                Lộ trình cải thiện cá nhân hóa theo thực đơn {targetKcal} kcal/ngày
              </h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Lộ trình được tính toán dựa trên mức độ đáp ứng của bệnh lý{" "}
                <strong>{diseases.join(", ")}</strong> và phác đồ dinh dưỡng được Bác sĩ phê duyệt:
              </p>
            </div>
            {isDoctorApproved && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-1 rounded-md border border-emerald-300 shrink-0">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                Phác đồ Bác sĩ
              </span>
            )}
          </div>

          <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-emerald-200">
            {/* Week 1 */}
            <div className="relative bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-2xs">
              <div className="absolute -left-[27px] top-3.5 w-4 h-4 rounded-full bg-[#006857] border-2 border-white flex items-center justify-center shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-xs text-[#006857] uppercase tracking-wider">
                  Tuần 1: Thích nghi thực đơn ({targetKcal} kcal)
                </span>
                <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                  Giai đoạn 1
                </span>
              </div>
              <p className="text-xs text-slate-700 font-semibold mt-1">
                Đường sau ăn 2h &lt; 10.0 mmol/L, cắt giảm đỉnh nhọn
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                Carb GI thấp (~{avgCarbG}g/ngày) giúp đường huyết không tăng vọt sau ăn, giảm cảm giác
                thèm ngọt và mệt mỏi sau bữa trưa/tối.
              </p>
            </div>

            {/* Week 2 - 4 */}
            <div className="relative bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-2xs">
              <div className="absolute -left-[27px] top-3.5 w-4 h-4 rounded-full bg-[#006857] border-2 border-white flex items-center justify-center shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-xs text-[#006857] uppercase tracking-wider">
                  Tuần 2 – 4: Phục hồi đường nền &amp; Cân nặng
                </span>
                <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                  Giai đoạn 2
                </span>
              </div>
              <p className="text-xs text-slate-700 font-semibold mt-1">
                Đường lúc đói về ngưỡng 4.4 – 7.2 mmol/L · Giảm {targetWeightLoss}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                {hasHypertension
                  ? "Tế bào gan tăng nhạy cảm với insulin; chế độ giảm muối giúp huyết áp tâm thu hạ về < 130 mmHg."
                  : "Tế bào gan tăng nhạy cảm với insulin, lượng mỡ nội tạng giảm giúp đường huyết lúc đói ổn định vững vàng."}
              </p>
            </div>

            {/* Week 8 - 12 */}
            <div className="relative bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-2xs">
              <div className="absolute -left-[27px] top-3.5 w-4 h-4 rounded-full bg-amber-500 border-2 border-white flex items-center justify-center shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-xs text-amber-800 uppercase tracking-wider">
                  Tuần 8 – 12: Kiểm soát HbA1c bền vững
                </span>
                <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                  Mục tiêu Bác sĩ
                </span>
              </div>
              <p className="text-xs text-slate-700 font-semibold mt-1">
                HbA1c giảm 0.5% – 1.0% (Mục tiêu &lt; 7.0%), ngừa biến chứng tim - thận
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                Kết quả xét nghiệm máu 3 tháng phản ánh sự thích ứng hoàn hảo của cơ thể với thực đơn
                dinh dưỡng, giúp bác sĩ có cơ sở cân nhắc giảm liều thuốc hạ đường huyết.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
