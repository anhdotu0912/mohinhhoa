"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { doctorInboxHref } from "@/lib/doctor-routes";

export default function ReviewsIndexRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace(doctorInboxHref("plan_review"));
  }, [router]);
  return (
    <main className="p-8 text-sm text-on-surface-variant">Đang chuyển tới Hàng việc…</main>
  );
}
