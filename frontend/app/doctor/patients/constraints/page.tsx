"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { doctorInboxHref } from "@/lib/doctor-routes";

export default function ConstraintsListRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace(doctorInboxHref("constraints"));
  }, [router]);
  return (
    <main className="p-8 text-sm text-on-surface-variant">Đang chuyển tới Hàng việc…</main>
  );
}
