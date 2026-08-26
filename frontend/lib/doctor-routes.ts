/** Canonical doctor-shell paths after the roster → chart + inbox IA. */

function enc(id: string): string {
  return encodeURIComponent(id);
}

export const CHART_TABS = [
  { id: "overview", label: "Tổng quan", suffix: "" },
  { id: "meals", label: "Thực đơn", suffix: "/meals" },
  { id: "constraints", label: "Ràng buộc", suffix: "/constraints" },
  { id: "compliance", label: "Tuân thủ", suffix: "/compliance" },
  { id: "history", label: "Lịch sử", suffix: "/history" },
] as const;

export type ChartTabId = (typeof CHART_TABS)[number]["id"];

export type InboxJobType =
  | "plan_review"
  | "constraints"
  | "generate_request"
  | "plan_expiry";

export function doctorPatientsHref(): string {
  return "/doctor/patients";
}

export function doctorInboxHref(
  type?: InboxJobType | "all",
  opts?: { urgency?: "soon" }
): string {
  const params = new URLSearchParams();
  if (type && type !== "all") params.set("type", type);
  if (opts?.urgency) params.set("urgency", opts.urgency);
  const qs = params.toString();
  return qs ? `/doctor/inbox?${qs}` : "/doctor/inbox";
}

export function doctorChartHref(
  patientId: string,
  tab: ChartTabId = "overview"
): string {
  const spec = CHART_TABS.find((t) => t.id === tab) ?? CHART_TABS[0];
  return `/doctor/patients/${enc(patientId)}${spec.suffix}`;
}

export function doctorGenerateHref(patientId: string, query?: string): string {
  const base = `/doctor/patients/${enc(patientId)}/generate`;
  return query ? `${base}?${query}` : base;
}

export function doctorReviewHref(patientId: string, planId: string): string {
  return `/doctor/reviews/${enc(patientId)}/${enc(planId)}`;
}

export function isGeneratePath(pathname: string | null | undefined): boolean {
  return Boolean(pathname?.includes("/generate"));
}

export function chartTabFromPath(pathname: string | null | undefined): ChartTabId {
  if (!pathname) return "overview";
  if (pathname.includes("/meals")) return "meals";
  if (pathname.includes("/constraints")) return "constraints";
  if (pathname.includes("/compliance")) return "compliance";
  if (pathname.includes("/history")) return "history";
  return "overview";
}
