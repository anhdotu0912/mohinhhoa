"use client";

import { PatientChartShell } from "@/components/doctor/chart/PatientChartShell";
import { asRouteId } from "@/lib/route-params";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";

export default function PatientChartLayout({ children }: { children: ReactNode }) {
  const params = useParams();
  const patientId = asRouteId(params?.patientId);

  return (
    <PatientChartShell patientId={patientId}>{children}</PatientChartShell>
  );
}
