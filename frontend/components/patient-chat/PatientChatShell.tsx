"use client";

import React, { type ReactNode, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PatientPanelProvider, usePatientPanel, type PatientPanelKey } from "./PatientPanelProvider";

// Side Panels
import { MealLogPanel } from "./panels/MealLogPanel";
import { NotificationsPanel } from "./panels/NotificationsPanel";
import { HealthMetricsPanel } from "./panels/HealthMetricsPanel";
import { PatientChatSidebar } from "./PatientChatSidebar";
import { usePatientChatHistoryStore } from "@/lib/patient-chat-history-store";
import { useAuthStore } from "@/lib/auth-store";
import { APP_NAME } from "@/lib/brand";
import { DoctorMiniChat } from "./DoctorMiniChat";

function ShellInner({ children }: { children: ReactNode }) {
  const { activePanel, openPanel, closePanel, hasUnseenBadge, doctorChat } = usePatientPanel();
  const token = useAuthStore((s) => s.token);
  const userId = useAuthStore((s) => s.userId);
  const toggleSidebar = usePatientChatHistoryStore((s) => s.toggleSidebar);
  const isSidebarOpen = usePatientChatHistoryStore((s) => s.isSidebarOpen);
  const hydrateSessions = usePatientChatHistoryStore((s) => s.hydrateSessions);
  const isHydrated = usePatientChatHistoryStore((s) => s.isHydrated);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("panel") === "health") {
      openPanel("health");
    }
  }, [searchParams, openPanel]);

  useEffect(() => {
    if (!token) {
      usePatientChatHistoryStore.setState({
        sessions: [],
        activeSessionId: null,
        isHydrated: false,
        isLoading: false,
      });
      return;
    }
    if (!isHydrated) {
      void hydrateSessions();
    }
  }, [token, isHydrated, hydrateSessions]);

  const handleDockClick = (key: Exclude<PatientPanelKey, null>) => {
    if (activePanel === key) {
      closePanel();
    } else {
      openPanel(key);
    }
  };

  return (
    <div className="bg-[#f8fafc] text-slate-900 h-screen h-[100dvh] w-full overflow-hidden flex flex-col font-body antialiased relative">
      {/* Mobile Top Header Bar (Mobile Navigation & Quick Actions) */}
      <header className="md:hidden flex items-center justify-between px-3.5 py-2.5 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs z-30 shrink-0">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg text-slate-700 hover:text-slate-950 hover:bg-slate-100 transition-colors flex items-center justify-center cursor-pointer active:scale-95"
            title="Mở lịch sử trò chuyện"
            aria-label="Mở menu"
          >
            <span className="material-symbols-outlined text-[22px]">menu</span>
          </button>
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-base text-[#006857] tracking-tight">
              {APP_NAME}
            </span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100/90 text-emerald-800 border border-emerald-200/60">
              AI
            </span>
          </div>
        </div>

        {/* Mobile Quick Action Buttons in Top Bar */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleDockClick("menu")}
            className={`p-1.5 rounded-lg transition-all flex items-center justify-center cursor-pointer active:scale-95 ${
              activePanel === "menu"
                ? "bg-[#006857] text-white shadow-xs"
                : "text-slate-700 hover:text-[#006857] hover:bg-emerald-50"
            }`}
            title="Thực đơn & Nhật ký"
          >
            <span className="material-symbols-outlined text-[20px]">restaurant_menu</span>
          </button>

          <button
            type="button"
            onClick={() => handleDockClick("notifications")}
            className={`relative p-1.5 rounded-lg transition-all flex items-center justify-center cursor-pointer active:scale-95 ${
              activePanel === "notifications"
                ? "bg-[#006857] text-white shadow-xs"
                : "text-slate-700 hover:text-[#006857] hover:bg-emerald-50"
            }`}
            title="Thông báo y tế"
            aria-label={hasUnseenBadge ? "Thông báo y tế — có thông báo mới" : "Thông báo y tế"}
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            {hasUnseenBadge && (
              <span
                className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 border border-white shadow-xs pointer-events-none"
                aria-hidden="true"
              />
            )}
          </button>

          <button
            type="button"
            onClick={() => handleDockClick("health")}
            className={`p-1.5 rounded-lg transition-all flex items-center justify-center cursor-pointer active:scale-95 ${
              activePanel === "health"
                ? "bg-[#006857] text-white shadow-xs"
                : "text-slate-700 hover:text-[#006857] hover:bg-emerald-50"
            }`}
            title="Chỉ số sức khỏe"
          >
            <span className="material-symbols-outlined text-[20px]">vital_signs</span>
          </button>
        </div>
      </header>

      {/* Floating Hamburger for Desktop when sidebar is closed (Gemini Style) */}
      {!isSidebarOpen && (
        <button
          type="button"
          onClick={toggleSidebar}
          className="hidden md:flex fixed top-3.5 left-3.5 z-40 p-2 rounded-full bg-white/90 hover:bg-white text-slate-700 hover:text-slate-950 shadow-md border border-slate-200/80 backdrop-blur-md transition-all hover:scale-105 active:scale-95 cursor-pointer items-center justify-center"
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
          aria-label={
            hasUnseenBadge ? "Thông báo y tế — có thông báo mới" : "Thông báo y tế"
          }
        >
          <span className="material-symbols-outlined text-[22px]">notifications</span>
          {hasUnseenBadge && (
            <span
              className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 border border-white shadow-xs pointer-events-none"
              aria-hidden="true"
            />
          )}
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

      {/* Body Canvas with Gemini Left Sidebar & Main Chat Content */}
      <div className="flex-1 w-full min-h-0 flex overflow-hidden relative">
        <PatientChatSidebar />
        <main className="flex-1 w-full min-h-0 overflow-hidden flex flex-col relative">
          {children}
        </main>
      </div>

      {/* Side Panels Overlay */}
      {token && doctorChat && doctorChat.userId === userId && (
        <div hidden={activePanel !== null}>
          <DoctorMiniChat
            key={`${userId}:${doctorChat.escalationId}`}
            escalationId={doctorChat.escalationId}
            doctor={doctorChat.doctor}
            initialThread={doctorChat.initialThread}
          />
        </div>
      )}
      {activePanel === "menu" && <MealLogPanel />}
      {activePanel === "notifications" && <NotificationsPanel />}
      {activePanel === "health" && <HealthMetricsPanel />}
    </div>
  );
}

export function PatientChatShell({ children }: { children: ReactNode }) {
  return (
    <PatientPanelProvider>
      <Suspense fallback={null}>
        <ShellInner>{children}</ShellInner>
      </Suspense>
    </PatientPanelProvider>
  );
}

