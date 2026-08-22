# Task 1.1 & 1.2 — Design Tokens & PatientPanelProvider

> **Thư mục:** [`tasks/patient-chat-redesign/phase-1/`](README.md)  
> **Phụ thuộc:** Không có (Task đầu tiên).

---

## Phần 1: T1.1 — Bổ sung Design Tokens vào Tailwind

### 1. Mục tiêu
Thêm các token màu, bóng đổ (shadow), bo góc từ mockup vào cấu hình Tailwind mà **không làm ảnh hưởng** tới các token đang phục vụ giao diện bác sĩ (`role === "doctor"`).

### 2. File tác động
- [frontend/tailwind.config.ts](file:///d:/vinAI/P-014/frontend/tailwind.config.ts)

### 3. Hướng dẫn chi tiết
1. Mở [frontend/tailwind.config.ts](file:///d:/vinAI/P-014/frontend/tailwind.config.ts).
2. Trong khối `theme.extend.colors`, thêm nhóm token mới (đặt comment phân biệt rõ ràng):
   ```ts
   // --- patient-chat mockup tokens (ui/stitch_vmec_10_health_assistant) ---
   "text-primary": "#141b2b",
   "text-secondary": "#3c4a42",
   "glass-surface": "rgba(255, 255, 255, 0.7)",
   "emerald-ring": "rgba(16, 185, 129, 0.4)",
   "inverse-surface": "#2e3131",
   "inverse-on-surface": "#f0f1f1",
   "primary-container": "#10b981",
   "tertiary-container": "#fc7c79",
   "error-container": "#ffdad6",
   "on-error-container": "#93000a",
   "surface-container-low": "#f3f4f4",
   "surface-container-high": "#e7e8e8",
   "surface-container-highest": "#e1e3e3",
   ```
   *(Lưu ý: Nếu key nào đã có trong config hiện tại và trùng màu, giữ nguyên key cũ hoặc merge cẩn thận để không đổi mã màu của Doctor UI)*.

3. Trong khối `theme.extend.boxShadow`, thêm:
   ```ts
   "emerald-ring": "0 0 20px rgba(16, 185, 129, 0.4)",
   "glass-card": "0 8px 32px rgba(16, 185, 129, 0.05)",
   ```

4. Kiểm tra [frontend/app/layout.tsx](file:///d:/vinAI/P-014/frontend/app/layout.tsx):
   - Đảm bảo font `Inter` và `Material Symbols Outlined` đã được nạp qua `@next/font` hoặc Google Fonts (hiện tại `layout.tsx` đã có `Inter` và local font `material-symbols-outlined`).

### 4. Tiêu chí Hoàn thành
- [ ] Chạy `cd frontend && npx tsc --noEmit` không báo lỗi cú pháp config.
- [ ] Các class `bg-glass-surface`, `text-text-primary`, `text-text-secondary`, `shadow-emerald-ring` hoạt động đúng.

---

## Phần 2: T1.2 — `PatientPanelProvider` (Context Quản lý Side Panels)

### 1. Mục tiêu
Tạo React Context và custom hook `usePatientPanel()` để quản lý trạng thái mở/đóng và chuyển đổi view của 3 Side Panels trượt mà **không làm thay đổi URL / router** (giữ nguyên chat làm nền tảng).

### 2. File tác động
- **[NEW]** `frontend/components/patient-chat/PatientPanelProvider.tsx`

### 3. Hướng dẫn chi tiết
Tạo file `frontend/components/patient-chat/PatientPanelProvider.tsx` với nội dung chuẩn:

```tsx
"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

export type PatientPanelKey = "menu" | "notifications" | "health" | null;
export type HealthPanelView = "dock" | "record";
export type NotificationsPanelView = "list" | { detailId: string };

export interface PatientPanelState {
  activePanel: PatientPanelKey;
  healthView: HealthPanelView;
  notificationsView: NotificationsPanelView;
}

export interface PatientPanelContextValue extends PatientPanelState {
  openPanel: (key: Exclude<PatientPanelKey, null>) => void;
  closePanel: () => void;
  openNotificationDetail: (id: string) => void;
  backToNotificationList: () => void;
  goToRecordMetricsForm: () => void;
  backToHealthDock: () => void;
}

const PatientPanelContext = createContext<PatientPanelContextValue | undefined>(undefined);

export function PatientPanelProvider({ children }: { children: ReactNode }) {
  const [activePanel, setActivePanel] = useState<PatientPanelKey>(null);
  const [healthView, setHealthView] = useState<HealthPanelView>("dock");
  const [notificationsView, setNotificationsView] = useState<NotificationsPanelView>("list");

  const openPanel = useCallback((key: Exclude<PatientPanelKey, null>) => {
    setActivePanel(key);
    setHealthView("dock");
    setNotificationsView("list");
  }, []);

  const closePanel = useCallback(() => {
    setActivePanel(null);
  }, []);

  const openNotificationDetail = useCallback((id: string) => {
    setNotificationsView({ detailId: id });
  }, []);

  const backToNotificationList = useCallback(() => {
    setNotificationsView("list");
  }, []);

  const goToRecordMetricsForm = useCallback(() => {
    setHealthView("record");
  }, []);

  const backToHealthDock = useCallback(() => {
    setHealthView("dock");
  }, []);

  // Handle Escape key to close panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activePanel !== null) {
        closePanel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activePanel, closePanel]);

  const value: PatientPanelContextValue = {
    activePanel,
    healthView,
    notificationsView,
    openPanel,
    closePanel,
    openNotificationDetail,
    backToNotificationList,
    goToRecordMetricsForm,
    backToHealthDock,
  };

  return (
    <PatientPanelContext.Provider value={value}>
      {children}
    </PatientPanelContext.Provider>
  );
}

export function usePatientPanel() {
  const context = useContext(PatientPanelContext);
  if (!context) {
    throw new Error("usePatientPanel must be used within a PatientPanelProvider");
  }
  return context;
}
```

### 4. Tiêu chí Hoàn thành
- [ ] Export đầy đủ `PatientPanelProvider`, `usePatientPanel` và các types.
- [ ] Đóng panel khi bấm phím `Escape`.
- [ ] Không có lỗi TypeScript khi compile (`npx tsc --noEmit`).
