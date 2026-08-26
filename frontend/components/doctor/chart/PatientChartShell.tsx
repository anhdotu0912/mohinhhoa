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
      <div className="bg-surface-container-lowest/95 backdrop-blur-md border-b border-outline-variant/60 sticky top-16 z-20 shadow-xs">
        <div className="px-4 sm:px-6 md:px-8 pt-3 pb-2 flex flex-col gap-2.5 max-w-7xl mx-auto w-full">
          <div className="flex items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Link
                href={
                  compact && routeId
                    ? doctorChartHref(routeId, "overview")
                    : doctorPatientsHref()
                }
                className="inline-flex items-center gap-1 text-on-surface-variant hover:text-primary transition-all shrink-0 text-xs font-bold px-2 py-1 rounded-lg hover:bg-surface-container-low"
                title={compact ? "Quay lại Hồ sơ" : "Quay lại Danh sách bệnh nhân"}
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                <span className="hidden sm:inline">
                  {compact ? "Hồ sơ" : "Danh sách"}
                </span>
              </Link>

              <div className="h-4 w-px bg-outline-variant/60 hidden sm:block shrink-0" />

              {patient ? (
                <div className="flex items-center gap-3 min-w-0 flex-1">
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
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-sm text-on-surface truncate tracking-tight capitalize">
                        {name}
                      </p>
                      {patient.age ? (
                        <span className="text-[11px] font-medium text-on-surface-variant bg-surface-container-low px-2 py-0.5 rounded-md border border-outline-variant/40">
                          {patient.age}t · {patient.gender === "male" ? "Nam" : patient.gender === "female" ? "Nữ" : patient.gender}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 mt-1 min-w-0 flex-wrap">
                      <PatientRecordId id={patient.id} compact />
                      {patient.condition_label && patient.condition_label !== "Chưa khai báo bệnh lý" ? (
                        <span className="inline-block text-[11px] text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md font-semibold truncate max-w-[220px]">
                          {patient.condition_label}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs font-semibold text-on-surface-variant animate-pulse">
                  {compact ? "Tạo thực đơn AI..." : "Đang tải hồ sơ lâm sàng..."}
                </p>
              )}
            </div>

            {patient?.plan_expiry && patient.plan_expiry !== "none" && (
              <div className="shrink-0">
                <PlanExpiryBadge
                  expiry={{
                    plan_expiry: patient.plan_expiry,
                    plan_days_left: patient.plan_days_left ?? null,
                    plan_end_date: patient.plan_end_date ?? null,
                  }}
                />
              </div>
            )}
          </div>

          {!compact && routeId && (
            <div
              role="tablist"
              aria-label="Phần hồ sơ bệnh nhân"
              className="flex items-center gap-1.5 overflow-x-auto pb-0.5 pt-0.5 border-t border-outline-variant/30 scrollbar-none"
            >
              {CHART_TABS.map((tab) => {
                const selected = activeTab === tab.id;
                return (
                  <Link
                    key={tab.id}
                    role="tab"
                    aria-selected={selected}
                    href={doctorChartHref(routeId, tab.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 ${
                      selected
                        ? "bg-primary text-on-primary font-bold shadow-2xs ring-1 ring-primary/30"
                        : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
                    }`}
                  >
                    {tab.id === "overview" && <span className="material-symbols-outlined text-[15px]">clinical_notes</span>}
                    {tab.id === "meals" && <span className="material-symbols-outlined text-[15px]">restaurant</span>}
                    {tab.id === "history" && <span className="material-symbols-outlined text-[15px]">calendar_month</span>}
                    {tab.id === "compliance" && <span className="material-symbols-outlined text-[15px]">analytics</span>}
                    {tab.id === "constraints" && <span className="material-symbols-outlined text-[15px]">rule</span>}
                    <span>{tab.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {children}
    </>
  );
}
