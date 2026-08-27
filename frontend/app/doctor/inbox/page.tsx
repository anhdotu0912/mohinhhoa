"use client";

/* eslint-disable @next/next/no-img-element */
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TopBar } from "@/components/shared/TopBar";
import Pagination, { getPageItems } from "@/components/shared/Pagination";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { resolveUserAvatar, userInitials } from "@/lib/avatar";
import {
  buildInboxJobs,
  INBOX_TYPE_META,
  type InboxJob,
} from "@/lib/doctor-inbox";
import { doctorChartHref, doctorInboxHref, type InboxJobType } from "@/lib/doctor-routes";
import { ApiError, type MealPlanOutput } from "@/lib/types";

const PAGE_SIZE = 10;

const FILTERS: { id: "all" | InboxJobType; label: string; icon: string }[] = [
  { id: "all", label: "Tất cả", icon: "all_inbox" },
  { id: "plan_review", label: "Chờ duyệt", icon: "assignment_turned_in" },
  { id: "constraints", label: "Ràng buộc", icon: "clinical_notes" },
  { id: "generate_request", label: "Yêu cầu tạo TD", icon: "restaurant_menu" },
  { id: "plan_expiry", label: "Hết hạn", icon: "event_busy" },
];

function isInboxType(value: string | null): value is InboxJobType {
  return (
    value === "plan_review" ||
    value === "constraints" ||
    value === "generate_request" ||
    value === "plan_expiry"
  );
}

function truncateId(id: string): string {
  return id.length > 8 ? `...${id.slice(-6)}` : id;
}

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return "Gần đây";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return "Vừa xong";
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays === 1) return "Hôm qua";
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return d.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function InboxContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<InboxJob[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const typeParam = searchParams.get("type");
  const urgencyFilter = searchParams.get("urgency") === "soon";
  const activeType: "all" | InboxJobType = isInboxType(typeParam) ? typeParam : "all";

  useEffect(() => {
    setHydrated(true);
  }, []);

  const load = useCallback(
    async (isManualRefresh = false) => {
      if (!token || role !== "doctor") return;
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const [patients, plans] = await Promise.all([
          api.listDoctorPatients(),
          api.listDoctorMealPlans("pending_review").catch(() => [] as MealPlanOutput[]),
        ]);
        setJobs(buildInboxJobs(patients, plans));
      } catch (err) {
        setJobs([]);
        setError(
          err instanceof ApiError ? err.message : "Không tải được hàng việc y khoa."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, role]
  );

  useEffect(() => {
    if (!hydrated) return;
    if (!token || role !== "doctor") {
      router.replace("/login");
      return;
    }
    void load();
  }, [hydrated, token, role, router, load]);

  // Reset về trang 1 khi đổi bộ lọc hoặc từ khóa tìm kiếm
  useEffect(() => {
    setPage(1);
  }, [activeType, searchQuery, urgencyFilter]);

  const counts = useMemo(() => {
    const next: Record<"all" | InboxJobType, number> = {
      all: jobs.length,
      plan_review: 0,
      constraints: 0,
      generate_request: 0,
      plan_expiry: 0,
    };
    for (const job of jobs) next[job.type] += 1;
    return next;
  }, [jobs]);

  const urgentCount = useMemo(
    () => jobs.filter((j) => j.urgency === "urgent" || j.urgency === "soon").length,
    [jobs]
  );

  const filteredJobs = useMemo(() => {
    let list = activeType === "all" ? jobs : jobs.filter((j) => j.type === activeType);
    if (urgencyFilter) {
      list = list.filter((j) => j.urgency === "urgent" || j.urgency === "soon");
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((j) => {
        return (
          j.patientName.toLowerCase().includes(q) ||
          j.patientId.toLowerCase().includes(q) ||
          j.title.toLowerCase().includes(q) ||
          j.subtitle.toLowerCase().includes(q) ||
          (j.patientCondition || "").toLowerCase().includes(q) ||
          (j.patientDisease || []).some((d) => d.toLowerCase().includes(q))
        );
      });
    }
    return list;
  }, [jobs, activeType, searchQuery, urgencyFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedJobs = getPageItems(filteredJobs, safePage, PAGE_SIZE);

  if (!hydrated || !token || role !== "doctor") return null;

  return (
    <>
      <TopBar title="Hàng việc y khoa" />
      <main className="p-4 sm:p-6 md:p-8 w-full max-w-[1600px] mx-auto pb-24 space-y-6 flex-1">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-h1 text-2xl md:text-3xl font-black text-on-surface tracking-tight">
              Việc cần xử lý
            </h1>
            <p className="text-xs md:text-sm text-on-surface-variant mt-1 font-medium">
              Quản lý tập trung các công việc duyệt thực đơn, xác nhận ràng buộc và xử lý cảnh báo y khoa
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={loading || refreshing}
              title="Làm mới hàng việc"
              className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-outline-variant/60 bg-surface-container-lowest text-on-surface-variant hover:text-primary hover:border-primary/40 transition-all cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
            >
              <span
                className={`material-symbols-outlined text-[20px] ${
                  refreshing ? "animate-spin text-primary" : ""
                }`}
              >
                refresh
              </span>
            </button>
            <Link
              href="/doctor/patients"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-all shadow-2xs active:scale-95 shrink-0"
            >
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
              <span>Tạo thực đơn AI</span>
            </Link>
          </div>
        </div>

        {/* 4 Clinical KPI Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Khẩn cấp / Ưu tiên */}
          <button
            type="button"
            onClick={() =>
              router.push(
                urgencyFilter
                  ? doctorInboxHref("all")
                  : doctorInboxHref("all", { urgency: "soon" })
              )
            }
            className={`p-4 rounded-xl bg-surface-container-lowest border shadow-2xs flex items-center gap-3.5 text-left transition-all cursor-pointer ${
              urgencyFilter
                ? "border-rose-400 ring-2 ring-rose-400/20 bg-rose-50/20"
                : "border-outline-variant/60 hover:border-rose-300"
            }`}
          >
            <div className="w-11 h-11 rounded-lg bg-rose-500/10 text-rose-700 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px]">bolt</span>
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block truncate">
                Cần xử lý sớm
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-black text-rose-700 tabular-nums">
                  {urgentCount}
                </span>
                <span className="text-[11px] text-on-surface-variant/80 font-medium">
                  tác vụ
                </span>
              </div>
            </div>
          </button>

          {/* Card 2: Chờ duyệt thực đơn */}
          <button
            type="button"
            onClick={() => router.push(doctorInboxHref("plan_review"))}
            className={`p-4 rounded-xl bg-surface-container-lowest border shadow-2xs flex items-center gap-3.5 text-left transition-all cursor-pointer ${
              activeType === "plan_review"
                ? "border-amber-400 ring-2 ring-amber-400/20 bg-amber-50/20"
                : "border-outline-variant/60 hover:border-amber-300"
            }`}
          >
            <div className="w-11 h-11 rounded-lg bg-amber-500/10 text-amber-800 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px]">assignment_turned_in</span>
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block truncate">
                Chờ duyệt thực đơn
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-black text-amber-900 tabular-nums">
                  {counts.plan_review}
                </span>
                <span className="text-[11px] text-on-surface-variant/80 font-medium">
                  thực đơn
                </span>
              </div>
            </div>
          </button>

          {/* Card 3: Chờ xác nhận ràng buộc */}
          <button
            type="button"
            onClick={() => router.push(doctorInboxHref("constraints"))}
            className={`p-4 rounded-xl bg-surface-container-lowest border shadow-2xs flex items-center gap-3.5 text-left transition-all cursor-pointer ${
              activeType === "constraints"
                ? "border-sky-400 ring-2 ring-sky-400/20 bg-sky-50/20"
                : "border-outline-variant/60 hover:border-sky-300"
            }`}
          >
            <div className="w-11 h-11 rounded-lg bg-sky-500/10 text-sky-800 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px]">clinical_notes</span>
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block truncate">
                Xác nhận ràng buộc
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-black text-sky-900 tabular-nums">
                  {counts.constraints}
                </span>
                <span className="text-[11px] text-on-surface-variant/80 font-medium">
                  bệnh nhân
                </span>
              </div>
            </div>
          </button>

          {/* Card 4: Hết hạn & Yêu cầu mới */}
          <button
            type="button"
            onClick={() => router.push(doctorInboxHref("plan_expiry"))}
            className={`p-4 rounded-xl bg-surface-container-lowest border shadow-2xs flex items-center gap-3.5 text-left transition-all cursor-pointer ${
              activeType === "plan_expiry"
                ? "border-emerald-400 ring-2 ring-emerald-400/20 bg-emerald-50/20"
                : "border-outline-variant/60 hover:border-emerald-300"
            }`}
          >
            <div className="w-11 h-11 rounded-lg bg-emerald-500/10 text-emerald-800 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px]">event_busy</span>
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block truncate">
                Hết hạn & Yêu cầu
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-black text-emerald-900 tabular-nums">
                  {counts.plan_expiry + counts.generate_request}
                </span>
                <span className="text-[11px] text-on-surface-variant/80 font-medium">
                  yêu cầu
                </span>
              </div>
            </div>
          </button>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          {/* Tab Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {FILTERS.map((filter) => {
              const selected = !urgencyFilter && activeType === filter.id;
              return (
                <Link
                  key={filter.id}
                  href={doctorInboxHref(filter.id)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    selected
                      ? "bg-primary text-on-primary shadow-2xs"
                      : "bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {filter.icon}
                  </span>
                  <span>{filter.label}</span>
                  <span
                    className={`ml-0.5 px-1.5 py-0.2 rounded-md text-[10px] font-extrabold tabular-nums ${
                      selected
                        ? "bg-white/20 text-white"
                        : "bg-surface-container-high text-on-surface-variant"
                    }`}
                  >
                    {counts[filter.id]}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px] sm:w-72">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
              search
            </span>
            <input
              type="text"
              placeholder="Tìm theo tên BN, mã BN, bệnh lý..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-8 py-2 bg-surface-container-lowest border border-outline-variant/70 rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-2xs placeholder:text-on-surface-variant/60"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface p-0.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-amber-700">
                warning
              </span>
              <span className="font-semibold">{error}</span>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              className="font-bold text-primary hover:underline cursor-pointer text-xs shrink-0"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Main List Container */}
        {loading ? (
          <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-12 text-center shadow-2xs space-y-3">
            <span className="material-symbols-outlined text-[36px] text-primary animate-spin">
              progress_activity
            </span>
            <p className="text-sm font-bold text-on-surface">Đang tải hàng việc y khoa…</p>
            <p className="text-xs text-on-surface-variant">
              Hệ thống đang đồng bộ dữ liệu bệnh nhân và thực đơn AI.
            </p>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-12 text-center shadow-2xs space-y-3">
            <div className="w-16 h-16 rounded-xl bg-emerald-500/10 text-emerald-600 mx-auto flex items-center justify-center">
              <span className="material-symbols-outlined text-[36px]">task_alt</span>
            </div>
            <div>
              <p className="font-bold text-base text-on-surface">
                {searchQuery
                  ? "Không tìm thấy công việc phù hợp"
                  : urgencyFilter
                  ? "Không có việc cần xử lý sớm"
                  : activeType === "all"
                  ? "Không còn việc chờ xử lý"
                  : "Không có công việc trong danh mục này"}
              </p>
              <p className="text-xs text-on-surface-variant mt-1 max-w-md mx-auto">
                {searchQuery
                  ? `Không có kết quả nào khớp với từ khoá "${searchQuery}". Hãy thử tìm kiếm khác.`
                  : urgencyFilter
                  ? "Không có thực đơn hết hạn hay việc ưu tiên. Chọn “Tất cả” để xem toàn bộ hàng việc."
                  : activeType === "all"
                  ? "Tất cả thực đơn, ràng buộc dinh dưỡng và chu kỳ điều trị của bệnh nhân đang ở trạng thái ổn định."
                  : "Chọn tab “Tất cả” hoặc chọn danh mục khác để kiểm tra công việc còn lại."}
              </p>
            </div>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="px-4 py-2 rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">clear_all</span>
                <span>Xoá tìm kiếm</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* List Header Info */}
            <div className="flex items-center justify-between text-xs text-on-surface-variant px-1 font-medium">
              <span>
                Tìm thấy <strong className="text-on-surface font-bold">{filteredJobs.length}</strong> công việc
                {urgencyFilter
                  ? " (Cần xử lý sớm)"
                  : activeType !== "all"
                    ? ` (${FILTERS.find((f) => f.id === activeType)?.label})`
                    : ""}
              </span>
              <span>Trang {safePage} / {totalPages}</span>
            </div>

            {/* List of Clinical Action Cards */}
            <ul className="space-y-2.5">
              {pagedJobs.map((job) => {
                const meta = INBOX_TYPE_META[job.type];
                const avatarSrc = resolveUserAvatar(job.patientAvatar);

                return (
                  <li key={job.id}>
                    <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-primary/50 hover:shadow-subtle transition-all">
                      {/* Left: Patient Avatar & Primary Details */}
                      <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                        {/* Avatar */}
                        <div className="relative shrink-0 mt-0.5 sm:mt-0">
                          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-sm select-none shadow-2xs">
                            {userInitials(job.patientName)}
                          </div>
                          {avatarSrc && (
                            <img
                              src={avatarSrc}
                              alt={job.patientName}
                              className="absolute inset-0 w-12 h-12 rounded-full object-cover border border-outline-variant/60 shadow-2xs"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          )}
                          {/* Urgency Indicator Dot */}
                          {job.urgency === "urgent" && (
                            <span
                              className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-600 ring-2 ring-white animate-pulse"
                              title="Khẩn cấp"
                            />
                          )}
                        </div>

                        {/* Task Information */}
                        <div className="min-w-0 flex-1 space-y-1">
                          {/* Row 1: Badges & Patient Identification */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${meta.chipClass}`}
                            >
                              <span className="material-symbols-outlined text-[13px]">
                                {meta.icon}
                              </span>
                              <span>{meta.label}</span>
                            </span>

                            {job.urgency === "urgent" && (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <span className="material-symbols-outlined text-[12px]">bolt</span>
                                <span>Khẩn cấp</span>
                              </span>
                            )}

                            <span className="text-[11px] text-on-surface-variant font-medium">
                              Mã BN: {truncateId(job.patientId)}
                            </span>
                          </div>

                          {/* Row 2: Patient Name + Task Title */}
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <Link
                              href={doctorChartHref(job.patientId)}
                              className="font-bold text-sm text-on-surface hover:text-primary hover:underline transition-colors"
                            >
                              {job.patientName}
                            </Link>
                            {job.patientAge != null && (
                              <span className="text-xs text-on-surface-variant font-medium">
                                ({job.patientAge} tuổi
                                {job.patientGender ? ` · ${job.patientGender}` : ""})
                              </span>
                            )}
                            <span className="text-on-surface-variant/40 hidden sm:inline">•</span>
                            <span className="font-semibold text-sm text-on-surface">
                              {job.title}
                            </span>
                          </div>

                          {/* Row 3: Subtitle / Medical Context */}
                          <p className="text-xs text-on-surface-variant/90 leading-relaxed">
                            {job.subtitle}
                          </p>

                          {/* Row 4: Disease Tags & Relative Time */}
                          <div className="flex items-center gap-2 pt-1 flex-wrap">
                            {job.patientDisease && job.patientDisease.length > 0 ? (
                              job.patientDisease.slice(0, 3).map((d) => (
                                <span
                                  key={d}
                                  className="px-2 py-0.5 rounded-md bg-surface-container-low text-on-surface-variant text-[10px] font-semibold border border-outline-variant/40"
                                >
                                  {d}
                                </span>
                              ))
                            ) : job.patientCondition ? (
                              <span className="px-2 py-0.5 rounded-md bg-surface-container-low text-on-surface-variant text-[10px] font-semibold border border-outline-variant/40">
                                {job.patientCondition}
                              </span>
                            ) : null}

                            <span className="text-[10px] text-on-surface-variant/70 inline-flex items-center gap-1 ml-auto sm:ml-0 font-medium">
                              <span className="material-symbols-outlined text-[13px]">
                                schedule
                              </span>
                              <span>{formatRelativeTime(job.sortAt)}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center justify-end sm:justify-start md:flex-col md:items-end gap-2 shrink-0 pt-2 sm:pt-0 border-t border-outline-variant/30 md:border-none">
                        <Link
                          href={job.href}
                          className="inline-flex items-center justify-center gap-1.5 h-9 md:h-10 px-4 rounded-lg bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-all shadow-2xs active:scale-95 shrink-0"
                        >
                          <span>{job.cta}</span>
                          <span className="material-symbols-outlined text-[16px]">
                            arrow_forward
                          </span>
                        </Link>

                        <Link
                          href={doctorChartHref(job.patientId)}
                          className="text-[11px] font-semibold text-on-surface-variant hover:text-primary hover:underline transition-colors px-1 py-0.5 inline-flex items-center gap-1"
                        >
                          <span>Hồ sơ bệnh án</span>
                          <span className="material-symbols-outlined text-[12px]">
                            open_in_new
                          </span>
                        </Link>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Pagination Component */}
            <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl shadow-2xs overflow-hidden mt-4">
              <Pagination
                page={safePage}
                totalItems={filteredJobs.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </div>
          </div>
        )}
      </main>
    </>
  );
}

export default function DoctorInboxPage() {
  return (
    <Suspense
      fallback={
        <main className="p-8 text-sm text-on-surface-variant flex items-center justify-center">
          Đang tải hàng việc y khoa…
        </main>
      }
    >
      <InboxContent />
    </Suspense>
  );
}
