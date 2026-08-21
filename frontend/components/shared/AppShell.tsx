"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { AppRole } from "@/lib/nav-config";
import { Sidebar } from "@/components/shared/Sidebar";
import { MobileMenuContext } from "@/components/shared/MobileMenuContext";

export { useMobileMenu } from "@/components/shared/MobileMenuContext";

import { RightFloatingBar } from "@/components/shared/RightFloatingBar";

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

  const isAssistantPage = Boolean(pathname?.includes("/assistant"));

  if (hideChrome) {
    return (
      <MobileMenuContext.Provider value={value}>{children}</MobileMenuContext.Provider>
    );
  }

  return (
    <MobileMenuContext.Provider value={value}>
      <div className={`bg-[#F7F8FA] text-on-surface flex font-body text-body ${isAssistantPage ? "h-screen max-h-screen overflow-hidden" : "min-h-screen"}`}>
        <Sidebar role={role} />
        <div className={`md:ml-[240px] flex-1 flex flex-col w-full ${isAssistantPage ? "h-screen max-h-screen overflow-hidden" : "min-h-screen"}`}>
          <div className="flex-1 w-full flex flex-col overflow-hidden">{children}</div>
        </div>
        
        {/* Global Right Floating Bar */}
        {role === "patient" && <RightFloatingBar />}
      </div>
    </MobileMenuContext.Provider>
  );
}
