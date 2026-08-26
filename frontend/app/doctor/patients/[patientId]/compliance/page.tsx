"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { asRouteId } from "@/lib/route-params";
import { MetricsOverlayChart } from "@/components/patient/MetricsOverlayChart";
import {
  ApiError,
  type DoctorPatientSummary,
  type MetricsHistoryPoint,
  type PatientComplianceOut,
} from "@/lib/types";

const COMPLIANCE_DAYS = 14;
const DEFAULT_REMIND = "Bác sĩ nhắc bạn ghi nhận tuân thủ thực đơn hôm nay nhé.";

function weekdayShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][d.getDay()];
}

function formatShortDate(iso: string): string {
  const parts = iso.split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : iso;
}

function formatEventTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTimeFull(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function bmiCategoryOf(bmi: number | null | undefined): { label: string; color: string; bg: string } {
  if (bmi == null || Number.isNaN(bmi) || bmi <= 0) {
    return { label: "Chưa tính", color: "text-on-surface-variant", bg: "bg-surface-container-high" };
  }
  if (bmi < 18.5) return { label: "Thiếu cân", color: "text-sky-900", bg: "bg-sky-50 border-sky-200" };
  if (bmi <= 22.9) return { label: "Bình thường (Chuẩn Á)", color: "text-emerald-900", bg: "bg-emerald-50 border-emerald-200" };
  if (bmi <= 24.9) return { label: "Tiền béo phì", color: "text-amber-900", bg: "bg-amber-50 border-amber-200" };
  if (bmi <= 29.9) return { label: "Béo phì độ I", color: "text-rose-900", bg: "bg-rose-50 border-rose-200" };
  return { label: "Béo phì độ II", color: "text-rose-950", bg: "bg-rose-100 border-rose-300" };
}

export default function PatientComplianceTabPage() {
  const params = useParams();
  const router = useRouter();
  const patientId = asRouteId(params?.patientId);
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);

  const [hydrated, setHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState<"compliance" | "metrics">("compliance");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [complianceData, setComplianceData] = useState<PatientComplianceOut | null>(null);
  const [patientSummary, setPatientSummary] = useState<DoctorPatientSummary | null>(null);
  const [metricsHistory, setMetricsHistory] = useState<MetricsHistoryPoint[]>([]);

  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [remindMessage, setRemindMessage] = useState(DEFAULT_REMIND);
  const [remindSending, setRemindSending] = useState(false);
  const [remindFeedback, setRemindFeedback] = useState<string | null>(null);

  const [metricsFilter, setMetricsFilter] = useState<"all" | "patient" | "doctor">("all");

  useEffect(() => {
    setHydrated(true);
  }, []);

  const loadData = useCallback(async () => {
    if (!token || role !== "doctor" || !patientId) return;
    setLoading(true);
    setError(null);
    try {
      const [compRow, summaryRow, historyRows] = await Promise.all([
        api.getPatientCompliance(patientId, COMPLIANCE_DAYS).catch(() => null),
        api.getDoctorPatient(patientId).catch(() => null),
        api.getDoctorPatientMetricsHistory(patientId, 90).catch(() => [] as MetricsHistoryPoint[]),
      ]);
      setComplianceData(compRow);
      setPatientSummary(summaryRow);
      setMetricsHistory(historyRows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không tải được dữ liệu theo dõi.");
    } finally {
      setLoading(false);
    }
  }, [token, role, patientId]);

  useEffect(() => {
    if (!hydrated) return;
    if (!token || role !== "doctor") {
      router.replace("/login");
      return;
    }
    void loadData();
  }, [hydrated, token, role, router, loadData]);

  const handleRemind = async () => {
    if (!patientId || remindSending) return;
    setRemindSending(true);
    setRemindFeedback(null);
    try {
      await api.remindPatientCompliance(patientId, remindMessage.trim());
      const row = await api.getPatientCompliance(patientId, COMPLIANCE_DAYS);
      setComplianceData(row);
      setRemindFeedback("Đã gửi nhắc nhở thành công. Bệnh nhân sẽ nhận được thông báo ngay.");
    } catch (err) {
      setRemindFeedback(
        err instanceof ApiError ? err.message : "Không gửi được nhắc nhở."
      );
    } finally {
      setRemindSending(false);
    }
  };

  const filteredMetrics = useMemo(() => {
    if (metricsFilter === "all") return metricsHistory;
    return metricsHistory.filter((m) => m.recorded_by === metricsFilter);
  }, [metricsHistory, metricsFilter]);

  const latestMetric = useMemo(() => {
    if (metricsHistory.length > 0) {
      return metricsHistory[metricsHistory.length - 1];
    }
    return null;
  }, [metricsHistory]);

  const chartHistory = useMemo(() => {
    if (metricsHistory.length > 0) return metricsHistory;
    if (!patientSummary) return [];
    if (
      patientSummary.weight != null ||
      patientSummary.blood_pressure ||
      patientSummary.blood_glucose
    ) {
      return [
        {
          id: "baseline-snapshot",
          user_id: patientSummary.id,
          weight: patientSummary.weight ?? null,
          height: patientSummary.height ?? null,
          bmi: patientSummary.bmi ?? null,
          blood_pressure: patientSummary.blood_pressure ?? null,
          blood_glucose: patientSummary.blood_glucose ?? null,
          recorded_by: "doctor" as const,
          recorded_at: patientSummary.last_update || new Date().toISOString(),
        },
      ];
    }
    return [];
  }, [metricsHistory, patientSummary]);

  const effectiveWeight = latestMetric?.weight ?? patientSummary?.weight ?? null;
  const effectiveHeight = latestMetric?.height ?? patientSummary?.height ?? null;
  const effectiveBmi = latestMetric?.bmi ?? patientSummary?.bmi ?? null;
  const effectiveBP = latestMetric?.blood_pressure ?? patientSummary?.blood_pressure ?? (latestMetric?.systolic && latestMetric?.diastolic ? `${latestMetric.systolic}/${latestMetric.diastolic}` : "—");
  const effectiveGlucose = latestMetric?.blood_glucose ?? patientSummary?.blood_glucose ?? (latestMetric?.glucose_fasting ? `${latestMetric.glucose_fasting} mmol/L` : "—");
  const effectiveWaist = latestMetric?.waist_cm ?? null;
  const effectiveHba1c = latestMetric?.hba1c ?? null;

  if (!hydrated || !token || role !== "doctor") return null;

  if (loading) {
    return (
      <main className="p-6 md:p-8 text-sm text-on-surface-variant max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[24px] animate-spin">
            progress_activity
          </span>
          <span>Đang tải dữ liệu tuân thủ &amp; chỉ số sinh hiệu…</span>
        </div>
      </main>
    );
  }

  const series = complianceData?.daily_series ?? [];
  const hasChart = series.some((d) => d.adherence_pct != null);
  const rate = complianceData?.overall_adherence_pct ?? null;

  return (
    <main className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header & Patient Context */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-on-surface font-black text-2xl tracking-tight flex items-center gap-2">
            <span>Theo dõi Tuân thủ &amp; Chỉ số Bệnh nhân</span>
          </h2>
          <p className="text-on-surface-variant mt-1 text-xs font-medium">
            Phân tích nhật ký dinh dưỡng 14 ngày kết hợp chuỗi thời gian các chỉ số sinh hiệu bệnh nhân tự ghi nhận
          </p>
        </div>

        {/* Tab Switcher Controller */}
        <div className="flex items-center gap-1.5 p-1 bg-surface-container-low border border-outline-variant/60 rounded-lg self-start md:self-auto shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab("compliance")}
            className={`px-4 py-2 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "compliance"
                ? "bg-primary text-on-primary shadow-2xs"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">verified</span>
            <span>Tuân thủ &amp; Bữa ăn</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("metrics")}
            className={`px-4 py-2 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "metrics"
                ? "bg-primary text-on-primary shadow-2xs"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">monitoring</span>
            <span>Chuỗi Chỉ số Sinh hiệu ({metricsHistory.length})</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 font-semibold flex justify-between items-center shadow-xs">
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px]">warning</span>
            <span>{error}</span>
          </span>
          <button
            type="button"
            onClick={() => void loadData()}
            className="font-bold text-primary underline cursor-pointer hover:text-primary/80"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 1: TUÂN THỦ DINH DƯỠNG & BỮA ĂN (14-day Compliance)   */}
      {/* ========================================================= */}
      {activeTab === "compliance" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* 3 Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 bg-surface-container-lowest border border-outline-variant/60 rounded-xl shadow-xs text-center flex flex-col justify-center">
              <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                Tỷ lệ tuân thủ 14 ngày
              </p>
              <p className="text-3xl font-black text-primary mt-1.5 tabular-nums tracking-tight">
                {rate != null ? `${rate}%` : "—"}
              </p>
              <span className="text-[10px] text-on-surface-variant mt-1">Đạt mục tiêu thực đơn đề ra</span>
            </div>

            <div className="p-5 bg-surface-container-lowest border border-outline-variant/60 rounded-xl shadow-xs text-center flex flex-col justify-center">
              <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                Check-in đúng kế hoạch
              </p>
              <p className="text-3xl font-black text-on-surface mt-1.5 tabular-nums tracking-tight">
                {complianceData?.checkins_as_planned ?? 0}{" "}
                <span className="text-sm font-semibold text-on-surface-variant">
                  / {complianceData?.checkins_done ?? 0} bữa
                </span>
              </p>
              <span className="text-[10px] text-on-surface-variant mt-1">Số bữa ăn đã ghi nhật ký</span>
            </div>

            <div className="p-5 bg-surface-container-lowest border border-outline-variant/60 rounded-xl shadow-xs text-center flex flex-col justify-center">
              <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                Đánh giá lâm sàng
              </p>
              <div className="mt-2">
                {rate == null ? (
                  <span className="inline-block px-3 py-1 rounded-md text-xs font-bold bg-surface-container-low text-on-surface-variant">
                    Chưa có dữ liệu
                  </span>
                ) : rate >= 85 ? (
                  <span className="inline-block px-3 py-1 rounded-md text-xs font-bold bg-emerald-500/15 text-emerald-900 border border-emerald-500/25">
                    Tuân thủ rất tốt
                  </span>
                ) : rate < (complianceData?.low_threshold_pct ?? 50) ? (
                  <span className="inline-block px-3 py-1 rounded-md text-xs font-bold bg-rose-500/15 text-rose-900 border border-rose-500/25">
                    Cần can thiệp lâm sàng
                  </span>
                ) : (
                  <span className="inline-block px-3 py-1 rounded-md text-xs font-bold bg-amber-500/15 text-amber-900 border border-amber-500/25">
                    Cần nhắc nhở &amp; theo dõi
                  </span>
                )}
              </div>
              <span className="text-[10px] text-on-surface-variant mt-1.5">
                Ngưỡng cảnh báo tối thiểu: {complianceData?.low_threshold_pct ?? 50}%
              </span>
            </div>
          </div>

          {/* 14-Day Interactive Bar Chart */}
          <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-2 uppercase tracking-wider">
                <span className="material-symbols-outlined text-primary text-[20px]">bar_chart</span>
                <span>Biểu đồ tuân thủ 14 ngày gần nhất</span>
              </h3>
              <div className="flex items-center gap-3 text-[11px] text-on-surface-variant">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-primary" />
                  <span>≥ 80% (Tốt)</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                  <span>60–79% (Vừa)</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
                  <span>&lt; 60% (Kém)</span>
                </span>
              </div>
            </div>

            {!hasChart ? (
              <div className="h-[200px] flex flex-col items-center justify-center text-on-surface-variant">
                <span className="material-symbols-outlined text-[40px] text-outline/40 mb-1">
                  bar_chart
                </span>
                <p className="text-sm font-bold text-on-surface">Chưa có dữ liệu tuân thủ 14 ngày</p>
                <p className="text-xs mt-1 text-center max-w-sm text-on-surface-variant">
                  Bệnh nhân chưa ghi nhận bữa ăn hoặc check-in trong chu kỳ 14 ngày qua.
                </p>
              </div>
            ) : (
              <div className="flex items-end justify-between gap-1.5 min-h-[190px] pt-6 overflow-x-auto">
                {series.map((item, idx) => {
                  const hasVal = item.adherence_pct != null;
                  const value = item.adherence_pct ?? 0;
                  const high = hasVal && value >= 80;
                  const mid = hasVal && value >= 60 && value < 80;
                  const bar = high ? "bg-primary" : mid ? "bg-amber-500" : "bg-rose-500";
                  const isToday = idx === series.length - 1;
                  const isHovered = hoveredDate === item.date;
                  const isSelected = selectedDate === item.date;

                  return (
                    <div
                      key={item.date}
                      className="flex-1 flex flex-col items-center min-w-[32px] cursor-pointer group"
                      onMouseEnter={() => setHoveredDate(item.date)}
                      onMouseLeave={() => setHoveredDate(null)}
                      onClick={() => setSelectedDate(item.date === selectedDate ? null : item.date)}
                    >
                      <span className={`text-[10px] font-bold tabular-nums mb-1 transition-all ${
                        isHovered || isSelected ? "text-primary scale-110" : "text-on-surface-variant"
                      }`}>
                        {hasVal ? `${value}%` : "—"}
                      </span>
                      <div className="w-full h-[120px] flex items-end justify-center">
                        {hasVal ? (
                          <div
                            className={`w-full max-w-[24px] rounded-t-xl transition-all ${bar} ${
                              isHovered || isSelected ? "ring-4 ring-primary/20 scale-y-105" : "hover:opacity-90"
                            }`}
                            style={{ height: `${Math.max(value, 8)}%` }}
                          />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-outline-variant/60 mb-2" />
                        )}
                      </div>
                      <span
                        className={`mt-1.5 text-[11px] font-bold ${
                          isToday ? "text-primary font-black" : "text-on-surface"
                        }`}
                      >
                        {weekdayShort(item.date)}
                      </span>
                      <span className="text-[9px] font-mono tabular-nums text-on-surface-variant">
                        {formatShortDate(item.date)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2-Column Section: Events & Reminder */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Events Log (7 cols) */}
            <div className="lg:col-span-7 bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <h3 className="text-xs font-bold text-on-surface mb-3 flex items-center justify-between uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-[18px]">history</span>
                    <span>Nhật ký Sự kiện &amp; Bữa ăn gần đây</span>
                  </span>
                  <span className="text-[11px] text-on-surface-variant lowercase font-mono">
                    {complianceData?.events?.length ?? 0} sự kiện
                  </span>
                </h3>

                {!complianceData?.events?.length ? (
                  <p className="text-xs text-on-surface-variant italic py-4 text-center">
                    Chưa ghi nhận sự kiện vi phạm hoặc check-in trong 14 ngày qua.
                  </p>
                ) : (
                  <ul className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                    {complianceData.events.slice(0, 10).map((ev, idx) => (
                      <li
                        key={`${ev.at}-${idx}`}
                        className="p-3 bg-surface-container-low/30 border border-outline-variant/40 rounded-lg text-xs flex items-start justify-between gap-2 shadow-2xs"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-on-surface truncate">{ev.title}</p>
                          <p className="text-on-surface-variant text-[11px] mt-0.5 font-medium">
                            Loại: <span className="capitalize">{ev.type}</span> • Mức độ:{" "}
                            <span className={ev.severity === "high" ? "text-rose-700 font-bold" : "text-amber-700 font-semibold"}>
                              {ev.severity}
                            </span>
                          </p>
                        </div>
                        <span className="text-[10px] font-mono text-on-surface-variant shrink-0 mt-0.5">
                          {formatEventTime(ev.at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Quick Doctor Reminder Card (5 cols) */}
            <div className="lg:col-span-5 bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <h3 className="text-xs font-bold text-on-surface mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                  <span className="material-symbols-outlined text-primary text-[18px]">send</span>
                  <span>Gửi Nhắc nhở Tuân thủ</span>
                </h3>
                <p className="text-[11px] text-on-surface-variant mb-3 font-medium">
                  Lời nhắc sẽ hiển thị ngay trong thông báo ứng dụng của bệnh nhân.
                </p>
                <textarea
                  value={remindMessage}
                  onChange={(e) => setRemindMessage(e.target.value)}
                  rows={4}
                  placeholder="Nhập nội dung nhắc nhở bệnh nhân..."
                  className="w-full px-3.5 py-2.5 bg-surface-container-low/40 border border-outline-variant/60 rounded-lg text-xs focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none font-medium"
                />
                {remindFeedback && (
                  <p className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg mt-2 animate-in fade-in">
                    {remindFeedback}
                  </p>
                )}
              </div>

              <button
                type="button"
                disabled={remindSending || !remindMessage.trim()}
                onClick={() => void handleRemind()}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold rounded-lg disabled:opacity-60 transition-all shadow-2xs active:scale-95 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {remindSending ? "progress_activity" : "send"}
                </span>
                <span>{remindSending ? "Đang gửi thông báo…" : "Gửi lời nhắc đến bệnh nhân"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: CHUỖI CHỈ SỐ SINH HIỆU & SỨC KHỎE (Recorded Metrics) */}
      {/* ========================================================= */}
      {activeTab === "metrics" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* 4 Vitals Summary Cards (Latest Measurements) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Weight / Height / BMI */}
            <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                    Thể trạng &amp; BMI
                  </span>
                  <span className="material-symbols-outlined text-primary text-[18px]">scale</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-on-surface font-mono tabular-nums">
                    {effectiveWeight != null ? `${effectiveWeight} kg` : "—"}
                  </span>
                  <span className="text-xs text-on-surface-variant font-mono">
                    / {effectiveHeight != null ? `${effectiveHeight} cm` : "—"}
                  </span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-outline-variant/40 flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-on-surface">
                  BMI: {effectiveBmi != null ? effectiveBmi : "—"}
                </span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${bmiCategoryOf(effectiveBmi).bg} ${bmiCategoryOf(effectiveBmi).color}`}>
                  {bmiCategoryOf(effectiveBmi).label}
                </span>
              </div>
            </div>

            {/* Card 2: Blood Pressure */}
            <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                    Huyết áp động mạch
                  </span>
                  <span className="material-symbols-outlined text-rose-600 text-[18px]">favorite</span>
                </div>
                <div className="text-2xl font-black text-rose-900 font-mono tabular-nums">
                  {effectiveBP || "—"}
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-outline-variant/40 flex items-center justify-between text-xs text-on-surface-variant font-medium">
                <span>Ngưỡng chuẩn:</span>
                <span className="font-mono text-[11px] text-on-surface">&lt; 120/80 mmHg</span>
              </div>
            </div>

            {/* Card 3: Blood Glucose & HbA1c */}
            <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                    Đường huyết &amp; HbA1c
                  </span>
                  <span className="material-symbols-outlined text-amber-600 text-[18px]">water_drop</span>
                </div>
                <div className="text-2xl font-black text-amber-900 font-mono tabular-nums">
                  {effectiveGlucose || "—"}
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-outline-variant/40 flex items-center justify-between text-xs text-on-surface-variant font-medium">
                <span>HbA1c gần nhất:</span>
                <span className="font-mono text-xs font-bold text-on-surface">
                  {effectiveHba1c != null ? `${effectiveHba1c}%` : "Chưa đo"}
                </span>
              </div>
            </div>

            {/* Card 4: Waist Circumference */}
            <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                    Vòng eo lâm sàng
                  </span>
                  <span className="material-symbols-outlined text-teal-600 text-[18px]">straighten</span>
                </div>
                <div className="text-2xl font-black text-on-surface font-mono tabular-nums">
                  {effectiveWaist != null ? `${effectiveWaist} cm` : "—"}
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-outline-variant/40 flex items-center justify-between text-xs text-on-surface-variant font-medium">
                <span>Cập nhật lúc:</span>
                <span className="font-mono text-[10px] text-on-surface truncate">
                  {latestMetric?.recorded_at ? formatEventTime(latestMetric.recorded_at) : (patientSummary?.last_update || "—")}
                </span>
              </div>
            </div>
          </div>

          {/* Biểu đồ Đa chuỗi & Dự đoán Xu hướng 7 ngày */}
          <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-6 shadow-xs">
            <MetricsOverlayChart history={chartHistory} loading={loading} />
          </div>

          {/* Time-series Table of Recorded Metrics */}
          <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-outline-variant/40">
              <div>
                <h3 className="text-sm font-bold text-on-surface flex items-center gap-2 uppercase tracking-wider">
                  <span className="material-symbols-outlined text-primary text-[20px]">table_chart</span>
                  <span>Lịch sử Chuỗi Thời gian Chỉ số Sinh hiệu</span>
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5 font-medium">
                  Tổng cộng {filteredMetrics.length} lần đo ghi nhận (90 ngày gần nhất)
                </p>
              </div>

              {/* Source Filter Tabs */}
              <div className="flex items-center gap-1 p-1 bg-surface-container-low border border-outline-variant/50 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setMetricsFilter("all")}
                  className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer ${
                    metricsFilter === "all"
                      ? "bg-surface-container-lowest text-primary shadow-2xs"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  Tất cả ({metricsHistory.length})
                </button>
                <button
                  type="button"
                  onClick={() => setMetricsFilter("patient")}
                  className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer ${
                    metricsFilter === "patient"
                      ? "bg-surface-container-lowest text-primary shadow-2xs"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  Bệnh nhân tự ghi ({metricsHistory.filter((m) => m.recorded_by === "patient").length})
                </button>
                <button
                  type="button"
                  onClick={() => setMetricsFilter("doctor")}
                  className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer ${
                    metricsFilter === "doctor"
                      ? "bg-surface-container-lowest text-primary shadow-2xs"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  Bác sĩ ghi ({metricsHistory.filter((m) => m.recorded_by === "doctor").length})
                </button>
              </div>
            </div>

            {filteredMetrics.length === 0 ? (
              <div className="py-12 text-center text-on-surface-variant space-y-2">
                <span className="material-symbols-outlined text-[40px] text-outline/40">
                  device_thermostat
                </span>
                <p className="text-sm font-bold text-on-surface">Chưa có lịch sử chuỗi thời gian</p>
                <p className="text-xs max-w-md mx-auto text-on-surface-variant">
                  Chỉ số hiện tại của bệnh nhân được lấy từ hồ sơ lâm sàng ban đầu. Khi bệnh nhân hoặc bác sĩ ghi nhận thêm các lần đo mới, lịch sử sẽ tự động hiển thị tại đây.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-outline-variant/60 text-on-surface-variant font-bold text-[11px] uppercase tracking-wider">
                      <th className="py-3 px-3">Thời gian ghi nhận</th>
                      <th className="py-3 px-3">Nguồn đo</th>
                      <th className="py-3 px-3">Cân nặng / Chiều cao</th>
                      <th className="py-3 px-3">BMI &amp; Phân loại</th>
                      <th className="py-3 px-3">Huyết áp</th>
                      <th className="py-3 px-3">Đường huyết / HbA1c</th>
                      <th className="py-3 px-3">Vòng eo</th>
                      <th className="py-3 px-3">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/30 text-on-surface">
                    {filteredMetrics.map((row, idx) => (
                      <tr key={row.id || idx} className="hover:bg-surface-container-low/40 transition-colors">
                        <td className="py-3 px-3 font-mono text-[11px] text-on-surface font-semibold whitespace-nowrap">
                          {formatDateTimeFull(row.recorded_at)}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {row.recorded_by === "patient" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-sky-50 text-sky-900 border border-sky-200">
                              <span className="material-symbols-outlined text-[12px]">person</span>
                              Bệnh nhân
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-900 border border-emerald-200">
                              <span className="material-symbols-outlined text-[12px]">stethoscope</span>
                              Bác sĩ
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono tabular-nums whitespace-nowrap">
                          <span className="font-bold">{row.weight != null ? `${row.weight} kg` : "—"}</span>
                          {row.height != null && (
                            <span className="text-on-surface-variant ml-1 text-[11px]">
                              / {row.height} cm
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="font-mono font-bold">{row.bmi != null ? row.bmi : "—"}</span>
                          {row.bmi != null && (
                            <span className={`ml-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold border ${bmiCategoryOf(row.bmi).bg} ${bmiCategoryOf(row.bmi).color}`}>
                              {bmiCategoryOf(row.bmi).label}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono tabular-nums whitespace-nowrap">
                          {row.blood_pressure || (row.systolic && row.diastolic ? `${row.systolic}/${row.diastolic}` : "—")}
                        </td>
                        <td className="py-3 px-3 font-mono tabular-nums whitespace-nowrap">
                          <span>{row.blood_glucose || (row.glucose_fasting ? `${row.glucose_fasting} mmol/L` : "—")}</span>
                          {row.hba1c != null && (
                            <span className="text-primary font-bold ml-1 text-[11px]">
                              (HbA1c: {row.hba1c}%)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono tabular-nums whitespace-nowrap">
                          {row.waist_cm != null ? `${row.waist_cm} cm` : "—"}
                        </td>
                        <td className="py-3 px-3 text-on-surface-variant text-[11px] max-w-[200px] truncate">
                          {row.note || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
