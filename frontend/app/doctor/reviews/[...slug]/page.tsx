"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  doctorChartHref,
  doctorInboxHref,
  doctorReviewHref,
} from "@/lib/doctor-routes";
import { asRouteId } from "@/lib/route-params";

/** URL cũ `/doctor/reviews/{patientId}/{planId}` — Next.js 16 không đăng ký hai segment động liền nhau. */
export default function LegacyReviewsRedirect() {
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug;
  const parts = Array.isArray(slug) ? slug.map(String) : slug ? [String(slug)] : [];
  const patientId = asRouteId(parts[0]);
  const planId = asRouteId(parts[1]);

  useEffect(() => {
    if (patientId && planId) {
      router.replace(doctorReviewHref(patientId, planId));
      return;
    }
    if (patientId) {
      router.replace(doctorChartHref(patientId, "meals"));
      return;
    }
    router.replace(doctorInboxHref("plan_review"));
  }, [router, patientId, planId]);

  return (
    <main className="p-8 text-sm text-on-surface-variant">
      Đang chuyển tới trang duyệt thực đơn…
    </main>
  );
}
