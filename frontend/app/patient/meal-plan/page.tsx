"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { ApiError, type MealPlanOutput, type MealPlanScheduleOut } from "@/lib/types";
import { WeeklyMealPlanCard } from "@/components/patient-chat/cards/WeeklyMealPlanCard";
import { parseFlexibleDate, planUsageFromPlan } from "@/lib/plan-expiry";
import { useVietnamToday } from "@/lib/use-vietnam-today";
import { selectCreationPlan } from "@/lib/meal-plan-workflow";
import { usePatientPanel } from "@/components/patient-chat/PatientPanelProvider";

const PRIORITIES = ["Dễ chế biến", "Đa dạng món ăn", "Ưu tiên món Việt"];

export default function PatientMealPlanPage() {
  const { openPanel } = usePatientPanel();
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const doctor = useAuthStore((s) => s.assignedDoctor);
  const today = useVietnamToday();
  const [schedule, setSchedule] = useState<MealPlanScheduleOut | null>(null);
  const [plan, setPlan] = useState<MealPlanOutput | null>(null);
  const [notes, setNotes] = useState("");
  const [priorities, setPriorities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (!token || role !== "patient") return;
    setLoading(true);
    try {
      const nextSchedule = await api.getMyMealPlanSchedule();
      setSchedule(nextSchedule);
      setPlan(selectCreationPlan(nextSchedule));
      setLoadFailed(false);
    } catch (err) {
      setLoadFailed(true);
      setError(err instanceof ApiError ? err.message : "Không tải được trạng thái thực đơn. Vui lòng làm mới.");
    } finally {
      setLoading(false);
    }
  }, [token, role]);

  useEffect(() => { void load(); }, [load, today]);

  // The server is authoritative; this also prevents accidental duplicate clicks.
  const blockedPlan = schedule?.unassigned_plans.find((p) =>
    p.id === plan?.id && ["pending_review", "approved", "edited"].includes(p.status)
  );
  const pending = plan?.status === "pending_review";
  const rejected = plan?.status === "rejected";
  const approved = plan?.status === "approved" || plan?.status === "edited";
  const applied = approved && Boolean(plan?.starts_on);
  const usage = plan ? planUsageFromPlan(plan, { today: parseFlexibleDate(today)! }) : "none";
  const completed = usage === "finished";
  const upcoming = usage === "upcoming";
  const needsRenewal = !plan && !loading && !loadFailed;
  const blockedMessage = blockedPlan?.status === "pending_review"
    ? "Bạn đã có bản dự thảo chờ bác sĩ duyệt. Hãy chờ kết quả trước khi tạo thêm."
    : blockedPlan
      ? "Bác sĩ đã duyệt thực đơn và đang sắp lịch áp dụng. Bạn chưa cần tạo thêm bản mới."
      : null;

  const generate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current || loading || loadFailed || blockedPlan) return;
    inFlight.current = true;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const draft = await api.generateMealPlan({ notes: notes.trim(), priorities });
      setPlan(draft);
      setSchedule((previous) => previous
        ? { ...previous, unassigned_plans: [draft, ...previous.unassigned_plans] }
        : previous);
      setNotice("AI đã tạo bản dự thảo 7 ngày. Thực đơn đang chờ bác sĩ kiểm tra và duyệt.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Chưa tạo được thực đơn. Vui lòng thử lại.");
      if (err instanceof ApiError && err.status === 409) await load();
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  if (!token || role !== "patient") {
    return <div className="p-8"><Link className="text-teal-700 underline" href="/login">Đăng nhập tài khoản bệnh nhân để tạo thực đơn</Link></div>;
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8 md:pr-24">
      <div className="max-w-5xl mx-auto space-y-5 pb-24">
        <Link href="/patient" className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-800">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span> Trở về trò chuyện
        </Link>
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-teal-700">Thực đơn của tôi</p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900">Tạo thực đơn bằng AI</h1>
            <p className="mt-2 text-sm text-slate-600 max-w-2xl">Bạn yêu cầu AI tạo bản dự thảo. Bác sĩ kiểm tra, chỉnh sửa và duyệt trước khi thực đơn được áp dụng.</p>
          </div>
          <button type="button" disabled={loading || submitting} onClick={() => { setError(null); void load(); }} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-teal-800 disabled:opacity-50">
            {loading ? "Đang tải…" : "Làm mới trạng thái"}
          </button>
        </header>

        <ol aria-label="Quy trình thực đơn" className="grid grid-cols-1 lg:grid-cols-3 gap-3 text-sm">
          {["1. Bạn yêu cầu AI tạo", "2. Bác sĩ kiểm tra và duyệt", "3. Áp dụng thực đơn đã duyệt"].map((step) => <li key={step} className="rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 font-semibold text-teal-900">{step}</li>)}
        </ol>

        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
        {notice && <p role="status" className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">{notice}</p>}
        {needsRenewal && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-bold">Bạn chưa tạo thực đơn cho chu kỳ mới.</p>
          <p className="mt-1">Hãy tạo thực đơn mới cho 7 ngày tiếp theo để bác sĩ kiểm tra và duyệt. Các bản cũ được lưu trong Nhật ký.</p>
          <a href="#new-meal-plan" className="mt-2 inline-block font-bold underline">Tạo thực đơn mới</a>
        </div>}
        <button type="button" onClick={() => openPanel("menu")} className="text-sm font-semibold text-teal-800 underline">Xem Nhật ký thực đơn</button>

        {plan && (
          <section aria-label="Trạng thái thực đơn" className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2">
            <h2 className="font-bold text-slate-900">{pending ? "Chờ bác sĩ duyệt" : rejected ? "Bản dự thảo chưa được chấp thuận" : completed ? "Hoàn thành chu kỳ thực đơn" : upcoming ? "Thực đơn đã được xếp lịch cho chu kỳ tới" : applied ? "Thực đơn đang áp dụng" : "Đã duyệt · Chờ áp dụng"}</h2>
            <p className="text-sm text-slate-600">{pending
              ? "Đây là bản AI đề xuất để xem trước, chưa phải thực đơn chính thức. Bác sĩ có thể điều chỉnh món ăn trước khi duyệt."
              : rejected
                ? "Bạn có thể cập nhật ghi chú bên dưới và yêu cầu AI tạo bản dự thảo khác để bác sĩ xem lại."
                : completed
                  ? `Chu kỳ ${plan.starts_on} – ${plan.ends_on} đã kết thúc. Lịch cũ được giữ lại để bạn xem lại.`
                : applied
                  ? `Thời gian áp dụng: ${plan.starts_on} – ${plan.ends_on}.`
                  : "Thực đơn đã được kiểm tra. Bác sĩ sẽ chọn lịch áp dụng phù hợp cho bạn."}</p>
            {rejected && plan.review_notes && <p className="text-sm text-rose-800">Ghi chú của bác sĩ: {plan.review_notes}</p>}
            <p className="text-xs text-slate-500">{doctor ? `Bác sĩ phụ trách: ${doctor.full_name || "Bác sĩ điều trị"}` : "Bạn chưa được phân công bác sĩ. Bản dự thảo sẽ được kiểm tra sau khi bác sĩ tiếp nhận hồ sơ."}</p>
          </section>
        )}

        <form id="new-meal-plan" onSubmit={(event) => void generate(event)} aria-busy={submitting} className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-slate-900">{plan ? "Yêu cầu bản dự thảo mới" : "Tạo thực đơn cá nhân hóa 7 ngày"}</h2>
            <Link href="/patient/profile" className="text-sm font-semibold text-teal-700 underline">Kiểm tra hồ sơ sức khỏe</Link>
          </div>
          <p className="text-sm text-slate-600">AI sử dụng bệnh lý, thuốc, dị ứng và các giới hạn dinh dưỡng đã được xác nhận trong hồ sơ của bạn.</p>
          <label className="block text-sm font-semibold text-slate-800" htmlFor="meal-plan-notes">Sở thích và ghi chú cho AI</label>
          <textarea id="meal-plan-notes" value={notes} onChange={(event) => setNotes(event.target.value)} disabled={submitting} rows={3} maxLength={2000} placeholder="Ví dụ: Tôi thích món Việt, muốn các món dễ chuẩn bị…" className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" />
          <fieldset disabled={submitting} className="space-y-2">
            <legend className="text-sm font-semibold text-slate-800">Ưu tiên của bạn (tùy chọn)</legend>
            <div className="flex flex-wrap gap-3">
              {PRIORITIES.map((priority) => <label key={priority} className="inline-flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={priorities.includes(priority)} onChange={(event) => setPriorities((previous) => event.target.checked ? [...previous, priority] : previous.filter((item) => item !== priority))} />{priority}</label>)}
            </div>
          </fieldset>
          {blockedMessage && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{blockedMessage}</p>}
          <button type="submit" disabled={loading || submitting || loadFailed || Boolean(blockedPlan)} className="inline-flex items-center gap-2 rounded-xl bg-[#006857] px-5 py-3 text-sm font-bold text-white hover:bg-[#005245] disabled:cursor-not-allowed disabled:opacity-50">
            <span className={`material-symbols-outlined text-[20px] ${submitting ? "animate-spin" : ""}`}>{submitting ? "progress_activity" : "auto_awesome"}</span>
            {submitting ? "AI đang tạo bản dự thảo…" : rejected ? "Tạo lại thực đơn bằng AI" : completed ? "Tạo thực đơn mới" : "Tạo thực đơn bằng AI"}
          </button>
          <p className="text-xs text-slate-500">Bản mới tự động chuyển vào hàng đợi kiểm duyệt. Bạn không cần gửi thêm yêu cầu cho bác sĩ tạo thực đơn.</p>
        </form>

        {plan && !rejected && <section aria-label={pending ? "Xem trước bản dự thảo AI" : "Chi tiết thực đơn"}><WeeklyMealPlanCard key={plan.id} plan={plan} /></section>}
        {schedule?.active_plan && plan?.id !== schedule.active_plan.id && <section aria-label="Thực đơn đang áp dụng"><h2 className="mb-3 text-lg font-bold text-slate-900">Thực đơn đang áp dụng</h2><WeeklyMealPlanCard plan={schedule.active_plan} /></section>}
      </div>
    </div>
  );
}
