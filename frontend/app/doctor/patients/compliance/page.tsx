"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/shared/TopBar";
import Pagination, { getPageItems } from "@/components/shared/Pagination";
import { api, assetUrl } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { doctorPatientToUi, type Patient } from "@/lib/mock-data";
import { shortCondition } from "@/lib/format";
import {
  ApiError,
  type DoctorPatientSummary,
  type PatientComplianceOut,
} from "@/lib/types";

interface ComplianceLog {
  title: string;
  time: string;
  description: string;
  type: "warning" | "success" | "info";
}

interface PatientComplianceSummary {
  rate: number | null;
  asPlannedMeals: number;
  totalMeals: number;
  lowThreshold: number;
  lastAlert: {
    text: string;
    type: "warning" | "success" | "info";
    time: string;
  };
  chartData: (number | null)[];
  logs: ComplianceLog[];
}

const PAGE_SIZE = 10;
const COMPLIANCE_DAYS = 14;
const DEFAULT_REMIND_MESSAGE =
  "Bác sĩ nhắc bạn ghi nhận tuân thủ thực đơn hôm nay nhé.";

function formatEventTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function complianceToSummary(data: PatientComplianceOut): PatientComplianceSummary {
  const logs: ComplianceLog[] = data.events.map((ev) => ({
    title: ev.title,
    time: formatEventTime(ev.at),
    description: `Mức độ cảnh báo: ${ev.severity}`,
    type:
      ev.severity === "Nguy hiểm" || ev.severity === "Cần chú ý"
        ? "warning"
        : "info",
  }));

  const lastEvent = data.events[0];
  const lastAlert = lastEvent
    ? {
        text: lastEvent.title,
        type: "warning" as const,
        time: formatEventTime(lastEvent.at),
      }
    : {
        text: "Chưa có sự kiện cảnh báo",
        type: "info" as const,
        time: "—",
      };

  return {
    rate: data.overall_adherence_pct,
    asPlannedMeals: data.checkins_as_planned,
    totalMeals: data.checkins_done,
    lowThreshold: data.low_threshold_pct,
    lastAlert,
    chartData: data.daily_series.map((d) => d.adherence_pct),
    logs,
  };
}

function emptyComplianceSummary(lowThreshold = 50): PatientComplianceSummary {
  return {
    rate: null,
    asPlannedMeals: 0,
    totalMeals: 0,
    lowThreshold,
    lastAlert: {
      text: "Chưa có sự kiện cảnh báo",
      type: "info",
      time: "—",
    },
    chartData: Array.from({ length: COMPLIANCE_DAYS }, () => null),
    logs: [],
  };
}

function truncateId(id: string): string {
  return id.length > 6 ? `...${id.slice(-4)}` : id;
}

function toUiPatient(row: DoctorPatientSummary): Patient {
  const ui = doctorPatientToUi(row);
  return { ...ui, avatar: assetUrl(ui.avatar) || ui.avatar };
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "BN";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

function matchesComplianceBand(
  stats: PatientComplianceSummary,
  band: "high" | "medium" | "low"
): boolean {
  if (stats.rate === null) return false;
  if (band === "high") return stats.rate >= 85;
  if (band === "medium") return stats.rate >= 75 && stats.rate < 85;
  return stats.rate < 75;
}

type ChartPoint = { val: number; idx: number };

function buildChartSegments(chartData: (number | null)[]) {
  const points = chartData
    .map((val, idx) => (val === null ? null : { val, idx }))
    .filter((p): p is ChartPoint => p !== null);

  const segments: ChartPoint[][] = [];
  let current: ChartPoint[] = [];

  for (let i = 0; i < chartData.length; i++) {
    const val = chartData[i];
    if (val === null) {
      if (current.length > 0) {
        segments.push(current);
        current = [];
      }
    } else {
      current.push({ val, idx: i });
    }
  }
  if (current.length > 0) segments.push(current);

  return { points, segments };
}

export default function PatientCompliancePage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const [hydrated, setHydrated] = useState(false);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [complianceByPatient, setComplianceByPatient] = useState<
    Record<string, PatientComplianceSummary>
  >({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [diagnosisFilter, setDiagnosisFilter] = useState<string>("all");
  const [complianceFilter, setComplianceFilter] = useState<
    "all" | "high" | "medium" | "low"
  >("all");
  const [page, setPage] = useState(1);

  const [viewingPatient, setViewingPatient] = useState<Patient | null>(null);
  const [remindMessage, setRemindMessage] = useState(DEFAULT_REMIND_MESSAGE);
  const [remindSending, setRemindSending] = useState(false);
  const [remindFeedback, setRemindFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const loadData = useCallback(async () => {
    if (!token || role !== "doctor") return;
    setLoading(true);
    setLoadError(null);
    try {
      const rows = await api.listDoctorPatients();
      const uiPatients = rows.map(toUiPatient);
      setPatients(uiPatients);

      const complianceResults = await Promise.all(
        uiPatients.map(async (patient) => {
          try {
            const data = await api.getPatientCompliance(patient.id, COMPLIANCE_DAYS);
            return [patient.id, complianceToSummary(data)] as const;
          } catch {
            return [patient.id, emptyComplianceSummary()] as const;
          }
        })
      );

      setComplianceByPatient(Object.fromEntries(complianceResults));
    } catch (err) {
      setPatients([]);
      setComplianceByPatient({});
      if (err instanceof ApiError && err.status !== 401) {
        setLoadError(err.message);
      } else if (!(err instanceof ApiError)) {
        setLoadError("Không tải được dữ liệu tuân thủ.");
      }
    } finally {
      setLoading(false);
    }
  }, [token, role]);

  useEffect(() => {
    if (!hydrated) return;
    if (!token || role !== "doctor") {
      router.replace("/login");
      return;
    }
    void loadData();
  }, [hydrated, token, role, router, loadData]);

  const getStats = useCallback(
    (patient: Patient): PatientComplianceSummary =>
      complianceByPatient[patient.id] ?? emptyComplianceSummary(),
    [complianceByPatient]
  );

  const filteredPatients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return patients.filter((patient) => {
      const matchesSearch =
        !q ||
        patient.name.toLowerCase().includes(q) ||
        patient.id.toLowerCase().includes(q) ||
        (patient.condition || "").toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (diagnosisFilter !== "all") {
        if (
          !(patient.condition || "")
            .toLowerCase()
            .includes(diagnosisFilter.toLowerCase())
        ) {
          return false;
        }
      }

      if (complianceFilter !== "all") {
        const stats = getStats(patient);
        if (!matchesComplianceBand(stats, complianceFilter)) return false;
      }

      return true;
    });
  }, [patients, searchQuery, diagnosisFilter, complianceFilter, getStats]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, diagnosisFilter, complianceFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedPatients = getPageItems(filteredPatients, safePage, PAGE_SIZE);

  const handleOpenModal = (patient: Patient) => {
    setViewingPatient(patient);
    setRemindMessage(DEFAULT_REMIND_MESSAGE);
    setRemindFeedback(null);
  };

  const handleSendRemind = async () => {
    if (!viewingPatient) return;
    setRemindSending(true);
    setRemindFeedback(null);
    try {
      await api.remindPatientCompliance(viewingPatient.id, remindMessage.trim());
      setRemindFeedback({
        type: "success",
        text: "Đã gửi nhắc nhở tuân thủ tới bệnh nhân.",
      });
    } catch (err) {
      setRemindFeedback({
        type: "error",
        text:
          err instanceof ApiError
            ? err.message
            : "Không gửi được nhắc nhở. Vui lòng thử lại.",
      });
    } finally {
      setRemindSending(false);
    }
  };

  if (!hydrated || !token || role !== "doctor") {
    return null;
  }

  if (loading) {
    return (
      <>
        <TopBar title="Theo dõi tuân thủ" />
        <main className="p-lg text-sm text-on-surface-variant">
          Đang tải dữ liệu tuân thủ bệnh nhân…
        </main>
      </>
    );
  }

  const viewingStats = viewingPatient ? getStats(viewingPatient) : null;
  const hasChartData =
    viewingStats?.chartData.some((val) => val !== null) ?? false;

  return (
    <>
      <TopBar title="Theo dõi tuân thủ" />

      <main className="p-lg max-w-[1400px]">
        {loadError && (
          <div className="mb-md p-md bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center justify-between">
            <span>{loadError}</span>
            <button
              onClick={() => void loadData()}
              className="text-primary font-semibold hover:underline cursor-pointer"
            >
              Thử lại
            </button>
          </div>
        )}

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-md mb-section-gap">
          <div>
            <h2 className="font-h1 text-h1 text-on-surface font-bold">
              Theo dõi tuân thủ dinh dưỡng
            </h2>
            <p className="font-caption text-caption text-on-surface-variant mt-xs">
              Thống kê check-in tuân thủ và cảnh báo tương tác thuốc–thực phẩm
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-sm">
            <div className="relative min-w-[240px]">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
                search
              </span>
              <input
                type="text"
                placeholder="Tìm mã BN, tên bệnh nhân, bệnh lý..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm font-body text-on-surface focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div className="relative min-w-[160px]">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] pointer-events-none">
                donut_large
              </span>
              <select
                value={complianceFilter}
                onChange={(e) =>
                  setComplianceFilter(
                    e.target.value as "all" | "high" | "medium" | "low"
                  )
                }
                className="w-full pl-9 pr-8 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm font-body text-on-surface focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
              >
                <option value="all">Tất cả mức độ</option>
                <option value="high">Cao (&ge; 85%)</option>
                <option value="medium">Trung bình (75 - 84%)</option>
                <option value="low">Cần lưu ý (&lt; 75%)</option>
              </select>
              <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] pointer-events-none">
                arrow_drop_down
              </span>
            </div>

            <div className="relative min-w-[170px]">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] pointer-events-none">
                filter_alt
              </span>
              <select
                value={diagnosisFilter}
                onChange={(e) => setDiagnosisFilter(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm font-body text-on-surface focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
              >
                <option value="all">Tất cả bệnh lý</option>
                <option value="tiểu đường">Tiểu đường</option>
                <option value="huyết áp">Tăng huyết áp</option>
                <option value="thận">Bệnh thận / CKD</option>
                <option value="lipid">Rối loạn lipid</option>
                <option value="gout">Gút (Gout)</option>
              </select>
              <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] pointer-events-none">
                arrow_drop_down
              </span>
            </div>
          </div>
        </div>

        {filteredPatients.length === 0 ? (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-xl text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-[48px] text-outline mb-sm">
              insights
            </span>
            <p className="font-body-bold text-body-bold">
              Không tìm thấy bệnh nhân phù hợp
            </p>
            <p className="font-caption text-caption text-xs mt-xs">
              Thử thay đổi từ khóa tìm kiếm hoặc chọn lại nhóm mức độ tuân thủ.
            </p>
          </div>
        ) : (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[980px]">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant">
                    <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider text-xs">
                      Mã BN
                    </th>
                    <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider text-xs">
                      Bệnh nhân
                    </th>
                    <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider text-xs">
                      Chẩn đoán bệnh lý
                    </th>
                    <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider text-xs text-center">
                      Mức độ tuân thủ (14 ngày)
                    </th>
                    <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider text-xs text-center">
                      Check-in tuân thủ
                    </th>
                    <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider text-xs">
                      Sự kiện / Cảnh báo gần nhất
                    </th>
                    <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider text-xs text-right">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant font-body text-body">
                  {pagedPatients.map((patient) => {
                    const stats = getStats(patient);
                    const hasRate = stats.rate !== null;
                    const rate = stats.rate ?? 0;
                    const isHigh = hasRate && rate >= 85;
                    const isMedium = hasRate && rate >= 75 && rate < 85;

                    return (
                      <tr
                        key={patient.id}
                        className="transition-colors hover:bg-surface-bright"
                      >
                        <td className="p-md">
                          <span
                            title={patient.id}
                            className="font-mono text-xs font-medium text-on-surface-variant"
                          >
                            {truncateId(patient.id)}
                          </span>
                        </td>

                        <td className="p-md">
                          <div className="flex items-center gap-sm min-w-0">
                            <div className="relative w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center font-label text-xs font-semibold shrink-0">
                              {initials(patient.name)}
                              {patient.avatar &&
                                !patient.avatar.startsWith(
                                  "https://api.dicebear.com"
                                ) && (
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
                            <div className="min-w-0">
                              <p className="font-body-bold text-on-surface font-semibold text-sm whitespace-nowrap">
                                {patient.name}
                              </p>
                              <p className="text-xs text-on-surface-variant">
                                {patient.age ? `${patient.age} tuổi` : "—"}{" "}
                                {patient.gender ? `• ${patient.gender}` : ""}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="p-md text-on-surface-variant">
                          <span
                            className="bg-tertiary-container/20 text-tertiary px-sm py-xs rounded-full font-caption text-caption border border-tertiary-container/30 text-xs font-medium inline-block max-w-[200px] truncate"
                            title={patient.condition}
                          >
                            {shortCondition(patient.condition, 2)}
                          </span>
                        </td>

                        <td className="p-md text-center whitespace-nowrap">
                          {hasRate ? (
                            <div className="inline-flex flex-col items-center gap-1">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                  isHigh
                                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                    : isMedium
                                    ? "bg-amber-50 text-amber-800 border border-amber-200"
                                    : "bg-red-50 text-red-800 border border-red-200"
                                }`}
                              >
                                <span className="material-symbols-outlined text-[14px]">
                                  {isHigh
                                    ? "check_circle"
                                    : isMedium
                                    ? "info"
                                    : "warning"}
                                </span>
                                {rate}%
                              </span>
                              <div className="w-20 bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    isHigh
                                      ? "bg-emerald-600"
                                      : isMedium
                                      ? "bg-amber-500"
                                      : "bg-red-500"
                                  }`}
                                  style={{ width: `${rate}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-on-surface-variant">
                              Chưa có check-in
                            </span>
                          )}
                        </td>

                        <td className="p-md text-center whitespace-nowrap text-xs">
                          {stats.totalMeals > 0 ? (
                            <>
                              <span className="font-semibold text-on-surface">
                                {stats.asPlannedMeals}
                              </span>
                              <span className="text-on-surface-variant">
                                {" "}
                                / {stats.totalMeals} check-in
                              </span>
                              <p className="text-[11px] text-on-surface-variant mt-0.5">
                                (
                                {Math.round(
                                  (stats.asPlannedMeals / stats.totalMeals) *
                                    100
                                )}
                                % đúng kế hoạch)
                              </p>
                            </>
                          ) : (
                            <span className="text-on-surface-variant">
                              Chưa có dữ liệu
                            </span>
                          )}
                        </td>

                        <td className="p-md text-on-surface-variant">
                          <div className="flex items-start gap-1 max-w-[240px]">
                            <span
                              className={`material-symbols-outlined text-[15px] shrink-0 mt-0.5 ${
                                stats.lastAlert.type === "warning"
                                  ? "text-amber-600"
                                  : stats.lastAlert.type === "success"
                                  ? "text-emerald-600"
                                  : "text-on-surface-variant"
                              }`}
                            >
                              {stats.lastAlert.type === "warning"
                                ? "warning"
                                : stats.lastAlert.type === "success"
                                ? "check_circle"
                                : "info"}
                            </span>
                            <span
                              className="text-xs truncate"
                              title={`${stats.lastAlert.text} (${stats.lastAlert.time})`}
                            >
                              {stats.lastAlert.text}
                            </span>
                          </div>
                        </td>

                        <td className="p-md text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-xs">
                            <Link
                              href={`/doctor/patients/${encodeURIComponent(patient.id)}`}
                              title="Xem chi tiết hồ sơ bệnh nhân"
                              className="inline-flex items-center gap-1.5 px-md py-1.5 bg-surface-container-lowest border border-outline-variant text-on-surface hover:border-primary hover:text-primary font-body-bold text-xs rounded-lg hover:bg-surface-container-low transition-all cursor-pointer active:scale-95 shadow-xs"
                            >
                              <span className="material-symbols-outlined text-[16px]">
                                visibility
                              </span>
                              <span>Xem chi tiết</span>
                            </Link>

                            <button
                              type="button"
                              onClick={() => handleOpenModal(patient)}
                              title="Xem biểu đồ tuân thủ & nhật ký sự kiện"
                              className="inline-flex items-center gap-1.5 px-md py-1.5 bg-primary text-on-primary font-body-bold text-xs rounded-lg hover:bg-primary-container transition-all cursor-pointer active:scale-95 shadow-xs font-semibold"
                            >
                              <span className="material-symbols-outlined text-[16px]">
                                insights
                              </span>
                              <span>Biểu đồ &amp; Nhật ký</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              page={safePage}
              totalItems={filteredPatients.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        )}
      </main>

      {viewingPatient && viewingStats && (
        <div className="fixed inset-0 z-50 bg-on-surface/40 backdrop-blur-xs flex items-center justify-center p-md animate-fadeIn">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-md border-b border-outline-variant mb-md shrink-0">
              <div className="flex items-center gap-sm">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined text-[22px]">
                    insights
                  </span>
                </div>
                <div>
                  <h3 className="font-h2 text-h2 text-on-surface font-bold text-base">
                    Theo dõi tuân thủ: {viewingPatient.name}
                  </h3>
                  <p className="font-caption text-caption text-on-surface-variant text-xs">
                    {viewingPatient.id} •{" "}
                    {viewingPatient.age ? `${viewingPatient.age} tuổi` : ""} •
                    Chẩn đoán: {viewingPatient.condition}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingPatient(null)}
                className="text-on-surface-variant hover:text-primary p-1 rounded-lg hover:bg-surface-container-low transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">
                  close
                </span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-md pr-xs py-xs">
              <div className="grid grid-cols-3 gap-sm">
                <div className="p-3 bg-surface-container-low/60 rounded-xl border border-outline-variant/60 text-center">
                  <p className="text-xs text-on-surface-variant">
                    Tỷ lệ tuân thủ 14 ngày
                  </p>
                  <p className="text-xl font-bold text-primary mt-0.5">
                    {viewingStats.rate !== null ? `${viewingStats.rate}%` : "—"}
                  </p>
                </div>
                <div className="p-3 bg-surface-container-low/60 rounded-xl border border-outline-variant/60 text-center">
                  <p className="text-xs text-on-surface-variant">
                    Check-in đúng kế hoạch
                  </p>
                  <p className="text-xl font-bold text-emerald-700 mt-0.5">
                    {viewingStats.asPlannedMeals} / {viewingStats.totalMeals}
                  </p>
                </div>
                <div className="p-3 bg-surface-container-low/60 rounded-xl border border-outline-variant/60 text-center">
                  <p className="text-xs text-on-surface-variant">
                    Đánh giá chung
                  </p>
                  <p
                    className={`text-sm font-bold mt-1 ${
                      viewingStats.rate !== null && viewingStats.rate >= 85
                        ? "text-emerald-700"
                        : "text-amber-700"
                    }`}
                  >
                    {viewingStats.rate === null
                      ? "Chưa có dữ liệu"
                      : viewingStats.rate >= 85
                      ? "Tuân thủ tốt"
                      : viewingStats.rate < viewingStats.lowThreshold
                      ? "Cần can thiệp"
                      : "Cần lưu ý"}
                  </p>
                </div>
              </div>

              <div className="bg-surface-container-lowest border border-outline-variant/80 rounded-xl p-md">
                <div className="flex justify-between items-center mb-sm">
                  <h4 className="font-body-bold text-sm font-semibold text-on-surface">
                    Biểu đồ tỷ lệ tuân thủ (14 ngày gần nhất)
                  </h4>
                  <span className="text-xs text-on-surface-variant font-medium">
                    Mức độ tuân thủ (%)
                  </span>
                </div>
                { !hasChartData ? (
                  <div className="h-[260px] flex items-center justify-center text-xs text-on-surface-variant">
                    Chưa có check-in tuân thủ trong 14 ngày qua
                  </div>
                ) : (
                  <div className="w-full pt-2 pb-1">
                    <svg
                      className="w-full h-auto block"
                      viewBox="0 0 1000 300"
                      preserveAspectRatio="xMidYMid meet"
                      role="img"
                      aria-label="Biểu đồ tỷ lệ tuân thủ 14 ngày"
                    >
                      {(() => {
                        const padLeft = 52;
                        const padRight = 24;
                        const plotTop = 28;
                        const plotBottom = 224;
                        const tickBottom = 232;
                        const labelY = 252;
                        const captionY = 278;
                        const plotWidth = 1000 - padLeft - padRight;
                        const plotHeight = plotBottom - plotTop;
                        const minVal = 0;
                        const maxVal = 100;
                        const chartData = viewingStats.chartData;
                        const total = chartData.length;
                        const xStep =
                          total > 1 ? plotWidth / (total - 1) : 0;

                        const toX = (idx: number) => padLeft + idx * xStep;
                        const toY = (val: number) => {
                          const clamped = Math.max(0, Math.min(100, val));
                          return (
                            plotBottom -
                            ((clamped - minVal) / (maxVal - minVal)) * plotHeight
                          );
                        };

                        const gridPercents = [100, 75, 50, 25, 0] as const;
                        const { points, segments } =
                          buildChartSegments(chartData);

                        const segmentPath = (seg: ChartPoint[]) =>
                          seg
                            .map((p, i) =>
                              i === 0
                                ? `M ${toX(p.idx)},${toY(p.val)}`
                                : `L ${toX(p.idx)},${toY(p.val)}`
                            )
                            .join(" ");

                        const segmentArea = (seg: ChartPoint[]) => {
                          if (seg.length === 0) return "";
                          if (seg.length === 1) {
                            const p = seg[0];
                            const x = toX(p.idx);
                            return `M ${x},${toY(p.val)} L ${x},${plotBottom} Z`;
                          }
                          const line = seg
                            .map((p) => `${toX(p.idx)},${toY(p.val)}`)
                            .join(" L ");
                          const first = seg[0];
                          const last = seg[seg.length - 1];
                          return `M ${toX(first.idx)},${plotBottom} L ${line} L ${toX(last.idx)},${plotBottom} Z`;
                        };

                        return (
                          <>
                            <g
                              stroke="#e5e7eb"
                              strokeDasharray="4 4"
                              strokeWidth="1"
                            >
                              {gridPercents.map((pct) => (
                                <line
                                  key={pct}
                                  x1={padLeft}
                                  x2={padLeft + plotWidth}
                                  y1={toY(pct)}
                                  y2={toY(pct)}
                                />
                              ))}
                            </g>

                            <g
                              fill="#6e7a75"
                              fontFamily="Inter, sans-serif"
                              fontSize="12"
                              textAnchor="end"
                            >
                              {gridPercents.map((pct) => (
                                <text key={pct} x={padLeft - 10} y={toY(pct) + 4}>
                                  {pct}%
                                </text>
                              ))}
                            </g>

                            <line
                              x1={padLeft}
                              x2={padLeft + plotWidth}
                              y1={plotBottom}
                              y2={plotBottom}
                              stroke="#d1d5db"
                              strokeWidth="1.5"
                            />

                            {Array.from({ length: total }, (_, idx) => {
                              const hasValue = chartData[idx] !== null;
                              return (
                                <g key={`tick-${idx}`}>
                                  <line
                                    x1={toX(idx)}
                                    x2={toX(idx)}
                                    y1={plotBottom}
                                    y2={tickBottom}
                                    stroke="#d1d5db"
                                    strokeWidth="1.5"
                                  />
                                  {!hasValue && (
                                    <circle
                                      cx={toX(idx)}
                                      cy={plotBottom}
                                      r="3"
                                      fill="#cbd5e1"
                                      stroke="none"
                                    >
                                      <title>{`Ngày ${idx + 1}: Không có dữ liệu`}</title>
                                    </circle>
                                  )}
                                </g>
                              );
                            })}

                            <g
                              fill="#6e7a75"
                              fontFamily="Inter, sans-serif"
                              fontSize="12"
                              fontWeight="500"
                              textAnchor="middle"
                            >
                              {Array.from({ length: total }, (_, idx) => (
                                <text key={idx} x={toX(idx)} y={labelY}>
                                  {idx + 1}
                                </text>
                              ))}
                            </g>

                            <text
                              x={padLeft + plotWidth / 2}
                              y={captionY}
                              fill="#9ca3af"
                              fontFamily="Inter, sans-serif"
                              fontSize="11"
                              textAnchor="middle"
                            >
                              Ngày (1 = cũ nhất → {total} = hôm nay)
                            </text>

                            <defs>
                              <linearGradient
                                id="modal-teal-fade"
                                x1="0"
                                x2="0"
                                y1="0"
                                y2="1"
                              >
                                <stop
                                  offset="0%"
                                  stopColor="#006857"
                                  stopOpacity="0.25"
                                />
                                <stop
                                  offset="100%"
                                  stopColor="#006857"
                                  stopOpacity="0.02"
                                />
                              </linearGradient>
                            </defs>

                            {segments.map((seg, i) => (
                              <path
                                key={`area-${i}`}
                                d={segmentArea(seg)}
                                fill="url(#modal-teal-fade)"
                              />
                            ))}
                            {segments.map((seg, i) => (
                              <path
                                key={`line-${i}`}
                                d={segmentPath(seg)}
                                fill="none"
                                stroke="#006857"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="3"
                              />
                            ))}
                            <g fill="#ffffff" stroke="#006857" strokeWidth="2.5">
                              {points.map((p) => (
                                <circle
                                  key={p.idx}
                                  cx={toX(p.idx)}
                                  cy={toY(p.val)}
                                  r="4.5"
                                  className="cursor-pointer transition-transform hover:scale-125"
                                >
                                  <title>{`Ngày ${p.idx + 1}: ${p.val}%`}</title>
                                </circle>
                              ))}
                            </g>
                          </>
                        );
                      })()}
                    </svg>
                  </div>
                )}
              </div>

              <div className="bg-surface-container-lowest border border-outline-variant/80 rounded-xl p-md">
                <h4 className="font-body-bold text-xs font-semibold text-on-surface mb-sm">
                  Nhật ký sự kiện tuân thủ gần đây
                </h4>
                {viewingStats.logs.length === 0 ? (
                  <p className="text-xs text-on-surface-variant">
                    Chưa có cảnh báo tương tác trong 14 ngày qua.
                  </p>
                ) : (
                  <div className="space-y-xs">
                    {viewingStats.logs.map((log, idx) => (
                      <div
                        key={idx}
                        className="p-sm bg-surface-container-low/40 border border-outline-variant/60 rounded-lg flex items-start gap-sm text-xs"
                      >
                        <span
                          className={`material-symbols-outlined text-[18px] shrink-0 mt-0.5 ${
                            log.type === "warning"
                              ? "text-amber-600"
                              : log.type === "success"
                              ? "text-emerald-600"
                              : "text-on-surface-variant"
                          }`}
                        >
                          {log.type === "warning"
                            ? "warning"
                            : log.type === "success"
                            ? "check_circle"
                            : "info"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between items-baseline gap-xs">
                            <p className="font-semibold text-on-surface">
                              {log.title}
                            </p>
                            <span className="text-[11px] text-on-surface-variant font-caption shrink-0">
                              {log.time}
                            </span>
                          </div>
                          <p className="text-on-surface-variant text-[11px] mt-0.5 leading-relaxed">
                            {log.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-surface-container-low/40 border border-outline-variant/60 rounded-xl p-md space-y-sm">
                <h4 className="font-body-bold text-xs font-semibold text-on-surface">
                  Gửi nhắc nhở tuân thủ
                </h4>
                <textarea
                  value={remindMessage}
                  onChange={(e) => setRemindMessage(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-xs text-on-surface focus:outline-none focus:border-primary resize-none"
                  placeholder="Nội dung nhắc nhở gửi tới bệnh nhân..."
                />
                {remindFeedback && (
                  <p
                    className={`text-xs ${
                      remindFeedback.type === "success"
                        ? "text-emerald-700"
                        : "text-red-600"
                    }`}
                  >
                    {remindFeedback.text}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => void handleSendRemind()}
                  disabled={remindSending}
                  className="inline-flex items-center gap-1.5 px-md py-2 bg-primary text-on-primary text-xs font-semibold rounded-lg hover:bg-primary-container transition-colors disabled:opacity-60 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    send
                  </span>
                  {remindSending ? "Đang gửi…" : "Gửi nhắc nhở"}
                </button>
              </div>
            </div>

            <div className="pt-md border-t border-outline-variant mt-md flex justify-between items-center shrink-0">
              <Link
                href={`/doctor/patients/${encodeURIComponent(viewingPatient.id)}`}
                className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Xem hồ sơ bệnh nhân</span>
                <span className="material-symbols-outlined text-[14px]">
                  arrow_forward
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setViewingPatient(null)}
                className="px-md py-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-xs font-semibold hover:bg-surface-container-low transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
