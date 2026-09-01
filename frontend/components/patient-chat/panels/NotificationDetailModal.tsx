"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { EscalationOut, EscalationStatus, NotificationOut } from "@/lib/types";
import { ApiError } from "@/lib/types";
import { usePatientPanel } from "../PatientPanelProvider";
import { useAuthStore } from "@/lib/auth-store";
import { APP_NAME } from "@/lib/brand";
import { api } from "@/lib/api";
import { EscalationThread } from "@/components/shared/EscalationThread";
import { resolveUserAvatar, userInitials } from "@/lib/avatar";

interface NotificationDetailModalProps {
  notification?: NotificationOut | null;
  escalationId?: string | null;
  onClose: () => void;
}

function notificationIcon(type: string): string {
  switch (type) {
    case "plan_approved":
      return "verified";
    case "manual_reminder":
      return "clinical_notes";
    case "interaction_followup":
    case "plan_expiring":
      return "warning";
    default:
      return "notifications";
  }
}

function extractReminderTags(notification: NotificationOut): string[] {
  const raw = notification.payload?.tags;
  return Array.isArray(raw) ? raw.filter((tag): tag is string => typeof tag === "string") : [];
}

function threadStatusMeta(status?: EscalationStatus | null) {
  if (status === "waiting_patient") {
    return { label: "Đã phản hồi", className: "text-[#006857]", dot: "bg-emerald-500" };
  }
  if (status === "resolved") {
    return { label: "Đã kết thúc", className: "text-slate-500", dot: "bg-slate-400" };
  }
  return { label: "Đang chờ trả lời", className: "text-slate-600", dot: "bg-amber-400" };
}

function PersonMark({
  name,
  avatar,
}: {
  name: string;
  avatar?: string | null;
}) {
  const src = resolveUserAvatar(avatar);
  const initials = userInitials(name);
  return (
    <div className="relative w-11 h-11 rounded-full overflow-hidden bg-emerald-50 border border-emerald-200/80 shrink-0">
      <div
        translate="no"
        className="absolute inset-0 flex items-center justify-center text-[12px] font-bold text-[#006857]"
      >
        {initials}
      </div>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          src={src}
          className="relative z-10 w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : null}
    </div>
  );
}

export function NotificationDetailModal({
  notification,
  escalationId: escalationIdProp,
  onClose,
}: NotificationDetailModalProps) {
  const { openPanel } = usePatientPanel();
  const assignedDoctor = useAuthStore((s) => s.assignedDoctor);
  const doctorLabel = assignedDoctor?.full_name?.trim() || "Bác sĩ phụ trách";
  const isPlanApproved = notification?.type === "plan_approved";
  const isManualReminder = notification?.type === "manual_reminder";
  const escalationId =
    escalationIdProp ||
    (typeof notification?.related_ids?.escalation_id === "string"
      ? notification.related_ids.escalation_id
      : null);
  const isEscalation =
    Boolean(escalationId) ||
    notification?.type === "escalation_sent" ||
    notification?.type === "escalation_reply";
  const reminderTags = notification ? extractReminderTags(notification) : [];

  const [thread, setThread] = useState<EscalationOut | null>(null);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const loadThread = useCallback(async () => {
    if (!escalationId) return;
    setThreadError(null);
    try {
      setThread(await api.getChatEscalation(escalationId));
    } catch (err) {
      setThreadError(err instanceof ApiError ? err.message : "Không tải được cuộc trao đổi.");
    }
  }, [escalationId]);

  useEffect(() => {
    if (!isEscalation) return;
    void loadThread();
  }, [isEscalation, loadThread]);

  const formattedTime = notification
    ? new Date(notification.created_at).toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "";

  const handleViewMealPlan = () => {
    onClose();
    openPanel("menu");
  };

  if (isEscalation) {
    const meta = threadStatusMeta(thread?.status);
    return (
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6">
        <div
          role="button"
          tabIndex={0}
          aria-label="Đóng cuộc trao đổi"
          onClick={onClose}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onClose();
          }}
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm cursor-pointer"
        />

        <div className="relative w-full sm:max-w-xl h-[min(92dvh,760px)] sm:h-[min(86dvh,720px)] bg-white sm:rounded-xl overflow-hidden flex flex-col z-10 shadow-[0_24px_64px_rgba(25,28,28,0.18)] animate-in fade-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
          <header className="px-4 sm:px-5 py-3.5 border-b border-slate-100 flex items-center gap-3 bg-white shrink-0">
            <PersonMark name={doctorLabel} avatar={assignedDoctor?.avatar} />
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-[16px] text-slate-900 truncate leading-tight">
                {doctorLabel}
              </h2>
              <p className={`mt-0.5 text-[12px] font-semibold inline-flex items-center gap-1.5 ${meta.className}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                {meta.label}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-md flex items-center justify-center hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
              title="Đóng (ESC)"
            >
              <span className="material-symbols-outlined text-[22px]">close</span>
            </button>
          </header>

          {thread ? (
            <EscalationThread
              thread={thread}
              viewer="patient"
              counterpartName={doctorLabel}
              counterpartAvatar={assignedDoctor?.avatar}
              sending={sending}
              error={threadError}
              onSend={(body) => {
                if (!escalationId) return;
                setSending(true);
                void api
                  .replyChatEscalation(escalationId, body)
                  .then(setThread)
                  .catch((err) => {
                    setThreadError(
                      err instanceof ApiError ? err.message : "Không gửi được tin nhắn."
                    );
                  })
                  .finally(() => setSending(false));
              }}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center px-6 text-sm text-slate-500 bg-[#f8fafc]">
              {threadError || "Đang tải cuộc trao đổi…"}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
      <div
        role="button"
        tabIndex={0}
        aria-label="Đóng chi tiết thông báo"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onClose();
        }}
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm cursor-pointer transition-opacity"
      />

      <div className="relative w-full max-w-lg bg-white border border-slate-200/90 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-10 animate-in fade-in zoom-in-95 duration-200 my-auto">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-3 bg-white shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            {isManualReminder ? (
              <PersonMark name={doctorLabel} avatar={assignedDoctor?.avatar} />
            ) : (
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-emerald-50 text-[#006857] border border-emerald-200">
                <span className="material-symbols-outlined text-[22px]">
                  {notificationIcon(notification?.type || "")}
                </span>
              </div>
            )}
            <div className="flex flex-col gap-0.5 min-w-0">
              <h3 className="font-bold text-base sm:text-lg text-slate-900 leading-snug break-words">
                {notification?.title || "Thông báo"}
              </h3>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <span className="font-semibold text-emerald-800 truncate">
                  {isManualReminder ? doctorLabel : `Hệ thống y tế ${APP_NAME}`}
                </span>
                {formattedTime ? (
                  <>
                    <span className="w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                    <span className="shrink-0">{formattedTime}</span>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
            title="Đóng (ESC)"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-3.5 custom-scrollbar max-h-[60vh] overflow-y-auto">
          <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/70 space-y-2">
            <p className="text-sm md:text-[15px] text-slate-800 leading-relaxed whitespace-pre-wrap">
              {notification?.body?.trim() || "Không có nội dung chi tiết."}
            </p>
          </div>

          {isManualReminder && reminderTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {reminderTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200/90"
                >
                  <span className="material-symbols-outlined text-[13px] text-amber-600">
                    bookmark
                  </span>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/60 shrink-0 flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors cursor-pointer text-center"
          >
            Đóng
          </button>

          {isPlanApproved && (
            <button
              type="button"
              onClick={handleViewMealPlan}
              className="px-4 py-2.5 rounded-xl bg-[#006857] hover:bg-[#005445] text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">restaurant_menu</span>
              <span>Xem thực đơn tuần mới</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
