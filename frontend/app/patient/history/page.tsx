"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Dock-first: chỉ số sống trong overlay, không có trang history riêng. */
export default function PatientHistoryRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/patient?panel=health");
  }, [router]);
  return null;
}
