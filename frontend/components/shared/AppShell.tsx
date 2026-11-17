"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { AppRole } from "@/lib/nav-config";
import { DoctorNavigation } from "@/components/doctor/DoctorNavigation";
import { MobileMenuContext } from "@/components/shared/MobileMenuContext";
import { PatientChatShell } from "@/components/patient-chat/PatientChatShell";
import { DoctorMessengerProvider } from "@/components/doctor/DoctorMessenger";

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

  // Doctor pages share horizontal navigation; patient chat keeps its own shell.
  return (
    <MobileMenuContext.Provider value={value}>
      <DoctorMessengerProvider>
        <div className="min-h-screen bg-[#F7F8FA] font-body text-body text-on-surface [--doctor-nav-height:124px] md:[--doctor-nav-height:88px]">
          <DoctorNavigation />
          <div className="flex min-h-[calc(100dvh-var(--doctor-nav-height))] w-full min-w-0 flex-col">
            <div className="flex-1 w-full flex flex-col min-w-0">{children}</div>
          </div>
        </div>
      </DoctorMessengerProvider>
    </MobileMenuContext.Provider>
  );
}

