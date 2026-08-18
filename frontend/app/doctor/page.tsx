"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/shared/TopBar";
import { MOCK_PATIENTS } from "@/lib/mock-data";
import { api, assetUrl } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { mealPlanToUiItem } from "@/lib/meal-plan-mappers";
import type { MealPlanItem } from "@/lib/plans-store";
import { ApiError, type DoctorPatientSummary } from "@/lib/types";

interface DayCompliance {
  day: string;
  date: string;
  rate: number;
  meals: string;
  calories: string;
  salt: string;
}

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
  const [complianceChart, setComplianceChart] = useState<DayCompliance[]>([]);

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
      const samplePatients = patientRows.slice(0, 5);
      if (samplePatients.length > 0) {
        const complianceRows = await Promise.all(
          samplePatients.map((p) => api.getPatientCompliance(p.id, 7).catch(() => null))
        );
        const valid = complianceRows.filter(Boolean);
        if (valid.length > 0) {
          const maxLen = Math.max(...valid.map((r) => r!.daily_series.length));
          const aggregated: DayCompliance[] = [];
          for (let i = 0; i < maxLen; i += 1) {
            const points = valid
              .map((r) => r!.daily_series[i])
              .filter((p) => p && p.adherence_pct != null);
            const rate =
              points.length > 0
                ? Math.round(
                    points.reduce((sum, p) => sum + (p!.adherence_pct ?? 0), 0) / points.length
                  )
                : 0;
            const dateLabel = points[0]?.date?.slice(5).replace("-", "/") ?? "";
            aggregated.push({
              day: `T${i + 2 > 7 ? "CN" : i + 2}`,
              date: dateLabel,
              rate,
              meals: "—",
              calories: `${rate}%`,
              salt: `${rate}%`,
            });
          }
          setComplianceChart(aggregated.slice(-7));
        }
      }
    } catch {
      setPlans([]);
      setPatientSummaries([]);
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
  const chartData =
    complianceChart.length > 0
      ? complianceChart
      : timeframe === "this_week"
        ? THIS_WEEK_DATA
        : LAST_WEEK_DATA;
  const avgCompliance = Math.round(
    chartData.reduce((acc, curr) => acc + curr.rate, 0) / chartData.length
  );

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

      <main className="p-lg max-w-[1400px]">
        {/* Summary Cards (4 columns) */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-lg mb-section-gap">
          {/* Card 1 */}
          <Link
            href="/doctor/patients"
            className="bg-surface-container-lowest border border-outline-variant rounded-xl p-card-padding shadow-xs flex items-center gap-md transition-all hover:shadow-md hover:border-primary/50 group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center text-secondary group-hover:bg-primary-container group-hover:text-primary transition-colors">
              <span
                className="material-symbols-outlined"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                group
              </span>
            </div>
            <div>
              <p className="font-caption text-caption text-on-surface-variant mb-xs">
                Tổng bệnh nhân
              </p>
              <p className="font-h1 text-h1 text-on-surface group-hover:text-primary transition-colors">
                {patientSummaries.length}
              </p>
            </div>
          </Link>

          {/* Card 2 */}
          <Link
            href="/doctor/reviews"
            className="bg-surface-container-lowest border border-outline-variant rounded-xl p-card-padding shadow-xs flex items-center gap-md transition-all hover:shadow-md hover:border-tertiary/50 group cursor-pointer relative overflow-hidden"
          >
            <div className="w-12 h-12 rounded-lg bg-tertiary-fixed flex items-center justify-center text-tertiary group-hover:scale-105 transition-transform">
              <span
                className="material-symbols-outlined"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                pending_actions
              </span>
            </div>
            <div>
              <p className="font-caption text-caption text-on-surface-variant mb-xs">
                Cần duyệt kế hoạch
              </p>
              <p className="font-h1 text-h1 text-on-surface font-bold">
                {pendingPlans.length}
              </p>
            </div>
            <div className="absolute top-0 right-0 w-1.5 h-full bg-tertiary-fixed-dim"></div>
          </Link>

          {/* Card 3 */}
          <Link
            href="/doctor/patients?status=attention"
            className="bg-surface-container-lowest border border-outline-variant rounded-xl p-card-padding shadow-xs flex items-center gap-md transition-all hover:shadow-md hover:border-error/50 group cursor-pointer relative overflow-hidden"
          >
            <div className="w-12 h-12 rounded-lg bg-error-container flex items-center justify-center text-error group-hover:scale-105 transition-transform">
              <span
                className="material-symbols-outlined"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                warning
              </span>
            </div>
            <div>
              <p className="font-caption text-caption text-on-surface-variant mb-xs">
                Cảnh báo lâm sàng
              </p>
              <p className="font-h1 text-h1 text-error font-bold">
                {MOCK_PATIENTS.filter((p) => p.status === "Cần chú ý" || p.status === "Cảnh báo").length}
              </p>
            </div>
            <div className="absolute top-0 right-0 w-1.5 h-full bg-error"></div>
          </Link>

          {/* Card 4 */}
          <Link
            href="/doctor/messages"
            className="bg-surface-container-lowest border border-outline-variant rounded-xl p-card-padding shadow-xs flex items-center gap-md transition-all hover:shadow-md hover:border-primary/50 group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-lg bg-primary-container flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
              <span
                className="material-symbols-outlined"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                mail
              </span>
            </div>
            <div>
              <p className="font-caption text-caption text-on-surface-variant mb-xs">
                Tin nhắn mới
              </p>
              <p className="font-h1 text-h1 text-on-surface font-bold">4</p>
            </div>
          </Link>
        </section>

        {/* Main Section (2 cols, 2:1 ratio) */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-lg mb-section-gap">
          {/* Left Col (2/3 width) - Bệnh nhân cần chú ý */}
          <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xs overflow-hidden flex flex-col">
            <div className="p-card-padding border-b border-outline-variant bg-surface flex justify-between items-center">
              <div>
                <h3 className="font-h2 text-h2 text-on-surface font-semibold">
                  Danh sách bệnh nhân cần chú ý
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Các bệnh nhân có chỉ số bất thường hoặc biến động gần đây
                </p>
              </div>
              <Link
                href="/doctor/patients"
                className="text-primary font-body-bold hover:underline text-sm cursor-pointer flex items-center gap-0.5"
              >
                <span>Xem tất cả</span>
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </Link>
            </div>
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[550px]">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant">
                    <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider">
                      Bệnh nhân
                    </th>
                    <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider">
                      Chỉ số biến động
                    </th>
                    <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider">
                      Trạng thái
                    </th>
                    <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider text-right">
                      Hành động
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant font-body text-body">
                  {MOCK_PATIENTS.map((patient) => (
                    <tr key={patient.id} className="hover:bg-surface-bright transition-colors">
                      <td className="p-md">
                        <div className="flex items-center gap-sm">
                          <div className="relative w-9 h-9 shrink-0">
                            <div className="absolute inset-0 rounded-full bg-primary/15 text-primary flex items-center justify-center font-label text-xs font-semibold">
                              {initials(patient.name)}
                            </div>
                            {patient.avatar && (
                              <img
                                src={patient.avatar}
                                alt={patient.name}
                                className="absolute inset-0 w-9 h-9 rounded-full object-cover border border-outline-variant bg-surface-container"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                            )}
                          </div>
                          <div>
                            <span className="font-body-bold text-on-surface block text-sm font-semibold">
                              {patient.name}
                            </span>
                            <span className="text-xs text-on-surface-variant font-mono">
                              {patient.id}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-md text-on-surface-variant text-sm">
                        {patient.bloodSugar ? `Đường huyết (${patient.bloodSugar})` : patient.condition}
                      </td>
                      <td className="p-md">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full font-caption text-xs font-semibold ${patient.statusColor}`}
                        >
                          {patient.status}
                        </span>
                      </td>
                      <td className="p-md text-right">
                        <Link
                          href={`/doctor/patients/${patient.id}`}
                          className="inline-flex items-center gap-1 h-8 px-md bg-surface-container-lowest border border-primary text-primary font-body-bold rounded-lg hover:bg-primary hover:text-on-primary transition-all text-xs cursor-pointer active:scale-95 shadow-2xs font-semibold"
                        >
                          <span>Xem chi tiết</span>
                          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Col (1/3 width) - Biểu đồ tuân thủ dinh dưỡng */}
          <div className="lg:col-span-1 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xs p-card-padding flex flex-col justify-between">
            <div>
              {/* Header & Controls */}
              <div className="border-b border-outline-variant pb-sm mb-md flex items-start justify-between">
                <div>
                  <h3 className="font-h2 text-h2 text-on-surface font-semibold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-emerald-600 text-[20px]">
                      monitoring
                    </span>
                    Tuân thủ dinh dưỡng
                  </h3>
                  <p className="font-caption text-caption text-on-surface-variant mt-0.5 text-xs">
                    Tỷ lệ tuân thủ thực đơn trung bình
                  </p>
                </div>
                {/* Timeframe Selector */}
                <div className="flex bg-surface-container-low rounded-lg p-0.5 border border-outline-variant">
                  <button
                    onClick={() => setTimeframe("this_week")}
                    className={`px-2 py-1 text-[11px] rounded-md transition-all font-semibold cursor-pointer ${
                      timeframe === "this_week"
                        ? "bg-surface-container-lowest text-primary shadow-2xs"
                        : "text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    Tuần này
                  </button>
                  <button
                    onClick={() => setTimeframe("last_week")}
                    className={`px-2 py-1 text-[11px] rounded-md transition-all font-semibold cursor-pointer ${
                      timeframe === "last_week"
                        ? "bg-surface-container-lowest text-primary shadow-2xs"
                        : "text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    Tuần trước
                  </button>
                </div>
              </div>

              {/* Stat Summary Box */}
              <div className="mb-md p-sm bg-emerald-50/60 border border-emerald-200/80 rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-xs text-emerald-800 font-medium block">Trung bình tuần</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold text-emerald-900">{avgCompliance}%</span>
                    <span className="text-[11px] text-emerald-700 font-semibold flex items-center">
                      <span className="material-symbols-outlined text-[14px]">trending_up</span>
                      +5%
                    </span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-bold shadow-2xs">
                  {avgCompliance >= 75 ? "Đạt mục tiêu" : "Cần theo dõi"}
                </span>
              </div>

              {/* Interactive Bar Chart */}
              <div className="relative pt-6 pb-2 min-h-[220px] flex flex-col justify-end">
                {/* Benchmark Target Line (80%) */}
                <div
                  className="absolute left-0 right-0 border-b-2 border-dashed border-emerald-400/80 z-0 flex items-center justify-end pr-1 pointer-events-none"
                  style={{ bottom: "calc(26px + 120px * 0.8)" }}
                >
                  <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded border border-emerald-300">
                    Chỉ tiêu 80%
                  </span>
                </div>

                {/* Y-axis grid line 50% */}
                <div
                  className="absolute left-0 right-0 border-b border-gray-200/70 z-0 pointer-events-none"
                  style={{ bottom: "calc(26px + 120px * 0.5)" }}
                ></div>

                {/* Bars Container */}
                <div className="w-full flex items-end justify-between px-1 z-10 gap-1.5">
                  {chartData.map((item) => {
                    const isHigh = item.rate >= 80;
                    const isMedium = item.rate >= 60 && item.rate < 80;

                    let barBg = "bg-rose-500 hover:bg-rose-600";
                    let textBg = "text-rose-700";
                    if (isHigh) {
                      barBg = "bg-emerald-500 hover:bg-emerald-600";
                      textBg = "text-emerald-700";
                    } else if (isMedium) {
                      barBg = "bg-amber-500 hover:bg-amber-600";
                      textBg = "text-amber-700";
                    }

                    return (
                      <div
                        key={item.day}
                        className="flex-1 flex flex-col items-center group relative cursor-pointer"
                        onMouseEnter={() => setHoveredDay(item)}
                        onMouseLeave={() => setHoveredDay(null)}
                      >
                        {/* Hover Tooltip Popup */}
                        {hoveredDay?.day === item.day && (
                          <div className="absolute bottom-full mb-2 z-30 w-44 bg-gray-900 text-white text-xs p-2.5 rounded-xl shadow-xl border border-gray-700 backdrop-blur-md animate-fadeIn pointer-events-none">
                            <div className="flex justify-between items-center border-b border-gray-700 pb-1 mb-1 font-semibold">
                              <span>Thứ ({item.day}) - {item.date}</span>
                              <span className={item.rate >= 80 ? "text-emerald-400" : "text-amber-400"}>
                                {item.rate}%
                              </span>
                            </div>
                            <div className="space-y-0.5 text-[11px] text-gray-300">
                              <p>Bữa ăn: <strong className="text-white">{item.meals}</strong></p>
                              <p>Calo đạt: <strong className="text-white">{item.calories}</strong></p>
                              <p>Muối đạt: <strong className="text-white">{item.salt}</strong></p>
                            </div>
                          </div>
                        )}

                        {/* Value Text Above Bar */}
                        <span className={`text-[10px] font-bold mb-1 ${textBg}`}>
                          {item.rate}%
                        </span>

                        {/* Bar Track (Explicit height 120px to allow percentage heights) */}
                        <div className="w-full h-[120px] flex items-end justify-center">
                          <div
                            className={`w-full max-w-[28px] rounded-t-md transition-all duration-300 ${barBg} ${
                              hoveredDay?.day === item.day ? "scale-105 shadow-md" : ""
                            }`}
                            style={{ height: `${item.rate}%` }}
                          ></div>
                        </div>

                        {/* X-axis Day Label */}
                        <span className="mt-1.5 text-[11px] font-semibold text-on-surface-variant">
                          {item.day}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Legend & Link */}
            <div className="pt-sm border-t border-outline-variant mt-sm">
              <div className="flex items-center justify-between text-[11px] text-on-surface-variant mb-2">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  Đạt (≥80%)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  TB (60-79%)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                  Kém (&lt;60%)
                </span>
              </div>

              <Link
                href="/doctor/patients/compliance"
                className="w-full py-1.5 bg-surface-container-low hover:bg-surface-container border border-outline-variant text-on-surface font-body-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1 font-semibold"
              >
                <span>Xem báo cáo tuân thủ chi tiết</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Bottom Section - Kế hoạch chờ duyệt mới nhất */}
        <section>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xs">
            <div className="p-card-padding border-b border-outline-variant bg-surface flex justify-between items-center rounded-t-xl">
              <div>
                <h3 className="font-h2 text-h2 text-on-surface flex items-center gap-sm font-semibold">
                  <span className="material-symbols-outlined text-tertiary">
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
                className="text-primary text-xs font-semibold hover:underline flex items-center gap-0.5"
              >
                <span>Xem tất cả ({pendingPlans.length})</span>
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </Link>
            </div>

            <div className="p-md space-y-sm">
              {pendingPlans.length === 0 ? (
                <div className="p-lg text-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-[36px] text-emerald-500 mb-xs">
                    check_circle
                  </span>
                  <p className="font-body-bold text-sm">Hiện không có kế hoạch nào chờ duyệt</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Tất cả các thực đơn đã được xem xét hoặc phê duyệt.
                  </p>
                </div>
              ) : (
                visiblePendingPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-md border border-outline-variant rounded-xl bg-surface hover:bg-surface-bright transition-colors gap-md"
                  >
                    <div className="flex items-center gap-md">
                      <div className="w-10 h-10 rounded-full bg-secondary-fixed flex items-center justify-center text-secondary font-body-bold shrink-0 font-bold">
                        {plan.patientName.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-xs">
                          <p className="font-body-bold text-on-surface font-semibold text-sm">
                            {plan.patientName}
                          </p>
                          <span className="font-mono text-xs text-on-surface-variant">
                            ({plan.patientCode})
                          </span>
                        </div>
                        <p className="text-xs text-on-surface font-medium text-primary mt-0.5 line-clamp-1">
                          {plan.planTitle}
                        </p>
                        <div className="flex items-center gap-md font-caption text-on-surface-variant mt-xs text-xs">
                          <span className="flex items-center gap-[2px]">
                            <span className="material-symbols-outlined text-[14px]">
                              restaurant_menu
                            </span>{" "}
                            {plan.condition}
                          </span>
                          <span className="flex items-center gap-[2px]">
                            <span className="material-symbols-outlined text-[14px]">
                              calendar_today
                            </span>{" "}
                            {plan.createdAt}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-sm shrink-0 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-sm sm:pt-0 border-outline-variant/50">
                      <Link
                        href={`/doctor/reviews/${plan.patientId}/${plan.id}`}
                        className="h-8 px-md bg-surface-container-lowest border border-outline-variant text-on-surface-variant font-body-bold rounded-lg hover:bg-surface-container-low hover:text-primary transition-colors text-xs flex items-center gap-1 cursor-pointer font-semibold"
                      >
                        <span className="material-symbols-outlined text-[16px]">visibility</span>
                        <span>Xem trước</span>
                      </Link>

                      <button
                        onClick={() =>
                          handleQuickApprove(plan.id, plan.planTitle)
                        }
                        className="h-8 px-md bg-primary text-on-primary font-body-bold rounded-lg hover:bg-primary-container hover:text-on-primary-container transition-all text-xs shadow-xs flex items-center gap-1 cursor-pointer font-semibold active:scale-95"
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
        <section className="mt-section-gap">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xs">
            <div className="p-card-padding border-b border-outline-variant bg-surface flex justify-between items-center rounded-t-xl">
              <div>
                <h3 className="font-h2 text-h2 text-on-surface flex items-center gap-sm font-semibold">
                  <span className="material-symbols-outlined text-tertiary">
                    event_busy
                  </span>
                  Cảnh báo thực đơn hết hạn
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Bệnh nhân sắp ăn xong / đã ăn xong thực đơn — cần tạo thực đơn tiếp
                </p>
              </div>

              <div className="flex items-center gap-sm shrink-0">
                <button
                  type="button"
                  onClick={() => void handleDemoExpiry("expiring")}
                  disabled={demoBusy}
                  className="px-md py-1.5 border border-outline-variant rounded-lg text-xs font-semibold text-on-surface-variant hover:border-amber-400 hover:text-amber-700 transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-1"
                  title="Chỉ khả dụng môi trường demo (backend chặn ở production)"
                >
                  <span className="material-symbols-outlined text-[16px]">schedule</span>
                  Giả lập: sắp hết hạn
                </button>
                <button
                  type="button"
                  onClick={() => void handleDemoExpiry("expired")}
                  disabled={demoBusy}
                  className="px-md py-1.5 border border-outline-variant rounded-lg text-xs font-semibold text-on-surface-variant hover:border-red-400 hover:text-red-700 transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-1"
                  title="Chỉ khả dụng môi trường demo (backend chặn ở production)"
                >
                  <span className="material-symbols-outlined text-[16px]">event_busy</span>
                  Giả lập: đã hết hạn
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-md px-md border-b border-outline-variant/60">
              <button
                type="button"
                onClick={() => setExpiryTab("expiring")}
                className={`font-label text-label pb-sm pt-sm px-sm border-b-2 transition-all cursor-pointer ${
                  expiryTab === "expiring"
                    ? "border-primary text-primary font-bold"
                    : "border-transparent text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Sắp ăn xong ({expiringPatients.length})
              </button>
              <button
                type="button"
                onClick={() => setExpiryTab("expired")}
                className={`font-label text-label pb-sm pt-sm px-sm border-b-2 transition-all cursor-pointer ${
                  expiryTab === "expired"
                    ? "border-primary text-primary font-bold"
                    : "border-transparent text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Đã ăn xong ({expiredPatients.length})
              </button>
            </div>

            <div className="p-md space-y-sm">
              {expiryList.length === 0 ? (
                <div className="p-lg text-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-[36px] text-emerald-500 mb-xs">
                    {expiryTab === "expiring" ? "upcoming" : "check_circle"}
                  </span>
                  <p className="font-body-bold text-sm">
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
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-md border border-outline-variant rounded-xl bg-surface hover:bg-surface-bright transition-colors gap-md"
                  >
                    <div className="flex items-center gap-md">
                      {/* Avatar — chuẩn theo trang /doctor/patients */}
                      <div className="relative w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center font-label text-xs font-semibold shrink-0">
                        {initials(p.name)}
                        {p.avatar &&
                          !p.avatar.startsWith("https://api.dicebear.com") && (
                          <img
                            src={assetUrl(p.avatar)}
                            alt={p.name}
                            className="absolute inset-0 w-10 h-10 rounded-full object-cover border border-outline-variant bg-surface-container"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-xs">
                          <p className="font-body-bold text-on-surface font-semibold text-sm">
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

                    <div className="flex items-center gap-sm shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                      {p.plan_expiry === "expiring" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                          Còn {p.plan_days_left ?? "?"} ngày (đến {p.plan_end_date ?? "—"})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200 whitespace-nowrap">
                          <span className="material-symbols-outlined text-[14px]">
                            event_busy
                          </span>
                          Hết hạn {p.plan_end_date ?? "—"}
                        </span>
                      )}

                      <Link
                        href={`/doctor/patients/${encodeURIComponent(p.id)}/generate`}
                        className="h-8 px-md bg-primary text-on-primary font-body-bold rounded-lg hover:bg-primary-container transition-all text-xs shadow-xs flex items-center gap-1 cursor-pointer font-semibold active:scale-95 whitespace-nowrap"
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
