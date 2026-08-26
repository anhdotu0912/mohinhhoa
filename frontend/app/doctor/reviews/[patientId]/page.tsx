"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { doctorChartHref } from "@/lib/doctor-routes";
import { asRouteId } from "@/lib/route-params";

export default function PatientReviewsRedirect() {
  const router = useRouter();
  const params = useParams();
  const patientId = asRouteId(params?.patientId);

  useEffect(() => {
    if (patientId) router.replace(doctorChartHref(patientId, "meals"));
  }, [router, patientId]);

  return (
    <main className="p-8 text-sm text-on-surface-variant">Đang chuyển tới thực đơn bệnh nhân…</main>
  );
}
