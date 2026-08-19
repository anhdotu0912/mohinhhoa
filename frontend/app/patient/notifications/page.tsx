"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TopBar } from "@/components/shared/TopBar";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import type {
  NotificationOut,
  NotificationStatus,
  NotificationType,
} from "@/lib/types";

type TimeFilter = "today" | "7d" | "30d" | "all";

const TIME_FILTER_LABELS: Record<TimeFilter, string> = {
  today: "Hôm nay",
  "7d": "7 ngày",
  "30d": "30 ngày",
  all: "Tất cả",
};

const PAGE_SIZE = 5;

type NotificationVisual = {
  icon: string;
  iconClass: string;
  fill?: boolean;
};

const TYPE_VISUALS: Record<string, NotificationVisual> = {
  meal_reminder: { icon: "restaurant", iconClass: "text-[#2F8F7A]" },
  adherence_checkin: { icon: "fact_check", iconClass: "text-[#2F8F7A]" },
  interaction_followup: {
    icon: "warning",
    iconClass: "text-amber-500",
    fill: true,
  },
  plan_approved: {
    icon: "check_circle",
    iconClass: "text-green-600",
    fill: true,
  },
  plan_expiring: { icon: "schedule", iconClass: "text-amber-500" },
  plan_expired: { icon: "event_busy", iconClass: "text-red-600" },
  manual_reminder: { icon: "campaign", iconClass: "text-[#2F8F7A]" },
};

const RESOLVED_STATUSES: NotificationStatus[] = ["read", "done", "dismissed"];
const ACTIONABLE_STATUSES: NotificationStatus[] = ["pending", "sent"];

function formatNotificationTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24)
  );

  const time = date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (diffDays === 0) return `${time}, Hôm nay`;
  if (diffDays === 1) return "Hôm qua";
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getVisual(type: NotificationType | string): NotificationVisual {
  return (
    TYPE_VISUALS[type] ?? {
      icon: "notifications",
      iconClass: "text-[#2F8F7A]",
    }
  );
}

function isActionable(status: NotificationStatus | string): boolean {
  return ACTIONABLE_STATUSES.includes(status as NotificationStatus);
}

function isResolved(status: NotificationStatus | string): boolean {
  return RESOLVED_STATUSES.includes(status as NotificationStatus);
}

function adherenceLabel(adherence: unknown): string | null {
  if (adherence === "yes") return "Đã ăn đúng thực đơn";
  if (adherence === "partial") return "Có sai lệch một phần";
  if (adherence === "no") return "Không theo thực đơn";
  return null;
}

export default function PatientNotificationsPage() {
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);

  const [notifications, setNotifications] = useState<NotificationOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("today");
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filteredNotifications = useMemo(() => {
    const now = new Date();
    const startOf = (d: Date) =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const todayStart = startOf(now);

    return notifications.filter((n) => {
      const ts = n.scheduled_at ?? n.created_at;
      if (!ts) return timeFilter === "all";
      const date = new Date(ts);
      if (Number.isNaN(date.getTime())) return timeFilter === "all";
      if (timeFilter === "today") return date >= todayStart;
      if (timeFilter === "7d") {
        const cutoff = new Date(todayStart);
        cutoff.setDate(cutoff.getDate() - 6);
        return date >= cutoff;
      }
      if (timeFilter === "30d") {
        const cutoff = new Date(todayStart);
        cutoff.setDate(cutoff.getDate() - 29);
        return date >= cutoff;
      }
      return true;
    });
  }, [notifications, timeFilter]);

  const visibleNotifications = filteredNotifications.slice(0, visibleCount);
  const hasMore = filteredNotifications.length > visibleCount;

  const loadNotifications = useCallback(async () => {
    if (!token || role !== "patient") return;
    setLoading(true);
    setError(null);
    try {
      const rows = await api.listNotifications();
      setNotifications(rows);
    } catch {
      setError("Không tải được thông báo. Vui lòng thử lại.");
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [token, role]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") {
        void loadNotifications();
      }
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loadNotifications]);

  const updateNotification = (updated: NotificationOut) => {
    setNotifications((prev) =>
      prev.map((row) => (row.id === updated.id ? updated : row))
    );
  };

  const handleRead = async (id: string) => {
    setActingId(id);
    try {
      const updated = await api.markNotificationRead(id);
      updateNotification(updated);
    } catch {
      setError("Không thể cập nhật thông báo.");
    } finally {
      setActingId(null);
    }
  };

  const handleDismiss = async (id: string) => {
    setActingId(id);
    try {
      const updated = await api.markNotificationDismiss(id);
      updateNotification(updated);
    } catch {
      setError("Không thể bỏ qua thông báo.");
    } finally {
      setActingId(null);
    }
  };

  const handleDone = async (
    id: string,
    adherence: "yes" | "partial" | "no"
  ) => {
    setActingId(id);
    try {
      const updated = await api.markNotificationDone(id, adherence);
      updateNotification(updated);
    } catch {
      setError("Không thể ghi nhận tuân thủ.");
    } finally {
      setActingId(null);
    }
  };

  return (
    <>
      <TopBar title="Thông báo" />
      <main className="flex-1 w-full p-4 md:p-8 pb-12">
        <div className="max-w-[800px] mx-auto w-full">
          {/* Toolbar */}
          <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
            <p className="font-caption text-caption text-on-surface-variant">
              Nhắc nhở từ bác sĩ và check-in tuân thủ sẽ cập nhật khi bạn quay lại trang này.
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  void api.simulateNotifications().then(() => loadNotifications()).catch(() => undefined);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Seed demo
              </button>
              {/* Time filter */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowFilterMenu((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#2f8f7a]/40 px-3 py-1.5 text-sm font-semibold text-[#2F8F7A] hover:bg-[#2F8F7A]/10"
                >
                  <span className="material-symbols-outlined text-[16px]">filter_list</span>
                  {TIME_FILTER_LABELS[timeFilter]}
                  <span className="material-symbols-outlined text-[14px]">
                    {showFilterMenu ? "expand_less" : "expand_more"}
                  </span>
                </button>
                {showFilterMenu && (
                  <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-lg py-1 min-w-[120px]">
                    {(Object.keys(TIME_FILTER_LABELS) as TimeFilter[]).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => {
                          setTimeFilter(f);
                          setVisibleCount(PAGE_SIZE);
                          setShowFilterMenu(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                          timeFilter === f
                            ? "bg-[#2F8F7A]/10 text-[#2F8F7A] font-semibold"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {TIME_FILTER_LABELS[f]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Refresh */}
              <button
                type="button"
                onClick={() => void loadNotifications()}
                disabled={loading}
                className="inline-flex items-center gap-1 rounded-lg border border-[#2f8f7a]/40 px-3 py-1.5 text-sm font-semibold text-[#2F8F7A] hover:bg-[#2F8F7A]/10 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">refresh</span>
                Làm mới
              </button>
            </div>
          </div>
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <p className="font-body text-body text-on-surface-variant">
              Đang tải thông báo...
            </p>
          ) : filteredNotifications.length === 0 ? (
            <div className="rounded-lg border border-[#2f8f7a]/30 bg-[#2f8f7a]/[0.06] p-card-padding text-center">
              <span className="material-symbols-outlined text-4xl text-[#2F8F7A] mb-2">
                notifications_off
              </span>
              <p className="font-body text-body text-on-surface-variant">
                {timeFilter === "today"
                  ? "Hôm nay chưa có thông báo nào."
                  : "Không có thông báo trong khoảng thời gian này."}
              </p>
              {timeFilter !== "all" && (
                <button
                  type="button"
                  onClick={() => { setTimeFilter("all"); setVisibleCount(PAGE_SIZE); }}
                  className="mt-3 text-sm font-semibold text-[#2F8F7A] hover:underline"
                >
                  Xem tất cả thông báo
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {visibleNotifications.map((notification) => {
                const visual = getVisual(notification.type);
                const unresolved = isActionable(notification.status);
                const resolved = isResolved(notification.status);
                const busy = actingId === notification.id;
                const timeLabel = formatNotificationTime(
                  notification.scheduled_at ?? notification.created_at
                );
                const recordedAdherence = adherenceLabel(
                  notification.payload?.adherence
                );

                return (
                  <div
                    key={notification.id}
                    className={`bg-[#2f8f7a]/[0.06] border border-[#2f8f7a]/30 rounded-lg shadow-subtle flex p-card-padding relative overflow-hidden ${
                      unresolved ? "" : "opacity-90"
                    }`}
                  >
                    {unresolved && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#2F8F7A]" />
                    )}
                    <div
                      className={`flex items-start gap-4 w-full ${
                        unresolved ? "pl-2" : ""
                      }`}
                    >
                      <div className="flex-shrink-0 mt-1">
                        <span
                          className={`material-symbols-outlined ${visual.iconClass}`}
                          style={
                            visual.fill
                              ? { fontVariationSettings: "'FILL' 1" }
                              : undefined
                          }
                        >
                          {visual.icon}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1 gap-3">
                          <h3 className="font-body-bold text-on-surface font-semibold">
                            {notification.title}
                          </h3>
                          {timeLabel && (
                            <span className="font-caption text-caption text-on-surface-variant whitespace-nowrap">
                              {timeLabel}
                            </span>
                          )}
                        </div>
                        <p className="font-body text-body text-on-surface-variant mb-2">
                          {notification.body}
                        </p>

                        {resolved && recordedAdherence && (
                          <p className="font-caption text-caption text-green-700 mb-2">
                            Đã ghi nhận: {recordedAdherence}
                          </p>
                        )}

                        {notification.type === "interaction_followup" &&
                          unresolved && (
                            <Link
                              className="font-body-bold text-body-bold text-[#2F8F7A] hover:underline inline-flex items-center gap-1 font-semibold mb-2"
                              href="/patient/meals"
                            >
                              Xem thực đơn
                              <span className="material-symbols-outlined text-[16px]">
                                arrow_forward
                              </span>
                            </Link>
                          )}

                        {notification.type === "adherence_checkin" &&
                          unresolved && (
                            <div className="flex flex-wrap gap-2 mt-1">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void handleDone(notification.id, "yes")
                                }
                                className="rounded-lg bg-[#2F8F7A] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#267a68] disabled:opacity-50"
                              >
                                Đã ăn đúng
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void handleDone(notification.id, "partial")
                                }
                                className="rounded-lg border border-[#2F8F7A] px-3 py-1.5 text-sm font-semibold text-[#2F8F7A] hover:bg-[#2F8F7A]/10 disabled:opacity-50"
                              >
                                Có sai lệch
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void handleDone(notification.id, "no")
                                }
                                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-on-surface-variant hover:bg-slate-50 disabled:opacity-50"
                              >
                                Không theo kế hoạch
                              </button>
                            </div>
                          )}

                        {notification.type !== "adherence_checkin" &&
                          unresolved && (
                            <div className="flex flex-wrap gap-2 mt-1">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void handleRead(notification.id)
                                }
                                className="rounded-lg bg-[#2F8F7A] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#267a68] disabled:opacity-50"
                              >
                                Đã đọc
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void handleDismiss(notification.id)
                                }
                                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-on-surface-variant hover:bg-slate-50 disabled:opacity-50"
                              >
                                Bỏ qua
                              </button>
                            </div>
                          )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {hasMore && (
                <button
                  type="button"
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  className="w-full py-2.5 rounded-lg border border-[#2f8f7a]/40 text-sm font-semibold text-[#2F8F7A] hover:bg-[#2F8F7A]/10 transition-colors"
                >
                  Xem thêm ({filteredNotifications.length - visibleCount} thông báo)
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Đóng dropdown filter khi click ra ngoài */}
      {showFilterMenu && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setShowFilterMenu(false)}
        />
      )}
    </>
  );
}
