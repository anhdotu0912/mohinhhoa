/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  DOCTOR_AVATAR_SRC,
  TOPBAR_PATIENT_AVATAR_SRC,
} from "@/lib/nav-config";
import { useMobileMenu } from "@/components/shared/MobileMenuContext";

type TopBarProps = {
  title: string;
  rightSlot?: ReactNode;
  leftSlot?: ReactNode;
  showUtilities?: boolean;
};

export function TopBar({
  title,
  rightSlot,
  leftSlot,
  showUtilities = true,
}: TopBarProps) {
  const { openMobileMenu, role } = useMobileMenu();
  const notificationsHref =
    role === "patient" ? "/patient/notifications" : "/doctor";
  const avatarSrc =
    role === "doctor" ? DOCTOR_AVATAR_SRC : TOPBAR_PATIENT_AVATAR_SRC;

  return (
    <header className="bg-white dark:bg-surface-container-lowest text-primary font-h2 text-h2 flex justify-between items-center h-16 px-lg w-full border-b border-outline-variant z-30 sticky top-0 shrink-0">
      <div className="flex items-center justify-between w-full gap-md">
        <div className="flex items-center gap-md min-w-0">
          <button
            type="button"
            onClick={openMobileMenu}
            className="md:hidden text-on-surface-variant hover:text-primary transition-colors mr-1 p-1 shrink-0"
          >
            <span className="material-symbols-outlined text-[24px]">menu</span>
          </button>

          {leftSlot ?? (
            <div className="font-bold text-primary text-base md:text-lg truncate">
              {title}
            </div>
          )}
        </div>

        {rightSlot ? (
          <div className="flex items-center gap-md shrink-0">{rightSlot}</div>
        ) : null}

        {showUtilities ? (
          <div className="flex items-center gap-md shrink-0">
            <Link
              href={notificationsHref}
              className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-variant"
            >
              <span className="material-symbols-outlined">notifications</span>
            </Link>
            <button
              type="button"
              className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-variant hidden md:flex"
            >
              <span className="material-symbols-outlined">settings</span>
            </button>
            <img
              alt="User Avatar"
              className="w-[32px] h-[32px] rounded-full object-cover md:hidden border border-outline-variant"
              src={avatarSrc}
            />
          </div>
        ) : null}
      </div>
    </header>
  );
}
