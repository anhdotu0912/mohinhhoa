import type { DoctorPatientSummary } from "@/lib/types";

type ExpiryFields = Pick<
  DoctorPatientSummary,
  "plan_expiry" | "plan_days_left" | "plan_end_date"
>;

export function PlanExpiryBadge({ expiry }: { expiry: ExpiryFields | null }) {
  if (!expiry?.plan_expiry || expiry.plan_expiry === "none") {
    return <span className="text-on-surface-variant text-xs">—</span>;
  }

  if (expiry.plan_expiry === "ok") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/70 whitespace-nowrap">
        Còn {expiry.plan_days_left ?? "?"} ngày
      </span>
    );
  }

  if (expiry.plan_expiry === "expiring") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200/70 whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        Còn {expiry.plan_days_left ?? "?"} ngày (đến {expiry.plan_end_date ?? "—"})
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/70 whitespace-nowrap">
      <span className="material-symbols-outlined text-[14px]">event_busy</span>
      Hết hạn {expiry.plan_end_date ?? "—"}
    </span>
  );
}
