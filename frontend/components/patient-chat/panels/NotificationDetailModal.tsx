"use client";

import React from "react";
import type { NotificationOut } from "@/lib/types";

interface NotificationDetailModalProps {
  notification: NotificationOut;
  onClose: () => void;
  onOpenMenu?: () => void;
}

export function NotificationDetailModal({
  notification,
  onClose,
  onOpenMenu,
}: NotificationDetailModalProps) {
  const isPlanApproved =
    notification.type === "plan_approved" ||
    notification.title.toLowerCase().includes("thực đơn") ||
    notification.title.toLowerCase().includes("kế hoạch");

  const formattedTime = new Date(notification.created_at).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Đóng chi tiết thông báo"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onClose();
        }}
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm cursor-pointer"
      />

      {/* Centered Modal Card Dialog */}
      <div className="relative w-[92%] max-w-2xl max-h-[85vh] bg-white border border-slate-200/90 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-10 animate-in fade-in zoom-in-95 duration-200 my-auto">
        {/* Top accent bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#006857] to-emerald-500" />

        {/* Fixed Header */}
        <div className="px-6 md:px-8 py-5 border-b border-slate-100 flex items-start justify-between gap-3 bg-white/95 backdrop-blur-md shrink-0">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 text-[#006857] border border-emerald-200 mt-0.5 shadow-2xs">
              <span className="material-symbols-outlined text-[22px]">
                {notification.type === "plan_approved"
                  ? "verified"
                  : notification.type === "warning"
                  ? "warning"
                  : "notifications"}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Chi tiết thông báo
              </span>
              <h3 className="font-bold text-base md:text-lg text-slate-900 leading-snug">
                {notification.title}
              </h3>
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <span className="font-semibold text-emerald-800">
                  Hệ thống y tế VMEC-10
                </span>
                <span className="w-1 h-1 rounded-full bg-slate-300" />
                <span>{formattedTime}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
            title="Đóng (ESC)"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Scrollable Body Content */}
        <div className="p-6 md:p-8 flex-1 overflow-y-auto custom-scrollbar">
          <div className="text-sm md:text-[15px] text-slate-800 leading-relaxed whitespace-pre-wrap bg-slate-50/90 p-4.5 rounded-xl border border-slate-200/80 shadow-2xs">
            {notification.body}
          </div>
        </div>

        {/* Fixed Footer Actions */}
        <div className="px-6 md:px-8 py-4 border-t border-slate-100 bg-white/95 backdrop-blur-md shrink-0 flex flex-col sm:flex-row gap-2.5 justify-end items-center">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4.5 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Đóng
          </button>

          {isPlanApproved && onOpenMenu && (
            <button
              type="button"
              onClick={onOpenMenu}
              className="w-full sm:w-auto px-4.5 py-2 rounded-lg bg-gradient-to-r from-[#006857] to-emerald-600 hover:from-[#005245] hover:to-emerald-700 text-white font-bold text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-emerald-700/20"
            >
              <span className="material-symbols-outlined text-[18px]">restaurant_menu</span>
              Xem thực đơn tuần mới
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
