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

  // Lock body scroll when panel is open
  useEffect(() => {
    if (activePanel !== null) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [activePanel]);

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
