"use client";

import React from "react";
import type { FieldDelta, MetricsDeltaAdviceOut } from "@/lib/types";

interface MetricsDeltaAdviceCardProps {
  data: MetricsDeltaAdviceOut;
}

function formatValue(value: number | null | undefined): string {
  if (value == null) return "—";
  // Trim trailing zeros like the backend (:g) so 70.0 → "70", 70.4 → "70.4"
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

function DeltaRow({ delta }: { delta: FieldDelta }) {
  const { label, before, after, unit, changed } = delta;
  const isNew = before == null && after != null;
  const unitSuffix = unit ? ` ${unit}` : "";

  return (
    <div className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
      <span className="text-[13px] text-slate-600 font-medium min-w-0 truncate">
        {label}
      </span>

      <div className="flex items-center gap-2 shrink-0">
        {changed ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200/80 rounded-full px-2 py-0.5">
            <span className="material-symbols-outlined text-[12px] text-amber-600">trending_up</span>
            Thay đổi rõ
          </span>
        ) : isNew ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/80 rounded-full px-2 py-0.5">
            <span className="material-symbols-outlined text-[12px] text-emerald-600">add</span>
            Mới ghi nhận
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200/80 rounded-full px-2 py-0.5">
            <span className="material-symbols-outlined text-[12px] text-slate-400">remove</span>
            Thay đổi nhỏ
          </span>
        )}

        <span className="tabular-nums text-[13px] font-semibold text-slate-700 whitespace-nowrap">
          {isNew ? (
            <span className="text-emerald-700">
              {formatValue(after)}
              {unitSuffix}
            </span>
          ) : (
            <>
              <span className="text-slate-400">{formatValue(before)}</span>
              <span className="mx-1 text-slate-300">→</span>
              <span>{formatValue(after)}</span>
              {unitSuffix}
            </>
          )}
        </span>
      </div>
    </div>
  );
}

export function MetricsDeltaAdviceCard({ data }: MetricsDeltaAdviceCardProps) {
  const deltas = data.field_deltas ?? [];
  if (deltas.length === 0) return null;

  return (
    <div className="w-full bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-5 shadow-[0_8px_24px_rgba(25,28,28,0.06)] flex flex-col gap-3 sm:gap-3.5 mt-1 selection:bg-emerald-100">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200/80 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[18px] text-[#006857]">
            monitoring
          </span>
        </div>
        <div className="flex flex-col min-w-0">
          <h4 className="font-bold text-sm sm:text-base text-slate-900 leading-tight">
            Chỉ số so với lần trước
          </h4>
          <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
            So sánh trước – sau của các chỉ số đã ghi nhận
          </p>
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {deltas.map((delta) => (
          <DeltaRow key={delta.field} delta={delta} />
        ))}
      </div>

      {data.ask_doctor ? (
        <p className="text-[11px] sm:text-xs text-amber-800 bg-amber-50/90 border border-amber-200/80 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5">
          <span className="material-symbols-outlined text-[14px] text-amber-600 shrink-0 mt-px">
            medical_information
          </span>
          <span>
            Có chỉ số ngoài ngưỡng khuyến nghị — nên trao đổi với bác sĩ điều trị để được đánh giá.
          </span>
        </p>
      ) : null}
    </div>
  );
}
