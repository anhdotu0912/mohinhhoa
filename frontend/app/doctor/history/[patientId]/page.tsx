"use client";

import { Suspense, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { asRouteId } from "@/lib/route-params";
import { buildHistoryHref } from "@/lib/plan-slot-intent";

function HistoryRedirectInner() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const patientId = asRouteId(params?.patientId);
  const week = searchParams.get("week");

  useEffect(() => {
    if (patientId) router.replace(buildHistoryHref(patientId, week));
  }, [router, patientId, week]);

  return (
    <main className="p-8 text-sm text-on-surface-variant">Đang chuyển tới lịch sử hồ sơ…</main>
  );
}

export default function PatientHistoryRedirect() {
  return (
    <Suspense
      fallback={
        <main className="p-8 text-sm text-on-surface-variant">Đang chuyển tới lịch sử hồ sơ…</main>
      }
    >
      <HistoryRedirectInner />
    </Suspense>
  );
}
