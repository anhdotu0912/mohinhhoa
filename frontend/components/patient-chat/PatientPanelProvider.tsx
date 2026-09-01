"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import type { NotificationOut } from "@/lib/types";

export type PatientPanelKey = "menu" | "notifications" | "health" | null;
export type HealthPanelView = "dock" | "record";
export type NotificationsPanelView =
  | "list"
  | { detailId: string }
  | { escalationId: string };

const NOTIF_SEEN_KEY_PREFIX = "p014.notif.seenAt:";

function getLastSeenAt(userId: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(`${NOTIF_SEEN_KEY_PREFIX}${userId}`);
}

function setLastSeenAt(userId: string, iso: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${NOTIF_SEEN_KEY_PREFIX}${userId}`, iso);
}

function computeHasUnseenBadge(
  notifications: NotificationOut[],
  lastSeenAt: string | null
): boolean {
  const unread = notifications.filter(
    (n) => n.status === "pending" || n.status === "sent"
  );
  if (unread.length === 0) return false;
  if (!lastSeenAt) return true;
  const lastSeenMs = new Date(lastSeenAt).getTime();
  return unread.some((n) => new Date(n.created_at).getTime() > lastSeenMs);
}

export interface PatientPanelState {
  activePanel: PatientPanelKey;
  healthView: HealthPanelView;
  notificationsView: NotificationsPanelView;
  hasUnseenBadge: boolean;
}

export interface PatientPanelContextValue extends PatientPanelState {
  openPanel: (key: Exclude<PatientPanelKey, null>) => void;
  closePanel: () => void;
  openNotificationDetail: (id: string) => void;
  openNotificationThread: (detailId?: string) => void;
  openEscalationThread: (escalationId: string) => void;
  backToNotificationList: () => void;
  goToRecordMetricsForm: () => void;
  backToHealthDock: () => void;
  markNotificationsSeen: () => void;
  refreshNotificationsBadge: () => Promise<void>;
}

const PatientPanelContext = createContext<PatientPanelContextValue | undefined>(undefined);

export function PatientPanelProvider({ children }: { children: ReactNode }) {
  const userId = useAuthStore((s) => s.userId);
  const [activePanel, setActivePanel] = useState<PatientPanelKey>(null);
  const [healthView, setHealthView] = useState<HealthPanelView>("dock");
  const [notificationsView, setNotificationsView] = useState<NotificationsPanelView>("list");
  const [hasUnseenBadge, setHasUnseenBadge] = useState(false);

  const refreshNotificationsBadge = useCallback(async () => {
    if (!userId) {
      setHasUnseenBadge(false);
      return;
    }
    try {
      const data = await api.listNotifications();
      const lastSeen = getLastSeenAt(userId);
      setHasUnseenBadge(computeHasUnseenBadge(data, lastSeen));
    } catch {
      // Ignore badge refresh errors silently
    }
  }, [userId]);

  const markNotificationsSeen = useCallback(() => {
    if (!userId) return;
    setLastSeenAt(userId, new Date().toISOString());
    setHasUnseenBadge(false);
  }, [userId]);

  useEffect(() => {
    void refreshNotificationsBadge();
  }, [refreshNotificationsBadge]);

  useEffect(() => {
    if (activePanel === null) {
      void refreshNotificationsBadge();
    }
  }, [activePanel, refreshNotificationsBadge]);

  const openPanel = useCallback(
    (key: Exclude<PatientPanelKey, null>) => {
      setActivePanel(key);
      setHealthView("dock");
      setNotificationsView("list");
      if (key === "notifications") {
        markNotificationsSeen();
      }
    },
    [markNotificationsSeen]
  );

  const closePanel = useCallback(() => {
    setActivePanel(null);
  }, []);

  const openNotificationDetail = useCallback((id: string) => {
    setNotificationsView({ detailId: id });
  }, []);

  const openNotificationThread = useCallback(
    (detailId?: string) => {
      setActivePanel("notifications");
      setHealthView("dock");
      setNotificationsView(detailId ? { detailId } : "list");
      markNotificationsSeen();
      void refreshNotificationsBadge();
    },
    [markNotificationsSeen, refreshNotificationsBadge]
  );

  const openEscalationThread = useCallback(
    (escalationId: string) => {
      setActivePanel("notifications");
      setHealthView("dock");
      setNotificationsView({ escalationId });
      markNotificationsSeen();
      void refreshNotificationsBadge();
    },
    [markNotificationsSeen, refreshNotificationsBadge]
  );

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
    hasUnseenBadge,
    openPanel,
    closePanel,
    openNotificationDetail,
    openNotificationThread,
    openEscalationThread,
    backToNotificationList,
    goToRecordMetricsForm,
    backToHealthDock,
    markNotificationsSeen,
    refreshNotificationsBadge,
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
