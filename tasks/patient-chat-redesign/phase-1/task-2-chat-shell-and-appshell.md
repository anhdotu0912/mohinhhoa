# Task 1.3 & 1.4 — PatientChatShell & AppShell Rẽ Nhánh

> **Thư mục:** [`tasks/patient-chat-redesign/phase-1/`](README.md)  
> **Phụ thuộc:** Hoàn thành [`task-1-tokens-and-provider.md`](task-1-tokens-and-provider.md).

---

## Phần 1: T1.3 — Xây dựng `PatientChatShell`

### 1. Mục tiêu
Xây dựng khung giao diện chính cho bệnh nhân bao gồm:
1. **Top App Bar kính mờ:** Logo VMEC-10, icon Sensors, Avatar bệnh nhân (link tới `/patient/profile`).
2. **Right Floating Dock (Desktop `hidden md:flex`):** 3 nút tròn (`menu`, `notifications`, `monitoring`) nổi bên phải, có tooltip hover và trạng thái active ring phát sáng.
3. **Bottom Navigation Bar (Mobile `md:hidden`):** 3 nút tương ứng ở đáy màn hình (nút giữa nhô lên nhẹ).
4. **Vùng render Panels trượt:** Container cho các Side Panels khi `activePanel !== null`.
5. Bọc toàn bộ trong `PatientPanelProvider`.

### 2. File tác động
- **[NEW]** `frontend/components/patient-chat/PatientChatShell.tsx`
- **Tham chiếu mockup:** `ui/stitch_vmec_10_health_assistant/chat-home/code.html` (header + nav phải) và `doctor-note/code.html` (BottomNavBar).

### 3. Hướng dẫn chi tiết
Tạo `frontend/components/patient-chat/PatientChatShell.tsx`:

```tsx
"use client";

import React, { type ReactNode } from "react";
import Link from "next/link";
import { TOPBAR_PATIENT_AVATAR_SRC } from "@/lib/nav-config";
import { PatientPanelProvider, usePatientPanel, type PatientPanelKey } from "./PatientPanelProvider";

// Import Panels (sẽ hoàn thiện ở task-5)
import { MealLogPanel } from "./panels/MealLogPanel";
import { NotificationsPanel } from "./panels/NotificationsPanel";
import { HealthMetricsPanel } from "./panels/HealthMetricsPanel";

function ShellInner({ children }: { children: ReactNode }) {
  const { activePanel, openPanel, closePanel } = usePatientPanel();

  const handleDockClick = (key: Exclude<PatientPanelKey, null>) => {
    if (activePanel === key) {
      closePanel();
    } else {
      openPanel(key);
    }
  };

  return (
    <div className="bg-[#f8f9f9] text-[#141b2b] h-screen w-full overflow-hidden flex flex-col font-body antialiased relative">
      {/* Top Glass App Bar */}
      <header className="fixed top-0 w-full z-40 flex justify-between items-center px-4 md:px-16 py-2 bg-white/70 backdrop-blur-xl border-b border-white/40 shadow-sm">
        <div className="flex items-center gap-2">
          <Link href="/patient" className="font-bold text-xl text-[#006857] tracking-tight hover:opacity-90 transition-opacity">
            VMEC-10
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="w-10 h-10 rounded-full flex items-center justify-center text-[#006857] hover:bg-[#10b981]/10 transition-colors"
            title="Cảm biến sức khỏe"
          >
            <span className="material-symbols-outlined text-[22px]">sensors</span>
          </button>
          <Link
            href="/patient/profile"
            className="w-10 h-10 rounded-full overflow-hidden border-2 border-emerald-500/30 hover:border-emerald-500 transition-colors"
            title="Hồ sơ cá nhân"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={TOPBAR_PATIENT_AVATAR_SRC}
              alt="Avatar"
              className="w-full h-full object-cover"
            />
          </Link>
        </div>
      </header>

      {/* Right Floating Dock (Desktop) */}
      <nav className="hidden md:flex fixed right-4 top-1/2 -translate-y-1/2 z-40 flex-col gap-4 py-6 px-2 items-center bg-white/70 backdrop-blur-2xl border border-white/40 shadow-[0_0_20px_rgba(16,185,129,0.3)] rounded-full w-16">
        {/* Menu (Thực đơn) */}
        <button
          type="button"
          onClick={() => handleDockClick("menu")}
          className={`p-3 rounded-full transition-all flex items-center justify-center group relative ${
            activePanel === "menu"
              ? "bg-[#006857] text-white ring-4 ring-emerald-400/40 shadow-md scale-105"
              : "text-[#3c4a42] hover:bg-black/5 hover:scale-110 active:scale-95"
          }`}
          title="Thực đơn"
        >
          <span className="material-symbols-outlined text-[24px]">menu</span>
          <span className="absolute right-full mr-4 bg-[#2e3131] text-white text-xs px-2.5 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-md font-medium">
            Thực đơn
          </span>
        </button>

        {/* Notifications (Thông báo) */}
        <button
          type="button"
          onClick={() => handleDockClick("notifications")}
          className={`p-3 rounded-full transition-all flex items-center justify-center group relative ${
            activePanel === "notifications"
              ? "bg-[#006857] text-white ring-4 ring-emerald-400/40 shadow-md scale-105"
              : "text-[#3c4a42] hover:bg-black/5 hover:scale-110 active:scale-95"
          }`}
          title="Thông báo"
        >
          <span className="material-symbols-outlined text-[24px]">notifications</span>
          <span className="absolute right-full mr-4 bg-[#2e3131] text-white text-xs px-2.5 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-md font-medium">
            Thông báo
          </span>
        </button>

        {/* Health Metrics (Chỉ số sức khỏe) */}
        <button
          type="button"
          onClick={() => handleDockClick("health")}
          className={`p-3 rounded-full transition-all flex items-center justify-center group relative ${
            activePanel === "health"
              ? "bg-[#006857] text-white ring-4 ring-emerald-400/40 shadow-md scale-105"
              : "text-[#3c4a42] hover:bg-black/5 hover:scale-110 active:scale-95"
          }`}
          title="Chỉ số sức khỏe"
        >
          <span className="material-symbols-outlined text-[24px]">monitoring</span>
          <span className="absolute right-full mr-4 bg-[#2e3131] text-white text-xs px-2.5 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-md font-medium">
            Chỉ số sức khỏe
          </span>
        </button>
      </nav>

      {/* Bottom Nav Bar (Mobile) */}
      <nav className="md:hidden fixed bottom-4 left-4 right-4 rounded-full backdrop-blur-2xl border border-white/40 shadow-lg shadow-emerald-500/20 bg-white/80 z-40 flex justify-around items-center py-2 px-4">
        <button
          type="button"
          onClick={() => handleDockClick("menu")}
          className={`p-2 flex flex-col items-center justify-center rounded-full ${
            activePanel === "menu" ? "text-[#006857] font-bold" : "text-[#3c4a42]"
          }`}
        >
          <span className="material-symbols-outlined text-[24px]">menu</span>
          <span className="text-[10px]">Thực đơn</span>
        </button>

        <button
          type="button"
          onClick={() => handleDockClick("notifications")}
          className={`p-3 rounded-full -translate-y-2 shadow-md transition-transform ${
            activePanel === "notifications"
              ? "bg-[#006857] text-white ring-4 ring-emerald-400/40"
              : "bg-white text-[#006857] border border-emerald-200"
          }`}
        >
          <span className="material-symbols-outlined text-[24px]">notifications</span>
        </button>

        <button
          type="button"
          onClick={() => handleDockClick("health")}
          className={`p-2 flex flex-col items-center justify-center rounded-full ${
            activePanel === "health" ? "text-[#006857] font-bold" : "text-[#3c4a42]"
          }`}
        >
          <span className="material-symbols-outlined text-[24px]">monitoring</span>
          <span className="text-[10px]">Chỉ số</span>
        </button>
      </nav>

      {/* Main Children Canvas (Chat Home) */}
      <main className="flex-1 w-full h-full overflow-hidden flex flex-col pt-16">
        {children}
      </main>

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
```

---

## Phần 2: T1.4 — Rẽ nhánh trong `AppShell`

### 1. Mục tiêu
Sửa [frontend/components/shared/AppShell.tsx](file:///d:/vinAI/P-014/frontend/components/shared/AppShell.tsx) để:
- Khi `role === "patient"` -> Bọc nội dung bằng `PatientChatShell` (không dùng `Sidebar` cũ hay `RightFloatingBar` tĩnh).
- Khi `role === "doctor"` -> Giữ nguyên 100% `Sidebar` + layout cũ.

### 2. File tác động
- [frontend/components/shared/AppShell.tsx](file:///d:/vinAI/P-014/frontend/components/shared/AppShell.tsx)

### 3. Hướng dẫn chi tiết
Cập nhật `frontend/components/shared/AppShell.tsx`:

```tsx
"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { AppRole } from "@/lib/nav-config";
import { Sidebar } from "@/components/shared/Sidebar";
import { MobileMenuContext } from "@/components/shared/MobileMenuContext";
import { PatientChatShell } from "@/components/patient-chat/PatientChatShell";

export { useMobileMenu } from "@/components/shared/MobileMenuContext";

export function AppShell({
  role,
  children,
}: {
  role: AppRole;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const hideChrome = pathname?.startsWith("/patient/onboarding");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const openMobileMenu = useCallback(() => setMobileMenuOpen(true), []);
  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

  const value = useMemo(
    () => ({
      mobileMenuOpen,
      openMobileMenu,
      closeMobileMenu,
      setMobileMenuOpen,
      role,
    }),
    [mobileMenuOpen, openMobileMenu, closeMobileMenu, role]
  );

  if (hideChrome) {
    return (
      <MobileMenuContext.Provider value={value}>{children}</MobileMenuContext.Provider>
    );
  }

  // Branch for Patient: Use modern PatientChatShell (No sidebar)
  if (role === "patient") {
    return (
      <MobileMenuContext.Provider value={value}>
        <PatientChatShell>{children}</PatientChatShell>
      </MobileMenuContext.Provider>
    );
  }

  // Branch for Doctor: Keep 100% identical layout and Sidebar
  return (
    <MobileMenuContext.Provider value={value}>
      <div className="bg-[#F7F8FA] text-on-surface flex font-body text-body min-h-screen">
        <Sidebar role={role} />
        <div className="md:ml-[240px] flex-1 flex flex-col w-full min-h-screen">
          <div className="flex-1 w-full flex flex-col overflow-hidden">{children}</div>
        </div>
      </div>
    </MobileMenuContext.Provider>
  );
}
```

### 4. Tiêu chí Hoàn thành
- [ ] Vào `/doctor/*`: Sidebar bên trái và layout doctor giữ nguyên 100%.
- [ ] Vào `/patient/*`: Không còn sidebar trái, hiển thị TopBar glass và Dock nổi bên phải.
