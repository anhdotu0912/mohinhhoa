"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUpRight, CalendarDays, ChevronRight, ClipboardCheck, Clock3, Inbox, MessageSquare, RefreshCw, Users } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { buildInboxJobs, type InboxJob } from "@/lib/doctor-inbox";
import { doctorChartHref, doctorInboxHref } from "@/lib/doctor-routes";
import { complianceWeek, shortDashboardDate } from "@/lib/doctor-dashboard";
import { useVietnamToday } from "@/lib/use-vietnam-today";
import { userInitials } from "@/lib/avatar";
import type { ClaimQueueItem, DoctorPatientSummary, EscalationListItem, MealPlanOutput, PatientComplianceOut } from "@/lib/types";

type DashboardData = {
  patients: DoctorPatientSummary[] | null;
  plans: MealPlanOutput[] | null;
  claims: ClaimQueueItem[] | null;
  escalations: EscalationListItem[] | null;
  errors: string[];
  updatedAt: Date | null;
};
type TaskFilter = "all" | "plans" | "messages" | "other";
const subscribe = () => () => {};
const panelClass = "min-w-0 rounded-xl border border-slate-200/80 bg-white";
const emptyData: DashboardData = { patients: null, plans: null, claims: null, escalations: null, errors: [], updatedAt: null };
const taskLabels: Record<InboxJob["type"], string> = {
  plan_review: "Duyệt thực đơn", constraints: "Xác nhận ràng buộc", generate_request: "Hỗ trợ thực đơn",
  plan_expiry: "Theo dõi chu kỳ", patient_claim: "Tiếp nhận bệnh nhân", chat_escalation: "Trả lời bệnh nhân",
};
const isMealTask = (job: InboxJob) => ["plan_review", "plan_expiry", "generate_request"].includes(job.type);

function Avatar({ name }: { name: string }) {
  return <span translate="no" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[12px] font-semibold text-slate-600">{userInitials(name)}</span>;
}

function EmptyBlock({ children, loading = false }: { children: React.ReactNode; loading?: boolean }) {
  return <div className="flex min-h-[150px] flex-col items-center justify-center gap-2 px-6 py-8 text-center text-sm text-slate-500">{loading ? <RefreshCw size={19} className="animate-spin text-slate-400" /> : <Inbox size={20} className="text-slate-400" />}<span>{children}</span></div>;
}

export default function DoctorDashboardPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const today = useVietnamToday();
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [complianceLoading, setComplianceLoading] = useState(true);
  const [compliance, setCompliance] = useState<PatientComplianceOut[]>([]);
  const [complianceFailures, setComplianceFailures] = useState(0);
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [previousWeek, setPreviousWeek] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    if (!token || role !== "doctor") return;
    const request = ++requestRef.current;
    setLoading(true);
    setComplianceLoading(true);
    setSelectedDate(null);
    const [patientsResult, plansResult, claimsResult, messagesResult] = await Promise.allSettled([
      api.listDoctorPatients(), api.listDoctorMealPlans("all"), api.listClaimQueue(), api.listDoctorEscalations("open"),
    ]);
    if (request !== requestRef.current) return;
    const patients = patientsResult.status === "fulfilled" ? patientsResult.value : null;
    const errors = [
      patientsResult.status === "rejected" ? "danh sách bệnh nhân" : null,
      plansResult.status === "rejected" ? "thực đơn" : null,
      claimsResult.status === "rejected" ? "yêu cầu tiếp nhận" : null,
      messagesResult.status === "rejected" ? "tin nhắn" : null,
    ].filter((value): value is string => value != null);
    setData({ patients, plans: plansResult.status === "fulfilled" ? plansResult.value : null,
      claims: claimsResult.status === "fulfilled" ? claimsResult.value : null,
      escalations: messagesResult.status === "fulfilled" ? messagesResult.value : null,
      errors, updatedAt: new Date() });
    setLoading(false);
    // Read every assigned patient, with bounded concurrency; do not silently sample ten.
    const rows: PatientComplianceOut[] = [];
    let failures = 0;
    for (let i = 0; i < (patients?.length ?? 0); i += 6) {
      const batch = await Promise.allSettled(patients!.slice(i, i + 6).map((p) => api.getPatientCompliance(p.id, 14)));
      if (request !== requestRef.current) return;
      for (const result of batch) {
        if (result.status === "fulfilled") rows.push(result.value);
        else failures++;
      }
    }
    if (request !== requestRef.current) return;
    setCompliance(rows);
    setComplianceFailures(failures);
    setComplianceLoading(false);
  }, [token, role]);

  useEffect(() => {
    if (!hydrated) return;
    if (!token || role !== "doctor") { router.replace("/login"); return; }
    void load();
    return () => { requestRef.current += 1; };
  }, [hydrated, token, role, load, router, today]);

  const patients = data.patients ?? [];
  const pendingPlans = data.plans?.filter((p) => ["pending", "pending_review"].includes(String(p.status))) ?? [];
  const unanswered = data.escalations?.filter((item) => item.status === "waiting_doctor") ?? [];
  const jobs = useMemo(() => buildInboxJobs(data.patients ?? [], data.plans ?? [], data.claims ?? [], data.escalations?.filter((item) => item.status === "waiting_doctor") ?? []), [data]);
  const visibleJobs = jobs.filter((job) => filter === "all" || (filter === "plans" ? isMealTask(job) : filter === "messages" ? job.type === "chat_escalation" : !isMealTask(job) && job.type !== "chat_escalation"));
  const attention = patients.filter((p) => ["attention", "warning"].includes(p.status_key))
    .sort((a, b) => Number(b.status_key === "warning") - Number(a.status_key === "warning") || b.alert_count - a.alert_count);
  const week = useMemo(() => complianceWeek(compliance, today, previousWeek), [compliance, today, previousWeek]);
  const selectedDay = week.days.find((d) => d.date === selectedDate);
  const activeCount = patients.filter((p) => Boolean(p.active_plan_id)).length;
  const ending = patients.filter((p) => p.plan_expiry === "expiring");
  const ended = patients.filter((p) => p.plan_expiry === "expired" || p.plan_usage === "finished");
  const busy = loading || complianceLoading;
  const firstLoad = !data.updatedAt;
  const todayLabel = new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(`${today}T12:00:00Z`));
  const count = (value: number, available: boolean) => firstLoad || !available ? "—" : value;
  const filters: { id: TaskFilter; label: string; count: number }[] = [
    { id: "all", label: "Tất cả", count: jobs.length },
    { id: "plans", label: "Thực đơn", count: jobs.filter(isMealTask).length },
    { id: "messages", label: "Tin nhắn", count: unanswered.length },
    { id: "other", label: "Khác", count: jobs.filter((job) => !isMealTask(job) && job.type !== "chat_escalation").length },
  ];

  return (
    <>
      <main className="mx-auto w-full max-w-[1480px] flex-1 space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-xs text-slate-500"><CalendarDays size={14} strokeWidth={1.6} /><span className="first-letter:uppercase">{todayLabel}</span></div>
            <h1 className="text-[25px] font-semibold tracking-tight text-slate-900">Tổng quan điều trị</h1>
            <p className="mt-1 text-[14px] text-slate-500">Theo dõi bệnh nhân và các công việc đang chờ xử lý.</p>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button onClick={() => void load()} disabled={busy} type="button" aria-label="Làm mới tổng quan" className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={14} className={busy ? "animate-spin" : ""} />Làm mới</button>
            <Link href="/doctor/inbox" className="flex h-9 items-center gap-2 rounded-lg bg-[#0f766e] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-[#115e59]">Mở hàng việc<ArrowUpRight size={15} /></Link>
          </div>
        </div>

        {data.errors.length > 0 && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900"><span>Chưa tải được {data.errors.join(", ")}. Một số thông tin chưa đầy đủ.</span><button disabled={busy} onClick={() => void load()} className="font-semibold underline">Thử lại</button></div>}

        <section aria-label="Chỉ số tổng quan" className={`${panelClass} grid grid-cols-2 overflow-hidden lg:grid-cols-4`}>
          {[
            { label: "Bệnh nhân đang quản lý", value: count(patients.length, data.patients != null), note: "Danh sách đã tiếp nhận", icon: Users, href: "/doctor/patients" },
            { label: "Thực đơn chờ duyệt", value: count(pendingPlans.length, data.plans != null), note: "Cần bác sĩ kiểm tra", icon: ClipboardCheck, href: doctorInboxHref("plan_review") },
            { label: "Tin nhắn chờ trả lời", value: count(unanswered.length, data.escalations != null), note: "Từ cuộc trao đổi với bệnh nhân", icon: MessageSquare, href: doctorInboxHref("chat_escalation") },
            { label: "Bệnh nhân cần theo dõi", value: count(attention.length, data.patients != null), note: "Theo trạng thái hồ sơ", icon: Clock3, href: "/doctor/patients" },
          ].map((item, i) => <Link key={item.label} href={item.href} className={`group min-w-0 px-4 py-5 transition-colors hover:bg-slate-50 sm:px-5 ${i % 2 ? "border-l border-slate-100" : ""} ${i > 1 ? "border-t border-slate-100 lg:border-t-0" : ""} ${i === 2 ? "lg:border-l" : ""}`}>
            <div className="flex items-center justify-between gap-2"><p className="min-h-[36px] text-[13px] font-medium text-slate-500 sm:min-h-0">{item.label}</p><item.icon size={16} strokeWidth={1.7} className="hidden shrink-0 text-slate-400 sm:block" /></div>
            <p className="mt-3 text-[30px] font-semibold leading-none tracking-tight text-slate-900 tabular-nums">{item.value}</p><p className="mt-2 hidden text-[12px] leading-relaxed text-slate-400 sm:block">{item.note}</p>
          </Link>)}
        </section>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(340px,1fr)]">
          <section className={panelClass} aria-labelledby="dashboard-tasks-heading">
            <div className="flex items-center justify-between gap-3 px-5 py-4"><div><h2 id="dashboard-tasks-heading" className="text-[16px] font-semibold text-slate-900">Việc cần xử lý</h2><p className="mt-1 text-xs text-slate-500">Kiểm tra, phản hồi và theo dõi kế hoạch điều trị.</p></div><span className="flex h-7 min-w-7 items-center justify-center rounded-md bg-slate-100 px-2 text-xs font-semibold text-slate-600">{firstLoad || data.errors.length ? "—" : jobs.length}</span></div>
            <div className="flex justify-between gap-2 overflow-x-auto border-b border-slate-100 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Loại công việc">
              {filters.map((item) => <button type="button" key={item.id} role="tab" aria-selected={filter === item.id} aria-controls="dashboard-task-list" id={`task-tab-${item.id}`} onClick={() => setFilter(item.id)} className={`flex shrink-0 items-center gap-1.5 border-b-2 py-3 text-xs font-medium transition-colors ${filter === item.id ? "border-[#0f766e] text-[#0f766e]" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{item.label}<span className={`rounded px-1.5 py-0.5 text-[11px] tabular-nums ${filter === item.id ? "bg-teal-50" : "bg-slate-50 text-slate-400"}`}>{firstLoad || data.errors.length ? "—" : item.count}</span></button>)}
            </div>
            <div id="dashboard-task-list" role="tabpanel" aria-labelledby={`task-tab-${filter}`}>
              {firstLoad ? <EmptyBlock loading>Đang tải công việc…</EmptyBlock> : visibleJobs.length === 0 ? <EmptyBlock>{data.errors.length ? "Chưa đủ dữ liệu để hiển thị công việc." : filter === "all" ? "Hiện không có công việc đang chờ xử lý." : "Không có công việc trong nhóm này."}</EmptyBlock> : <ul className="divide-y divide-slate-100">
                {visibleJobs.slice(0, 5).map((job) => <li key={job.id}><Link href={job.href || doctorInboxHref(job.type)} className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50/80"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${job.type === "chat_escalation" ? "bg-slate-100 text-slate-500" : "bg-teal-50 text-teal-700"}`}>{job.type === "chat_escalation" ? <MessageSquare size={17} strokeWidth={1.7} /> : job.type === "patient_claim" ? <Users size={17} strokeWidth={1.7} /> : <ClipboardCheck size={17} strokeWidth={1.7} />}</span><div className="min-w-0 flex-1"><p className="truncate text-[14px] font-semibold text-slate-800">{taskLabels[job.type]}<span className="ml-2 font-normal text-slate-500">· {job.patientName}</span></p><p className="mt-1 truncate text-xs text-slate-500">{job.type === "chat_escalation" ? job.title : job.type === "plan_review" ? job.title : job.subtitle}</p></div><span className="hidden shrink-0 text-[12px] text-slate-400 sm:block">{job.type === "chat_escalation" ? "Chờ phản hồi" : "Chờ xử lý"}</span><ChevronRight size={16} className="shrink-0 text-slate-300 group-hover:text-teal-700" /></Link></li>)}
              </ul>}
            </div>
            <Link href={filter === "messages" ? doctorInboxHref("chat_escalation") : "/doctor/inbox"} className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs font-medium text-[#0f766e] hover:bg-teal-50/40"><span>Xem hàng việc đầy đủ</span><ArrowRight size={15} /></Link>
          </section>

          <section className={panelClass} aria-labelledby="dashboard-compliance-heading">
            <div className="px-5 pt-4"><div className="flex items-center justify-between gap-2"><h2 id="dashboard-compliance-heading" className="text-[16px] font-semibold text-slate-900">Tuân thủ dinh dưỡng</h2><span className="text-[11px] text-slate-400">Theo ghi nhận</span></div><div className="mt-4 flex items-center justify-between gap-2"><div className="inline-flex rounded-lg bg-slate-100 p-0.5">{[false, true].map((previous) => <button key={String(previous)} type="button" aria-pressed={previousWeek === previous} onClick={() => { setPreviousWeek(previous); setSelectedDate(null); }} className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${previousWeek === previous ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{previous ? "Tuần trước" : "Tuần này"}</button>)}</div><span className="text-[12px] tabular-nums text-slate-400">{shortDashboardDate(week.start)} – {shortDashboardDate(week.end)}</span></div></div>
            <div className="px-5 pb-4 pt-4">
              <div className="flex items-end justify-between gap-3"><div className="flex items-baseline gap-1"><span className="text-[32px] font-semibold leading-none tracking-tight text-slate-900 tabular-nums">{complianceLoading || week.average == null ? "—" : week.average}</span>{!complianceLoading && week.average != null && <span className="text-sm text-slate-400">%</span>}</div><span className="text-right text-[12px] text-slate-500">{complianceLoading ? "Đang tổng hợp…" : data.patients == null ? "Chưa tải được bệnh nhân" : `${week.patients}/${patients.length} bệnh nhân có ghi nhận`}</span></div>
              {complianceLoading ? <EmptyBlock loading>Đang tải ghi nhận tuân thủ…</EmptyBlock> : week.average == null ? <div className="mt-5 flex h-[150px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-5 text-center"><Inbox size={23} strokeWidth={1.4} className="mb-2 text-slate-300" /><p className="text-xs font-medium text-slate-600">{complianceFailures || data.patients == null ? "Chưa tải được dữ liệu tuân thủ" : "Chưa có ghi nhận trong tuần"}</p><p className="mt-1 text-[12px] leading-relaxed text-slate-400">{complianceFailures || data.patients == null ? "Làm mới để thử tải lại." : "Tỷ lệ sẽ xuất hiện khi bệnh nhân ghi nhận bữa ăn hoặc check-in."}</p></div> : <>
                <div className="relative mt-7 pl-7" aria-label="Biểu đồ tuân thủ theo ngày">
                  <div aria-hidden="true" className="pointer-events-none absolute bottom-[38px] left-0 right-0 top-0 flex flex-col justify-between text-[10px] text-slate-400">{[100, 50, 0].map((tick) => <div key={tick} className="flex items-center gap-2"><span className="w-5 text-right tabular-nums">{tick}</span><span className="flex-1 border-t border-slate-100" /></div>)}</div>
                  <div className="relative grid grid-cols-7 gap-2">
                    {week.days.map((day) => <div key={day.date} className="min-w-0 text-center"><button type="button" disabled={day.future} onMouseEnter={() => setSelectedDate(day.date)} onFocus={() => setSelectedDate(day.date)} onMouseLeave={() => setSelectedDate(null)} onBlur={() => setSelectedDate(null)} onClick={() => setSelectedDate(day.date)} aria-label={`${day.label} ${shortDashboardDate(day.date)}: ${day.future ? "Chưa đến ngày" : day.rate == null ? "Chưa có ghi nhận" : `${day.rate}%, ${day.patients} bệnh nhân`}`} className="relative flex h-[120px] w-full flex-col items-center justify-end rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/30 disabled:cursor-default">
                      {day.rate != null ? <div style={{ height: `${Math.max(day.rate, 2)}%` }} className={`relative w-full max-w-7 rounded-t-[3px] ${day.date === selectedDate ? "bg-teal-600" : "bg-[#83b7ac]"}`}><span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-medium text-slate-600 tabular-nums">{day.rate}%</span></div> : <span className={`mb-0.5 h-1 w-4 rounded-full ${day.future ? "bg-slate-100" : "bg-slate-300"}`} />}
                    </button><p className={`mt-2 text-[11px] ${day.future ? "text-slate-300" : "text-slate-500"}`}>{day.label}</p><p className="mt-0.5 text-[10px] text-slate-400">{shortDashboardDate(day.date)}</p></div>)}
                  </div>
                </div>
                <p className="mt-3 min-h-4 text-center text-[11px] text-slate-500">{selectedDay ? `${shortDashboardDate(selectedDay.date)} · ${selectedDay.future ? "Chưa đến ngày" : selectedDay.rate == null ? "Chưa có ghi nhận" : `${selectedDay.rate}% · ${selectedDay.patients} bệnh nhân`}` : "Trung bình theo ngày · Dấu gạch: chưa có ghi nhận"}</p>
              </>}
              {complianceFailures > 0 && <p role="status" className="mt-3 text-[12px] text-amber-700">Chưa tải được ghi nhận của {complianceFailures} bệnh nhân.</p>}
            </div>
            <p className="border-t border-slate-100 px-5 py-3 text-[11px] leading-relaxed text-slate-400">Ngày chưa ghi nhận không tính vào trung bình.</p>
          </section>
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(340px,1fr)]">
          <section className={panelClass} aria-labelledby="dashboard-patients-heading">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-4"><div><h2 id="dashboard-patients-heading" className="text-[16px] font-semibold text-slate-900">Bệnh nhân cần theo dõi</h2><p className="mt-1 text-xs text-slate-500">Xem hồ sơ và các chỉ số ghi nhận gần nhất.</p></div><Link href="/doctor/patients" aria-label="Xem tất cả bệnh nhân" className="flex shrink-0 items-center gap-1 text-xs font-medium text-teal-700">Tất cả<ArrowUpRight size={14} /></Link></div>
            {firstLoad ? <EmptyBlock loading>Đang tải bệnh nhân…</EmptyBlock> : !data.patients ? <EmptyBlock>Chưa tải được danh sách bệnh nhân.</EmptyBlock> : attention.length === 0 ? <EmptyBlock>Chưa có hồ sơ được đánh dấu cần theo dõi.</EmptyBlock> : <>
              <div aria-hidden="true" className="hidden grid-cols-[minmax(0,1.5fr)_0.65fr_1fr_0.9fr_18px] gap-3 bg-slate-50/60 px-5 py-2.5 text-[11px] font-medium text-slate-400 sm:grid"><span>Bệnh nhân</span><span>BMI</span><span>Đường huyết</span><span>Trạng thái</span><span /></div>
              <ul className="divide-y divide-slate-100">{attention.slice(0, 5).map((p) => <li key={p.id}><Link href={doctorChartHref(p.id)} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50/80 sm:grid-cols-[minmax(0,1.5fr)_0.65fr_1fr_0.9fr_18px]"><div className="flex min-w-0 items-center gap-2.5"><Avatar name={p.name} /><div className="min-w-0"><p className="truncate text-[13px] font-semibold text-slate-800">{p.name}</p><p className="mt-0.5 truncate text-[11px] text-slate-400">{p.condition_label || "Chưa có thông tin bệnh lý"}</p><p className="mt-1 text-[11px] text-slate-500 sm:hidden">BMI {p.bmi?.toFixed(1) ?? "—"} · {p.blood_glucose || "Chưa có đường huyết"}</p></div></div><span className="hidden text-xs text-slate-600 tabular-nums sm:block">{p.bmi?.toFixed(1) ?? "—"}</span><span className="hidden text-[12px] text-slate-600 tabular-nums sm:block">{p.blood_glucose || "—"}</span><span className={`w-fit whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium ${p.status_key === "warning" ? "bg-rose-50 text-rose-700" : "bg-amber-50/70 text-amber-800"}`}>{p.status_key === "warning" ? "Có cảnh báo" : "Cần theo dõi"}</span><ChevronRight size={15} className="hidden text-slate-300 sm:block" /></Link></li>)}</ul>
            </>}
          </section>

          <section className={panelClass} aria-labelledby="dashboard-cycle-heading">
            <div className="px-5 pb-2 pt-4"><h2 id="dashboard-cycle-heading" className="text-[16px] font-semibold text-slate-900">Chu kỳ thực đơn</h2><p className="mt-1 text-xs text-slate-500">Theo lịch áp dụng của bệnh nhân.</p></div>
            <dl className="space-y-3.5 px-5 py-4 text-xs">{[{ label: "Đang áp dụng", value: activeCount, dot: "bg-teal-600" }, { label: "Sắp kết thúc", value: ending.length, dot: "bg-amber-400" }, { label: "Đã kết thúc", value: ended.length, dot: "bg-slate-300" }].map((item) => <div key={item.label} className="flex items-center justify-between"><dt className="flex items-center gap-2 text-slate-500"><span className={`h-1.5 w-1.5 rounded-full ${item.dot}`} />{item.label}</dt><dd className="font-semibold text-slate-800 tabular-nums">{count(item.value, data.patients != null)}<span className="ml-1.5 font-normal text-slate-400">bệnh nhân</span></dd></div>)}</dl>
            {(ending.length > 0 || ended.length > 0) && <div className="border-t border-slate-100 px-5 py-3"><p className="mb-2 text-[11px] font-medium text-slate-400">Cần theo dõi chu kỳ tiếp theo</p>{[...ended, ...ending].slice(0, 3).map((p) => <Link key={p.id} href={doctorChartHref(p.id, "meals")} className="flex items-center justify-between gap-2 py-1.5 text-xs"><span className="truncate text-slate-700">{p.name}</span><span className="flex shrink-0 items-center gap-1 text-[11px] text-slate-400">{p.plan_expiry === "expiring" ? `Còn ${p.plan_days_left ?? "—"} ngày` : "Đã kết thúc"}<ChevronRight size={13} /></span></Link>)}</div>}
            <Link href={doctorInboxHref("plan_expiry")} className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs font-medium text-teal-700 hover:bg-teal-50/40">Theo dõi lịch thực đơn<ArrowRight size={15} /></Link>
          </section>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400"><span>Số liệu từ hồ sơ và ghi nhận của bệnh nhân.</span><span role="status">{busy ? "Đang cập nhật dữ liệu…" : data.updatedAt ? `Cập nhật lúc ${data.updatedAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" })}` : "Đang kết nối…"}</span></div>
      </main>
    </>
  );
}
