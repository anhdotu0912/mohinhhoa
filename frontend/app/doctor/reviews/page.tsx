"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/shared/TopBar";
import Pagination, { getPageItems } from "@/components/shared/Pagination";
import { truncatePatientId } from "@/components/doctor/PatientCard";
import { PlanExpiryBadge } from "@/components/doctor/PlanExpiryBadge";
import { doctorPatientToUi, type Patient } from "@/lib/mock-data";
import { api, assetUrl } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useQueueStore } from "@/lib/queue-store";
import { mealPlanToUiItem } from "@/lib/meal-plan-mappers";
import { shortCondition } from "@/lib/format";
import type { MealPlanItem } from "@/lib/plans-store";
import { ApiError, type DoctorPatientSummary } from "@/lib/types";

type StatusTab = "all" | "pending" | "approved" | "expiring" | "expired";
type TimeFilterPreset = "all" | "today" | "week" | "month" | "custom";

const PAGE_SIZE = 10;

function truncateId(id: string): string {
  if (!id) return "";
  return id.length > 4 ? `...${id.slice(-4)}` : id;
}

function parsePlanDate(createdAt: string): Date | null {
  if (!createdAt) return null;
  const str = createdAt.trim();
  const vnMatch = str.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,]+(\d{1,2}):(\d{1,2}))?/
  );
  if (vnMatch) {
    const day = parseInt(vnMatch[1], 10);
    const month = parseInt(vnMatch[2], 10) - 1;
    const year = parseInt(vnMatch[3], 10);
    const hour = vnMatch[4] ? parseInt(vnMatch[4], 10) : 0;
    const min = vnMatch[5] ? parseInt(vnMatch[5], 10) : 0;
    return new Date(year, month, day, hour, min);
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function isDateInSameWeek(target: Date, reference: Date): boolean {
  const monday = new Date(reference);
  const day = monday.getDay();
  const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return target >= monday && target <= sunday;
}

function matchesTimeFilter(
  createdAt: string,
  preset: TimeFilterPreset,
  startDate: string,
  endDate: string
): boolean {
  if (preset === "all") return true;
  const planDate = parsePlanDate(createdAt);
  if (!planDate) return false;

  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const planDayStart = new Date(
    planDate.getFullYear(),
    planDate.getMonth(),
    planDate.getDate()
  ).getTime();

  if (preset === "today") {
    return planDayStart === todayStart;
  }

  if (preset === "week") {
    return isDateInSameWeek(planDate, now);
  }

  if (preset === "month") {
    return (
      planDate.getMonth() === now.getMonth() &&
      planDate.getFullYear() === now.getFullYear()
    );
  }

  if (preset === "custom") {
    if (startDate) {
      const s = new Date(startDate + "T00:00:00").getTime();
      if (planDate.getTime() < s) return false;
    }
    if (endDate) {
      const e = new Date(endDate + "T23:59:59").getTime();
      if (planDate.getTime() > e) return false;
    }
    return true;
  }

  return true;
}

// Khớp PRIORITY_OPTIONS bên trang generate (/doctor/patients/[patientId]/generate)
const PRIORITY_OPTIONS = [
  "Ưu tiên món quen thuộc",
  "Đa dạng món ăn",
  "Giảm calo nhanh hơn mục tiêu",
  "Món ăn mềm dễ tiêu hóa",
  "Nguyên liệu dễ tìm kiếm",
];

type PatientGenConfig = {
  priorities: string[];
  customActive: boolean;
  customPriority: string;
  notes: string;
};

const DEFAULT_CONFIG: PatientGenConfig = {
  priorities: [],
  customActive: false,
  customPriority: "",
  notes: "",
};

const STATUS_BADGE: Record<
  MealPlanItem["status"],
  { label: string; className: string; icon?: string }
> = {
  pending: {
    label: "Chưa duyệt",
    className: "bg-amber-50 text-amber-800 border-amber-200",
  },
  approved: {
    label: "Đã duyệt",
    className: "bg-emerald-50 text-emerald-800 border-emerald-200",
    icon: "check_circle",
  },
  edited: {
    label: "Đã chỉnh sửa",
    className: "bg-sky-50 text-sky-800 border-sky-200",
    icon: "edit_note",
  },
  rejected: {
    label: "Đã từ chối",
    className: "bg-red-50 text-red-800 border-red-200",
    icon: "cancel",
  },
  unselected: {
    label: "Không chọn",
    className: "bg-gray-100 text-gray-600 border-gray-200",
    icon: "remove_done",
  },
};

function resolveAvatar(raw?: string | null): string {
  if (
    !raw ||
    raw.startsWith("https://api.dicebear.com") ||
    raw.includes("googleusercontent.com")
  ) {
    return "";
  }
  return assetUrl(raw) || "";
}

function toUiPatient(row: DoctorPatientSummary): Patient {
  const ui = doctorPatientToUi(row);
  return { ...ui, avatar: resolveAvatar(ui.avatar) };
}

/** Lấy chữ cái đầu của tên (vd "Nguyễn Văn A" → "NA") cho avatar dự phòng. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "BN";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

function isReviewedStatus(status: MealPlanItem["status"]): boolean {
  return status === "approved" || status === "edited";
}

export default function DoctorReviewsPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const [hydrated, setHydrated] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [plans, setPlans] = useState<MealPlanItem[]>([]);
  const [allPatients, setAllPatients] = useState<Patient[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<StatusTab>("all");
  const [timePreset, setTimePreset] = useState<TimeFilterPreset>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Patient Selection Modal state
  const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatientIds, setSelectedPatientIds] = useState<Set<string>>(
    new Set()
  );
  // Cấu hình sinh thực đơn theo từng bệnh nhân (mở qua nút "Cài đặt")
  const [genConfigs, setGenConfigs] = useState<Record<string, PatientGenConfig>>(
    {}
  );
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [configTargetPatientId, setConfigTargetPatientId] = useState<
    string | null
  >(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [page, setPage] = useState(1);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const load = useCallback(async () => {
    if (!token || role !== "doctor") return;
    setLoading(true);
    setLoadError(null);
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
      setAllPatients(patientRows.map(toUiPatient));
    } catch (err) {
      setLoadError(
        err instanceof ApiError
          ? err.message
          : "Không tải được danh sách thực đơn."
      );
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
    void load();
  }, [hydrated, token, role, router, load]);

  const pendingCount = plans.filter((p) => p.status === "pending").length;
  const approvedCount = plans.filter((p) => isReviewedStatus(p.status)).length;

  const expiryByPlanId = useMemo(() => {
    const map = new Map<
      string,
      Pick<DoctorPatientSummary, "plan_expiry" | "plan_days_left" | "plan_end_date">
    >();
    for (const p of allPatients) {
      if (
        p.latestPlanId &&
        p.planExpiry &&
        p.planExpiry !== "none" &&
        (p.latestPlanStatus === "approved" || p.latestPlanStatus === "edited")
      ) {
        map.set(p.latestPlanId, {
          plan_expiry: p.planExpiry,
          plan_days_left: p.planDaysLeft,
          plan_end_date: p.planEndDate,
        });
      }
    }
    return map;
  }, [allPatients]);

  const expiringCount = useMemo(
    () =>
      plans.filter(
        (plan) => expiryByPlanId.get(plan.id)?.plan_expiry === "expiring"
      ).length,
    [plans, expiryByPlanId]
  );

  const expiredCount = useMemo(
    () =>
      plans.filter(
        (plan) => expiryByPlanId.get(plan.id)?.plan_expiry === "expired"
      ).length,
    [plans, expiryByPlanId]
  );

  // Tra cứu bệnh nhân theo patientId (plan.patientId = user_id) — avatar + tuổi
  const patientById = useMemo(() => {
    const map = new Map<string, Patient>();
    for (const p of allPatients) map.set(p.id, p);
    return map;
  }, [allPatients]);

  const filteredPlans = plans.filter((plan) => {
    if (activeTab === "pending" && plan.status !== "pending") return false;
    if (activeTab === "approved" && !isReviewedStatus(plan.status)) return false;
    if (activeTab === "expiring") {
      if (expiryByPlanId.get(plan.id)?.plan_expiry !== "expiring") return false;
    }
    if (activeTab === "expired") {
      if (expiryByPlanId.get(plan.id)?.plan_expiry !== "expired") return false;
    }

    // Lọc theo thời gian
    if (!matchesTimeFilter(plan.createdAt, timePreset, startDate, endDate)) {
      return false;
    }

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      plan.id.toLowerCase().includes(q) ||
      plan.patientName.toLowerCase().includes(q) ||
      plan.patientCode.toLowerCase().includes(q) ||
      plan.condition.toLowerCase().includes(q) ||
      plan.planTitle.toLowerCase().includes(q)
    );
  });

  // Về trang 1 khi đổi tab / từ khóa tìm kiếm / bộ lọc thời gian
  useEffect(() => {
    setPage(1);
  }, [activeTab, searchQuery, timePreset, startDate, endDate]);

  const totalPages = Math.max(1, Math.ceil(filteredPlans.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedPlans = getPageItems(filteredPlans, safePage, PAGE_SIZE);

  // Bệnh nhân đã chọn luôn dồn lên đầu danh sách; phần còn lại lọc theo từ khóa
  const selectedPatientList = allPatients.filter((p) =>
    selectedPatientIds.has(p.id)
  );

  const matchesSearch = (p: Patient) => {
    if (!patientSearch.trim()) return true;
    const q = patientSearch.toLowerCase().trim();
    return (
      p.name.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q) ||
      p.condition.toLowerCase().includes(q)
    );
  };

  const unselectedPatients = allPatients.filter(
    (p) => !selectedPatientIds.has(p.id) && matchesSearch(p)
  );

  const visiblePatients = [...selectedPatientList, ...unselectedPatients];

  const selectedCount = visiblePatients.filter((p) =>
    selectedPatientIds.has(p.id)
  ).length;
  const allVisibleSelected =
    visiblePatients.length > 0 &&
    visiblePatients.every((p) => selectedPatientIds.has(p.id));

  const togglePatientSelection = (patientId: string) => {
    setSelectedPatientIds((prev) => {
      const next = new Set(prev);
      if (next.has(patientId)) {
        next.delete(patientId);
      } else {
        next.add(patientId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedPatientIds(new Set());
    } else {
      setSelectedPatientIds(new Set(visiblePatients.map((p) => p.id)));
    }
  };

  const closePatientModal = () => {
    setIsSelectModalOpen(false);
    setIsConfigOpen(false);
    setConfigTargetPatientId(null);
    setSelectedPatientIds(new Set());
    setPatientSearch("");
    setGenConfigs({});
  };

  const selectedPatients = allPatients.filter((p) =>
    selectedPatientIds.has(p.id)
  );

  // Dialog cài đặt: mở qua bánh răng → chỉ 1 bệnh nhân; mở qua nút footer → tất cả đã chọn
  const configTargetPatient = configTargetPatientId
    ? allPatients.find((p) => p.id === configTargetPatientId) || null
    : null;
  const dialogPatients = configTargetPatient
    ? [configTargetPatient]
    : selectedPatients;

  const getConfig = (patientId: string): PatientGenConfig =>
    genConfigs[patientId] || DEFAULT_CONFIG;

  const updateConfig = (patientId: string, patch: Partial<PatientGenConfig>) => {
    setGenConfigs((prev) => ({
      ...prev,
      [patientId]: { ...(prev[patientId] || DEFAULT_CONFIG), ...patch },
    }));
  };

  const togglePriority = (patientId: string, priority: string) => {
    const cur = getConfig(patientId);
    const has = cur.priorities.includes(priority);
    updateConfig(patientId, {
      priorities: has
        ? cur.priorities.filter((p) => p !== priority)
        : [...cur.priorities, priority],
    });
  };

  const toggleCustomActive = (patientId: string) => {
    updateConfig(patientId, { customActive: !getConfig(patientId).customActive });
  };

  const setCustomPriority = (patientId: string, text: string) => {
    updateConfig(patientId, { customPriority: text });
  };

  const setNotes = (patientId: string, notes: string) => {
    updateConfig(patientId, { notes });
  };

  /** Đã có thông số tùy chỉnh nào chưa (để hiển thị summary inline dưới tên BN). */
  const hasConfig = (patientId: string): boolean => {
    const cfg = getConfig(patientId);
    return (
      cfg.priorities.length > 0 ||
      (cfg.customActive && cfg.customPriority.trim().length > 0) ||
      cfg.notes.trim().length > 0
    );
  };

  /** Đóng gói priorities/notes giống trang generate (gộp cả ưu tiên tự nhập). */
  const buildPayload = (cfg: PatientGenConfig) => ({
    notes: cfg.notes.trim() || undefined,
    priorities: [
      ...cfg.priorities,
      ...(cfg.customActive && cfg.customPriority.trim()
        ? [cfg.customPriority.trim()]
        : []),
    ],
  });

  const handleGenerateForSelected = () => {
    const targets = allPatients.filter((p) => selectedPatientIds.has(p.id));
    if (targets.length === 0) return;

    // 1 hoặc nhiều BN đều vào hàng đợi (gen mất thời gian; theo dõi tại /doctor/patients/queue)
    useQueueStore
      .getState()
      .addJobs(
        targets.map((p) => {
          const payload = buildPayload(getConfig(p.id));
          return {
            id: p.id,
            name: p.name,
            avatar: p.avatar,
            condition: p.condition,
            age: p.age,
            gender: p.gender,
            notes: payload.notes,
            priorities: payload.priorities,
          };
        })
      );
    useQueueStore.getState().openDrawer();

    setIsSelectModalOpen(false);
    setIsConfigOpen(false);
    setConfigTargetPatientId(null);
    setSelectedPatientIds(new Set());
    setPatientSearch("");
    setGenConfigs({});
    showToast(
      targets.length === 1
        ? `Đã thêm ${targets[0].name} vào hàng đợi tạo thực đơn AI.`
        : `Đã thêm ${targets.length} bệnh nhân vào hàng đợi tạo thực đơn AI.`
    );
    router.push("/doctor/patients/queue");
  };

  // Tự tải lại danh sách thực đơn khi hàng đợi xử lý xong
  useEffect(() => {
    const unsubscribe = useQueueStore.subscribe((state) => {
      const hasActive = state.jobs.some(
        (j) => j.status === "queued" || j.status === "processing"
      );
      if (!hasActive && state.jobs.length > 0) {
        void load();
      }
    });
    return unsubscribe;
  }, [load]);

  if (!hydrated || !token || role !== "doctor") {
    return null;
  }

  if (loading) {
    return (
      <>
        <TopBar title="Danh sách thực đơn" />
        <main className="p-lg text-sm text-on-surface-variant">
          Đang tải danh sách thực đơn…
        </main>
      </>
    );
  }

  return (
    <>
      <TopBar title="Danh sách thực đơn" />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-[60] bg-emerald-800 text-white px-md py-sm rounded-xl shadow-lg border border-emerald-600 flex items-center gap-xs font-body text-sm animate-slide-down">
          <span className="material-symbols-outlined text-[20px] text-emerald-300">
            check_circle
          </span>
          <span>{toastMessage}</span>
        </div>
      )}

      <main className="p-lg max-w-[1400px]">
        {loadError ? (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-xl text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-[48px] text-outline mb-sm">
              error
            </span>
            <p className="font-body-bold text-body-bold">{loadError}</p>
            <button
              onClick={() => void load()}
              className="mt-md px-md py-2 bg-primary text-on-primary rounded-lg text-xs font-semibold hover:bg-primary-container transition-all shadow-xs cursor-pointer active:scale-95"
            >
              Thử lại
            </button>
          </div>
        ) : (
          <>
            {/* Page Title & Subtitle + Action Button */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-md mb-section-gap">
              <div>
                <h2 className="font-h1 text-h1 text-on-surface font-bold">
                  Danh sách thực đơn
                </h2>
                <p className="font-caption text-caption text-on-surface-variant mt-xs">
                  Xem và phê duyệt các thực đơn dinh dưỡng do AI khởi tạo
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-sm">
                {/* Search Box */}
                <div className="relative min-w-[220px]">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="Tìm mã thực đơn, tên BN, bệnh lý..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm font-body text-on-surface focus:outline-none focus:border-primary transition-colors"
                  />
                </div>

                {/* Time Filter Select */}
                <div className="relative min-w-[160px]">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] pointer-events-none">
                    calendar_month
                  </span>
                  <select
                    value={timePreset}
                    onChange={(e) => setTimePreset(e.target.value as TimeFilterPreset)}
                    className="w-full pl-9 pr-8 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm font-body text-on-surface focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
                  >
                    <option value="all">Tất cả</option>
                    <option value="today">Hôm nay</option>
                    <option value="week">Tuần này</option>
                    <option value="month">Tháng này</option>
                    <option value="custom">Chọn theo khoảng thời gian</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] pointer-events-none">
                    arrow_drop_down
                  </span>
                </div>

                <button
                  onClick={() => setIsSelectModalOpen(true)}
                  className="bg-primary text-on-primary px-md py-2 rounded-lg font-body-bold text-sm hover:bg-primary-container transition-all shadow-xs flex items-center gap-xs cursor-pointer active:scale-95 font-semibold shrink-0"
                >
                  <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                  <span>Tạo thực đơn mới bằng AI</span>
                </button>
              </div>
            </div>

            {/* Custom Date Range Picker Bar */}
            {timePreset === "custom" && (
              <div className="bg-surface-container-low/80 border border-outline-variant/80 rounded-xl px-md py-sm mb-md flex flex-wrap items-center justify-between gap-sm animate-fadeIn">
                <div className="flex items-center gap-sm flex-wrap">
                  <span className="text-xs font-semibold text-on-surface flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px] text-primary">date_range</span>
                    Lọc theo khoảng ngày tạo:
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
                </div>

                {(startDate || endDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setStartDate("");
                      setEndDate("");
                    }}
                    className="text-xs text-red-600 hover:text-red-700 hover:underline flex items-center gap-0.5 cursor-pointer font-medium"
                  >
                    <span className="material-symbols-outlined text-[14px]">clear</span>
                    Xóa khoảng ngày
                  </button>
                )}
              </div>
            )}

            {/* Filter Tabs */}
            <div className="flex gap-md border-b border-outline-variant mb-lg pb-sm overflow-x-auto">
              <button
                onClick={() => setActiveTab("all")}
                className={`font-label text-label pb-sm px-sm transition-colors cursor-pointer border-b-2 whitespace-nowrap shrink-0 ${activeTab === "all"
                    ? "border-primary text-primary font-bold"
                    : "border-transparent text-on-surface-variant hover:text-primary"
                  }`}
              >
                Tất cả ({plans.length})
              </button>
              <button
                onClick={() => setActiveTab("pending")}
                className={`font-label text-label pb-sm px-sm transition-colors cursor-pointer border-b-2 whitespace-nowrap shrink-0 ${activeTab === "pending"
                    ? "border-primary text-primary font-bold"
                    : "border-transparent text-on-surface-variant hover:text-primary"
                  }`}
              >
                Chưa duyệt ({pendingCount})
              </button>
              <button
                onClick={() => setActiveTab("approved")}
                className={`font-label text-label pb-sm px-sm transition-colors cursor-pointer border-b-2 whitespace-nowrap shrink-0 ${activeTab === "approved"
                    ? "border-primary text-primary font-bold"
                    : "border-transparent text-on-surface-variant hover:text-primary"
                  }`}
              >
                Đã duyệt ({approvedCount})
              </button>
              <button
                onClick={() => setActiveTab("expiring")}
                className={`font-label text-label pb-sm px-sm transition-colors cursor-pointer border-b-2 whitespace-nowrap shrink-0 ${activeTab === "expiring"
                    ? "border-primary text-primary font-bold"
                    : "border-transparent text-on-surface-variant hover:text-primary"
                  }`}
              >
                Sắp hết hạn ({expiringCount})
              </button>
              <button
                onClick={() => setActiveTab("expired")}
                className={`font-label text-label pb-sm px-sm transition-colors cursor-pointer border-b-2 whitespace-nowrap shrink-0 ${activeTab === "expired"
                    ? "border-primary text-primary font-bold"
                    : "border-transparent text-on-surface-variant hover:text-primary"
                  }`}
              >
                Hết hạn ({expiredCount})
              </button>
            </div>

            {/* Meal Plans Table */}
            {filteredPlans.length === 0 ? (
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-xl text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-[48px] text-outline mb-sm">
                  menu_book
                </span>
                <p className="font-body-bold text-body-bold">
                  {plans.length === 0
                    ? "Chưa có thực đơn nào"
                    : "Không có thực đơn phù hợp"}
                </p>
                <p className="font-caption text-caption text-xs mt-xs">
                  {plans.length === 0
                    ? 'Bấm "Tạo thực đơn mới bằng AI" để tạo thực đơn đầu tiên cho bệnh nhân.'
                    : "Thử đổi từ khóa tìm kiếm, chọn lại bộ lọc thời gian hoặc chọn tab khác."}
                </p>
              </div>
            ) : (
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[860px]">
                    <thead>
                      <tr className="border-b border-outline-variant bg-surface-container-low/60 text-left">
                        <th className="px-md py-3 font-body-bold text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
                          Mã thực đơn
                        </th>
                        <th className="px-md py-3 font-body-bold text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
                          Tên bệnh nhân
                        </th>
                        <th className="px-md py-3 font-body-bold text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
                          Số ngày
                        </th>
                        <th className="px-md py-3 font-body-bold text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
                          Lượng calo
                        </th>
                        <th className="px-md py-3 font-body-bold text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
                          Trạng thái
                        </th>
                        <th className="px-md py-3 font-body-bold text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
                          Hạn thực đơn
                        </th>
                        <th className="px-md py-3 font-body-bold text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
                          Ngày tạo
                        </th>
                        <th className="px-md py-3 font-body-bold text-xs font-semibold text-on-surface-variant uppercase tracking-wide text-right">
                          Thao tác
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedPlans.map((plan) => {
                        const badge = STATUS_BADGE[plan.status] || STATUS_BADGE.pending;
                        const patient = patientById.get(plan.patientId);
                        return (
                          <tr
                            key={plan.id}
                            className="border-b border-outline-variant/60 last:border-b-0 hover:bg-surface-container-low/40 transition-colors"
                          >
                            {/* Mã thực đơn */}
                            <td className="px-md py-3">
                              <span
                                title={plan.id}
                                className="font-mono text-xs font-semibold text-primary"
                              >
                                {truncateId(plan.id)}
                              </span>
                            </td>

                            {/* Tên bệnh nhân */}
                            <td className="px-md py-3">
                              <div className="flex items-center gap-sm min-w-0">
                                {/* Avatar — chuẩn theo trang /doctor/patients */}
                                <div className="relative w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center font-label text-xs font-semibold shrink-0">
                                  {initials(plan.patientName)}
                                  {patient?.avatar &&
                                    !patient.avatar.startsWith("https://api.dicebear.com") && (
                                    <img
                                      src={patient.avatar}
                                      alt={plan.patientName}
                                      className="absolute inset-0 w-9 h-9 rounded-full object-cover border border-outline-variant bg-surface-container"
                                      onError={(e) => {
                                        e.currentTarget.style.display = "none";
                                      }}
                                    />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-body-bold text-body font-semibold text-on-surface whitespace-nowrap">
                                    {plan.patientName}
                                  </p>
                                  <p className="text-xs text-on-surface-variant">
                                    {patient?.age
                                      ? `${patient.age} tuổi • `
                                      : ""}
                                    Chẩn đoán: {shortCondition(plan.condition)}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* Số ngày */}
                            <td className="px-md py-3 text-on-surface-variant whitespace-nowrap">
                              {plan.daysCount || 7} ngày
                            </td>

                            {/* Lượng calo */}
                            <td className="px-md py-3 text-on-surface whitespace-nowrap">
                              <span className="inline-flex items-center gap-xs">
                                <span className="material-symbols-outlined text-[16px] text-outline">
                                  local_fire_department
                                </span>
                                {plan.calories}
                              </span>
                            </td>

                            {/* Trạng thái */}
                            <td className="px-md py-3">
                              <span
                                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${badge.className}`}
                              >
                                {badge.icon && (
                                  <span className="material-symbols-outlined text-[14px]">
                                    {badge.icon}
                                  </span>
                                )}
                                {badge.label}
                              </span>
                            </td>

                            {/* Hạn thực đơn — chỉ hiện với plan đang có hiệu lực (mới nhất đã duyệt/chỉnh) */}
                            <td className="px-md py-3">
                              <PlanExpiryBadge expiry={expiryByPlanId.get(plan.id) ?? null} />
                            </td>

                            {/* Ngày tạo */}
                            <td className="px-md py-3 text-on-surface-variant whitespace-nowrap">
                              {plan.createdAt || "—"}
                            </td>

                            {/* Thao tác */}
                            <td className="px-md py-3 text-right">
                              <Link
                                href={`/doctor/reviews/${encodeURIComponent(plan.patientId)}/${encodeURIComponent(plan.id)}`}
                                className="inline-flex items-center gap-xs bg-primary hover:bg-primary-container text-on-primary font-body-bold h-9 px-lg rounded-lg transition-all text-xs font-semibold shrink-0 cursor-pointer active:scale-95 shadow-xs whitespace-nowrap"
                              >
                                <span>Xem chi tiết</span>
                                <span className="material-symbols-outlined text-[16px]">
                                  arrow_forward
                                </span>
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={safePage}
                  totalItems={filteredPlans.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setPage}
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* PATIENT SELECTION MODAL */}
      {isSelectModalOpen && (
        <div className="fixed inset-0 z-50 bg-on-surface/40 backdrop-blur-xs flex items-center justify-center p-md animate-fadeIn">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-lg shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-md border-b border-outline-variant mb-md">
              <div className="flex items-center gap-sm">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined text-[22px]">auto_awesome</span>
                </div>
                <div>
                  <h3 className="font-h2 text-h2 text-on-surface font-bold text-base">
                    Tạo thực đơn AI cho bệnh nhân
                  </h3>
                  <p className="font-caption text-caption text-on-surface-variant text-xs">
                    Chọn một hoặc nhiều bệnh nhân — hệ thống sẽ tạo thực đơn cho tất cả
                  </p>
                </div>
              </div>
              <button
                onClick={closePatientModal}
                className="text-on-surface-variant hover:text-primary p-1 rounded-lg hover:bg-surface-container-low transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Search + Select All Toolbar */}
            <div className="flex items-center gap-sm mb-md">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-md top-1/2 -translate-y-1/2 text-outline text-[20px]">
                  search
                </span>
                <input
                  type="text"
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="Tìm theo tên, mã bệnh nhân, hoặc bệnh lý..."
                  className="w-full pl-xl pr-md py-sm bg-surface-container-low border border-outline-variant rounded-xl font-body text-body text-on-surface text-xs focus:outline-none focus:border-primary transition-colors"
                  autoFocus
                />
              </div>
              <button
                type="button"
                onClick={toggleSelectAll}
                disabled={visiblePatients.length === 0}
                className="px-md py-sm border border-outline-variant rounded-xl text-xs font-semibold text-on-surface-variant hover:border-primary hover:text-primary transition-colors cursor-pointer disabled:opacity-40 shrink-0 flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {allVisibleSelected ? "deselect" : "select_all"}
                </span>
                <span>{allVisibleSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}</span>
              </button>
            </div>

            {/* Patient List */}
            <div className="flex-1 overflow-y-auto space-y-sm pr-xs">
              {visiblePatients.length === 0 ? (
                <div className="text-center py-xl text-on-surface-variant text-xs">
                  {allPatients.length === 0
                    ? "Danh sách bệnh nhân đang trống."
                    : `Không tìm thấy bệnh nhân phù hợp với từ khóa "${patientSearch}".`}
                </div>
              ) : (
                <>
                  {selectedPatientList.length > 0 &&
                    visiblePatients.length > selectedPatientList.length && (
                    <div className="flex items-center gap-1.5 px-xs pt-xs pb-1">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-primary">
                        Đã chọn ({selectedPatientList.length})
                      </span>
                      <span className="text-[11px] text-on-surface-variant">
                        {patientSearch.trim()
                          ? "— giữ nguyên dù không khớp từ khóa"
                          : "— dồn lên đầu danh sách"}
                      </span>
                    </div>
                  )}
                  {visiblePatients.map((patient) => {
                    const isSelected = selectedPatientIds.has(patient.id);
                    // Avatar chuẩn như trang /doctor/patients: bỏ seed dicebear, resolve /static/ theo API_BASE
                    const avatar =
                      patient.avatar &&
                      !patient.avatar.startsWith("https://api.dicebear.com")
                        ? patient.avatar
                        : "";
                    const cfg = getConfig(patient.id);
                    const showSummary = isSelected && hasConfig(patient.id);
                    return (
                      <div
                        key={patient.id}
                        className={`rounded-xl border transition-all ${isSelected
                            ? "border-primary bg-primary/5 shadow-2xs"
                            : "border-outline-variant bg-surface-container-lowest hover:border-primary/50 hover:bg-surface-container-low/50"
                          }`}
                      >
                        {/* Hàng chọn bệnh nhân (click để chọn/bỏ chọn) */}
                        <div
                          onClick={() => togglePatientSelection(patient.id)}
                          className="flex items-center gap-sm p-sm cursor-pointer select-none"
                        >
                          {/* Checkbox */}
                          <span
                            className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${isSelected
                                ? "bg-primary border-primary text-on-primary"
                                : "border-outline bg-surface-container-lowest"
                              }`}
                          >
                            {isSelected && (
                              <span className="material-symbols-outlined text-[14px]">check</span>
                            )}
                          </span>

                          {/* Avatar — chuẩn theo trang /doctor/patients */}
                          <div className="relative w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center font-label text-xs font-semibold shrink-0">
                            {initials(patient.name)}
                            {avatar && (
                              <img
                                src={avatar}
                                alt={patient.name}
                                className="absolute inset-0 w-9 h-9 rounded-full object-cover border border-outline-variant bg-surface-container"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-body-bold text-sm font-semibold text-on-surface truncate">
                                {patient.name}
                              </p>
                              <span
                                className="font-mono text-[10px] text-on-surface-variant bg-surface-container-high px-1.5 py-0.5 rounded-md shrink-0"
                                title={patient.id}
                              >
                                {truncatePatientId(patient.id)}
                              </span>
                            </div>
                            <p className="text-xs text-on-surface-variant mt-0.5">
                              {patient.age > 0 ? `${patient.age} tuổi` : "—"}
                              {patient.gender ? ` • ${patient.gender}` : ""}
                            </p>
                            <p className="text-xs text-on-surface-variant truncate">
                              Chẩn đoán: {shortCondition(patient.condition)}
                            </p>
                          </div>

                          {/* Nút cài đặt — chỉ hiện khi bệnh nhân đã được chọn */}
                          {isSelected && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfigTargetPatientId(patient.id);
                                setIsConfigOpen(true);
                              }}
                              className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container-low transition-colors cursor-pointer"
                              title={`Cài đặt thông số cho ${patient.name}`}
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                settings
                              </span>
                            </button>
                          )}
                        </div>

                        {/* Summary inline các thông số đã cài đặt */}
                        {showSummary && (
                          <div className="px-sm pb-sm space-y-1">
                            {cfg.priorities.length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap">
                                {cfg.priorities.map((pr) => (
                                  <span
                                    key={pr}
                                    className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20"
                                  >
                                    {pr}
                                  </span>
                                ))}
                                {cfg.customActive && cfg.customPriority.trim() && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-surface-container-high text-on-surface-variant border border-outline-variant">
                                    {cfg.customPriority.trim()}
                                  </span>
                                )}
                              </div>
                            )}
                            {cfg.notes.trim() && (
                              <p className="text-[11px] text-on-surface-variant truncate flex items-center gap-1">
                                <span className="material-symbols-outlined text-[12px]">notes</span>
                                {cfg.notes.trim()}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-md border-t border-outline-variant mt-md flex justify-between items-center text-xs text-on-surface-variant">
              <span>
                Đã chọn {selectedCount}/{visiblePatients.length} bệnh nhân
              </span>
              <div className="flex items-center gap-sm">
                <button
                  onClick={closePatientModal}
                  className="px-md py-sm border border-outline-variant rounded-lg hover:bg-surface-container-low transition-colors cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  onClick={handleGenerateForSelected}
                  disabled={selectedCount === 0}
                  className="bg-primary text-on-primary px-md py-sm rounded-lg text-xs font-semibold hover:bg-primary-container transition-all shadow-xs flex items-center gap-xs cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    auto_awesome
                  </span>
                  <span>Tạo thực đơn cho {selectedCount} bệnh nhân</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GENERATION SETTINGS DIALOG */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-[60] bg-on-surface/40 backdrop-blur-xs flex items-center justify-center p-md animate-fadeIn">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-lg shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col">
            {/* Dialog Header */}
            <div className="flex items-center justify-between pb-md border-b border-outline-variant mb-md">
              <div className="flex items-center gap-sm">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined text-[22px]">tune</span>
                </div>
                <div>
                  <h3 className="font-h2 text-h2 text-on-surface font-bold text-base">
                    Cài đặt thông số tạo thực đơn
                  </h3>
                  <p className="font-caption text-caption text-on-surface-variant text-xs">
                    {configTargetPatient
                      ? `Điều chỉnh thông số cho bệnh nhân ${configTargetPatient.name}`
                      : `Điều chỉnh ưu tiên & ghi chú cho từng bệnh nhân đã chọn (${selectedPatients.length})`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsConfigOpen(false)}
                className="text-on-surface-variant hover:text-primary p-1 rounded-lg hover:bg-surface-container-low transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Per-patient config list — đầy đủ thông số như trang gen bình thường */}
            <div className="flex-1 overflow-y-auto space-y-md pr-xs">
              {dialogPatients.length === 0 ? (
                <div className="text-center py-xl text-on-surface-variant text-xs">
                  Chưa chọn bệnh nhân nào.
                </div>
              ) : (
                dialogPatients.map((patient) => {
                  const cfg = getConfig(patient.id);
                  return (
                    <div
                      key={patient.id}
                      className="border border-outline-variant rounded-xl p-md space-y-md bg-surface-container-lowest"
                    >
                      <div className="flex items-center gap-1.5">
                        <p className="font-body-bold text-sm font-semibold text-on-surface truncate">
                          {patient.name}
                        </p>
                        <span
                          className="font-mono text-[10px] text-on-surface-variant bg-surface-container-high px-1.5 py-0.5 rounded-md shrink-0"
                          title={patient.id}
                        >
                          {truncatePatientId(patient.id)}
                        </span>
                      </div>

                      {/* Số ngày (giống trang gen — MVP cố định 7 ngày theo contract) */}
                      <div>
                        <label className="font-label text-label text-on-surface block mb-xs font-semibold text-xs">
                          Số ngày
                        </label>
                        <div className="flex items-center gap-xs">
                          <button
                            type="button"
                            className="px-md py-sm rounded-lg text-xs font-semibold bg-primary text-on-primary shadow-xs"
                          >
                            7 ngày (Khuyến nghị)
                          </button>
                          <span className="px-md py-sm rounded-lg text-xs text-on-surface-variant/50">
                            3 ngày
                          </span>
                          <span className="px-md py-sm rounded-lg text-xs text-on-surface-variant/50">
                            14 ngày
                          </span>
                        </div>
                        <p className="text-[11px] text-on-surface-variant mt-xs">
                          MVP cố định 7 ngày theo contract.
                        </p>
                      </div>

                      {/* Ưu tiên đặc biệt (giống trang gen) */}
                      <div>
                        <label className="font-label text-label text-on-surface block mb-xs font-semibold text-xs">
                          Ưu tiên đặc biệt
                        </label>
                        <div className="flex flex-wrap gap-xs">
                          {PRIORITY_OPTIONS.map((opt) => {
                            const on = cfg.priorities.includes(opt);
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => togglePriority(patient.id, opt)}
                                className={`px-md py-sm rounded-full text-xs font-semibold border transition-all cursor-pointer flex items-center gap-xs ${on
                                    ? "bg-primary/10 border-primary text-primary"
                                    : "bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:border-primary/50"
                                  }`}
                              >
                                {on && (
                                  <span className="material-symbols-outlined text-[14px]">check</span>
                                )}
                                {opt}
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => toggleCustomActive(patient.id)}
                            className={`px-md py-sm rounded-full text-xs font-semibold border transition-all cursor-pointer flex items-center gap-xs ${cfg.customActive
                                ? "bg-primary/10 border-primary text-primary"
                                : "bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:border-primary/50"
                              }`}
                          >
                            {cfg.customActive && (
                              <span className="material-symbols-outlined text-[14px]">check</span>
                            )}
                            Khác...
                          </button>
                        </div>
                        {cfg.customActive && (
                          <div className="mt-xs">
                            <input
                              type="text"
                              value={cfg.customPriority}
                              onChange={(e) => setCustomPriority(patient.id, e.target.value)}
                              placeholder="Nhập ưu tiên đặc biệt khác..."
                              className="w-full p-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-xs font-body text-on-surface focus:outline-none focus:border-primary transition-all shadow-xs"
                            />
                          </div>
                        )}
                      </div>

                      {/* Ghi chú bổ sung cho AI Agent (giống trang gen) */}
                      <div>
                        <label className="font-label text-label text-on-surface block mb-xs font-semibold text-xs">
                          Ghi chú bổ sung cho AI Agent
                        </label>
                        <textarea
                          value={cfg.notes}
                          onChange={(e) => setNotes(patient.id, e.target.value)}
                          rows={3}
                          placeholder="Ví dụ: ưu tiên món hấp luộc miền Bắc, hạn chế đồ chiên xào..."
                          className="w-full p-md bg-surface-container-lowest border border-outline-variant rounded-lg font-body text-body text-on-surface focus:outline-none focus:border-primary text-sm transition-shadow"
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Dialog Footer */}
            <div className="pt-md border-t border-outline-variant mt-md flex justify-end">
              <button
                onClick={() => setIsConfigOpen(false)}
                className="bg-primary text-on-primary px-md py-sm rounded-lg text-xs font-semibold hover:bg-primary-container transition-all shadow-xs flex items-center gap-xs cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-[16px]">check</span>
                <span>Xong</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
