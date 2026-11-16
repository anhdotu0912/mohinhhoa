"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ClipboardCheck, ExternalLink, Inbox, RefreshCw, Search, X } from "lucide-react";
import Pagination from "@/components/shared/Pagination";
import { resolveUserAvatar, userInitials } from "@/lib/avatar";
import { INBOX_TYPE_META, type InboxJob } from "@/lib/doctor-inbox";
import { doctorChartHref, doctorInboxHref, type InboxJobType } from "@/lib/doctor-routes";

const FILTERS: { id: "all" | InboxJobType; label: string }[] = [
  { id: "all", label: "Tất cả công việc" },
  { id: "plan_review", label: "Chờ duyệt thực đơn" },
  { id: "constraints", label: "Xác nhận ràng buộc" },
  { id: "chat_escalation", label: "Hỏi bác sĩ" },
  { id: "plan_expiry", label: "Chu kỳ thực đơn" },
  { id: "generate_request", label: "Yêu cầu hỗ trợ" },
  { id: "patient_claim", label: "Chờ nhận bệnh nhân" },
];

function relativeTime(value: string) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "Gần đây";
  const hours = Math.floor((Date.now() - date.getTime()) / 3_600_000);
  if (hours < 1) return "Vừa xong";
  if (hours < 24) return `${hours} giờ trước`;
  if (hours < 48) return "Hôm qua";
  if (hours < 168) return `${Math.floor(hours / 24)} ngày trước`;
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
}

export function CompactInbox({
  jobs, counts, urgentCount, total, page, pageSize, activeType, urgencyFilter,
  searchQuery, loading, refreshing, error, claimingId, onSearch, onRefresh, onClaim, onPage,
}: {
  jobs: InboxJob[];
  counts: Record<"all" | InboxJobType, number>;
  urgentCount: number;
  total: number;
  page: number;
  pageSize: number;
  activeType: "all" | InboxJobType;
  urgencyFilter: boolean;
  searchQuery: string;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  claimingId: string | null;
  onSearch: (query: string) => void;
  onRefresh: () => void;
  onClaim: (job: InboxJob) => void;
  onPage: (page: number) => void;
}) {
  const router = useRouter();
  const busy = loading || refreshing;
  const summary = [
    { label: "Cần xử lý sớm", value: urgentCount, href: urgencyFilter ? doctorInboxHref("all") : doctorInboxHref("all", { urgency: "soon" }), active: urgencyFilter },
    { label: "Chờ duyệt", value: counts.plan_review, href: doctorInboxHref("plan_review"), active: activeType === "plan_review" },
    { label: "Ràng buộc", value: counts.constraints, href: doctorInboxHref("constraints"), active: activeType === "constraints" },
    { label: "Hỏi bác sĩ", value: counts.chat_escalation, href: doctorInboxHref("chat_escalation"), active: activeType === "chat_escalation" },
    { label: "Chu kỳ thực đơn", value: counts.plan_expiry, href: doctorInboxHref("plan_expiry"), active: activeType === "plan_expiry" },
    { label: "Chờ nhận", value: counts.patient_claim, href: doctorInboxHref("patient_claim"), active: activeType === "patient_claim" },
  ];

  return (
    <main className="mx-auto w-full max-w-[1360px] flex-1 space-y-4 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
      <header className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
        <div className="min-w-0">
          <h1 className="text-[23px] font-semibold leading-tight tracking-tight text-slate-900">Việc cần xử lý</h1>
          <p className="mt-1 text-xs text-slate-500">Duyệt thực đơn, xác nhận hồ sơ và phản hồi bệnh nhân.</p>
        </div>
        <div className="flex w-full items-center gap-2 xl:w-auto">
          <div className="relative min-w-0 flex-1 xl:w-64 xl:flex-none">
            <label className="sr-only" htmlFor="inbox-search">Tìm công việc theo tên, mã bệnh nhân hoặc bệnh lý</label>
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input id="inbox-search" type="search" role="searchbox" value={searchQuery} onChange={(e) => onSearch(e.target.value)} autoComplete="off" placeholder="Tìm tên, mã BN, bệnh lý…" className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 [&::-webkit-search-cancel-button]:appearance-none" />
            {searchQuery && <button type="button" aria-label="Xóa tìm kiếm" onClick={() => onSearch("")} className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100"><X size={14} /></button>}
          </div>
          <button type="button" onClick={onRefresh} disabled={busy} title="Làm mới hàng việc" aria-label="Làm mới hàng việc" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-teal-700 disabled:opacity-50"><RefreshCw size={15} className={busy ? "animate-spin" : ""} /></button>
          <Link href="/doctor/patients" className="flex h-9 shrink-0 items-center gap-2 rounded-lg bg-[#0f766e] px-3 text-xs font-medium text-white hover:bg-teal-800"><ClipboardCheck size={15} /><span className="hidden sm:inline">Kiểm tra thực đơn</span><span className="sm:hidden">Thực đơn</span></Link>
        </div>
      </header>

      <section aria-label="Thống kê công việc" className="grid grid-cols-3 overflow-hidden rounded-xl border border-slate-200/80 bg-white sm:grid-cols-6">
        {summary.map((item, index) => (
          <Link key={item.label} href={item.href} aria-current={item.active ? "true" : undefined} className={`min-w-0 px-3 py-3 transition-colors hover:bg-slate-50 sm:px-4 ${index > 0 ? "sm:border-l sm:border-slate-100" : ""} ${index % 3 ? "border-l border-slate-100" : ""} ${index >= 3 ? "border-t border-slate-100 sm:border-t-0" : ""} ${item.active ? "bg-teal-50/70" : ""}`}>
            <p className={`truncate text-[11px] font-medium ${item.active ? "text-teal-700" : "text-slate-500"}`}>{item.label}</p>
            <p className={`mt-1 text-[23px] font-semibold leading-none tabular-nums ${item.active ? "text-teal-800" : "text-slate-900"}`}>{loading || error ? "—" : item.value}</p>
          </Link>
        ))}
      </section>

      <section aria-label="Danh sách công việc" className="overflow-hidden rounded-xl border border-slate-200/80 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <label htmlFor="inbox-type" className="sr-only">Lọc loại công việc</label>
            <select id="inbox-type" value={activeType} onChange={(e) => router.push(doctorInboxHref(e.target.value as "all" | InboxJobType, urgencyFilter ? { urgency: "soon" } : undefined))} className="h-8 max-w-[215px] rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-teal-500">
              {FILTERS.map((filter) => <option value={filter.id} key={filter.id}>{filter.label} ({counts[filter.id]})</option>)}
            </select>
            {urgencyFilter && <button type="button" onClick={() => router.push(doctorInboxHref(activeType))} className="flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-800" aria-label="Bỏ lọc cần xử lý sớm">Xử lý sớm<X size={12} /></button>}
          </div>
          <p role="status" className="text-[11px] text-slate-400">{loading ? "Đang tải…" : error ? "Chưa tải được dữ liệu" : <><strong className="font-semibold text-slate-700">{total}</strong> công việc{total > pageSize ? ` · Trang ${page}/${Math.ceil(total / pageSize)}` : ""}</>}</p>
        </div>

        {error ? (
          <div role="alert" className="flex items-center justify-between gap-3 bg-amber-50 px-4 py-4 text-xs text-amber-900"><span>{error}</span><button type="button" onClick={onRefresh} className="shrink-0 font-semibold underline">Thử lại</button></div>
        ) : loading ? (
          <div className="flex min-h-36 items-center justify-center gap-2 text-sm text-slate-500"><RefreshCw size={17} className="animate-spin" />Đang tải công việc…</div>
        ) : jobs.length === 0 ? (
          <div className="flex min-h-36 flex-col items-center justify-center gap-2 px-5 py-6 text-center"><Inbox size={23} strokeWidth={1.5} className="text-slate-300" /><p className="text-sm font-medium text-slate-600">{searchQuery ? "Không tìm thấy công việc phù hợp" : "Không có công việc trong bộ lọc này"}</p><p className="text-xs text-slate-400">{searchQuery ? "Thử tên, mã bệnh nhân hoặc từ khóa khác." : "Chọn loại công việc khác để xem thêm."}</p>{searchQuery && <button type="button" onClick={() => onSearch("")} className="mt-1 text-xs font-medium text-teal-700">Xóa tìm kiếm</button>}</div>
        ) : (
          <>
            <div aria-hidden="true" className="hidden grid-cols-[minmax(180px,0.95fr)_minmax(0,1.6fr)_96px_168px] gap-4 border-b border-slate-100 bg-slate-50/60 px-4 py-2 text-[11px] font-medium text-slate-400 lg:grid"><span>Bệnh nhân</span><span>Công việc</span><span>Cập nhật</span><span className="text-right">Thao tác</span></div>
            <ul data-inbox-rows className="divide-y divide-slate-100">
              {jobs.map((job) => {
                const meta = INBOX_TYPE_META[job.type];
                const avatar = resolveUserAvatar(job.patientAvatar);
                const isClaim = job.type === "patient_claim";
                const claimBusy = claimingId === job.id;
                const href = job.type === "chat_escalation" ? doctorInboxHref(activeType, { urgency: urgencyFilter ? "soon" : undefined, escalation: job.id.replace(/^escalation:/, "") }) : job.href;
                return (
                  <li key={job.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 transition-colors hover:bg-slate-50/60 lg:grid-cols-[minmax(180px,0.95fr)_minmax(0,1.6fr)_96px_168px] lg:gap-x-4">
                    <div className="order-1 flex min-w-0 items-center gap-2.5">
                      <span translate="no" className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-teal-50 text-[10px] font-semibold text-teal-700">{userInitials(job.patientName)}{avatar && <img alt="" src={avatar} className="absolute inset-0 h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />}</span>
                      <div className="min-w-0">
                        {isClaim ? <p className="truncate text-[13px] font-semibold text-slate-800">{job.patientName}</p> : <Link href={doctorChartHref(job.patientId)} className="block truncate text-[13px] font-semibold text-slate-800 hover:text-teal-700 hover:underline">{job.patientName}</Link>}
                        <p className="mt-0.5 truncate text-[11px] text-slate-400">{job.patientAge != null ? `${job.patientAge} tuổi` : ""}{job.patientGender ? ` · ${job.patientGender}` : ""}<span className="hidden xl:inline" title={job.patientId}>{job.patientAge != null || job.patientGender ? " · " : ""}{job.patientId.length > 10 ? `…${job.patientId.slice(-6)}` : job.patientId}</span><span className="lg:hidden"> · {relativeTime(job.sortAt)}</span></p>
                      </div>
                    </div>
                    <div className="order-3 col-span-2 min-w-0 lg:order-2 lg:col-span-1">
                      <div className="mb-1 flex items-center gap-2"><span className={`inline-flex max-w-full items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-tight ${meta.chipClass}`}>{meta.label}</span>{job.urgency === "urgent" && <span className="text-[10px] font-medium text-amber-700">Ưu tiên</span>}</div>
                      <p className="line-clamp-2 text-[13px] font-medium leading-snug text-slate-700" title={job.title}>{job.title}</p>
                      <p className="mt-0.5 truncate text-[11px] leading-relaxed text-slate-400" title={job.subtitle}>{job.subtitle}</p>
                    </div>
                    <time dateTime={job.sortAt || undefined} title={job.sortAt ? new Date(job.sortAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : undefined} className="order-3 hidden text-[11px] text-slate-400 lg:block">{relativeTime(job.sortAt)}</time>
                    <div className="order-2 flex items-center justify-end gap-2 lg:order-4">
                      {isClaim ? (
                        <button type="button" onClick={() => onClaim(job)} disabled={Boolean(claimingId)} className="flex h-9 items-center gap-1.5 rounded-md bg-[#0f766e] px-3 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-50 lg:h-8">{claimBusy ? "Đang nhận…" : job.cta}{claimBusy ? <RefreshCw size={13} className="animate-spin" /> : <ArrowRight size={13} />}</button>
                      ) : (
                        <>
                          <Link href={href} className="flex h-9 items-center gap-1.5 whitespace-nowrap rounded-md bg-[#0f766e] px-3 text-xs font-medium text-white hover:bg-teal-800 lg:h-8">{job.cta}<ArrowRight size={13} /></Link>
                          <Link href={doctorChartHref(job.patientId)} aria-label={`Hồ sơ bệnh nhân ${job.patientName}`} title="Hồ sơ bệnh nhân" className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-400 hover:border-teal-300 hover:text-teal-700 sm:flex"><ExternalLink size={13} /></Link>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {total > pageSize && <Pagination page={page} totalItems={total} pageSize={pageSize} onPageChange={onPage} />}
          </>
        )}
      </section>
    </main>
  );
}
