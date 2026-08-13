"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { AppRole } from "@/lib/nav-config";
import { Sidebar } from "@/components/shared/Sidebar";
import { MobileMenuContext } from "@/components/shared/MobileMenuContext";

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

  return (
    <MobileMenuContext.Provider value={value}>
      <div className="bg-[#F7F8FA] min-h-screen text-on-surface flex font-body text-body">
        <Sidebar role={role} />
        <div className="md:ml-[240px] flex-1 flex flex-col min-h-screen w-full">
          <div className="flex-1 w-full flex flex-col">{children}</div>
        </div>
      </div>
    </MobileMenuContext.Provider>
  );
}
