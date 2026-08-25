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
  isoDate?: string;
}

interface ComplianceDayItem {
  date: string;
  dayName: string;
  fullDayName: string;
  shortDate: string;
  fullDate: string;
  isToday: boolean;
  rate: number | null;
  logs: ComplianceLog[];
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
  dailySeries: ComplianceDayItem[];
  logs: ComplianceLog[];
}

const PAGE_SIZE = 10;
const COMPLIANCE_DAYS = 14;
const EVENT_LOG_PREVIEW = 3;
const DEFAULT_REMIND_MESSAGE =
  "Bác sĩ nhắc bạn ghi nhận tuân thủ thực đơn hôm nay nhé.";

function weekdayShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][d.getDay()];
}

function weekdayFull(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return [
    "Chủ Nhật",
    "Thứ Hai",
    "Thứ Ba",
    "Thứ Tư",
    "Thứ Năm",
    "Thứ Sáu",
    "Thứ Bảy",
  ][d.getDay()];
}

function formatShortDate(iso: string): string {
  const parts = iso.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
  return iso;
}

function formatFullDate(iso: string): string {
  const parts = iso.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return iso;
}

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

function complianceEventDescription(ev: PatientComplianceOut["events"][number]): string {
  switch (ev.type) {
    case "alert":
      return `Mức độ cảnh báo: ${ev.severity}`;
    case "food_log":
      return ev.severity === "Tuân thủ"
        ? "Bệnh nhân ghi nhận ăn đúng thực đơn"
        : "Bệnh nhân ghi nhận ăn khác kế hoạch";
    case "checkin":
      return `Phản hồi check-in: ${ev.severity}`;
    case "reminder":
      return "Bác sĩ gửi nhắc nhở tuân thủ qua thông báo in-app";
    default:
      return ev.severity;
  }
}

function complianceEventLogType(
  ev: PatientComplianceOut["events"][number]
): ComplianceLog["type"] {
  if (ev.type === "alert") {
    return ev.severity === "Nguy hiểm" || ev.severity === "Cần chú ý"
      ? "warning"
      : "info";
  }
  if (ev.type === "food_log") {
    return ev.severity === "Tuân thủ" ? "success" : "warning";
  }
  if (ev.type === "checkin") {
    if (ev.severity === "Tuân thủ") return "success";
    if (ev.severity === "Một phần") return "info";
    return "warning";
  }
  if (ev.type === "reminder") return "info";
  return "info";
}

function complianceToSummary(data: PatientComplianceOut): PatientComplianceSummary {
  const logs: ComplianceLog[] = data.events.map((ev) => ({
    title: ev.title,
    time: formatEventTime(ev.at),
    description: complianceEventDescription(ev),
    type: complianceEventLogType(ev),
    isoDate: ev.at ? ev.at.split("T")[0] : undefined,
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

  const lastIndex = data.daily_series.length - 1;
  const dailySeries: ComplianceDayItem[] = data.daily_series.map((d, idx) => {
    const isToday = idx === lastIndex;
    const dayLogs = logs.filter((l) => l.isoDate === d.date);
    return {
      date: d.date,
      dayName: weekdayShort(d.date),
      fullDayName: weekdayFull(d.date),
      shortDate: formatShortDate(d.date),
      fullDate: formatFullDate(d.date),
      isToday,
      rate: d.adherence_pct,
      logs: dayLogs,
    };
  });

  return {
    rate: data.overall_adherence_pct,
    asPlannedMeals: data.checkins_as_planned,
    totalMeals: data.checkins_done,
    lowThreshold: data.low_threshold_pct,
    lastAlert,
    dailySeries,
    logs,
  };
}

function emptyComplianceSummary(lowThreshold = 50): PatientComplianceSummary {
  const today = new Date();
  const dailySeries: ComplianceDayItem[] = Array.from(
    { length: COMPLIANCE_DAYS },
    (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (COMPLIANCE_DAYS - 1 - i));
      const iso = d.toISOString().split("T")[0];
      return {
        date: iso,
        dayName: weekdayShort(iso),
        fullDayName: weekdayFull(iso),
        shortDate: formatShortDate(iso),
        fullDate: formatFullDate(iso),
        isToday: i === COMPLIANCE_DAYS - 1,
        rate: null,
        logs: [],
      };
    }
  );

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
    dailySeries,
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
  const [hoveredModalDay, setHoveredModalDay] = useState<ComplianceDayItem | null>(null);
  const [remindMessage, setRemindMessage] = useState(DEFAULT_REMIND_MESSAGE);
  const [remindSending, setRemindSending] = useState(false);
  const [remindFeedback, setRemindFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [showAllEventLogs, setShowAllEventLogs] = useState(false);

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
    setShowAllEventLogs(false);
  };

  const handleSendRemind = async () => {
    if (!viewingPatient) return;
    setRemindSending(true);
    setRemindFeedback(null);
    try {
      await api.remindPatientCompliance(viewingPatient.id, remindMessage.trim());
      const data = await api.getPatientCompliance(
        viewingPatient.id,
        COMPLIANCE_DAYS
      );
      setComplianceByPatient((prev) => ({
        ...prev,
        [viewingPatient.id]: complianceToSummary(data),
      }));
      setRemindFeedback({
        type: "success",
        text: "Đã gửi nhắc nhở. Bệnh nhân sẽ thấy trong mục Thông báo.",
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
    viewingStats?.dailySeries.some((val) => val.rate !== null) ?? false;

  return (
    <>
      <TopBar title="Theo dõi tuân thủ" />

      <main className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        {loadError && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs flex items-center justify-between shadow-2xs">
            <span>{loadError}</span>
            <button
              onClick={() => void loadData()}
              className="text-primary font-bold hover:underline cursor-pointer"
            >
              Thử lại
            </button>
          </div>
        )}

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="font-h1 text-h1 text-on-surface font-bold text-2xl">
              Theo dõi tuân thủ dinh dưỡng
            </h2>
            <p className="font-caption text-caption text-on-surface-variant mt-1 text-xs">
              Thống kê check-in tuân thủ và cảnh báo tương tác thuốc–thực phẩm
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px]">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
                search
              </span>
              <input
                type="text"
                placeholder="Tìm mã BN, tên bệnh nhân, bệnh lý..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-surface-container-lowest border border-outline-variant/60 rounded-xl text-sm font-body text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-2xs"
              />
            </div>

            <div className="relative min-w-[170px]">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] pointer-events-none">
                donut_large
              </span>
              <select
                value={complianceFilter}
                onChange={(e) =>
                  setComplianceFilter(
                    e.target.value as "all" | "high" | "medium" | "low"
                  )
                }
                className="w-full pl-10 pr-8 py-2.5 bg-surface-container-lowest border border-outline-variant/60 rounded-xl text-sm font-body text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer shadow-2xs font-medium"
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
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] pointer-events-none">
                filter_alt
              </span>
              <select
                value={diagnosisFilter}
                onChange={(e) => setDiagnosisFilter(e.target.value)}
                className="w-full pl-10 pr-8 py-2.5 bg-surface-container-lowest border border-outline-variant/60 rounded-xl text-sm font-body text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer shadow-2xs font-medium"
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
          <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-12 text-center text-on-surface-variant shadow-subtle">
            <span className="material-symbols-outlined text-[48px] text-outline/40 mb-2">
              insights
            </span>
            <p className="font-body-bold text-body-bold text-sm font-bold">
              Không tìm thấy bệnh nhân phù hợp
            </p>
            <p className="font-caption text-caption text-xs mt-1">
              Thử thay đổi từ khóa tìm kiếm hoặc chọn lại nhóm mức độ tuân thủ.
            </p>
          </div>
        ) : (
          <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl shadow-subtle overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[820px]">
                <thead>
                  <tr className="bg-surface-container-low/50 border-b border-outline-variant/40">
                    <th className="px-5 py-3.5 font-label text-label text-on-surface-variant uppercase tracking-wider text-[11px] font-semibold">
                      Mã BN
                    </th>
                    <th className="px-5 py-3.5 font-label text-label text-on-surface-variant uppercase tracking-wider text-[11px] font-semibold">
                      Bệnh nhân
                    </th>
                    <th className="px-5 py-3.5 font-label text-label text-on-surface-variant uppercase tracking-wider text-[11px] font-semibold">
                      Chẩn đoán bệnh lý
                    </th>
                    <th className="px-5 py-3.5 font-label text-label text-on-surface-variant uppercase tracking-wider text-[11px] font-semibold text-center">
                      Mức độ tuân thủ (14 ngày)
                    </th>
                    <th className="px-5 py-3.5 font-label text-label text-on-surface-variant uppercase tracking-wider text-[11px] font-semibold">
                      Sự kiện / Cảnh báo gần nhất
                    </th>
                    <th className="px-5 py-3.5 font-label text-label text-on-surface-variant uppercase tracking-wider text-[11px] font-semibold text-right">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30 font-body text-body">
                  {pagedPatients.map((patient) => {
                    const stats = getStats(patient);
                    const hasRate = stats.rate !== null;
                    const rate = stats.rate ?? 0;
                    const isHigh = hasRate && rate >= 85;
                    const isMedium = hasRate && rate >= 75 && rate < 85;

                    return (
                      <tr
                        key={patient.id}
                        className="transition-colors hover:bg-surface-container-low/40"
                      >
                        <td className="px-5 py-3.5">
                          <span
                            title={patient.id}
                            className="font-mono text-xs font-semibold text-on-surface-variant"
                          >
                            {truncateId(patient.id)}
                          </span>
                        </td>

                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-label text-xs font-bold ring-2 ring-primary/20 shrink-0">
                              {initials(patient.name)}
                              {patient.avatar &&
                                !patient.avatar.startsWith(
                                  "https://api.dicebear.com"
                                ) && (
                                  <img
                                    src={patient.avatar}
                                    alt={patient.name}
                                    className="absolute inset-0 w-9 h-9 rounded-full object-cover ring-2 ring-outline-variant/40"
                                    onError={(e) => {
                                      e.currentTarget.style.display = "none";
                                    }}
                                  />
                                )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-body-bold text-on-surface font-bold text-sm whitespace-nowrap">
                                {patient.name}
                              </p>
                              <p className="text-xs text-on-surface-variant">
                                {patient.age ? `${patient.age} tuổi` : "—"}{" "}
                                {patient.gender ? `• ${patient.gender}` : ""}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-3.5 text-on-surface-variant">
                          <span
                            className="bg-primary/10 text-primary px-3 py-1 rounded-full font-caption text-xs font-semibold border border-primary/20 inline-block max-w-[200px] truncate"
                            title={patient.condition}
                          >
                            {shortCondition(patient.condition, 2)}
                          </span>
                        </td>

                        <td className="px-5 py-3.5 text-center whitespace-nowrap">
                          {hasRate ? (
                            <div className="inline-flex flex-col items-center gap-1.5">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold tabular-nums ${
                                  isHigh
                                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                    : isMedium
                                    ? "bg-amber-50 text-amber-800 border border-amber-200"
                                    : "bg-rose-50 text-rose-800 border border-rose-200"
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
                                  className={`h-full rounded-full transition-all ${
                                    isHigh
                                      ? "bg-primary"
                                      : isMedium
                                      ? "bg-amber-500"
                                      : "bg-rose-500"
                                  }`}
                                  style={{ width: `${rate}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-on-surface-variant font-medium">
                              Chưa có check-in
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-3.5 text-on-surface-variant">
                          <div className="flex items-start gap-1.5 max-w-[240px]">
                            <span
                              className={`material-symbols-outlined text-[16px] shrink-0 mt-0.5 ${
                                stats.lastAlert.type === "warning"
                                  ? "text-amber-600"
                                  : stats.lastAlert.type === "success"
                                  ? "text-primary"
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
                              className="text-xs truncate font-medium"
                              title={`${stats.lastAlert.text} (${stats.lastAlert.time})`}
                            >
                              {stats.lastAlert.text}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleOpenModal(patient)}
                            title="Xem biểu đồ tuân thủ & nhật ký sự kiện"
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-on-primary font-body-bold text-xs rounded-xl hover:bg-primary/90 transition-all cursor-pointer active:scale-95 shadow-2xs font-bold"
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              insights
                            </span>
                            <span>Biểu đồ &amp; Nhật ký</span>
                          </button>
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
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-3xl p-6 md:p-8 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col animate-scaleUp overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-outline-variant/40 mb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined text-[22px]">
                    insights
                  </span>
                </div>
                <div>
                  <h3 className="font-h2 text-h2 text-on-surface font-bold text-base">
                    Theo dõi tuân thủ: {viewingPatient.name}
                  </h3>
                  <p className="font-caption text-caption text-on-surface-variant text-xs mt-0.5">
                    {viewingPatient.id} •{" "}
                    {viewingPatient.age ? `${viewingPatient.age} tuổi` : ""} •
                    Chẩn đoán: {viewingPatient.condition}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingPatient(null)}
                className="text-on-surface-variant hover:text-primary p-1.5 rounded-xl hover:bg-surface-container-low transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">
                  close
                </span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl text-center shadow-2xs">
                  <p className="text-xs text-on-surface-variant font-medium">
                    Tỷ lệ tuân thủ 14 ngày
                  </p>
                  <p className="text-2xl font-bold text-primary mt-1 tabular-nums">
                    {viewingStats.rate !== null ? `${viewingStats.rate}%` : "—"}
                  </p>
                </div>
                <div className="p-4 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl text-center shadow-2xs">
                  <p className="text-xs text-on-surface-variant font-medium">
                    Check-in đúng kế hoạch
                  </p>
                  <p className="text-2xl font-bold text-primary mt-1 tabular-nums">
                    {viewingStats.asPlannedMeals} / {viewingStats.totalMeals}
                  </p>
                </div>
                <div className="p-4 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl text-center shadow-2xs">
                  <p className="text-xs text-on-surface-variant font-medium">
                    Đánh giá chung
                  </p>
                  <p
                    className={`text-sm font-bold mt-2 ${
                      viewingStats.rate !== null && viewingStats.rate >= 85
                        ? "text-primary"
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

              <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-5 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-outline-variant/40">
                  <div>
                    <h4 className="font-body-bold text-sm font-bold text-on-surface flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[20px]">
                        monitoring
                      </span>
                      Biểu đồ tỷ lệ tuân thủ (14 ngày gần nhất)
                    </h4>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      Rà chuột lên từng ngày để xem chi tiết bữa ăn và tương tác ghi nhận
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-on-surface-variant font-medium">
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                      Đạt (≥80%)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      TB (60-79%)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                      Kém (&lt;60%)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-outline-variant/80" />
                      Chưa ghi nhận
                    </span>
                    <span className="flex items-center gap-1.5 text-emerald-800 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 shadow-2xs">
                      <span className="w-3.5 border-b-2 border-dashed border-emerald-600 inline-block" />
                      Chỉ tiêu (80%)
                    </span>
                  </div>
                </div>

                {!hasChartData ? (
                  <div className="h-[240px] flex flex-col items-center justify-center text-on-surface-variant py-8">
                    <span className="material-symbols-outlined text-[36px] text-outline/40 mb-1">
                      bar_chart
                    </span>
                    <p className="text-sm font-bold">Chưa có dữ liệu tuân thủ</p>
                    <p className="text-xs mt-0.5 text-center text-on-surface-variant max-w-[280px]">
                      Bệnh nhân chưa có ghi nhận bữa ăn (Food Log) hoặc xác nhận check-in trong 14 ngày qua.
                    </p>
                  </div>
                ) : (
                  <div className="relative pt-6 pb-2 min-h-[250px] flex flex-col justify-end">
                    {/* Benchmark Target Line (80%) */}
                    <div
                      className="absolute left-0 right-0 border-b-2 border-dashed border-emerald-400/80 z-0 pointer-events-none"
                      style={{ bottom: "calc(44px + 130px * 0.8)" }}
                    />

                    {/* 50% grid line */}
                    <div
                      className="absolute left-0 right-0 border-b border-outline-variant/30 z-0 pointer-events-none"
                      style={{ bottom: "calc(44px + 130px * 0.5)" }}
                    />

                    {/* 14-day Interactive Columns Container */}
                    <div className="w-full flex items-end justify-between z-10 gap-1 sm:gap-1.5">
                      {viewingStats.dailySeries.map((item) => {
                        const hasVal = item.rate !== null;
                        const rate = item.rate ?? 0;
                        const isHigh = hasVal && rate >= 80;
                        const isMedium = hasVal && rate >= 60 && rate < 80;

                        let barBg = "bg-rose-500 hover:bg-rose-600";
                        let textBg = "text-rose-700";
                        if (isHigh) {
                          barBg = "bg-primary hover:bg-primary/90";
                          textBg = "text-primary";
                        } else if (isMedium) {
                          barBg = "bg-amber-500 hover:bg-amber-600";
                          textBg = "text-amber-700";
                        }

                        const isHovered = hoveredModalDay?.date === item.date;

                        return (
                          <div
                            key={item.date}
                            className="flex-1 flex flex-col items-center group relative cursor-pointer select-none"
                            onMouseEnter={() => setHoveredModalDay(item)}
                            onMouseLeave={() => setHoveredModalDay(null)}
                          >
                            {/* Hover Tooltip Popup */}
                            {isHovered && (
                              <div className="absolute bottom-full mb-3 z-30 w-56 bg-surface-container-lowest text-on-surface text-xs p-3.5 rounded-2xl shadow-xl border border-outline-variant/70 backdrop-blur-md animate-fadeIn pointer-events-none">
                                <div className="flex justify-between items-center border-b border-outline-variant/40 pb-1.5 mb-1.5 font-bold">
                                  <span>
                                    {item.fullDayName}, {item.shortDate}
                                  </span>
                                  {hasVal ? (
                                    <span
                                      className={`font-bold ${
                                        isHigh
                                          ? "text-primary"
                                          : isMedium
                                          ? "text-amber-700"
                                          : "text-rose-600"
                                      }`}
                                    >
                                      {rate}%
                                    </span>
                                  ) : (
                                    <span className="text-on-surface-variant font-normal text-[11px]">
                                      Trống
                                    </span>
                                  )}
                                </div>
                                {hasVal ? (
                                  <div className="space-y-1 text-[11px] text-on-surface-variant">
                                    <p>
                                      Đánh giá:{" "}
                                      <strong className="text-on-surface font-semibold">
                                        {isHigh
                                          ? "Đạt chỉ tiêu"
                                          : isMedium
                                          ? "Cần lưu ý"
                                          : "Kém"}
                                      </strong>
                                    </p>
                                    {item.logs.length > 0 ? (
                                      <div className="pt-1 border-t border-outline-variant/30 space-y-1">
                                        <p className="font-semibold text-on-surface">
                                          Ghi nhận trong ngày:
                                        </p>
                                        {item.logs.map((lg, lgIdx) => (
                                          <p
                                            key={lgIdx}
                                            className="text-[10px] flex items-center gap-1 text-on-surface leading-tight"
                                          >
                                            <span
                                              className={
                                                lg.type === "warning"
                                                  ? "text-amber-600"
                                                  : "text-primary"
                                              }
                                            >
                                              •
                                            </span>
                                            {lg.title}
                                          </p>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-[10px] text-on-surface-variant italic">
                                        Không có ghi chú bất thường
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-[11px] text-on-surface-variant">
                                    Bệnh nhân không ghi nhận bữa ăn hoặc check-in vào ngày này.
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Value Text Above Bar */}
                            <span
                              className={`text-[10px] font-bold mb-1 tabular-nums ${
                                hasVal ? textBg : "text-outline/40"
                              }`}
                            >
                              {hasVal ? `${rate}%` : "—"}
                            </span>

                            {/* Bar Track */}
                            <div
                              className={`w-full h-[130px] rounded-xl flex items-end justify-center transition-colors p-0.5 ${
                                isHovered
                                  ? "bg-surface-container-low"
                                  : "bg-transparent"
                              }`}
                            >
                              {hasVal ? (
                                <div
                                  className={`w-full max-w-[24px] rounded-t-lg transition-all duration-200 ${barBg} ${
                                    isHovered ? "ring-2 ring-primary/40 shadow-xs" : ""
                                  }`}
                                  style={{ height: `${Math.max(rate, 6)}%` }}
                                />
                              ) : (
                                <div className="w-1.5 h-1.5 rounded-full bg-outline-variant/60 mb-2" />
                              )}
                            </div>

                            {/* X-axis Day Label & Date */}
                            <div className="mt-1.5 flex flex-col items-center">
                              <span
                                className={`text-[10px] font-semibold ${
                                  item.isToday
                                    ? "text-primary font-bold"
                                    : "text-on-surface-variant"
                                }`}
                              >
                                {item.dayName}
                              </span>
                              <span
                                className={`text-[9px] tabular-nums ${
                                  item.isToday
                                    ? "text-primary font-bold"
                                    : "text-outline"
                                }`}
                              >
                                {item.shortDate}
                              </span>
                              {item.isToday && (
                                <span
                                  className="w-1.5 h-1.5 rounded-full bg-primary mt-0.5"
                                  title="Hôm nay"
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-5 shadow-2xs">
                <h4 className="font-body-bold text-xs font-bold text-on-surface mb-3">
                  Nhật ký sự kiện tuân thủ gần đây
                </h4>
                {viewingStats.logs.length === 0 ? (
                  <p className="text-xs text-on-surface-variant">
                    Chưa có sự kiện tuân thủ trong 14 ngày qua (ghi nhận bữa
                    ăn, check-in, nhắc nhở hoặc cảnh báo tương tác).
                  </p>
                ) : (
                  <div className="space-y-2">
                    {(showAllEventLogs
                      ? viewingStats.logs
                      : viewingStats.logs.slice(0, EVENT_LOG_PREVIEW)
                    ).map((log, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-surface-container-low/40 border border-outline-variant/40 rounded-xl flex items-start gap-3 text-xs"
                      >
                        <span
                          className={`material-symbols-outlined text-[18px] shrink-0 mt-0.5 ${
                            log.type === "warning"
                              ? "text-amber-600"
                              : log.type === "success"
                              ? "text-primary"
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
                          <div className="flex justify-between items-baseline gap-2">
                            <p className="font-bold text-on-surface">
                              {log.title}
                            </p>
                            <span className="text-[11px] text-on-surface-variant font-caption shrink-0">
                              {log.time}
                            </span>
                          </div>
                          <p className="text-on-surface-variant text-xs mt-0.5 leading-relaxed">
                            {log.description}
                          </p>
                        </div>
                      </div>
                    ))}
                    {viewingStats.logs.length > EVENT_LOG_PREVIEW && (
                      <button
                        type="button"
                        onClick={() => setShowAllEventLogs((prev) => !prev)}
                        className="mt-2 text-xs font-bold text-primary hover:underline cursor-pointer"
                      >
                        {showAllEventLogs
                          ? "Thu gọn"
                          : `Xem thêm (${viewingStats.logs.length - EVENT_LOG_PREVIEW})`}
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-surface-container-low/40 border border-outline-variant/60 rounded-2xl p-5 space-y-3 shadow-2xs">
                <h4 className="font-body-bold text-xs font-bold text-on-surface">
                  Gửi nhắc nhở tuân thủ
                </h4>
                <textarea
                  value={remindMessage}
                  onChange={(e) => setRemindMessage(e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2.5 bg-surface-container-lowest border border-outline-variant/60 rounded-xl text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none transition-all"
                  placeholder="Nội dung nhắc nhở gửi tới bệnh nhân..."
                />
                {remindFeedback && (
                  <p
                    className={`text-xs font-medium ${
                      remindFeedback.type === "success"
                        ? "text-primary"
                        : "text-rose-600"
                    }`}
                  >
                    {remindFeedback.text}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => void handleSendRemind()}
                  disabled={remindSending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-xl hover:bg-primary/90 transition-all shadow-2xs disabled:opacity-60 cursor-pointer active:scale-95"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    send
                  </span>
                  {remindSending ? "Đang gửi…" : "Gửi nhắc nhở"}
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-outline-variant/40 mt-4 flex justify-between items-center shrink-0">
              <Link
                href={`/doctor/patients/${encodeURIComponent(viewingPatient.id)}`}
                className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Xem hồ sơ bệnh nhân</span>
                <span className="material-symbols-outlined text-[14px]">
                  arrow_forward
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setViewingPatient(null)}
                className="px-4 py-2 bg-surface-container-lowest border border-outline-variant/60 rounded-xl text-xs font-semibold hover:bg-surface-container-low transition-colors cursor-pointer"
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
