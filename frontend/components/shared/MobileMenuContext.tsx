"use client";

import {
  createContext,
  useContext,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { AppRole } from "@/lib/nav-config";

export type MobileMenuContextValue = {
  mobileMenuOpen: boolean;
  openMobileMenu: () => void;
  closeMobileMenu: () => void;
  setMobileMenuOpen: Dispatch<SetStateAction<boolean>>;
  role: AppRole;
};

export const MobileMenuContext = createContext<MobileMenuContextValue | null>(
  null
);

export function useMobileMenu() {
  const ctx = useContext(MobileMenuContext);
  if (!ctx) {
    throw new Error("useMobileMenu must be used within AppShell");
  }
  return ctx;
}
