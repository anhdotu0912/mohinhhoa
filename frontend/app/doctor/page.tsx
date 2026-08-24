"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/shared/TopBar";
import { doctorPatientToUi } from "@/lib/mock-data";
import { api, assetUrl } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { isProduction } from "@/lib/env";
import { mealPlanToUiItem } from "@/lib/meal-plan-mappers";
import type { MealPlanItem } from "@/lib/plans-store";
import {
  ApiError,
  type ComplianceDayPoint,
  type DoctorPatientSummary,
  type PatientComplianceOut,
} from "@/lib/types";

interface DayCompliance {
  day: string;
  date: string;
  rate: number;
  meals: string;
  calories: string;
  salt: string;
}

// Fallback chỉ dùng khi chưa có dữ liệu tuân thủ thật ở môi trường dev/demo.
const THIS_WEEK_DATA: DayCompliance[] = [
  { day: "T2", date: "07/10", rate: 60, meals: "2/3 bữa", calories: "85%", salt: "70%" },
  { day: "T3", date: "08/10", rate: 75, meals: "3/3 bữa", calories: "90%", salt: "80%" },
  { day: "T4", date: "09/10", rate: 50, meals: "1/3 bữa", calories: "60%", salt: "55%" },
  { day: "T5", date: "10/10", rate: 90, meals: "3/3 bữa", calories: "98%", salt: "92%" },
  { day: "T6", date: "11/10", rate: 85, meals: "3/3 bữa", calories: "92%", salt: "88%" },
  { day: "T7", date: "12/10", rate: 65, meals: "2/3 bữa", calories: "75%", salt: "70%" },
  { day: "CN", date: "13/10", rate: 80, meals: "3/3 bữa", calories: "88%", salt: "85%" },
];

const LAST_WEEK_DATA: DayCompliance[] = [
  { day: "T2", date: "30/09", rate: 70, meals: "2/3 bữa", calories: "88%", salt: "75%" },
  { day: "T3", date: "01/10", rate: 80, meals: "3/3 bữa", calories: "90%", salt: "85%" },
  { day: "T4", date: "02/10", rate: 85, meals: "3/3 bữa", calories: "95%", salt: "90%" },
  { day: "T5", date: "03/10", rate: 60, meals: "2/3 bữa", calories: "80%", salt: "65%" },
  { day: "T6", date: "04/10", rate: 75, meals: "3/3 bữa", calories: "85%", salt: "80%" },
  { day: "T7", date: "05/10", rate: 90, meals: "3/3 bữa", calories: "96%", salt: "94%" },
  { day: "CN", date: "06/10", rate: 70, meals: "2/3 bữa", calories: "82%", salt: "72%" },
];

/** Lấy chữ cái đầu của tên (vd "Nguyễn Văn A" → "NA") cho avatar dự phòng. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "BN";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** Thứ trong tuần suy từ ngày ISO thật (không gán cứng theo thứ tự mảng). */
function weekdayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][d.getDay()];
}

function formatDateLabel(iso: string): string {
  const [, mm, dd] = iso.split("-");
  return mm && dd ? `${dd}/${mm}` : iso;
}

function averageRate(data: DayCompliance[]): number | null {
  if (data.length === 0) return null;
  return Math.round(data.reduce((acc, cur) => acc + cur.rate, 0) / data.length);
}

export default function DoctorDashboardPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const [hydrated, setHydrated] = useState(false);
  const [plans, setPlans] = useState<MealPlanItem[]>([]);
  const [patientSummaries, setPatientSummaries] = useState<DoctorPatientSummary[]>(
    []
  );
  const [expiryTab, setExpiryTab] = useState<"expiring" | "expired">("expiring");
  const [demoBusy, setDemoBusy] = useState(false);
  const [timeframe, setTimeframe] = useState<"this_week" | "last_week">("this_week");
  const [hoveredDay, setHoveredDay] = useState<DayCompliance | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [thisWeekChart, setThisWeekChart] = useState<DayCompliance[]>([]);
  const [lastWeekChart, setLastWeekChart] = useState<DayCompliance[]>([]);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const loadPlans = useCallback(async () => {
    if (!token || role !== "doctor") return;
    try {
      const [planRows, patientRows] = await Promise.all([
        api.listDoctorMealPlans("all"),
        api.listDoctorPatients().catch(() => [] as DoctorPatientSummary[]),
      ]);
      const patientMap = new Map(patientRows.map((p) => [p.id, p]));
      const items = planRows.map((row) => {
        const p = patientMap.get(row.user_id);
        return mealPlanToUiItem(row, {
          patientName: p?.name || "Bệnh nhân",
          patientCode: p?.id || row.user_id,
          condition: p?.condition_label || "—",
        });
      });
      setPlans(items);
      setPatientSummaries(patientRows);

      const samplePatients = patientRows.slice(0, 10);
      if (samplePatients.length > 0) {
        const complianceRows = await Promise.all(
          samplePatients.map((p) =>
            api.getPatientCompliance(p.id, 14).catch(() => null)
          )
        );
        const valid = complianceRows.filter(
          (r): r is PatientComplianceOut => r != null
        );
        if (valid.length > 0) {
          const maxLen = Math.max(...valid.map((r) => r.daily_series.length));
          const aggregated: DayCompliance[] = [];
          for (let i = 0; i < maxLen; i += 1) {
            const points = valid
              .map((r) => r.daily_series[i])
              .filter(
                (p): p is ComplianceDayPoint => Boolean(p) && p.adherence_pct != null
              );
            const rate =
              points.length > 0
                ? Math.round(
                    points.reduce((sum, p) => sum + (p.adherence_pct ?? 0), 0) /
                      points.length
                  )
                : 0;
            const dateIso = valid.find((r) => r.daily_series[i])?.daily_series[i]?.date ?? "";
            aggregated.push({
              day: weekdayLabel(dateIso),
              date: formatDateLabel(dateIso),
              rate,
              meals: "—",
              calories: `${rate}%`,
              salt: `${rate}%`,
            });
          }
          const last7 = aggregated.slice(-7);
          const olderPart = aggregated.slice(0, Math.max(aggregated.length - 7, 0));
          setThisWeekChart(last7);
          setLastWeekChart(olderPart.slice(-7));
        } else {
          setThisWeekChart([]);
          setLastWeekChart([]);
        }
      } else {
        setThisWeekChart([]);
        setLastWeekChart([]);
      }
    } catch {
      setPlans([]);
      setPatientSummaries([]);
      setThisWeekChart([]);
      setLastWeekChart([]);
    }
  }, [token, role]);

  useEffect(() => {
    if (!hydrated) return;
    if (!token || role !== "doctor") {
      router.replace("/login");
      return;
    }
    void loadPlans();
  }, [hydrated, token, role, router, loadPlans]);

  const pendingPlans = plans.filter((p) => p.status === "pending");
  // Chỉ hiển thị 5 thực đơn chờ duyệt mới nhất trên dashboard
  const visiblePendingPlans = pendingPlans.slice(0, 5);

  // Cảnh báo hạn thực đơn: sắp ăn xong (expiring) / đã ăn xong (expired)
  const expiringPatients = patientSummaries.filter(
    (p) => p.plan_expiry === "expiring"
  );
  const expiredPatients = patientSummaries.filter(
    (p) => p.plan_expiry === "expired"
  );
  const expiryList = expiryTab === "expiring" ? expiringPatients : expiredPatients;

  // Bệnh nhân cần chú ý: status "Cần chú ý" hoặc "Cảnh báo", ưu tiên nhiều cảnh báo nhất
  const attentionSummaries = patientSummaries.filter(
    (p) => p.status_key === "attention" || p.status_key === "warning"
  );
  const attentionPatients = [...attentionSummaries]
    .sort((a, b) => (b.alert_count ?? 0) - (a.alert_count ?? 0))
    .slice(0, 5)
    .map(doctorPatientToUi);

  // Demo: giả lập thực đơn sắp/đã hết hạn (backend chặn ở production)
  const handleDemoExpiry = async (mode: "expiring" | "expired") => {
    if (demoBusy) return;
    setDemoBusy(true);
    try {
      await api.demoPlanExpiry(mode);
      showToast(
        mode === "expiring"
          ? "Đã giả lập: các thực đơn đã duyệt còn 1 ngày (sắp ăn xong)."
          : "Đã giả lập: các thực đơn đã duyệt hết hạn."
      );
      await loadPlans();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "Không giả lập được hạn thực đơn."
      );
    } finally {
      setDemoBusy(false);
    }
  };
  const realChartData = timeframe === "this_week" ? thisWeekChart : lastWeekChart;
  // Dev/demo: fallback dữ liệu mẫu khi chưa có compliance thật; production luôn hiện empty state.
  const chartData =
    realChartData.length > 0
      ? realChartData
      : !isProduction
        ? timeframe === "this_week"
          ? THIS_WEEK_DATA
          : LAST_WEEK_DATA
        : [];
  const hasChartData = chartData.length > 0;
  const avgCompliance = hasChartData ? averageRate(chartData) : null;
  const thisWeekAvg = averageRate(thisWeekChart);
  const lastWeekAvg = averageRate(lastWeekChart);
  const trendDelta =
    timeframe === "this_week" && thisWeekAvg !== null && lastWeekAvg !== null
      ? thisWeekAvg - lastWeekAvg
      : null;

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleQuickApprove = async (planId: string, planTitle: string) => {
    try {
      await api.reviewMealPlan(planId, { action: "approve" });
      showToast(`Đã duyệt nhanh thực đơn: ${planTitle}`);
      await loadPlans();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Không duyệt được thực đơn.");
    }
  };

  return (
    <>
      <TopBar title="Dashboard Tổng quan" />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-800 text-white px-md py-sm rounded-xl shadow-lg border border-emerald-600 flex items-center gap-xs font-body text-sm animate-slide-down">
          <span className="material-symbols-outlined text-[20px] text-emerald-300">
            check_circle
          </span>
          <span>{toastMessage}</span>
        </div>
      )}

      <main className="p-6 md:p-8 w-full max-w-7xl mx-auto space-y-8">
        {/* Summary Cards (3 columns) */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1 */}
          <Link
            href="/doctor/patients"
            className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-5 shadow-subtle flex items-center gap-4 transition-all hover:shadow-md hover:border-primary/40 group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors shrink-0">
              <span
                className="material-symbols-outlined text-[24px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                group
              </span>
            </div>
            <div>
              <p className="font-caption text-caption text-on-surface-variant mb-1 font-medium text-xs">
                Tổng bệnh nhân
              </p>
              <p className="font-h1 text-h1 text-on-surface text-2xl font-bold group-hover:text-primary transition-colors tabular-nums">
                {patientSummaries.length}
              </p>
            </div>
          </Link>

          {/* Card 2 */}
          <Link
            href="/doctor/reviews"
            className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-5 shadow-subtle flex items-center gap-4 transition-all hover:shadow-md hover:border-amber-500/40 group cursor-pointer relative overflow-hidden"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition-colors shrink-0">
              <span
                className="material-symbols-outlined text-[24px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                pending_actions
              </span>
            </div>
            <div>
              <p className="font-caption text-caption text-on-surface-variant mb-1 font-medium text-xs">
                Cần duyệt kế hoạch
              </p>
              <p className="font-h1 text-h1 text-on-surface text-2xl font-bold tabular-nums">
                {pendingPlans.length}
              </p>
            </div>
            <div className="absolute top-0 right-0 w-1.5 h-full bg-amber-400"></div>
          </Link>

          {/* Card 3 */}
          <Link
            href="/doctor/patients?status=attention"
            className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-5 shadow-subtle flex items-center gap-4 transition-all hover:shadow-md hover:border-rose-500/40 group cursor-pointer relative overflow-hidden"
          >
            <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition-colors shrink-0">
              <span
                className="material-symbols-outlined text-[24px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                warning
              </span>
            </div>
            <div>
              <p className="font-caption text-caption text-on-surface-variant mb-1 font-medium text-xs">
                Cảnh báo lâm sàng
              </p>
              <p className="font-h1 text-h1 text-rose-600 text-2xl font-bold tabular-nums">
                {attentionSummaries.length}
              </p>
            </div>
            <div className="absolute top-0 right-0 w-1.5 h-full bg-rose-500"></div>
          </Link>
        </section>

        {/* Main Section (1:1 ratio) */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Col - Bệnh nhân cần chú ý */}
          <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl shadow-subtle overflow-hidden flex flex-col">
            <div className="p-5 border-b border-outline-variant/40 bg-surface-container-low/30 flex justify-between items-center">
              <div>
                <h3 className="font-h2 text-h2 text-on-surface font-bold text-base flex items-center gap-2">
                  <span className="material-symbols-outlined text-rose-600 text-[20px]">
                    error_outline
                  </span>
                  Danh sách bệnh nhân cần chú ý
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Các bệnh nhân có chỉ số bất thường hoặc cảnh báo gần đây
                </p>
              </div>
              <Link
                href="/doctor/patients"
                className="text-primary font-body-bold hover:underline text-xs cursor-pointer flex items-center gap-0.5 font-semibold"
              >
                <span>Xem tất cả</span>
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </Link>
            </div>
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[550px]">
                <thead>
                  <tr className="bg-surface-container-low/50 border-b border-outline-variant/40">
                    <th className="px-5 py-3 font-label text-label text-on-surface-variant uppercase tracking-wider text-[11px] font-semibold">
                      Bệnh nhân
                    </th>
                    <th className="px-5 py-3 font-label text-label text-on-surface-variant uppercase tracking-wider text-[11px] font-semibold">
                      Chỉ số biến động
                    </th>
                    <th className="px-5 py-3 font-label text-label text-on-surface-variant uppercase tracking-wider text-[11px] font-semibold text-center whitespace-nowrap">
                      Trạng thái
                    </th>
                    <th className="px-5 py-3 font-label text-label text-on-surface-variant uppercase tracking-wider text-[11px] font-semibold text-center whitespace-nowrap">
                      Hành động
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30 font-body text-body">
                  {attentionPatients.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-on-surface-variant">
                        <span className="material-symbols-outlined text-[36px] text-emerald-500 mb-1">
                          check_circle
                        </span>
                        <p className="font-body-bold text-sm font-bold">
                          Không có bệnh nhân nào cần chú ý
                        </p>
                        <p className="text-xs text-on-surface-variant mt-0.5">
                          Mọi bệnh nhân hiện đều ở trạng thái ổn định.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    attentionPatients.map((patient) => {
                      const avatar =
                        patient.avatar && !patient.avatar.startsWith("https://api.dicebear.com")
                          ? assetUrl(patient.avatar)
                          : "";
                      return (
                        <tr key={patient.id} className="hover:bg-surface-container-low/40 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="relative w-9 h-9 shrink-0">
                                <div className="absolute inset-0 rounded-full bg-primary/10 text-primary flex items-center justify-center font-label text-xs font-bold ring-2 ring-primary/20">
                                  <span translate="no" className="notranslate">{initials(patient.name)}</span>
                                </div>
                                {avatar && (
                                  <img
                                    src={avatar}
                                    alt={patient.name}
                                    className="absolute inset-0 w-9 h-9 rounded-full object-cover ring-2 ring-outline-variant/40"
                                    onError={(e) => {
                                      e.currentTarget.style.display = "none";
                                    }}
                                  />
                                )}
                              </div>
                              <div>
                                <span className="font-body-bold text-on-surface block text-sm font-bold">
                                  {patient.name}
                                </span>
                                <span className="text-xs text-on-surface-variant font-mono">
                                  {patient.id}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-on-surface-variant text-xs font-medium">
                            {patient.bloodSugar ? `Đường huyết (${patient.bloodSugar})` : patient.condition}
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span
                              className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${patient.statusColor}`}
                            >
                              {patient.status}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <Link
                              href={`/doctor/patients/${patient.id}`}
                              className="inline-flex items-center justify-center gap-1 h-8 px-3 bg-surface-container-lowest border border-outline-variant hover:border-primary text-primary font-body-bold rounded-xl hover:bg-primary hover:text-white transition-all text-xs cursor-pointer active:scale-95 shadow-2xs font-semibold whitespace-nowrap"
                            >
                              <span>Chi tiết</span>
                              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Col - Biểu đồ tuân thủ dinh dưỡng */}
          <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl shadow-subtle p-5 flex flex-col justify-between">
            <div>
              {/* Header & Controls */}
              <div className="border-b border-outline-variant/40 pb-3 mb-4 flex items-start justify-between">
                <div>
                  <h3 className="font-h2 text-h2 text-on-surface font-bold flex items-center gap-2 text-base">
                    <span className="material-symbols-outlined text-primary text-[22px]">
                      monitoring
                    </span>
                    Tuân thủ dinh dưỡng
                  </h3>
                  <p className="font-caption text-caption text-on-surface-variant mt-0.5 text-xs">
                    Tỷ lệ tuân thủ thực đơn trung bình của bệnh nhân
                  </p>
                </div>
                {/* Timeframe Selector */}
                <div className="flex bg-surface-container-low rounded-full p-1 border border-outline-variant/40">
                  <button
                    onClick={() => {
                      setTimeframe("this_week");
                      setHoveredDay(null);
                    }}
                    className={`px-3 py-1 text-xs rounded-full transition-all font-semibold cursor-pointer ${
                      timeframe === "this_week"
                        ? "bg-surface-container-lowest text-primary shadow-xs font-bold"
                        : "text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    Tuần này
                  </button>
                  <button
                    onClick={() => {
                      setTimeframe("last_week");
                      setHoveredDay(null);
                    }}
                    className={`px-3 py-1 text-xs rounded-full transition-all font-semibold cursor-pointer ${
                      timeframe === "last_week"
                        ? "bg-surface-container-lowest text-primary shadow-xs font-bold"
                        : "text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    Tuần trước
                  </button>
                </div>
              </div>

              {/* Stat Summary Box */}
              <div className="mb-4 p-3.5 bg-primary/5 border border-primary/20 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-xs text-primary font-semibold block">Trung bình tuần</span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-2xl font-bold text-on-surface tabular-nums">
                      {avgCompliance !== null ? `${avgCompliance}%` : "—"}
                    </span>
                    {trendDelta !== null && (
                      <span
                        className={`text-xs font-bold flex items-center tabular-nums ${
                          trendDelta >= 0 ? "text-emerald-700" : "text-rose-700"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          {trendDelta >= 0 ? "trending_up" : "trending_down"}
                        </span>
                        {trendDelta >= 0 ? "+" : ""}
                        {trendDelta}%
                      </span>
                    )}
                  </div>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold shadow-2xs ${
                    avgCompliance === null
                      ? "bg-surface-container text-on-surface-variant"
                      : avgCompliance >= 75
                        ? "bg-emerald-600 text-white"
                        : "bg-amber-500 text-white"
                  }`}
                >
                  {avgCompliance === null
                    ? "Chưa có dữ liệu"
                    : avgCompliance >= 75
                      ? "Đạt mục tiêu"
                      : "Cần theo dõi"}
                </span>
              </div>

              {/* Interactive Bar Chart */}
              <div className="relative pt-6 pb-2 min-h-[220px] flex flex-col justify-end">
                {!hasChartData ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant py-8">
                    <span className="material-symbols-outlined text-[36px] text-outline/40 mb-1">
                      bar_chart
                    </span>
                    <p className="text-sm font-bold">Chưa có dữ liệu tuân thủ</p>
                    <p className="text-xs mt-0.5 text-center max-w-[220px]">
                      Cần bệnh nhân ghi nhận Food Log để hiển thị biểu đồ.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Benchmark Target Line (80%) */}
                    <div
                      className="absolute left-0 right-0 border-b-2 border-dashed border-emerald-400/80 z-0 flex items-center justify-start pl-2 pointer-events-none"
                      style={{ bottom: "calc(26px + 120px * 0.8)" }}
                    >
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-300 shadow-2xs">
                        Chỉ tiêu 80%
                      </span>
                    </div>

                    {/* Y-axis grid line 50% */}
                    <div
                      className="absolute left-0 right-0 border-b border-outline-variant/30 z-0 pointer-events-none"
                      style={{ bottom: "calc(26px + 120px * 0.5)" }}
                    ></div>

                    {/* Bars Container */}
                    <div className="w-full flex items-end justify-between px-2 z-10 gap-2">
                      {chartData.map((item) => {
                        const isHigh = item.rate >= 80;
                        const isMedium = item.rate >= 60 && item.rate < 80;

                        let barBg = "bg-rose-500 hover:bg-rose-600";
                        let textBg = "text-rose-700";
                        if (isHigh) {
                          barBg = "bg-primary hover:bg-primary/90";
                          textBg = "text-primary";
                        } else if (isMedium) {
                          barBg = "bg-amber-500 hover:bg-amber-600";
                          textBg = "text-amber-700";
                        }

                        return (
                          <div
                            key={`${item.day}-${item.date}`}
                            className="flex-1 flex flex-col items-center group relative cursor-pointer select-none"
                            onMouseEnter={() => setHoveredDay(item)}
                            onMouseLeave={() => setHoveredDay(null)}
                          >
                            {/* Hover Tooltip Popup */}
                            {hoveredDay?.date === item.date && (
                              <div className="absolute bottom-full mb-2 z-30 w-44 bg-surface-container-lowest text-on-surface text-xs p-3 rounded-2xl shadow-xl border border-outline-variant/60 backdrop-blur-md animate-fadeIn pointer-events-none">
                                <div className="flex justify-between items-center border-b border-outline-variant/40 pb-1 mb-1 font-bold">
                                  <span>Thứ ({item.day}) - {item.date}</span>
                                  <span className={item.rate >= 80 ? "text-primary" : "text-amber-700"}>
                                    {item.rate}%
                                  </span>
                                </div>
                                <div className="space-y-0.5 text-[11px] text-on-surface-variant">
                                  <p>Bữa ăn: <strong className="text-on-surface">{item.meals}</strong></p>
                                  <p>Calo đạt: <strong className="text-on-surface">{item.calories}</strong></p>
                                  <p>Muối đạt: <strong className="text-on-surface">{item.salt}</strong></p>
                                </div>
                              </div>
                            )}

                            {/* Value Text Above Bar */}
                            <span className={`text-[10px] font-bold mb-1 tabular-nums ${textBg}`}>
                              {item.rate}%
                            </span>

                            {/* Bar Track */}
                            <div className="w-full h-[120px] flex items-end justify-center">
                              <div
                                className={`w-full max-w-[28px] rounded-t-lg transition-all duration-200 ${barBg} ${
                                  hoveredDay?.date === item.date ? "ring-2 ring-primary/40 shadow-xs" : ""
                                }`}
                                style={{ height: `${item.rate}%` }}
                              ></div>
                            </div>

                            {/* X-axis Day Label */}
                            <span className="mt-1.5 text-xs font-semibold text-on-surface-variant">
                              {item.day}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Legend & Link */}
            <div className="pt-3 border-t border-outline-variant/40 mt-3">
              <div className="flex items-center justify-between text-xs text-on-surface-variant mb-3 font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>
                  Đạt (≥80%)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  TB (60-79%)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                  Kém (&lt;60%)
                </span>
              </div>

              <Link
                href="/doctor/patients/compliance"
                className="w-full py-2 bg-surface-container-low hover:bg-surface-container border border-outline-variant/60 text-on-surface font-body-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1 font-semibold"
              >
                <span>Xem báo cáo tuân thủ chi tiết</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Bottom Section - Kế hoạch chờ duyệt mới nhất */}
        <section>
          <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl shadow-subtle overflow-hidden">
            <div className="p-5 border-b border-outline-variant/40 bg-surface-container-low/30 flex justify-between items-center">
              <div>
                <h3 className="font-h2 text-h2 text-on-surface flex items-center gap-2 font-bold text-base">
                  <span className="material-symbols-outlined text-amber-600 text-[20px]">
                    assignment
                  </span>
                  Kế hoạch chờ duyệt mới nhất
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Các thực đơn được AI khởi tạo cần bác sĩ đánh giá và xác nhận
                </p>
              </div>

              <Link
                href="/doctor/reviews"
                className="text-primary text-xs font-bold hover:underline flex items-center gap-0.5"
              >
                <span>Xem tất cả ({pendingPlans.length})</span>
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </Link>
            </div>

            <div className="p-5 space-y-3">
              {pendingPlans.length === 0 ? (
                <div className="p-8 text-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-[36px] text-emerald-500 mb-1">
                    check_circle
                  </span>
                  <p className="font-body-bold text-sm font-bold">Hiện không có kế hoạch nào chờ duyệt</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Tất cả các thực đơn đã được xem xét hoặc phê duyệt.
                  </p>
                </div>
              ) : (
                visiblePendingPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border border-outline-variant/50 rounded-2xl bg-surface-container-lowest hover:bg-surface-container-low/30 hover:border-primary/40 transition-all gap-4 shadow-2xs"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary ring-2 ring-primary/20 flex items-center justify-center font-bold text-sm shrink-0">
                        <span translate="no" className="notranslate">{plan.patientName.charAt(0)}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-body-bold text-on-surface font-bold text-sm">
                            {plan.patientName}
                          </p>
                          <span className="font-mono text-xs text-on-surface-variant">
                            ({plan.patientCode})
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-primary mt-0.5 line-clamp-1">
                          {plan.planTitle}
                        </p>
                        <div className="flex items-center gap-3 font-caption text-on-surface-variant mt-1 text-xs">
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">
                              restaurant_menu
                            </span>{" "}
                            {plan.condition}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">
                              calendar_today
                            </span>{" "}
                            {plan.createdAt}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-outline-variant/30">
                      <Link
                        href={`/doctor/reviews/${plan.patientId}/${plan.id}`}
                        className="h-8 px-3.5 bg-surface-container-lowest border border-outline-variant/60 text-on-surface-variant font-body-bold rounded-xl hover:bg-surface-container-low hover:text-primary transition-all text-xs flex items-center gap-1 cursor-pointer font-semibold"
                      >
                        <span className="material-symbols-outlined text-[16px]">visibility</span>
                        <span>Xem trước</span>
                      </Link>

                      <button
                        onClick={() =>
                          handleQuickApprove(plan.id, plan.planTitle)
                        }
                        className="h-8 px-3.5 bg-primary text-on-primary font-body-bold rounded-xl hover:bg-primary/90 transition-all text-xs shadow-2xs flex items-center gap-1 cursor-pointer font-semibold active:scale-95"
                      >
                        <span className="material-symbols-outlined text-[16px]">check</span>
                        <span>Duyệt nhanh</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Cảnh báo thực đơn hết hạn */}
        <section>
          <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl shadow-subtle overflow-hidden">
            <div className="p-5 border-b border-outline-variant/40 bg-surface-container-low/30 flex justify-between items-center">
              <div>
                <h3 className="font-h2 text-h2 text-on-surface flex items-center gap-2 font-bold text-base">
                  <span className="material-symbols-outlined text-amber-600 text-[20px]">
                    event_busy
                  </span>
                  Cảnh báo thực đơn hết hạn
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Bệnh nhân sắp ăn xong / đã ăn xong thực đơn — cần tạo thực đơn tiếp
                </p>
              </div>

              {!isProduction && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleDemoExpiry("expiring")}
                    disabled={demoBusy}
                    className="px-3 py-1.5 border border-outline-variant/60 rounded-xl text-xs font-semibold text-on-surface-variant hover:border-amber-400 hover:text-amber-700 transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-1"
                    title="Chỉ khả dụng môi trường demo (backend chặn ở production)"
                  >
                    <span className="material-symbols-outlined text-[16px]">schedule</span>
                    Giả lập: sắp hết hạn
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDemoExpiry("expired")}
                    disabled={demoBusy}
                    className="px-3 py-1.5 border border-outline-variant/60 rounded-xl text-xs font-semibold text-on-surface-variant hover:border-red-400 hover:text-red-700 transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-1"
                    title="Chỉ khả dụng môi trường demo (backend chặn ở production)"
                  >
                    <span className="material-symbols-outlined text-[16px]">event_busy</span>
                    Giả lập: đã hết hạn
                  </button>
                </div>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-3 px-5 border-b border-outline-variant/30 pt-2">
              <button
                type="button"
                onClick={() => setExpiryTab("expiring")}
                className={`font-label text-label pb-2.5 pt-1 px-3 border-b-2 transition-all cursor-pointer text-xs ${
                  expiryTab === "expiring"
                    ? "border-primary text-primary font-bold"
                    : "border-transparent text-on-surface-variant hover:text-on-surface font-medium"
                }`}
              >
                Sắp ăn xong ({expiringPatients.length})
              </button>
              <button
                type="button"
                onClick={() => setExpiryTab("expired")}
                className={`font-label text-label pb-2.5 pt-1 px-3 border-b-2 transition-all cursor-pointer text-xs ${
                  expiryTab === "expired"
                    ? "border-primary text-primary font-bold"
                    : "border-transparent text-on-surface-variant hover:text-on-surface font-medium"
                }`}
              >
                Đã ăn xong ({expiredPatients.length})
              </button>
            </div>

            <div className="p-5 space-y-3">
              {expiryList.length === 0 ? (
                <div className="p-8 text-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-[36px] text-emerald-500 mb-1">
                    {expiryTab === "expiring" ? "upcoming" : "check_circle"}
                  </span>
                  <p className="font-body-bold text-sm font-bold">
                    {expiryTab === "expiring"
                      ? "Không có bệnh nhân nào sắp ăn xong thực đơn"
                      : "Không có bệnh nhân nào hết hạn thực đơn"}
                  </p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {expiryTab === "expiring"
                      ? "Các thực đơn đã duyệt đều còn nhiều ngày sử dụng."
                      : "Tất cả bệnh nhân đều còn thực đơn đang sử dụng."}
                  </p>
                </div>
              ) : (
                expiryList.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border border-outline-variant/50 rounded-2xl bg-surface-container-lowest hover:bg-surface-container-low/30 hover:border-primary/40 transition-all gap-4 shadow-2xs"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="relative w-10 h-10 rounded-full bg-primary/10 text-primary ring-2 ring-primary/20 flex items-center justify-center font-bold text-xs shrink-0">
                        <span translate="no" className="notranslate">{initials(p.name)}</span>
                        {p.avatar &&
                          !p.avatar.startsWith("https://api.dicebear.com") && (
                          <img
                            src={assetUrl(p.avatar)}
                            alt={p.name}
                            className="absolute inset-0 w-10 h-10 rounded-full object-cover ring-2 ring-outline-variant/40"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-body-bold text-on-surface font-bold text-sm">
                            {p.name}
                          </p>
                          <span className="font-mono text-xs text-on-surface-variant">
                            ({p.id})
                          </span>
                        </div>
                        <p className="text-xs text-on-surface-variant mt-0.5">
                          {p.condition_label}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                      {p.plan_expiry === "expiring" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                          Còn {p.plan_days_left ?? "?"} ngày (đến {p.plan_end_date ?? "—"})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
                          <span className="material-symbols-outlined text-[14px]">
                            event_busy
                          </span>
                          Hết hạn {p.plan_end_date ?? "—"}
                        </span>
                      )}

                      <Link
                        href={`/doctor/patients/${encodeURIComponent(p.id)}/generate`}
                        className="h-8 px-3.5 bg-primary text-on-primary font-body-bold rounded-xl hover:bg-primary/90 transition-all text-xs shadow-2xs flex items-center gap-1 cursor-pointer font-semibold active:scale-95 whitespace-nowrap"
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          auto_awesome
                        </span>
                        <span>Tạo thực đơn mới</span>
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
