"use client";

import React, { type ReactNode } from "react";
import Link from "next/link";
import { TOPBAR_PATIENT_AVATAR_SRC } from "@/lib/nav-config";
import { PatientPanelProvider, usePatientPanel, type PatientPanelKey } from "./PatientPanelProvider";

// Side Panels
import { MealLogPanel } from "./panels/MealLogPanel";
import { NotificationsPanel } from "./panels/NotificationsPanel";
import { HealthMetricsPanel } from "./panels/HealthMetricsPanel";
import { PatientChatSidebar } from "./PatientChatSidebar";
import { usePatientChatHistoryStore } from "@/lib/patient-chat-history-store";

function ShellInner({ children }: { children: ReactNode }) {
  const { activePanel, openPanel, closePanel } = usePatientPanel();
  const toggleSidebar = usePatientChatHistoryStore((s) => s.toggleSidebar);
  const isSidebarOpen = usePatientChatHistoryStore((s) => s.isSidebarOpen);

  const handleDockClick = (key: Exclude<PatientPanelKey, null>) => {
    if (activePanel === key) {
      closePanel();
    } else {
      openPanel(key);
    }
  };

  return (
    <div className="bg-[#f8fafc] text-slate-900 h-screen h-[100dvh] w-full overflow-hidden flex flex-col font-body antialiased relative">
      {/* Top Glass App Bar */}
      <header className="shrink-0 z-40 w-full flex justify-between items-center px-3 sm:px-6 md:px-8 py-2 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-xs transition-all">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Sidebar Toggle Hamburger (Gemini style) */}
          <button
            type="button"
            onClick={toggleSidebar}
            className={`p-2 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 transition-colors cursor-pointer flex items-center justify-center ${
              isSidebarOpen ? "md:hidden" : "flex"
            }`}
            title={isSidebarOpen ? "Đóng lịch sử chat" : "Mở lịch sử chat"}
          >
            <span className="material-symbols-outlined text-[22px]">menu</span>
          </button>

          <Link
            href="/patient"
            className="flex items-center gap-2.5 group hover:opacity-95 transition-opacity"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#006857] to-emerald-500 flex items-center justify-center text-white shadow-sm shadow-emerald-600/30 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[20px]">ecg_heart</span>
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-base sm:text-lg text-[#006857] tracking-tight leading-tight flex items-center gap-1.5">
                VMEC-10
                <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  AI Patient
                </span>
              </span>
              <span className="text-[10px] text-slate-500 font-medium leading-none hidden sm:inline">
                Clinical Nutrition Care
              </span>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50/80 border border-emerald-200/60 text-emerald-800 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>HITL Guardrails Active</span>
          </div>

          <Link
            href="/patient/profile"
            className="relative flex items-center gap-2 p-1 pl-1.5 rounded-full hover:bg-slate-100/80 border border-transparent hover:border-slate-200 transition-all group"
            title="Hồ sơ sức khỏe cá nhân"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden border-2 border-emerald-500/40 group-hover:border-emerald-600 transition-colors shadow-xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={TOPBAR_PATIENT_AVATAR_SRC}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            </div>
          </Link>
        </div>
      </header>

      {/* Right Floating Dock (Desktop) */}
      <nav
        aria-label="Patient Quick Navigation"
        className="hidden md:flex fixed right-4 lg:right-6 top-1/2 -translate-y-1/2 z-30 flex-col gap-3 py-4 px-1.5 items-center bg-white/90 backdrop-blur-2xl border border-slate-200/80 shadow-[0_12px_36px_rgba(0,104,87,0.12)] rounded-full w-[54px]"
      >
        {/* Menu (Thực đơn & Nhật ký) */}
        <button
          type="button"
          onClick={() => handleDockClick("menu")}
          className={`p-2.5 rounded-full transition-all flex items-center justify-center group relative cursor-pointer ${
            activePanel === "menu"
              ? "bg-gradient-to-tr from-[#006857] to-emerald-600 text-white ring-4 ring-emerald-400/30 shadow-md scale-105"
              : "text-emerald-900 hover:text-emerald-950 hover:bg-emerald-100/70 hover:scale-110 active:scale-95"
          }`}
          title="Thực đơn & Nhật ký ăn uống"
        >
          <span className="material-symbols-outlined text-[22px]">restaurant_menu</span>
          <span className="absolute right-full mr-3.5 bg-slate-900 text-white text-xs px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-1 group-hover:translate-x-0 whitespace-nowrap pointer-events-none shadow-lg font-medium">
            Thực đơn &amp; Nhật ký
          </span>
        </button>

        {/* Notifications (Thông báo & Cảnh báo) */}
        <button
          type="button"
          onClick={() => handleDockClick("notifications")}
          className={`p-2.5 rounded-full transition-all flex items-center justify-center group relative cursor-pointer ${
            activePanel === "notifications"
              ? "bg-gradient-to-tr from-[#006857] to-emerald-600 text-white ring-4 ring-emerald-400/30 shadow-md scale-105"
              : "text-emerald-900 hover:text-emerald-950 hover:bg-emerald-100/70 hover:scale-110 active:scale-95"
          }`}
          title="Thông báo & Cảnh báo y tế"
        >
          <span className="material-symbols-outlined text-[22px]">notifications</span>
          <span className="absolute right-full mr-3.5 bg-slate-900 text-white text-xs px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-1 group-hover:translate-x-0 whitespace-nowrap pointer-events-none shadow-lg font-medium">
            Thông báo y tế
          </span>
        </button>

        {/* Health Metrics (Chỉ số sức khỏe) */}
        <button
          type="button"
          onClick={() => handleDockClick("health")}
          className={`p-2.5 rounded-full transition-all flex items-center justify-center group relative cursor-pointer ${
            activePanel === "health"
              ? "bg-gradient-to-tr from-[#006857] to-emerald-600 text-white ring-4 ring-emerald-400/30 shadow-md scale-105"
              : "text-emerald-900 hover:text-emerald-950 hover:bg-emerald-100/70 hover:scale-110 active:scale-95"
          }`}
          title="Chỉ số sức khỏe & Biểu đồ"
        >
          <span className="material-symbols-outlined text-[22px]">vital_signs</span>
          <span className="absolute right-full mr-3.5 bg-slate-900 text-white text-xs px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-1 group-hover:translate-x-0 whitespace-nowrap pointer-events-none shadow-lg font-medium">
            Chỉ số sức khỏe
          </span>
        </button>
      </nav>

      {/* Bottom Nav Bar (Mobile) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-3 left-3 right-3 rounded-xl backdrop-blur-2xl border border-white/70 shadow-[0_8px_30px_rgba(0,104,87,0.15)] bg-white/90 z-40 flex justify-around items-center py-2 px-2.5"
      >
        <button
          type="button"
          onClick={() => handleDockClick("menu")}
          className={`flex-1 py-1.5 flex flex-col items-center justify-center rounded-lg transition-colors ${
            activePanel === "menu" ? "text-emerald-950 font-bold bg-emerald-100/80" : "text-emerald-800 hover:bg-emerald-50"
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">restaurant_menu</span>
          <span className="text-[11px] mt-0.5">Thực đơn</span>
        </button>

        <button
          type="button"
          onClick={() => handleDockClick("notifications")}
          className={`flex-1 py-1.5 flex flex-col items-center justify-center rounded-lg transition-colors ${
            activePanel === "notifications" ? "text-emerald-950 font-bold bg-emerald-100/80" : "text-emerald-800 hover:bg-emerald-50"
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">notifications</span>
          <span className="text-[11px] mt-0.5">Thông báo</span>
        </button>

        <button
          type="button"
          onClick={() => handleDockClick("health")}
          className={`flex-1 py-1.5 flex flex-col items-center justify-center rounded-lg transition-colors ${
            activePanel === "health" ? "text-emerald-950 font-bold bg-emerald-100/80" : "text-emerald-800 hover:bg-emerald-50"
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">vital_signs</span>
          <span className="text-[11px] mt-0.5">Chỉ số</span>
        </button>
      </nav>

      {/* Body Canvas with Gemini Left Sidebar & Main Chat Content */}
      <div className="flex-1 w-full min-h-0 flex overflow-hidden relative">
        <PatientChatSidebar />
        <main className="flex-1 w-full min-h-0 overflow-hidden flex flex-col relative">
          {children}
        </main>
      </div>

      {/* Side Panels Overlay */}
      {activePanel === "menu" && <MealLogPanel />}
      {activePanel === "notifications" && <NotificationsPanel />}
      {activePanel === "health" && <HealthMetricsPanel />}
    </div>
  );
}

export function PatientChatShell({ children }: { children: ReactNode }) {
  return (
    <PatientPanelProvider>
      <ShellInner>{children}</ShellInner>
    </PatientPanelProvider>
  );
}

