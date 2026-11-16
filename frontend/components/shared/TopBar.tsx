/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMobileMenu } from "@/components/shared/MobileMenuContext";
import { resolveUserAvatar, userInitials } from "@/lib/avatar";
import { useAuthStore } from "@/lib/auth-store";

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
  const { role } = useMobileMenu();
  const authAvatar = useAuthStore((s) => s.avatar);
  const displayName = useAuthStore((s) => s.displayName);
  const email = useAuthStore((s) => s.email);

  const avatarSrc = resolveUserAvatar(authAvatar);
  const avatarInitials = userInitials(displayName || email || (role === "doctor" ? "BS" : "BN"));
  const profileHref = role === "doctor" ? "/doctor/profile" : "/patient/profile";

  if (role === "doctor") {
    return (
      <div className="mx-auto flex min-h-12 w-full max-w-[1480px] items-center justify-between gap-3 px-4 py-2 text-[13px] text-slate-500 sm:px-6 lg:px-8">
        <div className="min-w-0 truncate">{leftSlot ?? title}</div>
        {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
      </div>
    );
  }

  return (
    <header className="bg-white dark:bg-surface-container-lowest text-primary font-h2 text-h2 flex justify-between items-center h-16 px-lg w-full border-b border-outline-variant z-30 sticky top-0 shrink-0">
      <div className="flex items-center justify-between w-full gap-md">
        <div className="flex items-center gap-md min-w-0">

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
              href={profileHref}
              title="Hồ sơ"
              className="relative w-[32px] h-[32px] rounded-full border border-outline-variant overflow-hidden bg-primary/15 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
            >
              <div
                translate="no"
                className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-primary"
              >
                {avatarInitials}
              </div>
              {avatarSrc ? (
                <img
                  alt="User Avatar"
                  className="relative z-10 w-full h-full object-cover"
                  src={avatarSrc}
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : null}
            </Link>
          </div>
        ) : null}
      </div>
    </header>
  );
}

