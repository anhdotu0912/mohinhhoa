"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { doctorPatientsHref } from "@/lib/doctor-routes";

export default function HistoryIndexRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace(doctorPatientsHref());
  }, [router]);
  return (
    <main className="p-8 text-sm text-on-surface-variant">Đang chuyển tới danh sách bệnh nhân…</main>
  );
}
