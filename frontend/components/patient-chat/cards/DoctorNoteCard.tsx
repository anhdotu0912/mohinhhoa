"use client";

import React from "react";
import { usePatientPanel } from "../PatientPanelProvider";
import type { DoctorNoteOut } from "@/lib/types";

const DEFAULT_AVATAR =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBSX_YybfKfT0_-mukPxAmqqyRU53FeqJQTvIQX1gHbQHXiGVFWFCxERy2tYf-lN3IqMV1BZ1mUG6KINhl2tMreNG9LrG-P0RPYcSqMx0bfld15SoeaKlc_THNP66j1x_A1-FdQSN3oD_xNKjRs9vnT48bH7G3VJsTIBEEScHM-ziqK3CTj495lX2pp7jRAlO97T_QBwG2RkBRZtsD4rTPlMB0DsF6yba58qgl3XZ_vOIPO8ZyRIaWqlA";

const TAG_STYLES = [
  { type: "warning" as const, icon: "warning" },
  { type: "info" as const, icon: "event" },
  { type: "success" as const, icon: "check_circle" },
];

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface DoctorNoteCardProps {
  data: DoctorNoteOut;
}

export function DoctorNoteCard({ data }: DoctorNoteCardProps) {
  const { openPanel } = usePatientPanel();
  const tags = data.tags ?? [];

  return (
    <div className="w-full bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-5 shadow-xs flex flex-col gap-3.5 sm:gap-4 relative overflow-hidden mt-1">
      <div className="absolute -top-12 -right-12 w-36 h-36 bg-emerald-500/8 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 relative z-10">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={data.doctor_name}
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-emerald-500/40 shadow-xs"
              src={DEFAULT_AVATAR}
            />
            <span
              className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-[#006857] border-2 border-white rounded-full flex items-center justify-center text-[8px] sm:text-[9px] text-white shadow-2xs"
              title="Bác sĩ đã xác thực"
            >
              ✓
            </span>
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <h4 className="font-extrabold text-sm sm:text-base text-slate-900 truncate">
                {data.doctor_name}
              </h4>
              <span className="text-[9px] sm:text-[10px] bg-emerald-50 text-[#006857] border border-emerald-200/80 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Bác sĩ điều trị
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-600 font-medium flex items-center gap-1 mt-0.5 truncate">
              <span className="material-symbols-outlined text-[14px] sm:text-[15px] text-[#006857] shrink-0">
                stethoscope
              </span>
              <span>VMEC-10 Clinical Nutrition</span>
            </p>
          </div>
        </div>

        <div className="self-start sm:self-auto inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-slate-500 bg-slate-50 border border-slate-200/80 px-2.5 py-0.5 sm:py-1 rounded-full shadow-2xs shrink-0">
          <span className="material-symbols-outlined text-[13px] sm:text-[14px] text-slate-400">schedule</span>
          <span>{formatTimestamp(data.created_at)}</span>
        </div>
      </div>

      <div className="bg-slate-50/90 rounded-xl p-3 sm:p-4 border border-slate-200/80 relative z-10 shadow-2xs">
        <div className="flex items-start gap-2.5 sm:gap-3">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-50 text-[#006857] flex items-center justify-center shrink-0 mt-0.5 border border-emerald-200/60">
            <span className="material-symbols-outlined text-[18px] sm:text-[20px]">format_quote</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] sm:text-[11px] font-bold text-[#006857] uppercase tracking-wider">
              Lời dặn điều trị &amp; Lối sống
            </span>
            <p className="text-xs sm:text-[14.5px] text-slate-800 italic font-medium leading-relaxed">
              &ldquo;{data.note}&rdquo;
            </p>
          </div>
        </div>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-col gap-1.5 sm:gap-2 relative z-10">
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Chỉ định quan trọng cần lưu ý:
          </span>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {tags.map((text, index) => {
              const style = TAG_STYLES[index % TAG_STYLES.length];
              return (
                <div
                  key={`${text}-${index}`}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold shadow-2xs transition-all ${
                    style.type === "warning"
                      ? "bg-rose-50 text-rose-800 border border-rose-200/90"
                      : style.type === "info"
                      ? "bg-blue-50 text-blue-800 border border-blue-200/90"
                      : "bg-emerald-50 text-[#006857] border border-emerald-200/90"
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px] sm:text-[16px] shrink-0">
                    {style.icon}
                  </span>
                  <span>{text}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-3 pt-2.5 sm:pt-3 border-t border-slate-100 text-xs relative z-10">
        <div className="flex items-center gap-1.5 text-slate-500 text-[11px] sm:text-xs">
          <span className="material-symbols-outlined text-[15px] sm:text-[16px] text-emerald-600">verified</span>
          <span>Xác thực bởi Hệ thống Y khoa VMEC-10</span>
        </div>

        <button
          type="button"
          onClick={() => openPanel("menu")}
          className="inline-flex items-center gap-1.5 text-[#006857] hover:text-[#005245] font-bold cursor-pointer transition-colors group text-xs"
        >
          <span>Xem phác đồ thực đơn</span>
          <span className="material-symbols-outlined text-[15px] sm:text-[16px] group-hover:translate-x-0.5 transition-transform">
            arrow_forward
          </span>
        </button>
      </div>
    </div>
  );
}
