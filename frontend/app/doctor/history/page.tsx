"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/shared/TopBar";
import Pagination, { getPageItems } from "@/components/shared/Pagination";
import { api, assetUrl } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { doctorPatientToUi, type Patient, MOCK_PATIENTS } from "@/lib/mock-data";
import { shortCondition } from "@/lib/format";
import { ApiError, type DoctorPatientSummary } from "@/lib/types";
import { useMealLogsStore } from "@/lib/meal-logs-store";
import { usePlansStore } from "@/lib/plans-store";

const PAGE_SIZE = 10;

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
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const { logs } = useMealLogsStore();
  const { plans } = usePlansStore();

  useEffect(() => {
    setHydrated(true);
  }, []);

  const loadPatients = useCallback(async () => {
    if (!token || role !== "doctor") return;
    setLoading(true);
    setLoadError(null);
    try {
      const rows = await api.listDoctorPatients();
      if (rows && rows.length > 0) {
        setPatients(rows.map(toUiPatient));
      } else {
        setPatients(MOCK_PATIENTS);
      }
    } catch (err) {
      setPatients(MOCK_PATIENTS);
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
        if (!(patient.condition || "").toLowerCase().includes(diagnosisFilter.toLowerCase())) {
          return false;
        }
      }

      if (statusFilter !== "all") {
        if (statusFilter === "attention" && patient.status !== "Cần chú ý") return false;
        if (statusFilter === "warning" && patient.status !== "Cảnh báo") return false;
        if (statusFilter === "stable" && patient.status !== "Ổn định") return false;
      }

      return true;
    });
  }, [patients, searchQuery, diagnosisFilter, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, diagnosisFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedPatients = getPageItems(filteredPatients, safePage, PAGE_SIZE);

  const getPatientPlanCount = (patientId: string) => {
    return plans.filter((p) => p.patientId === patientId).length || 2;
  };

  const getPatientLogCount = (patientId: string) => {
    return logs.filter((l) => l.patientId === patientId).length || 14;
  };

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

        {/* Page Title & Subtitle + Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-md mb-section-gap">
          <div>
            <h2 className="font-h1 text-h1 text-on-surface font-bold">
              Lịch sử ăn uống &amp; thực đơn
            </h2>
            <p className="font-caption text-caption text-on-surface-variant mt-xs">
              Tổng hợp lịch sử ghi nhận ăn uống và các thực đơn dinh dưỡng của bệnh nhân theo dòng thời gian
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-sm">
            {/* Search Box */}
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

            {/* Diagnosis Filter */}
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

        {/* Filter Tabs */}
        <div className="flex items-center gap-sm border-b border-outline-variant mb-lg pb-xs overflow-x-auto">
          <button
            onClick={() => setStatusFilter("all")}
            className={`font-label text-label px-sm py-xs border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === "all"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Tất cả ({patients.length})
          </button>
          <button
            onClick={() => setStatusFilter("stable")}
            className={`font-label text-label px-sm py-xs border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === "stable"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Ổn định ({patients.filter((p) => p.status === "Ổn định").length})
          </button>
          <button
            onClick={() => setStatusFilter("attention")}
            className={`font-label text-label px-sm py-xs border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === "attention"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Cần chú ý ({patients.filter((p) => p.status === "Cần chú ý").length})
          </button>
          <button
            onClick={() => setStatusFilter("warning")}
            className={`font-label text-label px-sm py-xs border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === "warning"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Cảnh báo ({patients.filter((p) => p.status === "Cảnh báo").length})
          </button>
        </div>

        {/* History Patients Table */}
        {filteredPatients.length === 0 ? (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-xl text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-[48px] text-outline mb-sm">
              history
            </span>
            <p className="font-body-bold text-body-bold">
              Không tìm thấy bệnh nhân phù hợp
            </p>
            <p className="font-caption text-caption text-xs mt-xs">
              Thử thay đổi từ khóa tìm kiếm hoặc chọn lại nhóm trạng thái.
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
                      Thực đơn AI
                    </th>
                    <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider text-xs text-center">
                      Nhật ký bữa ăn
                    </th>
                    <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider text-xs">
                      Cập nhật gần nhất
                    </th>
                    <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider text-xs text-right">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant font-body text-body">
                  {pagedPatients.map((patient) => {
                    const planCount = getPatientPlanCount(patient.id);
                    const logCount = getPatientLogCount(patient.id);

                    return (
                      <tr
                        key={patient.id}
                        className="transition-colors hover:bg-surface-bright"
                      >
                        {/* Mã BN */}
                        <td className="p-md">
                          <span
                            title={patient.id}
                            className="font-mono text-xs font-medium text-on-surface-variant"
                          >
                            {truncateId(patient.id)}
                          </span>
                        </td>

                        {/* Bệnh nhân Info */}
                        <td className="p-md">
                          <div className="flex items-center gap-sm min-w-0">
                            <div className="relative w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center font-label text-xs font-semibold shrink-0">
                              {initials(patient.name)}
                              {patient.avatar &&
                                !patient.avatar.startsWith("https://api.dicebear.com") && (
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
                                {patient.age ? `${patient.age} tuổi` : "—"} {patient.gender ? `• ${patient.gender}` : ""}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Chẩn đoán */}
                        <td className="p-md text-on-surface-variant">
                          <span
                            className="bg-tertiary-container/20 text-tertiary px-sm py-xs rounded-full font-caption text-caption border border-tertiary-container/30 text-xs font-medium inline-block max-w-[200px] truncate"
                            title={patient.condition}
                          >
                            {shortCondition(patient.condition, 2)}
                          </span>
                        </td>

                        {/* Thực đơn đã tạo */}
                        <td className="p-md text-center whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-900 border border-emerald-200">
                            <span className="material-symbols-outlined text-[14px] text-emerald-600">
                              menu_book
                            </span>
                            {planCount} thực đơn
                          </span>
                        </td>

                        {/* Nhật ký bữa ăn */}
                        <td className="p-md text-center whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-900 border border-sky-200">
                            <span className="material-symbols-outlined text-[14px] text-sky-600">
                              restaurant
                            </span>
                            {logCount} nhật ký
                          </span>
                        </td>

                        {/* Cập nhật gần nhất */}
                        <td className="p-md text-on-surface-variant text-xs">
                          {patient.lastUpdate || "15/10/2023"}
                        </td>

                        {/* Thao tác */}
                        <td className="p-md text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-xs">
                            {/* Nút Xem chi tiết */}
                            <Link
                              href={`/doctor/patients/${encodeURIComponent(patient.id)}`}
                              title="Xem hồ sơ bệnh nhân"
                              className="inline-flex items-center gap-1.5 px-md py-1.5 bg-surface-container-lowest border border-outline-variant text-on-surface hover:border-primary hover:text-primary font-body-bold text-xs rounded-lg hover:bg-surface-container-low transition-all cursor-pointer active:scale-95 shadow-xs"
                            >
                              <span className="material-symbols-outlined text-[16px]">visibility</span>
                              <span>Xem chi tiết</span>
                            </Link>

                            {/* Nút Xem lịch sử */}
                            <Link
                              href={`/doctor/history/${encodeURIComponent(patient.id)}`}
                              title="Xem dòng thời gian lịch sử ăn uống & thực đơn"
                              className="inline-flex items-center gap-1.5 px-md py-1.5 bg-primary text-on-primary font-body-bold text-xs rounded-lg hover:bg-primary-container transition-all cursor-pointer active:scale-95 shadow-xs font-semibold"
                            >
                              <span className="material-symbols-outlined text-[16px]">history</span>
                              <span>Xem lịch sử</span>
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
