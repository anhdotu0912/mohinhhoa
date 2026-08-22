"use client";

import React from "react";
import { MOCK_DOCTOR_NOTE_DATA } from "@/lib/patient-chat-mock-data";

export function DoctorNoteCard() {
  return (
    <div className="w-full bg-white border border-slate-200/90 rounded-xl p-4.5 shadow-xs flex flex-col gap-3.5 relative overflow-hidden mt-1">
      {/* Decorative ambient gradient */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header with Doctor Info */}
      <div className="flex items-start justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={MOCK_DOCTOR_NOTE_DATA.doctorName}
              className="w-11 h-11 rounded-full object-cover border-2 border-emerald-500/40 shadow-xs"
              src={MOCK_DOCTOR_NOTE_DATA.avatarSrc}
            />
            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center text-[8px] text-white">
              ✓
            </span>
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
              {MOCK_DOCTOR_NOTE_DATA.doctorName}
              <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 rounded-full font-semibold">
                Phụ trách
              </span>
            </h4>
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
              <span className="material-symbols-outlined text-[14px] text-[#006857]">stethoscope</span>
              {MOCK_DOCTOR_NOTE_DATA.specialty}
            </p>
          </div>
        </div>
        <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200/60">
          {MOCK_DOCTOR_NOTE_DATA.timestamp}
        </span>
      </div>

      {/* Quote Box */}
      <div className="bg-slate-50/90 rounded-xl p-4 border border-slate-200/80 relative z-10">
        <div className="flex items-start gap-2.5">
          <span className="material-symbols-outlined text-[#006857] text-[22px] shrink-0 mt-0.5">
            format_quote
          </span>
          <p className="text-sm text-slate-800 italic font-medium leading-relaxed">
            &ldquo;{MOCK_DOCTOR_NOTE_DATA.quote}&rdquo;
          </p>
        </div>
      </div>

      {/* Tags / Action Chips */}
      <div className="flex flex-wrap gap-2 pt-0.5 relative z-10">
        {MOCK_DOCTOR_NOTE_DATA.tags.map((tag) => (
          <span
            key={tag.text}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
              tag.type === "warning"
                ? "bg-rose-50 text-rose-800 border border-rose-200"
                : tag.type === "info"
                ? "bg-blue-50 text-blue-800 border border-blue-200"
                : "bg-emerald-50 text-emerald-800 border border-emerald-200"
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">
              {tag.type === "warning" ? "warning" : tag.type === "info" ? "event" : "check_circle"}
            </span>
            {tag.text}
          </span>
        ))}
      </div>
    </div>
  );
}

