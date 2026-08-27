"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { TopBar } from "@/components/shared/TopBar";
import { PlanExpiryBadge } from "@/components/doctor/PlanExpiryBadge";
import { api, assetUrl } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { PatientRecordId } from "@/components/doctor/chart/PatientRecordId";
import {
  CHART_TABS,
  chartTabFromPath,
  doctorChartHref,
  doctorPatientsHref,
  doctorGenerateHref,
  isGeneratePath,
} from "@/lib/doctor-routes";
import { asRouteId } from "@/lib/route-params";
import type { DoctorPatientSummary } from "@/lib/types";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "BN";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

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

function tabIcon(id: string): string {
  switch (id) {
    case "overview":
      return "clinical_notes";
    case "meals":
      return "restaurant";
    case "history":
      return "calendar_month";
    case "compliance":
      return "analytics";
    case "constraints":
      return "rule";
    default:
      return "description";
  }
}

export function PatientChartShell({
  patientId: patientIdProp,
  children,
}: {
  patientId?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const [patient, setPatient] = useState<DoctorPatientSummary | null>(null);

  const routeId = asRouteId(patientIdProp);
  const compact = isGeneratePath(pathname);
  const activeTab = chartTabFromPath(pathname);

  const load = useCallback(async () => {
    if (!token || role !== "doctor" || !routeId) return;
    try {
      const row = await api.getDoctorPatient(routeId);
      setPatient(row);
    } catch {
      setPatient(null);
    }
  }, [token, role, routeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const name = patient?.name || "Hồ sơ bệnh nhân";
  const avatar = resolveAvatar(patient?.avatar);

  return (
    <>
      <TopBar title={compact ? "Tạo thực đơn AI" : "Hồ sơ lâm sàng bệnh nhân"} />

      {/* Modern EHR 2-Tier Sticky Header Bar */}
      <div className="bg-surface-container-lowest/95 backdrop-blur-md border-b border-outline-variant/60 sticky top-16 z-20 shadow-xs">
        <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 md:px-8 flex flex-col">
          {/* TIER 1: Patient Clinical Identity & Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 py-3">
            {/* Left Section: Back link + Avatar + Patient Info */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Link
                href={
                  compact && routeId
                    ? doctorChartHref(routeId, "overview")
                    : doctorPatientsHref()
                }
                className="inline-flex items-center gap-1.5 text-on-surface-variant hover:text-primary transition-all shrink-0 text-xs font-bold px-2.5 py-1.5 rounded-lg border border-outline-variant/60 hover:bg-surface-container-low hover:border-primary/40 shadow-2xs cursor-pointer active:scale-95"
                title={compact ? "Quay lại Hồ sơ" : "Quay lại Danh sách bệnh nhân"}
              >
                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                <span>{compact ? "Hồ sơ" : "Danh sách"}</span>
              </Link>

              <div className="h-6 w-px bg-outline-variant/60 hidden sm:block shrink-0" />

              {patient ? (
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Patient Avatar */}
                  <div className="relative w-10 h-10 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs overflow-hidden">
                    {initials(name)}
                    {avatar ? (
                      <img
                        src={avatar}
                        alt=""
                        className="absolute inset-0 w-full h-full rounded-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : null}
                  </div>

                  {/* Patient Details: Line 1 (Name & Age/Gender) + Line 2 (Record ID & Medical Condition) */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-sm text-on-surface truncate tracking-tight capitalize leading-tight">
                        {name}
                      </p>
                      {patient.age ? (
                        <span className="text-[11px] font-semibold text-on-surface-variant bg-surface-container-low px-2 py-0.5 rounded-md border border-outline-variant/40 shrink-0">
                          {patient.age}t · {patient.gender === "male" ? "Nam" : patient.gender === "female" ? "Nữ" : patient.gender}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2 mt-1 min-w-0 flex-wrap">
                      <PatientRecordId id={patient.id} compact />
                      {patient.condition_label && patient.condition_label !== "Chưa khai báo bệnh lý" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md font-semibold truncate max-w-[280px]">
                          <span className="material-symbols-outlined text-[13px]">medical_information</span>
                          <span className="truncate">{patient.condition_label}</span>
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant animate-pulse py-1">
                  <span className="material-symbols-outlined text-[18px] text-primary animate-spin">
                    progress_activity
                  </span>
                  <span>{compact ? "Đang thiết lập tạo thực đơn AI..." : "Đang tải hồ sơ lâm sàng..."}</span>
                </div>
              )}
            </div>

            {/* Right Section: Plan Expiry Badge + Quick Action (Tạo thực đơn AI) */}
            <div className="flex items-center gap-2.5 shrink-0">
              {patient?.plan_expiry && patient.plan_expiry !== "none" && (
                <PlanExpiryBadge
                  expiry={{
                    plan_expiry: patient.plan_expiry,
                    plan_days_left: patient.plan_days_left ?? null,
                    plan_end_date: patient.plan_end_date ?? null,
                  }}
                />
              )}

              {!compact && routeId && (
                <Link
                  href={doctorGenerateHref(routeId)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer shrink-0"
                >
                  <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                  <span className="hidden sm:inline">Tạo thực đơn AI</span>
                  <span className="sm:hidden">Tạo AI</span>
                </Link>
              )}
            </div>
          </div>

          {!compact && routeId && (
            <div className="pb-3">
              <div
                role="tablist"
                aria-label="Phần hồ sơ bệnh nhân"
                className="flex w-full min-w-0 flex-nowrap gap-0.5 overflow-x-auto p-1 rounded-xl bg-surface-container-low border border-outline-variant/50 custom-scrollbar"
              >
                {CHART_TABS.map((tab) => {
                  const selected = activeTab === tab.id;
                  return (
                    <Link
                      key={tab.id}
                      role="tab"
                      aria-selected={selected}
                      aria-current={selected ? "page" : undefined}
                      href={doctorChartHref(routeId, tab.id)}
                      className={`flex flex-1 min-w-[9rem] items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
                        selected
                          ? "bg-primary text-on-primary font-bold shadow-[0_1px_2px_rgba(18,28,42,0.18)]"
                          : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-lowest/80"
                      }`}
                    >
                      <span
                        className="material-symbols-outlined text-[16px] shrink-0"
                        style={{
                          fontVariationSettings: selected
                            ? "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 20"
                            : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20",
                        }}
                      >
                        {tabIcon(tab.id)}
                      </span>
                      <span>{tab.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {children}
    </>
  );
}
