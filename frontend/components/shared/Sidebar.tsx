/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DOCTOR_AVATAR_SRC,
  NAV_BY_ROLE,
  PATIENT_AVATAR_SRC,
  ROLE_META,
  resolveActiveNavId,
  type AppRole,
} from "@/lib/nav-config";
import { useMobileMenu } from "@/components/shared/MobileMenuContext";

type SidebarProps = {
  role: AppRole;
  activeItem?: string;
};

function NavLinks({
  role,
  activeId,
  onNavigate,
}: {
  role: AppRole;
  activeId: string;
  onNavigate?: () => void;
}) {
  const items = NAV_BY_ROLE[role];

  return (
    <div className="flex-1 flex flex-col gap-xs">
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <Link
            key={item.id}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-md px-md py-sm rounded-lg transition-all duration-200 cursor-pointer active:translate-x-1 ${
              isActive
                ? "text-primary font-body-bold border-r-4 border-primary bg-primary-container/10 font-semibold"
                : "text-on-surface-variant font-body hover:text-primary hover:bg-surface-container-low"
            }`}
          >
            <span
              className={`material-symbols-outlined text-[22px] ${
                isActive ? "text-primary" : ""
              }`}
            >
              {item.icon}
            </span>
            <span className="text-sm">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

function SidebarFooter({
  role,
  onNavigate,
}: {
  role: AppRole;
  onNavigate?: () => void;
}) {
  const meta = ROLE_META[role];
  const avatarSrc = role === "doctor" ? DOCTOR_AVATAR_SRC : PATIENT_AVATAR_SRC;

  return (
    <div className="mt-auto px-sm pt-md border-t border-outline-variant">
      <div className="flex items-center gap-sm p-sm rounded-lg hover:bg-surface-container-low cursor-pointer transition-colors mb-sm">
        <div className="w-8 h-8 rounded-full overflow-hidden bg-surface-container-high border border-outline-variant shrink-0">
          <img
            alt={`${meta.roleLabel} Profile`}
            className="w-full h-full object-cover"
            src={avatarSrc}
          />
        </div>
        <div className="overflow-hidden">
          <p className="font-body-bold text-body-bold text-on-surface truncate text-xs font-semibold">
            {meta.displayName}
          </p>
          <p className="font-caption text-caption text-on-surface-variant truncate text-[11px]">
            {meta.roleLabel}
          </p>
        </div>
      </div>

      <Link
        href="/"
        onClick={onNavigate}
        className="w-full flex items-center justify-center gap-sm bg-surface-container-low text-error border border-outline-variant hover:bg-error-container hover:text-on-error-container font-label text-label py-sm px-md rounded-lg transition-colors shadow-xs text-xs font-semibold cursor-pointer active:scale-95"
      >
        <span className="material-symbols-outlined text-[18px]">logout</span>
        <span>Đăng xuất</span>
      </Link>
    </div>
  );
}

export function Sidebar({ role, activeItem }: SidebarProps) {
  const pathname = usePathname();
  const { mobileMenuOpen, closeMobileMenu } = useMobileMenu();
  const meta = ROLE_META[role];
  const activeId = resolveActiveNavId(role, pathname, activeItem);

  return (
    <>
      {/* Desktop SideNavBar */}
      <nav className="bg-surface-container-lowest text-primary font-body text-body w-[240px] h-screen fixed left-0 top-0 border-r border-outline-variant shadow-sm flex flex-col p-md z-40 hidden md:flex">
        <div className="px-sm mb-lg">
          <Link href={meta.homeHref} className="block">
            <h2 className="font-h2 text-h2 text-primary font-bold tracking-tight">
              VMEC-10
            </h2>
            <p className="font-caption text-caption text-on-surface-variant">
              {meta.brandSubtitle}
            </p>
          </Link>
        </div>

        <NavLinks role={role} activeId={activeId} />
        <SidebarFooter role={role} />
      </nav>

      {/* Mobile SideNavBar Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={closeMobileMenu}
          />
          <nav className="relative bg-surface-container-lowest text-primary w-[260px] h-full flex flex-col p-md shadow-xl z-10">
            <div className="flex justify-between items-center px-sm mb-lg border-b border-outline-variant/40 pb-md">
              <div>
                <h2 className="font-h2 text-h2 text-primary font-bold">VMEC-10</h2>
                <p className="font-caption text-caption text-on-surface-variant">
                  {meta.brandSubtitle}
                </p>
              </div>
              <button
                onClick={closeMobileMenu}
                className="text-on-surface-variant p-1 rounded-md"
                type="button"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <NavLinks role={role} activeId={activeId} onNavigate={closeMobileMenu} />
            <SidebarFooter role={role} onNavigate={closeMobileMenu} />
          </nav>
        </div>
      )}
    </>
  );
}
