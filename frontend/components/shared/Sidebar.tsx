"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  NAV_BY_ROLE,
  ROLE_META,
  resolveActiveNavId,
  type AppRole,
} from "@/lib/nav-config";
import { useMobileMenu } from "@/components/shared/MobileMenuContext";
import { NotificationBadge } from "@/components/shared/NotificationBadge";
import { api, assetUrl } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

type SidebarProps = {
  role: AppRole;
  activeItem?: string;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

function NavLinks({
  role,
  activeId,
  onNavigate,
  mealPlanRequestCount = 0,
}: {
  role: AppRole;
  activeId: string;
  onNavigate?: () => void;
  mealPlanRequestCount?: number;
}) {
  const items = NAV_BY_ROLE[role];

  return (
    <div className="flex-1 flex flex-col gap-xs">
      {items.map((item) => {
        const isActive = item.id === activeId;
        const showRequestBadge = role === "doctor" && item.id === "patients" && mealPlanRequestCount > 0;
        return (
          <Link
            key={item.id}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-md px-md py-sm rounded-lg transition-all duration-200 cursor-pointer active:translate-x-1 ${isActive
                ? "text-primary font-body-bold border-r-4 border-primary bg-primary-container/10 font-semibold"
                : "text-on-surface-variant font-body hover:text-primary hover:bg-surface-container-low"
              }`}
          >
            <span className="relative shrink-0">
              <span
                className={`material-symbols-outlined text-[26px] ${isActive ? "text-primary" : ""
                  }`}
              >
                {item.icon}
              </span>
              {showRequestBadge && <NotificationBadge count={mealPlanRequestCount} />}
            </span>
            <span className="text-body font-body">{item.label}</span>
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
  const router = useRouter();
  const meta = ROLE_META[role];
  const token = useAuthStore((s) => s.token);
  const email = useAuthStore((s) => s.email);
  const displayName = useAuthStore((s) => s.displayName);
  const avatar = useAuthStore((s) => s.avatar);
  const logout = useAuthStore((s) => s.logout);
  const setUserProfile = useAuthStore((s) => s.setUserProfile);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api
      .getCurrentUser(token)
      .then((user) => {
        if (cancelled) return;
        setUserProfile({
          displayName: user.full_name?.trim() || user.email,
          avatar: user.avatar ?? null,
        });
      })
      .catch(() => {
        /* giữ fallback local nếu API không khả dụng */
      });
    return () => {
      cancelled = true;
    };
  }, [token, setUserProfile]);

  const resolvedName = displayName || email || meta.displayName;
  const avatarSrc = avatar ? assetUrl(avatar) : "";

  const handleLogout = () => {
    logout();
    onNavigate?.();
    router.push("/login");
  };

  const profileBlock = (
    <>
      <div className="relative w-10 h-10 rounded-full overflow-hidden bg-surface-container-high border border-outline-variant shrink-0">
        <div translate="no" className="absolute inset-0 bg-primary/15 text-primary flex items-center justify-center font-label text-label font-semibold">
          {initials(resolvedName)}
        </div>
        {avatarSrc ? (
          <img
            alt={`${meta.roleLabel} Profile`}
            className="absolute inset-0 w-full h-full object-cover"
            src={avatarSrc}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : null}
      </div>
      <div className="overflow-hidden">
        <p className="font-body-bold text-body-bold text-on-surface truncate font-semibold">
          {resolvedName}
        </p>
        <p className="font-caption text-caption text-on-surface-variant truncate">
          {meta.roleLabel}
        </p>
      </div>
    </>
  );

  return (
    <div className="mt-auto px-sm pt-md border-t border-outline-variant">
      <div className="flex items-center gap-sm p-sm rounded-lg hover:bg-surface-container-low cursor-pointer transition-colors mb-sm">
        {profileBlock}
      </div>

      <button
        type="button"
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-sm bg-surface-container-low text-error border border-outline-variant hover:bg-error-container hover:text-on-error-container font-label text-label py-sm px-md rounded-lg transition-colors shadow-xs font-semibold cursor-pointer active:scale-95"
      >
        <span className="material-symbols-outlined text-[22px]">logout</span>
        <span>Đăng xuất</span>
      </button>
    </div>
  );
}

export function Sidebar({ role, activeItem }: SidebarProps) {
  const pathname = usePathname();
  const { mobileMenuOpen, closeMobileMenu } = useMobileMenu();
  const meta = ROLE_META[role];
  const activeId = resolveActiveNavId(role, pathname, activeItem);
  const token = useAuthStore((s) => s.token);
  const authRole = useAuthStore((s) => s.role);
  const [mealPlanRequestCount, setMealPlanRequestCount] = useState(0);

  useEffect(() => {
    if (role !== "doctor" || authRole !== "doctor" || !token) {
      setMealPlanRequestCount(0);
      return;
    }
    let cancelled = false;
    api
      .listDoctorPatients({ meal_plan_request: "pending" })
      .then((rows) => {
        if (!cancelled) setMealPlanRequestCount(rows.length);
      })
      .catch(() => {
        if (!cancelled) setMealPlanRequestCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [role, authRole, token, pathname]);

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

        <NavLinks role={role} activeId={activeId} mealPlanRequestCount={mealPlanRequestCount} />
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

            <NavLinks
              role={role}
              activeId={activeId}
              onNavigate={closeMobileMenu}
              mealPlanRequestCount={mealPlanRequestCount}
            />
            <SidebarFooter role={role} onNavigate={closeMobileMenu} />
          </nav>
        </div>
      )}
    </>
  );
}
