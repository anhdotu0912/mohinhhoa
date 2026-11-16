"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { resolveUserAvatar, userInitials } from "@/lib/avatar";
import { APP_NAME } from "@/lib/brand";
import { buildInboxJobs } from "@/lib/doctor-inbox";
import { NAV_BY_ROLE, resolveActiveNavId } from "@/lib/nav-config";

export function DoctorNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const displayName = useAuthStore((s) => s.displayName);
  const email = useAuthStore((s) => s.email);
  const avatar = useAuthStore((s) => s.avatar);
  const setUserProfile = useAuthStore((s) => s.setUserProfile);
  const logout = useAuthStore((s) => s.logout);
  const [inboxCount, setInboxCount] = useState<number | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  const accountId = useId();
  const activeId = pathname.startsWith("/doctor/profile") ? null : resolveActiveNavId("doctor", pathname);
  const name = displayName || email || "Bác sĩ";
  const avatarSrc = resolveUserAvatar(avatar);

  useEffect(() => {
    if (!token || role !== "doctor") return;
    let cancelled = false;
    api.getCurrentUser(token).then((user) => {
      if (cancelled) return;
      setUserProfile({ displayName: user.full_name?.trim() || user.email, email: user.email, avatar: user.avatar ?? null });
    }).catch(() => { /* Retain the last loaded account if the request fails. */ });
    return () => { cancelled = true; };
  }, [token, role, setUserProfile]);

  useEffect(() => {
    if (!token || role !== "doctor") return;
    let cancelled = false;
    Promise.all([
      api.listDoctorPatients(),
      api.listDoctorMealPlans("pending_review").catch(() => []),
      api.listClaimQueue().catch(() => []),
      api.listDoctorEscalations("open").catch(() => []),
    ]).then(([patients, plans, claims, escalations]) => {
      if (!cancelled) setInboxCount(buildInboxJobs(patients, plans, claims, escalations).length);
    }).catch(() => { if (!cancelled) setInboxCount(null); });
    return () => { cancelled = true; };
  }, [token, role, pathname]);

  useEffect(() => {
    if (!accountOpen) return;
    const outside = (event: PointerEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccountOpen(false);
        accountButtonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [accountOpen]);

  return (
    <header className="sticky top-0 z-40 flex h-[var(--doctor-nav-height)] shrink-0 items-center border-b border-slate-200/60 bg-[#f7f8fa]/95 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-[1480px] grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 md:grid-cols-[1fr_auto_1fr]">
        <Link href="/doctor" onClick={() => setAccountOpen(false)} className="w-fit rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40" aria-label="VinNutri — về tổng quan bác sĩ">
          <span className="block text-[21px] font-bold leading-tight tracking-tight text-[#0f766e]">{APP_NAME}</span>
          <span className="mt-0.5 hidden text-[11px] text-slate-500 md:block">Không gian bác sĩ</span>
        </Link>

        <nav aria-label="Điều hướng bác sĩ" className="order-3 col-span-2 mx-auto flex w-fit max-w-full items-center gap-1 rounded-full border border-slate-200/80 bg-white p-1 shadow-[0_2px_8px_rgba(15,23,42,0.03)] md:order-none md:col-span-1">
          {NAV_BY_ROLE.doctor.map((item) => {
            const active = item.id === activeId;
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={() => setAccountOpen(false)}
                className={`flex h-9 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40 sm:px-5 ${active ? "bg-[#0f766e] text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}
              >
                {item.label}
                {item.id === "inbox" && inboxCount != null && inboxCount > 0 ? (
                  <span aria-label={`${inboxCount} công việc`} className={`flex h-[19px] min-w-[19px] items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums ${active ? "bg-white/20 text-white" : "bg-rose-50 text-rose-600"}`}>{inboxCount > 99 ? "99+" : inboxCount}</span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div ref={accountRef} className="relative justify-self-end">
          <button
            ref={accountButtonRef}
            type="button"
            aria-label="Mở tài khoản bác sĩ"
            aria-expanded={accountOpen}
            aria-controls={accountId}
            onClick={() => setAccountOpen((open) => !open)}
            className={`flex items-center gap-2.5 rounded-full border bg-white p-1.5 pr-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40 ${accountOpen || pathname.startsWith("/doctor/profile") ? "border-teal-300" : "border-slate-200/80 hover:border-slate-300"}`}
          >
            <span translate="no" className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-teal-50 text-[11px] font-semibold text-teal-700">
              {userInitials(name)}
              {avatarSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarSrc} alt="" className="absolute inset-0 h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} />
              ) : null}
            </span>
            <span className="hidden max-w-36 truncate text-xs font-medium text-slate-700 xl:block">{name}</span>
            <ChevronDown size={14} className={`text-slate-400 transition-transform ${accountOpen ? "rotate-180" : ""}`} />
          </button>

          {accountOpen ? (
            <div id={accountId} aria-label="Tài khoản bác sĩ" className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[0_12px_32px_rgba(15,23,42,0.12)]">
              <div className="border-b border-slate-100 px-3 py-2.5">
                <p className="truncate text-[13px] font-semibold text-slate-900">{name}</p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">{email}</p>
              </div>
              <Link href="/doctor/profile" onClick={() => setAccountOpen(false)} className="mt-1 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs text-slate-600 hover:bg-slate-50"><UserRound size={16} />Hồ sơ bác sĩ</Link>
              <button type="button" onClick={() => { setAccountOpen(false); logout(); router.replace("/login"); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs text-rose-600 hover:bg-rose-50"><LogOut size={16} />Đăng xuất</button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
