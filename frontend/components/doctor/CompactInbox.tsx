"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarClock, ClipboardCheck, ExternalLink, FileCheck2, Inbox, MessageSquare, RefreshCw, Search, UserPlus, X, Zap } from "lucide-react";
import Pagination from "@/components/shared/Pagination";
import { resolveUserAvatar, userInitials } from "@/lib/avatar";
import { INBOX_TYPE_META, type InboxJob } from "@/lib/doctor-inbox";
import { doctorChartHref, doctorInboxHref, type InboxJobType } from "@/lib/doctor-routes";
import { messageTimeIso, relativeMessageTime, vietnamMessageDateTime } from "@/lib/message-time";
import { useCurrentTime } from "@/lib/use-current-time";

const FILTERS: { id: "all" | InboxJobType; label: string }[] = [
  { id: "all", label: "Tất cả công việc" },
  { id: "plan_review", label: "Chờ duyệt thực đơn" },
  { id: "constraints", label: "Xác nhận ràng buộc" },
  { id: "chat_escalation", label: "Hỏi bác sĩ" },
  { id: "plan_expiry", label: "Chu kỳ thực đơn" },
  { id: "generate_request", label: "Yêu cầu hỗ trợ" },
  { id: "patient_claim", label: "Chờ nhận bệnh nhân" },
];

export function CompactInbox({
  jobs, counts, urgentCount, total, page, pageSize, activeType, urgencyFilter,
  searchQuery, loading, refreshing, error, claimingId, onSearch, onRefresh, onClaim, onPage, onOpenChat,
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
  onOpenChat?: (id: string) => void;
}) {
  const router = useRouter();
  const now = useCurrentTime();
  const busy = loading || refreshing;
  const summary = [
    { label: "Cần xử lý sớm", value: urgentCount, note: "công việc", icon: Zap, color: "border-rose-200/70 bg-rose-50/50 hover:border-rose-400", iconColor: "bg-rose-100 text-rose-700", valueColor: "text-rose-800", href: urgencyFilter ? doctorInboxHref("all") : doctorInboxHref("all", { urgency: "soon" }), active: urgencyFilter },
    { label: "Chờ duyệt", value: counts.plan_review, note: "thực đơn", icon: ClipboardCheck, color: "border-amber-200/70 bg-amber-50/60 hover:border-amber-400", iconColor: "bg-amber-100 text-amber-700", valueColor: "text-amber-800", href: doctorInboxHref("plan_review"), active: activeType === "plan_review" },
    { label: "Ràng buộc", value: counts.constraints, note: "hồ sơ", icon: FileCheck2, color: "border-sky-200/70 bg-sky-50/60 hover:border-sky-400", iconColor: "bg-sky-100 text-sky-700", valueColor: "text-sky-800", href: doctorInboxHref("constraints"), active: activeType === "constraints" },
    { label: "Hỏi bác sĩ", value: counts.chat_escalation, note: "câu hỏi", icon: MessageSquare, color: "border-teal-200/70 bg-teal-50/60 hover:border-teal-400", iconColor: "bg-teal-100 text-teal-700", valueColor: "text-teal-800", href: doctorInboxHref("chat_escalation"), active: activeType === "chat_escalation" },
    { label: "Chu kỳ thực đơn", value: counts.plan_expiry, note: "công việc", icon: CalendarClock, color: "border-emerald-200/70 bg-emerald-50/60 hover:border-emerald-400", iconColor: "bg-emerald-100 text-emerald-700", valueColor: "text-emerald-800", href: doctorInboxHref("plan_expiry"), active: activeType === "plan_expiry" },
    { label: "Chờ nhận", value: counts.patient_claim, note: "bệnh nhân", icon: UserPlus, color: "border-violet-200/70 bg-violet-50/50 hover:border-violet-400", iconColor: "bg-violet-100 text-violet-700", valueColor: "text-violet-800", href: doctorInboxHref("patient_claim"), active: activeType === "patient_claim" },
  ];

  return (
    <main className="mx-auto w-full max-w-[1240px] flex-1 space-y-4 px-4 py-5 sm:px-6">
      <header className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div className="min-w-0">
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-slate-900">Việc cần xử lý</h1>
        </div>
        <div className="flex w-full items-center gap-2 lg:w-auto">
          <div className="relative min-w-0 flex-1 lg:w-64 lg:flex-none">
            <label className="sr-only" htmlFor="inbox-search">Tìm công việc theo tên, mã bệnh nhân hoặc bệnh lý</label>
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input id="inbox-search" type="search" role="searchbox" value={searchQuery} onChange={(e) => onSearch(e.target.value)} autoComplete="off" placeholder="Tìm tên, mã BN, bệnh lý…" className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 [&::-webkit-search-cancel-button]:appearance-none" />
            {searchQuery && <button type="button" aria-label="Xóa tìm kiếm" onClick={() => onSearch("")} className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100"><X size={14} /></button>}
          </div>
          <button type="button" onClick={onRefresh} disabled={busy} title="Làm mới hàng việc" aria-label="Làm mới hàng việc" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-teal-700 disabled:opacity-50"><RefreshCw size={15} className={busy ? "animate-spin" : ""} /></button>
          <Link href="/doctor/patients" className="flex h-9 shrink-0 items-center gap-2 rounded-lg bg-[#0f766e] px-3 text-xs font-medium text-white hover:bg-teal-800"><ClipboardCheck size={15} /><span className="hidden sm:inline">Kiểm tra thực đơn</span><span className="sm:hidden">Thực đơn</span></Link>
        </div>
      </header>

      <section aria-label="Thống kê công việc" className="flex flex-wrap items-stretch justify-center gap-2.5">
        {summary.map((item) => (
          <Link key={item.label} href={item.href} aria-current={item.active ? "true" : undefined} className={`flex w-fit max-w-full flex-none items-center gap-2.5 rounded-xl border px-3 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${item.color} ${item.active ? "ring-2 ring-teal-600/30 ring-offset-1" : ""}`}>
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.iconColor}`}><item.icon size={19} strokeWidth={1.8} /></span>
            <div><p className="text-[12px] font-semibold text-slate-600">{item.label}</p><div className="mt-1 flex items-baseline gap-1.5"><p className={`text-[27px] font-bold leading-none tabular-nums ${item.valueColor}`}>{loading || error ? "—" : item.value}</p><span className="text-[11px] text-slate-500">{item.note}</span></div></div>
          </Link>
        ))}
      </section>

      <section aria-label="Danh sách công việc" className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.025)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-teal-100/70 bg-teal-50/40 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <label htmlFor="inbox-type" className="sr-only">Lọc loại công việc</label>
            <select id="inbox-type" value={activeType} onChange={(e) => router.push(doctorInboxHref(e.target.value as "all" | InboxJobType, urgencyFilter ? { urgency: "soon" } : undefined))} className="h-8 max-w-[215px] rounded-lg border border-teal-200/70 bg-white px-2 text-xs font-medium text-teal-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10">
              {FILTERS.map((filter) => <option value={filter.id} key={filter.id}>{filter.label} ({counts[filter.id]})</option>)}
            </select>
            {urgencyFilter && <button type="button" onClick={() => router.push(doctorInboxHref(activeType))} className="flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-800" aria-label="Bỏ lọc cần xử lý sớm">Xử lý sớm<X size={12} /></button>}
          </div>
          <p role="status" className="w-fit rounded-md border border-teal-100 bg-white px-2 py-1 text-[11px] text-teal-700">{loading ? "Đang tải…" : error ? "Chưa tải được dữ liệu" : <><strong className="font-semibold text-teal-800">{total}</strong> công việc{total > pageSize ? ` · Trang ${page}/${Math.ceil(total / pageSize)}` : ""}</>}</p>
        </div>

        {error ? (
          <div role="alert" className="flex items-center justify-between gap-3 bg-amber-50 px-4 py-4 text-xs text-amber-900"><span>{error}</span><button type="button" onClick={onRefresh} className="shrink-0 font-semibold underline">Thử lại</button></div>
        ) : loading ? (
          <div className="flex min-h-36 items-center justify-center gap-2 text-sm text-slate-500"><RefreshCw size={17} className="animate-spin" />Đang tải công việc…</div>
        ) : jobs.length === 0 ? (
          <div className="flex min-h-36 flex-col items-center justify-center gap-2 px-5 py-6 text-center"><Inbox size={23} strokeWidth={1.5} className="text-slate-300" /><p className="text-sm font-medium text-slate-600">{searchQuery ? "Không tìm thấy công việc phù hợp" : "Không có công việc trong bộ lọc này"}</p><p className="text-xs text-slate-400">{searchQuery ? "Thử tên, mã bệnh nhân hoặc từ khóa khác." : "Chọn loại công việc khác để xem thêm."}</p>{searchQuery && <button type="button" onClick={() => onSearch("")} className="mt-1 text-xs font-medium text-teal-700">Xóa tìm kiếm</button>}</div>
        ) : (
          <>
            <div aria-hidden="true" className="hidden grid-cols-[200px_minmax(0,1fr)_120px_160px] gap-4 border-b border-slate-100 bg-slate-50/60 px-4 py-2 text-[12px] font-medium text-slate-500 lg:grid"><span>Bệnh nhân</span><span>Công việc</span><span>Cập nhật</span><span className="text-right">Thao tác</span></div>
            <ul data-inbox-rows className="divide-y divide-slate-100">
              {jobs.map((job) => {
                const meta = INBOX_TYPE_META[job.type];
                const avatar = resolveUserAvatar(job.patientAvatar);
                const isClaim = job.type === "patient_claim";
                const claimBusy = claimingId === job.id;
                const href = job.type === "chat_escalation" ? doctorInboxHref(activeType, { urgency: urgencyFilter ? "soon" : undefined, escalation: job.id.replace(/^escalation:/, "") }) : job.href;
                return (
                  <li key={job.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 transition-colors hover:bg-teal-50/30 lg:grid-cols-[200px_minmax(0,1fr)_120px_160px] lg:gap-x-4">
                    <div className="order-1 flex min-w-0 items-center gap-2.5">
                      <span translate="no" className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-teal-100 bg-teal-50 text-[11px] font-semibold text-teal-700">{userInitials(job.patientName)}{avatar && <img alt="" src={avatar} className="absolute inset-0 h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />}</span>
                      <div className="min-w-0">
                        {isClaim ? <p className="truncate text-[14px] font-semibold text-slate-800">{job.patientName}</p> : <Link href={doctorChartHref(job.patientId)} className="block truncate text-[14px] font-semibold text-slate-800 hover:text-teal-700 hover:underline">{job.patientName}</Link>}
                        <p className="mt-0.5 truncate text-[11px] text-slate-400">{job.patientAge != null ? `${job.patientAge} tuổi` : ""}{job.patientGender ? ` · ${job.patientGender}` : ""}<span className="hidden xl:inline" title={job.patientId}>{job.patientAge != null || job.patientGender ? " · " : ""}{job.patientId.length > 10 ? `…${job.patientId.slice(-6)}` : job.patientId}</span><span className="lg:hidden"> · <time dateTime={messageTimeIso(job.sortAt)} title={`${vietnamMessageDateTime(job.sortAt)} (giờ Việt Nam)`}>{relativeMessageTime(job.sortAt, now)}</time></span></p>
                      </div>
                    </div>
                    <div className="order-3 col-span-2 min-w-0 lg:order-2 lg:col-span-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2"><span className={`inline-flex w-fit max-w-full items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-tight ${meta.chipClass}`}>{meta.label}</span>{job.urgency === "urgent" && <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">Ưu tiên</span>}</div>
                      <p className="line-clamp-2 text-[14px] font-medium leading-snug text-slate-700" title={job.title}>{job.title}</p>
                      <p className="mt-0.5 truncate text-[12px] leading-relaxed text-slate-500" title={job.subtitle}>{job.subtitle}</p>
                    </div>
                    <time dateTime={messageTimeIso(job.sortAt)} title={`${vietnamMessageDateTime(job.sortAt)} (giờ Việt Nam)`} className="order-3 hidden text-xs text-slate-600 lg:block">{relativeMessageTime(job.sortAt, now)}<span className="mt-1 block text-[11px] text-slate-500">{vietnamMessageDateTime(job.sortAt, true)}</span></time>
                    <div className="order-2 grid w-[160px] grid-cols-[minmax(0,1fr)_32px] items-center gap-2 lg:order-4">
                      {isClaim ? (
                        <button type="button" onClick={() => onClaim(job)} disabled={Boolean(claimingId)} className="flex h-9 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-[#0f766e] px-2 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-50 lg:h-8">{claimBusy ? "Đang nhận…" : job.cta}{claimBusy ? <RefreshCw size={13} className="shrink-0 animate-spin" /> : <ArrowRight size={13} className="shrink-0" />}</button>
                      ) : (
                        <>
                          <Link href={href} onClick={(event) => { if (job.type === "chat_escalation" && onOpenChat && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) { event.preventDefault(); onOpenChat(job.id.replace(/^escalation:/, "")); } }} className="flex h-9 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-[#0f766e] px-2 text-xs font-medium text-white hover:bg-teal-800 lg:h-8">{job.cta}<ArrowRight size={13} className="shrink-0" /></Link>
                          <Link href={doctorChartHref(job.patientId)} aria-label={`Hồ sơ bệnh nhân ${job.patientName}`} title="Hồ sơ bệnh nhân" className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-md border border-teal-100 bg-teal-50/60 text-teal-600 hover:border-teal-300 hover:text-teal-800 sm:flex"><ExternalLink size={13} /></Link>
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
