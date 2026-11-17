"use client";

import Link from "next/link";
import type { FoodLogEntry, MealPlanOutput } from "@/lib/types";
import { patientMealProgress } from "@/lib/patient-meal-progress";

export function DailyMealProgress({ plan, logs, today, loading, error, onRetry, onRecord, onNavigate }: {
  plan: MealPlanOutput | null; logs: FoodLogEntry[]; today: string; loading: boolean;
  error: string | null; onRetry: () => void; onRecord: () => void; onNavigate: () => void;
}) {
  const progress = patientMealProgress(plan, today, logs);
  const complete = progress.total > 0 && progress.recorded === progress.total;
  const label = complete ? progress.custom ? "Đã ghi đủ · Có bữa ăn khác" : "Đã ghi đủ · Ăn đúng thực đơn" : progress.recorded ? `Còn ${progress.total - progress.recorded} bữa chưa ghi` : "Chưa ghi bữa nào";
  return <section aria-labelledby="daily-meal-progress-heading" className="space-y-3 rounded-xl border border-teal-100 bg-teal-50/40 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 id="daily-meal-progress-heading" className="flex items-center gap-2 text-sm font-bold text-slate-900"><span className="material-symbols-outlined text-[20px] text-teal-700">fact_check</span>Ghi nhận hôm nay</h3>
      {!loading && !error && plan && progress.total > 0 && <span role="status" className={`w-fit rounded-md border px-2 py-1 text-[11px] font-semibold ${complete ? progress.custom ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-600"}`}>{label}</span>}
    </div>
    {loading ? <p role="status" className="text-xs text-slate-500">Đang tải ghi nhận bữa ăn…</p> : error ? <div role="alert" className="text-xs text-amber-800"><p>{error}</p><button type="button" onClick={onRetry} className="mt-2 font-semibold underline">Tải lại ghi nhận</button></div> : !plan ? <>
      <p className="text-[13px] leading-relaxed text-slate-600">Bạn chưa có thực đơn đang áp dụng hôm nay. Bản cũ trong Nhật ký chỉ để xem lại, chưa thể dùng để xác nhận đã ăn theo thực đơn hôm nay.</p>
      <Link href="/patient/meal-plan" onClick={onNavigate} className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800">Tạo / xem trạng thái thực đơn<span className="material-symbols-outlined text-[15px]">arrow_forward</span></Link>
    </> : progress.total === 0 ? <p className="text-xs text-slate-600">Chưa có thông tin các bữa ăn của hôm nay trong lịch áp dụng.</p> : <>
      <p className="text-[13px] text-slate-700"><strong>{progress.recorded}/{progress.total} bữa đã ghi</strong> · {progress.planned} ăn đúng · {progress.custom} ăn khác</p>
      <div role="progressbar" aria-label="Tiến độ ghi nhận bữa ăn hôm nay" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.recorded} className="h-2 overflow-hidden rounded-full bg-slate-200/70"><div className="h-full rounded-full bg-sky-600 transition-[width]" style={{ width: `${progress.recorded / progress.total * 100}%` }} /></div>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">{progress.meals.map(({ slot, label: mealLabel, log }) => <li key={slot} className={`rounded-lg border px-2.5 py-2 text-xs ${log?.type === "as_planned" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : log ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-white text-slate-600"}`}><p className="font-semibold">{mealLabel}</p><p className="mt-1 flex items-center gap-1 text-[11px]"><span className="material-symbols-outlined text-[14px]">{log?.type === "as_planned" ? "check_circle" : log ? "edit_note" : "schedule"}</span>{log?.type === "as_planned" ? "Đã ăn đúng" : log ? "Đã ăn khác" : "Chưa ghi"}</p></li>)}</ul>
      <p className="text-xs leading-relaxed text-slate-500">Sau mỗi bữa, chọn “Đã ăn theo thực đơn” hoặc “Đã ăn khác” và nhập món thực tế. Bữa chưa ghi chưa cho biết bạn đã ăn đúng hay sai.</p>
      <button type="button" onClick={onRecord} className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-teal-200 bg-white px-3 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-50">{complete ? "Xem các bữa hôm nay" : "Ghi nhận bữa ăn hôm nay"}<span className="material-symbols-outlined text-[15px]">arrow_downward</span></button>
    </>}
  </section>;
}
