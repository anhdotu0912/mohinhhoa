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
      <TopBar title={compact ? "Tạo thực đơn AI" : "Hồ sơ bệnh nhân"} />
      <div className="bg-surface-container-lowest border-b border-outline-variant/60 sticky top-16 z-20">
        <div className="px-6 md:px-8 pt-3.5 flex flex-col gap-3 max-w-7xl mx-auto w-full">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <Link
              href={
                compact && routeId
                  ? doctorChartHref(routeId, "overview")
                  : doctorPatientsHref()
              }
              className="inline-flex items-center gap-1 text-on-surface-variant hover:text-primary transition-colors shrink-0 text-xs font-bold"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              <span className="hidden sm:inline">
                {compact ? "Hồ sơ" : "Danh sách bệnh nhân"}
              </span>
            </Link>

            {patient ? (
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="relative w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs ring-2 ring-primary/20 shrink-0">
                  {initials(name)}
                  {avatar ? (
                    <img
                      src={avatar}
                      alt=""
                      className="absolute inset-0 w-10 h-10 rounded-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm text-on-surface truncate">{name}</p>
                  <p className="flex items-start gap-1.5 mt-0.5 min-w-0">
                    <span className="text-[11px] text-on-surface-variant font-semibold shrink-0 pt-px">
                      Mã hồ sơ
                    </span>
                    <PatientRecordId id={patient.id} compact />
                  </p>
                </div>
                {patient.plan_expiry && patient.plan_expiry !== "none" && (
                  <div className="hidden md:block shrink-0">
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
            ) : (
              <p className="text-sm font-semibold text-on-surface-variant">
                {compact ? "Tạo thực đơn bằng AI" : "Đang tải hồ sơ…"}
              </p>
            )}
          </div>

          {!compact && routeId && (
            <div
              role="tablist"
              aria-label="Phần hồ sơ bệnh nhân"
              className="flex items-center gap-1 overflow-x-auto -mb-px"
            >
              {CHART_TABS.map((tab) => {
                const selected = activeTab === tab.id;
                return (
                  <Link
                    key={tab.id}
                    role="tab"
                    aria-selected={selected}
                    href={doctorChartHref(routeId, tab.id)}
                    className={`px-3.5 py-2 rounded-t-xl text-xs font-semibold whitespace-nowrap transition-colors border-b-2 ${
                      selected
                        ? "border-primary text-primary bg-primary/5"
                        : "border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
                    }`}
                  >
                    {tab.label}
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
