"use client";

import React from "react";
import { MOCK_DOCTOR_NOTE_DATA } from "@/lib/patient-chat-mock-data";
import { usePatientPanel } from "../PatientPanelProvider";

export function DoctorNoteCard() {
  const { openPanel } = usePatientPanel();

  return (
    <div className="w-full bg-white border border-slate-200/90 rounded-2xl p-4.5 sm:p-5 shadow-xs flex flex-col gap-4 relative overflow-hidden mt-1">
      {/* Decorative ambient background */}
      <div className="absolute -top-12 -right-12 w-36 h-36 bg-emerald-500/8 rounded-full blur-3xl pointer-events-none" />

      {/* Header with Doctor Info & Hospital Affiliation */}
      <div className="flex flex-wrap items-start justify-between gap-3 relative z-10">
        <div className="flex items-center gap-3.5">
          {/* Avatar with verified badge */}
          <div className="relative shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={MOCK_DOCTOR_NOTE_DATA.doctorName}
              className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500/40 shadow-xs"
              src={MOCK_DOCTOR_NOTE_DATA.avatarSrc}
            />
            <span
              className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-[#006857] border-2 border-white rounded-full flex items-center justify-center text-[9px] text-white shadow-2xs"
              title="Bác sĩ đã xác thực"
            >
              ✓
            </span>
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-extrabold text-sm sm:text-base text-slate-900">
                {MOCK_DOCTOR_NOTE_DATA.doctorName}
              </h4>
              <span className="text-[10px] bg-emerald-50 text-[#006857] border border-emerald-200/80 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                {MOCK_DOCTOR_NOTE_DATA.title}
              </span>
            </div>
            <p className="text-xs text-slate-600 font-medium flex items-center gap-1 mt-0.5 truncate">
              <span className="material-symbols-outlined text-[15px] text-[#006857] shrink-0">
                stethoscope
              </span>
              <span>{MOCK_DOCTOR_NOTE_DATA.hospital}</span>
            </p>
          </div>
        </div>

        {/* Timestamp */}
        <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-full shadow-2xs shrink-0">
          <span className="material-symbols-outlined text-[14px] text-slate-400">schedule</span>
          <span>{MOCK_DOCTOR_NOTE_DATA.timestamp}</span>
        </div>
      </div>

      {/* Doctor Advice Quote Box */}
      <div className="bg-slate-50/90 rounded-xl p-4 border border-slate-200/80 relative z-10 shadow-2xs">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#006857] flex items-center justify-center shrink-0 mt-0.5 border border-emerald-200/60">
            <span className="material-symbols-outlined text-[20px]">
              format_quote
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-[#006857] uppercase tracking-wider">
              Lời dặn điều trị &amp; Lối sống
            </span>
            <p className="text-sm sm:text-[14.5px] text-slate-800 italic font-medium leading-relaxed">
              &ldquo;{MOCK_DOCTOR_NOTE_DATA.quote}&rdquo;
            </p>
          </div>
        </div>
      </div>

      {/* Clinical Guidance Tags */}
      <div className="flex flex-col gap-2 relative z-10">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
          Chỉ định quan trọng cần lưu ý:
        </span>
        <div className="flex flex-wrap gap-2">
          {MOCK_DOCTOR_NOTE_DATA.tags.map((tag) => (
            <div
              key={tag.text}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-2xs transition-all ${
                tag.type === "warning"
                  ? "bg-rose-50 text-rose-800 border border-rose-200/90"
                  : tag.type === "info"
                  ? "bg-blue-50 text-blue-800 border border-blue-200/90"
                  : "bg-emerald-50 text-[#006857] border border-emerald-200/90"
              }`}
            >
              <span className="material-symbols-outlined text-[16px] shrink-0">
                {tag.icon || (tag.type === "warning" ? "warning" : tag.type === "info" ? "event" : "check_circle")}
              </span>
              <span>{tag.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer verification & CTA */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-3 border-t border-slate-100 text-xs relative z-10">
        <div className="flex items-center gap-1.5 text-slate-500">
          <span className="material-symbols-outlined text-[16px] text-emerald-600">verified</span>
          <span>Xác thực bởi Hệ thống Y khoa VMEC-10</span>
        </div>

        <button
          type="button"
          onClick={() => openPanel("menu")}
          className="inline-flex items-center gap-1.5 text-[#006857] hover:text-[#005245] font-bold cursor-pointer transition-colors group"
        >
          <span>Xem phác đồ thực đơn</span>
          <span className="material-symbols-outlined text-[16px] group-hover:translate-x-0.5 transition-transform">
            arrow_forward
          </span>
        </button>
      </div>
    </div>
  );
}
