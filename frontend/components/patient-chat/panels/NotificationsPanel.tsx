"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { usePatientPanel } from "../PatientPanelProvider";
import { api } from "@/lib/api";
import { ApiError, type NotificationOut } from "@/lib/types";
import { NotificationDetailModal } from "./NotificationDetailModal";
import { useVietnamToday } from "@/lib/use-vietnam-today";

const PAGE_SIZE = 6;

export function NotificationsPanel() {
  const today = useVietnamToday();
  const {
    closePanel,
    notificationsView,
    openNotificationDetail,
    backToNotificationList,
  } = usePatientPanel();

  const [notifications, setNotifications] = useState<NotificationOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const data = await api.listNotifications();
      setNotifications(data);
      setPage(1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không tải được danh sách thông báo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData, today]);

  const handleSelectNotification = async (notif: NotificationOut) => {
    openNotificationDetail(notif.id);
    if (notif.status === "pending" || notif.status === "sent") {
      try {
        await api.markNotificationRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, status: "read" } : n))
        );
      } catch {
        // Ignore read status error silently
      }
    }
  };

  const openedFromChat =
    typeof notificationsView === "object" && "escalationId" in notificationsView;
  const escalationIdFromView = openedFromChat ? notificationsView.escalationId : null;
  const selectedNotification =
    typeof notificationsView === "object" && "detailId" in notificationsView
      ? notifications.find((n) => n.id === notificationsView.detailId) || null
      : escalationIdFromView
        ? notifications.find((n) => n.related_ids?.escalation_id === escalationIdFromView) ||
          null
        : null;

  const unreadCount = notifications.filter(
    (n) => n.status === "pending" || n.status === "sent"
  ).length;

  const totalPages = Math.max(1, Math.ceil(notifications.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedNotifications = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return notifications.slice(start, start + PAGE_SIZE);
  }, [notifications, safePage]);

  const formatRelativeTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Vừa xong";
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays === 1) return "Hôm qua";
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  };

  const getDotColor = (type: string) => {
    switch (type) {
      case "plan_approved":
        return "bg-emerald-500";
      case "manual_reminder":
        return "bg-[#006857]";
      case "warning":
      case "interaction_followup":
      case "plan_expiring":
        return "bg-amber-500";
      case "plan_expired":
        return "bg-rose-500";
      case "escalation_sent":
        return "bg-teal-600";
      case "escalation_reply":
        return "bg-emerald-600";
      case "meal_reminder":
      case "adherence_checkin":
        return "bg-blue-500";
      default:
        return "bg-gray-400";
    }
  };

  const getTypeBadge = (type: string) => {
    if (type === "manual_reminder") {
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold shrink-0">
          <span className="material-symbols-outlined text-[12px]">clinical_notes</span>
          Bác sĩ
        </span>
      );
    }
    if (type === "escalation_sent") {
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-bold shrink-0">
          <span className="material-symbols-outlined text-[12px]">forum</span>
          Đã gửi
        </span>
      );
    }
    if (type === "escalation_reply") {
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold shrink-0">
          <span className="material-symbols-outlined text-[12px]">mark_chat_read</span>
          Bác sĩ phản hồi
        </span>
      );
    }
    return null;
  };

  if (openedFromChat && escalationIdFromView) {
    return (
      <NotificationDetailModal
        notification={selectedNotification}
        escalationId={escalationIdFromView}
        onClose={closePanel}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Đóng bảng thông báo"
        onClick={closePanel}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") closePanel();
        }}
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity cursor-pointer"
      />

      {/* Centered Modal Card Dialog */}
      <div className="relative w-full max-w-2xl max-h-[94vh] sm:max-h-[88vh] bg-white rounded-2xl shadow-2xl z-10 flex flex-col border border-slate-200/90 animate-in fade-in zoom-in-95 duration-200 overflow-hidden my-auto m-2 sm:m-0">
        {/* Fixed Header */}
        <div className="px-4 sm:px-6 md:px-8 py-3.5 sm:py-5 min-h-[64px] sm:min-h-[78px] border-b border-slate-100 flex items-center justify-between bg-white/95 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-emerald-50 text-[#006857] flex items-center justify-center border border-emerald-200 shadow-2xs shrink-0">
              <span className="material-symbols-outlined text-[20px] sm:text-[24px]">
                notifications
              </span>
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base sm:text-xl text-slate-900 leading-tight truncate">Thông báo y tế</h2>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] sm:text-[11px] font-extrabold border border-emerald-200 shadow-2xs shrink-0">
                    {unreadCount} MỚI
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-[13px] text-slate-500 font-medium mt-0.5 truncate">Cập nhật kế hoạch &amp; nhắc nhở từ bác sĩ</p>
            </div>
          </div>
          <button
            type="button"
            onClick={closePanel}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
            title="Đóng (ESC)"
          >
            <span className="material-symbols-outlined text-[20px] sm:text-[22px]">close</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-3.5 sm:p-6 md:p-8 flex-1 overflow-y-auto custom-scrollbar space-y-3">
          {loading && (
            <div className="py-12 text-center text-xs text-slate-500">
              <span className="material-symbols-outlined animate-spin text-[24px] text-[#006857] mb-2">
                progress_activity
              </span>
              <p>Đang tải thông báo...</p>
            </div>
          )}

          {error && !loading && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
              {error}
            </div>
          )}

          {!loading && !error && notifications.length === 0 && (
            <div className="p-8 bg-slate-50 rounded-xl text-center text-xs text-slate-500 border border-slate-200">
              <span className="material-symbols-outlined text-3xl text-slate-300 mb-1">
                notifications_off
              </span>
              <p>Hiện không có thông báo nào.</p>
            </div>
          )}

          {!loading &&
            paginatedNotifications.map((n) => {
              const isUnread = n.status === "pending" || n.status === "sent";

              return (
                <div
                  key={n.id}
                  onClick={() => void handleSelectNotification(n)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex gap-3.5 items-start ${
                    isUnread
                      ? "bg-white border-emerald-200 shadow-xs hover:border-emerald-400 hover:shadow-sm"
                      : "bg-slate-50/70 border-slate-200/80 hover:bg-white hover:border-slate-300 opacity-90"
                  }`}
                >
                  <div
                    className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${getDotColor(n.type)} shadow-2xs`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h4
                          className={`text-sm leading-snug line-clamp-1 ${
                            isUnread ? "font-bold text-slate-900" : "font-semibold text-slate-700"
                          }`}
                        >
                          {n.title}
                        </h4>
                        {getTypeBadge(n.type)}
                      </div>
                      <span className="text-[11px] text-slate-400 shrink-0 font-medium">
                        {formatRelativeTime(n.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                      {n.body}
                    </p>
                  </div>
                </div>
              );
            })}
        </div>

        {!loading && !error && notifications.length > PAGE_SIZE && (
          <div className="px-6 md:px-8 py-4 border-t border-slate-100 flex items-center justify-between bg-white/95 shrink-0">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Trước
            </button>
            <span className="text-xs font-semibold text-slate-500">
              Trang {safePage}/{totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Sau
            </button>
          </div>
        )}
      </div>

      {/* Modal Detail Overlay */}
      {selectedNotification && (
        <NotificationDetailModal
          notification={selectedNotification}
          onClose={backToNotificationList}
        />
      )}
    </div>
  );
}
