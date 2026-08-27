"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { AppRole } from "@/lib/nav-config";
import { Sidebar } from "@/components/shared/Sidebar";
import { MobileMenuContext } from "@/components/shared/MobileMenuContext";
import { PatientChatShell } from "@/components/patient-chat/PatientChatShell";

export { useMobileMenu } from "@/components/shared/MobileMenuContext";

export function AppShell({
  role,
  children,
}: {
  role: AppRole;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const hideChrome = pathname?.startsWith("/patient/onboarding");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const openMobileMenu = useCallback(() => setMobileMenuOpen(true), []);
  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

  const value = useMemo(
    () => ({
      mobileMenuOpen,
      openMobileMenu,
      closeMobileMenu,
      setMobileMenuOpen,
      role,
    }),
    [mobileMenuOpen, openMobileMenu, closeMobileMenu, role]
  );

  if (hideChrome) {
    return (
      <MobileMenuContext.Provider value={value}>{children}</MobileMenuContext.Provider>
    );
  }

  // Branch for Patient: Use modern PatientChatShell (No sidebar)
  if (role === "patient") {
    return (
      <MobileMenuContext.Provider value={value}>
        <PatientChatShell>{children}</PatientChatShell>
      </MobileMenuContext.Provider>
    );
  }

  // Branch for Doctor: Keep 100% identical layout and Sidebar
  return (
    <MobileMenuContext.Provider value={value}>
      <div className="bg-[#F7F8FA] text-on-surface flex font-body text-body min-h-screen">
        <Sidebar role={role} />
        <div className="md:ml-[240px] flex-1 flex flex-col w-full min-h-screen min-w-0">
          <div className="flex-1 w-full flex flex-col min-w-0">{children}</div>
        </div>
      </div>
    </MobileMenuContext.Provider>
  );
}

