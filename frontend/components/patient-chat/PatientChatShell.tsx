"use client";

import React, { type ReactNode } from "react";
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
      {/* Floating Hamburger to open sidebar when closed (Gemini Style) */}
      {!isSidebarOpen && (
        <button
          type="button"
          onClick={toggleSidebar}
          className="fixed top-3.5 left-3.5 z-40 p-2 rounded-full bg-white/90 hover:bg-white text-slate-700 hover:text-slate-950 shadow-md border border-slate-200/80 backdrop-blur-md transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center"
          title="Mở lịch sử trò chuyện"
        >
          <span className="material-symbols-outlined text-[22px]">menu</span>
        </button>
      )}

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

