"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/shared/TopBar";
import Pagination, { getPageItems } from "@/components/shared/Pagination";
import { PlanExpiryBadge } from "@/components/doctor/PlanExpiryBadge";
import { api, assetUrl } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { doctorPatientToUi, type Patient } from "@/lib/mock-data";
import { shortCondition } from "@/lib/format";
import {
  matchesValidityTimeFilter,
  patientUsageLabel,
  patientUsageStatus,
  patientValidityRange,
  type TimeFilterPreset,
} from "@/lib/plan-expiry";
import { ApiError, type DoctorPatientSummary } from "@/lib/types";

const PAGE_SIZE = 10;

type UsageTab = "all" | "none" | "active" | "finished";

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

function usageBadgeClass(status: ReturnType<typeof patientUsageStatus>): string {
  switch (status) {
    case "active":
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    case "finished":
      return "bg-surface-container-high text-on-surface-variant border-outline-variant";
    default:
      return "bg-surface-container-low text-on-surface-variant border-outline-variant";
  }
}

export default function DoctorHistoryIndexPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const [hydrated, setHydrated] = useState(false);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [diagnosisFilter, setDiagnosisFilter] = useState<string>("all");
  const [usageTab, setUsageTab] = useState<UsageTab>("all");
  const [timePreset, setTimePreset] = useState<TimeFilterPreset>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const loadPatients = useCallback(async () => {
    if (!token || role !== "doctor") return;
    setLoading(true);
    setLoadError(null);
    try {
      const rows = await api.listDoctorPatients();
      setPatients(rows.map(toUiPatient));
    } catch (err) {
      setPatients([]);
      if (err instanceof ApiError && err.status !== 401) {
        setLoadError(err.message);
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
    void loadPatients();
  }, [hydrated, token, role, router, loadPatients]);

  const searchFiltered = useMemo(() => {
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

      return true;
    });
  }, [patients, searchQuery, diagnosisFilter]);

  const tabCounts = useMemo(() => {
    const active = searchFiltered.filter((p) => patientUsageStatus(p) === "active").length;
    const finished = searchFiltered.filter(
      (p) => patientUsageStatus(p) === "finished"
    ).length;
    const none = searchFiltered.filter((p) => patientUsageStatus(p) === "none").length;
    return { all: searchFiltered.length, none, active, finished };
  }, [searchFiltered]);

  const filteredPatients = useMemo(() => {
    return searchFiltered.filter((patient) => {
      const usage = patientUsageStatus(patient);
      if (usageTab === "none" && usage !== "none") return false;
      if (usageTab === "active" && usage !== "active") return false;
      if (usageTab === "finished" && usage !== "finished") return false;

      const range = patientValidityRange(patient);
      if (
        !matchesValidityTimeFilter(range, timePreset, startDate, endDate)
      ) {
        return false;
      }

      return true;
    });
  }, [searchFiltered, usageTab, timePreset, startDate, endDate]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, diagnosisFilter, usageTab, timePreset, startDate, endDate]);

  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedPatients = getPageItems(filteredPatients, safePage, PAGE_SIZE);

  if (!hydrated || !token || role !== "doctor") {
    return null;
  }

  if (loading) {
    return (
      <>
        <TopBar title="Lịch sử bệnh nhân" />
        <main className="p-lg text-sm text-on-surface-variant">
          Đang tải danh sách lịch sử bệnh nhân…
        </main>
      </>
    );
  }

  return (
    <>
      <TopBar title="Lịch sử bệnh nhân" />

      <main className="p-lg max-w-[1400px]">
        {loadError && (
          <div className="mb-md p-md bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center justify-between">
            <span>{loadError}</span>
            <button
              onClick={() => void loadPatients()}
              className="text-primary font-semibold hover:underline cursor-pointer"
            >
              Thử lại
            </button>
          </div>
        )}

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-md mb-section-gap">
          <div>
            <h2 className="font-h1 text-h1 text-on-surface font-bold">
              Lịch sử thực đơn theo tuần
            </h2>
            <p className="font-caption text-caption text-on-surface-variant mt-xs">
              Thực đơn đã duyệt theo dòng thời gian và tuân thủ check-in — không phải nhật ký ăn uống chi tiết
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

            <div className="relative min-w-[160px]">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] pointer-events-none">
                calendar_month
              </span>
              <select
                value={timePreset}
                onChange={(e) =>
                  setTimePreset(e.target.value as TimeFilterPreset)
                }
                className="w-full pl-9 pr-8 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm font-body text-on-surface focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
              >
                <option value="all">Tất cả thời gian</option>
                <option value="today">Hôm nay</option>
                <option value="week">Tuần này</option>
                <option value="month">Tháng này</option>
                <option value="custom">Chọn khoảng thời gian</option>
              </select>
              <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] pointer-events-none">
                arrow_drop_down
              </span>
            </div>
          </div>
        </div>

        {timePreset === "custom" && (
          <div className="bg-surface-container-low/80 border border-outline-variant/80 rounded-xl px-md py-sm mb-md flex flex-wrap items-center gap-sm">
            <span className="text-xs font-semibold text-on-surface flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-primary">
                date_range
              </span>
              Lọc theo khoảng hiệu lực thực đơn:
            </span>
            <div className="flex items-center gap-xs">
              <label className="text-xs text-on-surface-variant">Từ:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2 py-1 bg-surface-container-lowest border border-outline-variant rounded-lg text-xs font-mono text-on-surface focus:outline-none focus:border-primary"
              />
            </div>
            <div className="flex items-center gap-xs">
              <label className="text-xs text-on-surface-variant">Đến:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2 py-1 bg-surface-container-lowest border border-outline-variant rounded-lg text-xs font-mono text-on-surface focus:outline-none focus:border-primary"
              />
            </div>
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                className="text-xs text-primary font-semibold hover:underline cursor-pointer"
              >
                Xóa khoảng
              </button>
            )}
          </div>
        )}

        <div className="flex items-center gap-sm border-b border-outline-variant mb-lg pb-xs overflow-x-auto">
          {(
            [
              ["all", "Tất cả", tabCounts.all],
              ["none", "Chưa áp dụng", tabCounts.none],
              ["active", "Đang sử dụng", tabCounts.active],
              ["finished", "Đã dùng xong", tabCounts.finished],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              onClick={() => setUsageTab(key)}
              className={`font-label text-label px-sm py-xs border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                usageTab === key
                  ? "border-primary text-primary font-bold"
                  : "border-transparent text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>

        {filteredPatients.length === 0 ? (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-xl text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-[48px] text-outline mb-sm">
              history
            </span>
            <p className="font-body-bold text-body-bold">
              {patients.length === 0
                ? "Chưa có bệnh nhân"
                : "Không tìm thấy bệnh nhân phù hợp"}
            </p>
            <p className="font-caption text-caption text-xs mt-xs">
              Thử thay đổi từ khóa, khoảng thời gian hoặc tab trạng thái thực đơn.
            </p>
          </div>
        ) : (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1050px]">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant">
                    <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider text-xs">
                      Mã BN
                    </th>
                    <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider text-xs">
                      Bệnh nhân
                    </th>
                    <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider text-xs">
                      Chẩn đoán
                    </th>
                    <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider text-xs text-center">
                      Thực đơn AI
                    </th>
                    <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider text-xs">
                      Trạng thái
                    </th>
                    <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider text-xs">
                      Hạn thực đơn
                    </th>
                    <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider text-xs">
                      Cập nhật
                    </th>
                    <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider text-xs text-right">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant font-body text-body">
                  {pagedPatients.map((patient) => {
                    const usage = patientUsageStatus(patient);
                    const expiryFields =
                      usage !== "none"
                        ? {
                            plan_expiry: patient.planExpiry ?? "none",
                            plan_days_left: patient.planDaysLeft ?? null,
                            plan_end_date: patient.planEndDate ?? null,
                          }
                        : null;

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
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-900 border border-emerald-200">
                            <span className="material-symbols-outlined text-[14px] text-emerald-600">
                              menu_book
                            </span>
                            {patient.planTotal ?? 0} thực đơn
                          </span>
                        </td>

                        <td className="p-md whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${usageBadgeClass(usage)}`}
                          >
                            {patientUsageLabel(usage)}
                          </span>
                        </td>

                        <td className="p-md whitespace-nowrap">
                          <PlanExpiryBadge expiry={expiryFields} />
                        </td>

                        <td className="p-md text-on-surface-variant text-xs">
                          {patient.lastUpdate || "—"}
                        </td>

                        <td className="p-md text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-xs">
                            <Link
                              href={`/doctor/patients/${encodeURIComponent(patient.id)}`}
                              title="Xem hồ sơ bệnh nhân"
                              className="inline-flex items-center gap-1.5 px-md py-1.5 bg-surface-container-lowest border border-outline-variant text-on-surface hover:border-primary hover:text-primary font-body-bold text-xs rounded-lg hover:bg-surface-container-low transition-all cursor-pointer active:scale-95 shadow-xs"
                            >
                              <span className="material-symbols-outlined text-[16px]">
                                visibility
                              </span>
                              <span>Chi tiết</span>
                            </Link>

                            <Link
                              href={`/doctor/history/${encodeURIComponent(patient.id)}`}
                              title="Xem lịch sử thực đơn theo tuần"
                              className="inline-flex items-center gap-1.5 px-md py-1.5 bg-primary text-on-primary font-body-bold text-xs rounded-lg hover:bg-primary-container transition-all cursor-pointer active:scale-95 shadow-xs font-semibold"
                            >
                              <span className="material-symbols-outlined text-[16px]">
                                history
                              </span>
                              <span>Lịch sử</span>
                            </Link>
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
    </>
  );
}
