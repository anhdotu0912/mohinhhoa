"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ComplianceListRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/doctor");
  }, [router]);
  return (
    <main className="p-8 text-sm text-on-surface-variant">Đang chuyển tới Dashboard…</main>
  );
}
