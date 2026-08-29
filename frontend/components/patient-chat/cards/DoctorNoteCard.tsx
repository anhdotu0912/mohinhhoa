"use client";

import React from "react";
import { usePatientPanel } from "../PatientPanelProvider";
import { resolveUserAvatar, userInitials } from "@/lib/avatar";
import type { DoctorNoteItem, DoctorNoteOut } from "@/lib/types";

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
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
}

function asItems(data: DoctorNoteOut): DoctorNoteItem[] {
  if (data.notes && data.notes.length > 0) return data.notes;
  if (data.note?.trim()) {
    return [
      {
        id: "latest",
        title: "",
        note: data.note,
        created_at: data.created_at,
        tags: data.tags,
      },
    ];
  }
  return [];
}

interface DoctorNoteCardProps {
  data: DoctorNoteOut;
}

export function DoctorNoteCard({ data }: DoctorNoteCardProps) {
  const { openPanel } = usePatientPanel();
  const items = asItems(data);
  const doctorName = data.doctor_name?.trim() || "";
  const avatarSrc = resolveUserAvatar(data.doctor_avatar);
  const initials = userInitials(doctorName || "BS");

  return (
    <div className="w-full bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-5 shadow-[0_8px_24px_rgba(25,28,28,0.06)] flex flex-col gap-3.5 sm:gap-4 mt-1 selection:bg-emerald-100">
      <div className="flex items-center gap-3">
        <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden bg-emerald-50 border border-emerald-200/80 shrink-0">
          <div
            translate="no"
            className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-[#006857]"
          >
            {initials}
          </div>
          {avatarSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={doctorName || "Bác sĩ phụ trách"}
              className="relative z-10 w-full h-full object-cover"
              src={avatarSrc}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : null}
        </div>

        <div className="flex flex-col min-w-0">
          <h4 className="font-bold text-sm sm:text-base text-slate-900 truncate">
            {doctorName || "Bác sĩ phụ trách"}
          </h4>
          <p className="text-[11px] sm:text-xs text-slate-600 font-medium">
            Lời dặn đã gửi cho bạn
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-slate-600 bg-slate-50 rounded-xl px-3.5 py-3 border border-slate-200/80">
          Chưa có lời dặn nào gần đây.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/80 flex gap-3 items-start"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#006857] shrink-0 mt-1.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900 leading-snug line-clamp-1">
                    {item.title?.trim() || "Lời dặn"}
                  </p>
                  <span className="text-[11px] text-slate-500 shrink-0 font-medium">
                    {formatRelativeTime(item.created_at)}
                  </span>
                </div>
                <p className="text-xs sm:text-[13px] text-slate-700 mt-1 line-clamp-2 leading-relaxed">
                  {item.note}
                </p>
                {item.tags && item.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {item.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-[#006857] border border-emerald-200/80"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {(data.has_more || items.length > 0) && (
        <div className="flex justify-end pt-1 border-t border-slate-100">
          <button
            type="button"
            onClick={() => openPanel("notifications")}
            className="inline-flex items-center gap-1.5 text-[#006857] hover:text-[#005245] font-bold cursor-pointer transition-colors text-xs py-1"
          >
            <span>Xem tất cả thông báo</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>
      )}
    </div>
  );
}
