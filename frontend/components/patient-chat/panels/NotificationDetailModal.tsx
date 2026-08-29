"use client";

import React from "react";
import type { NotificationOut } from "@/lib/types";
import { usePatientPanel } from "../PatientPanelProvider";
import { useAuthStore } from "@/lib/auth-store";

interface NotificationDetailModalProps {
  notification: NotificationOut;
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

export function NotificationDetailModal({
  notification,
  onClose,
}: NotificationDetailModalProps) {
  const { openPanel } = usePatientPanel();
  const assignedDoctor = useAuthStore((s) => s.assignedDoctor);
  const doctorLabel = assignedDoctor?.full_name?.trim() || "Bác sĩ phụ trách";
  const isPlanApproved = notification.type === "plan_approved";
  const isManualReminder = notification.type === "manual_reminder";
  const reminderTags = extractReminderTags(notification);

  const formattedTime = new Date(notification.created_at).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const handleViewMealPlan = () => {
    onClose();
    openPanel("menu");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
      {/* Backdrop */}
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

      {/* Auto-fit Centered Modal Dialog */}
      <div className="relative w-full max-w-lg bg-white border border-slate-200/90 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-10 animate-in fade-in zoom-in-95 duration-200 my-auto">
        <div className="h-1.5 w-full bg-gradient-to-r from-[#006857] to-emerald-500" />

        {/* Modal Header */}
        <div className="px-4 sm:px-6 md:px-8 py-3.5 sm:py-5 min-h-[64px] sm:min-h-[78px] border-b border-slate-100 flex items-start justify-between gap-3 bg-white/95 backdrop-blur-md shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-2xs border ${
                isManualReminder
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-emerald-50 text-[#006857] border-emerald-200"
              }`}
            >
              <span className="material-symbols-outlined text-[20px] sm:text-[24px]">
                {notificationIcon(notification.type)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {isManualReminder ? "Lời nhắc từ bác sĩ" : "Chi tiết thông báo"}
              </span>
              <h3 className="font-bold text-sm sm:text-lg text-slate-900 leading-snug break-words">
                {notification.title}
              </h3>
              <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-slate-500 font-medium pt-0.5">
                <span className="font-semibold text-emerald-800 truncate">
                  {isManualReminder ? doctorLabel : "Hệ thống y tế VMEC-10"}
                </span>
                <span className="w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                <span className="shrink-0">{formattedTime}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
            title="Đóng (ESC)"
          >
            <span className="material-symbols-outlined text-[20px] sm:text-[22px]">close</span>
          </button>
        </div>

        {/* Modal Body - Semantic Text Block without faux input styling */}
        <div className="p-3.5 sm:p-5 md:p-6 space-y-3.5 max-h-[60vh] overflow-y-auto custom-scrollbar">
          <div className="bg-slate-50/80 rounded-xl p-4 sm:p-4.5 border border-slate-200/70 shadow-2xs space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#006857]">
              <span className="material-symbols-outlined text-[16px]">notes</span>
              <span>Nội dung hướng dẫn y khoa</span>
            </div>
            <p className="text-sm md:text-[15px] text-slate-800 leading-relaxed whitespace-pre-wrap font-normal">
              {notification.body?.trim() || "Không có nội dung chi tiết."}
            </p>
          </div>

          {isManualReminder && reminderTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-xs text-slate-500 font-medium mr-1">Chủ đề:</span>
              {reminderTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200/90 shadow-2xs"
                >
                  <span className="material-symbols-outlined text-[13px] text-amber-600">bookmark</span>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer - Balanced padding, responsive flow, no overflow */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-slate-100 bg-slate-50/60 shrink-0 flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end items-stretch sm:items-center">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors cursor-pointer text-center shadow-2xs"
          >
            Đóng
          </button>

          {isPlanApproved && (
            <button
              type="button"
              onClick={handleViewMealPlan}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#006857] to-emerald-600 hover:from-[#005245] hover:to-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-700/20 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 text-center"
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
