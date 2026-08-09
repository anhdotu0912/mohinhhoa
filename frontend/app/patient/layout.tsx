/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isMessagesPage = pathname === "/patient/messages";

  const navItems = [
    { name: "Tổng quan", href: "/patient", icon: "dashboard" },
    { name: "Thực đơn", href: "/patient/meals", icon: "restaurant" },
    { name: "Lịch sử & Tiến độ", href: "/patient/history", icon: "analytics" },
    { name: "Trợ lý AI", href: "/patient/assistant", icon: "smart_toy" },
    { name: "Tư vấn Bác sĩ", href: "/patient/messages", icon: "chat" },
  ];

  const getPageTitle = () => {
    if (pathname === "/patient/notifications") return "Thông báo";
    if (pathname === "/patient/meals/log") return "Ghi nhận bữa ăn";
    if (pathname === "/patient/meals") return "Thực đơn hôm nay";
    if (pathname === "/patient/history") return "Lịch sử & tiến độ";
    if (pathname === "/patient/assistant") return "Trợ lý AI";
    return "Chào, Nguyễn Văn A";
  };

  return (
    <div className="bg-[#F7F8FA] min-h-screen text-on-surface flex">
      {/* Desktop SideNavBar */}
      <nav className="bg-surface-container-lowest text-primary font-body text-body w-[240px] h-screen fixed left-0 top-0 border-r border-outline-variant shadow-sm flex flex-col p-md z-40 hidden md:flex">
        {/* Brand Logo */}
        <div className="px-sm mb-lg">
          <Link href="/patient" className="block">
            <h2 className="font-h2 text-h2 text-primary font-bold tracking-tight">VMEC-10</h2>
            <p className="font-caption text-caption text-on-surface-variant">Trợ lý Sức khỏe</p>
          </Link>
        </div>

        {/* Navigation Tabs */}
        <div className="flex-1 flex flex-col gap-xs">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/patient" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
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
                <span className="text-sm">{item.name}</span>
              </Link>
            );
          })}
        </div>

        {/* Bottom Section */}
        <div className="mt-auto px-sm pt-md border-t border-outline-variant">
          {/* User Account Component */}
          <div className="flex items-center gap-sm p-sm rounded-lg hover:bg-surface-container-low cursor-pointer transition-colors mb-sm">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-surface-container-high border border-outline-variant shrink-0">
              <img
                alt="Patient Profile"
                className="w-full h-full object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAAEO489Y9x22XpBDURh5EbYSPORMZ-fqupO1piTVhKxnLwxMBJvDcoBNb8mMUI2oFidOXaMbW8vE8x1KBieFqD63boIjI0T_jx6lhF1X8vIfLhN9vorW753hCqscv9-taa2FEGEPxCywf6ftNRoY65F0cxi8nrKxySOzPFv-WVdPDOe1fzvxMKUwYGVQLmLNvQbHZdDAOu8vh8yEHgIvbGGdnuJOQ32uO3_Qji3yxymqOGAjBFcRtsxQ"
              />
            </div>
            <div className="overflow-hidden">
              <p className="font-body-bold text-body-bold text-on-surface truncate text-xs font-semibold">
                Nguyễn Văn A
              </p>
              <p className="font-caption text-caption text-on-surface-variant truncate text-[11px]">
                Bệnh nhân
              </p>
            </div>
          </div>

          {/* Logout Button below Account Component */}
          <Link
            href="/"
            className="w-full flex items-center justify-center gap-sm bg-surface-container-low text-error border border-outline-variant hover:bg-error-container hover:text-on-error-container font-label text-label py-sm px-md rounded-lg transition-colors shadow-xs text-xs font-semibold cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            <span>Đăng xuất</span>
          </Link>
        </div>
      </nav>

      {/* Mobile SideNavBar Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <nav className="relative bg-surface-container-lowest text-primary w-[260px] h-full flex flex-col p-md shadow-xl z-10">
            <div className="flex justify-between items-center px-sm mb-lg border-b border-outline-variant/40 pb-md">
              <div>
                <h2 className="font-h2 text-h2 text-primary font-bold">VMEC-10</h2>
                <p className="font-caption text-caption text-on-surface-variant">Trợ lý Sức khỏe</p>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="text-on-surface-variant p-1 rounded-md"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-1 flex flex-col gap-xs">
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/patient" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-md px-md py-sm rounded-lg transition-all ${
                      isActive
                        ? "text-primary font-body-bold border-r-4 border-primary bg-primary-container/10 font-semibold"
                        : "text-on-surface-variant font-body hover:bg-surface-container-low"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
                    <span className="text-sm">{item.name}</span>
                  </Link>
                );
              })}
            </div>

            <div className="mt-auto pt-md border-t border-outline-variant">
              {/* User Account Component */}
              <div className="flex items-center gap-sm p-sm rounded-lg mb-sm">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-surface-container-high border border-outline-variant shrink-0">
                  <img
                    alt="Patient Profile"
                    className="w-full h-full object-cover"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuAAEO489Y9x22XpBDURh5EbYSPORMZ-fqupO1piTVhKxnLwxMBJvDcoBNb8mMUI2oFidOXaMbW8vE8x1KBieFqD63boIjI0T_jx6lhF1X8vIfLhN9vorW753hCqscv9-taa2FEGEPxCywf6ftNRoY65F0cxi8nrKxySOzPFv-WVdPDOe1fzvxMKUwYGVQLmLNvQbHZdDAOu8vh8yEHgIvbGGdnuJOQ32uO3_Qji3yxymqOGAjBFcRtsxQ"
                  />
                </div>
                <div className="overflow-hidden">
                  <p className="font-body-bold text-body-bold text-on-surface truncate text-xs font-semibold">
                    Nguyễn Văn A
                  </p>
                  <p className="font-caption text-caption text-on-surface-variant truncate text-[11px]">
                    Bệnh nhân
                  </p>
                </div>
              </div>

              {/* Logout Button */}
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center justify-center gap-sm bg-surface-container-low text-error border border-outline-variant hover:bg-error-container hover:text-on-error-container py-sm rounded-lg text-xs font-semibold"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                <span>Đăng xuất</span>
              </Link>
            </div>
          </nav>
        </div>
      )}

      {/* Main Content Area */}
      <div className="md:ml-[240px] flex-1 flex flex-col min-h-screen w-full">
        {/* Dynamic TopAppBar */}
        <header className="bg-white dark:bg-surface-container-lowest text-primary font-h2 text-h2 flex justify-between items-center h-16 px-lg w-full border-b border-outline-variant z-30 sticky top-0 shrink-0">
          {isMessagesPage ? (
            /* Doctor Header for Messages Page */
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-md">
                <button
                  onClick={() => setMobileMenuOpen(true)}
                  className="md:hidden text-on-surface-variant hover:text-primary transition-colors mr-1 p-1"
                >
                  <span className="material-symbols-outlined text-[24px]">menu</span>
                </button>
                <div className="relative">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-container-high border border-outline-variant">
                    <img
                      alt="Dr. Minh"
                      className="w-full h-full object-cover"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuC5r_ZeLtWNoVeKuK3GOSjuEdF1_-FpUL5Af3hmrd7IbG7wEyzqvCNJQDjwV_qhNXWYvy1UuM9Gtrp1Ti9xMrCeTe42VvCmSMzcQ7zPhjEWuVElrSGJg0DpOiZNM-Tlb1Jsd2t-sxGpKsKLGnMNN2o8HCHRfuQcyhMrmQlNyLsoDgLyRLgQjsWag0pST3a_RZLkVOyZKis7Yv8iItxC-m4oUxgsHiCmZ6WegmYP55ItbhRY62snjVL-lw"
                    />
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#2F8F7A] border-2 border-surface-container-lowest rounded-full"></div>
                </div>
                <div>
                  <h1 className="font-h2 text-h2 text-on-surface tracking-tight font-semibold text-base">
                    Bác sĩ Minh
                  </h1>
                  <p className="font-caption text-caption text-on-surface-variant text-xs">
                    Chuyên gia Dinh dưỡng
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-sm">
                <button className="p-sm text-on-surface-variant hover:text-primary hover:bg-surface-container-low rounded-full transition-colors cursor-pointer">
                  <span className="material-symbols-outlined text-[24px]">call</span>
                </button>
                <button className="p-sm text-on-surface-variant hover:text-primary hover:bg-surface-container-low rounded-full transition-colors cursor-pointer">
                  <span className="material-symbols-outlined text-[24px]">more_vert</span>
                </button>
              </div>
            </div>
          ) : (
            /* Default or Title Header for other pages */
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-md">
                <button
                  onClick={() => setMobileMenuOpen(true)}
                  className="md:hidden text-on-surface-variant hover:text-primary transition-colors mr-1 p-1"
                >
                  <span className="material-symbols-outlined text-[24px]">menu</span>
                </button>
                <div className="font-bold text-primary text-base md:text-lg">
                  {getPageTitle()}
                </div>
                {pathname === "/patient/assistant" && (
                  <span className="px-sm py-[2px] rounded-full bg-primary/10 text-primary font-label text-xs border border-primary/20 flex items-center gap-xs ml-2 md:ml-4">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                    Đang hoạt động
                  </span>
                )}
                {pathname === "/patient/meals" && (
                  <div className="flex items-center bg-surface-container-lowest border border-outline-variant rounded-lg p-1 ml-2 md:ml-4 shadow-sm">
                    <button className="p-1 hover:bg-surface-container-low rounded text-on-surface-variant transition-colors">
                      <span className="material-symbols-outlined text-sm">chevron_left</span>
                    </button>
                    <div className="px-3 flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-sm">calendar_month</span>
                      <span className="font-body-bold text-on-surface text-sm">Thứ Hai, 16/10</span>
                    </div>
                    <button className="p-1 hover:bg-surface-container-low rounded text-on-surface-variant transition-colors">
                      <span className="material-symbols-outlined text-sm">chevron_right</span>
                    </button>
                  </div>
                )}
                {pathname === "/patient/history" && (
                  <div className="relative hidden sm:flex items-center border border-outline-variant rounded-lg px-3 py-1.5 bg-surface-container-lowest cursor-pointer hover:bg-surface-container-low transition-colors ml-2 md:ml-4 text-xs">
                    <span className="font-body text-body text-on-surface mr-2 font-medium">7 ngày qua</span>
                    <span className="material-symbols-outlined text-on-surface-variant text-[18px]">calendar_today</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-md">
                <Link
                  href="/patient/notifications"
                  className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-variant"
                >
                  <span className="material-symbols-outlined">notifications</span>
                </Link>
                <button className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-variant hidden md:flex">
                  <span className="material-symbols-outlined">settings</span>
                </button>
                <img
                  alt="Patient Avatar"
                  className="w-[32px] h-[32px] rounded-full object-cover md:hidden border border-outline-variant"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBxHY31kVzCzgHgRGdCYDSFnemw1MldBt3HQzQ42c9ovBpzp_EYy_hq5VzuZDGfB_C840YTDJpU6mHgXJ9OF72CJJYeMvNy1xo5n89jVQ51uU-rnAh55AA5iF0cLWNI14JwtsRBj3wCgSDvblkTh6dqjZ6kX27zHh26wxyrOM6YmHLXDFEH_SK2Ck54D1EV9PEvDCFYOBAclFDCnQRd6oSv4wMSpmpiqt4Q-U7v2V5We1-rYbkTasIYcA"
                />
              </div>
            </div>
          )}
        </header>

        {/* Page Canvas */}
        <div className="flex-1 w-full flex flex-col">{children}</div>
      </div>
    </div>
  );
}
