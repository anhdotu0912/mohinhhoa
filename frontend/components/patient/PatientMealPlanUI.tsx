"use client";

import React, { useState } from "react";
import type { MealDishItem } from "@/lib/plans-store";

type NutrientKind = "kcal" | "fat" | "salt";

const NUTRIENT_META: Record<
  NutrientKind,
  { icon: string; label: string; unit: string; iconClass: string }
> = {
  kcal: {
    icon: "local_fire_department",
    label: "Kcal",
    unit: "kcal",
    iconClass: "text-amber-600",
  },
  fat: {
    icon: "opacity",
    label: "Béo",
    unit: "g",
    iconClass: "text-yellow-700",
  },
  salt: {
    icon: "grain",
    label: "Muối",
    unit: "g",
    iconClass: "text-sky-700",
  },
};

export function NutrientChip({
  kind,
  value,
  compact = false,
}: {
  kind: NutrientKind;
  value: number;
  compact?: boolean;
}) {
  const meta = NUTRIENT_META[kind];
  const display =
    kind === "kcal" ? Math.round(value).toLocaleString("vi-VN") : value.toFixed(1);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 text-slate-800 tabular-nums ${
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs"
      }`}
      title={`${meta.label}: ${display} ${meta.unit}`}
    >
      <span
        className={`material-symbols-outlined ${meta.iconClass} ${compact ? "text-[12px]" : "text-[14px]"}`}
        aria-hidden
      >
        {meta.icon}
      </span>
      <span className="font-semibold">{display}</span>
      <span className="text-slate-500 font-normal">{meta.unit}</span>
    </span>
  );
}

export function NutrientChipsRow({
  food,
  compact = false,
}: {
  food: MealDishItem;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-wrap ${compact ? "gap-1" : "gap-1.5"}`}>
      <NutrientChip kind="kcal" value={food.calories || 0} compact={compact} />
      <NutrientChip kind="fat" value={food.fat ?? 0} compact={compact} />
      <NutrientChip kind="salt" value={food.salt} compact={compact} />
    </div>
  );
}

function progressTone(ratio: number, mode: "band" | "ceiling"): "ok" | "warn" {
  if (mode === "ceiling") return ratio > 1 ? "warn" : "ok";
  if (ratio < 0.85 || ratio > 1.1) return "warn";
  return "ok";
}

function MetricProgressBar({
  label,
  icon,
  value,
  target,
  unit,
  mode = "band",
}: {
  label: string;
  icon: string;
  value: number;
  target: number;
  unit: string;
  mode?: "band" | "ceiling";
}) {
  const safeTarget = Math.max(target, 1);
  const ratio = value / safeTarget;
  const tone = progressTone(ratio, mode);
  const scaleMax = mode === "ceiling" ? safeTarget * 1.35 : safeTarget * 1.15;
  const fillPct = Math.min(100, (value / scaleMax) * 100);
  const targetPct = Math.min(100, (safeTarget / scaleMax) * 100);

  const valueDisplay =
    unit === "kcal" ? Math.round(value).toLocaleString("vi-VN") : value.toFixed(1);
  const targetDisplay =
    unit === "kcal" ? Math.round(safeTarget).toLocaleString("vi-VN") : safeTarget.toFixed(1);

  return (
    <div
      className={`rounded-xl border p-3 sm:p-4 ${
        tone === "warn"
          ? "border-amber-200 bg-amber-50/60"
          : "border-teal-100 bg-teal-50/40"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`material-symbols-outlined text-[20px] shrink-0 ${
              tone === "warn" ? "text-amber-700" : "text-teal-700"
            }`}
            aria-hidden
          >
            {icon}
          </span>
          <span className="text-xs font-bold uppercase tracking-wide text-slate-700">{label}</span>
        </div>
        {tone === "warn" && (
          <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-md">
            <span className="material-symbols-outlined text-[12px]">warning</span>
            {mode === "ceiling" ? "Vượt mục tiêu" : "Ngoài ngưỡng"}
          </span>
        )}
      </div>

      <p className="flex items-baseline gap-1.5 mb-2">
        <span
          className={`text-2xl sm:text-3xl font-bold tabular-nums leading-none ${
            tone === "warn" ? "text-amber-900" : "text-slate-900"
          }`}
        >
          {valueDisplay}
        </span>
        <span className="text-sm text-slate-600">
          / {targetDisplay} {unit}
        </span>
      </p>

      <div
        className="relative h-2.5 rounded-full bg-slate-200/80 overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={safeTarget}
        aria-valuenow={Math.round(value)}
        aria-label={`${label}: ${valueDisplay} trên ${targetDisplay} ${unit}`}
      >
        {mode === "band" && (
          <div
            className="absolute inset-y-0 bg-emerald-200/80"
            style={{
              left: `${Math.max(0, (safeTarget * 0.9) / scaleMax) * 100}%`,
              width: `${((safeTarget * 0.2) / scaleMax) * 100}%`,
            }}
          />
        )}
        <div
          className="absolute inset-y-0 w-0.5 bg-slate-400/70 z-10"
          style={{ left: `${targetPct}%` }}
          title={`Mục tiêu ${targetDisplay} ${unit}`}
        />
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
            tone === "warn" ? "bg-amber-500" : "bg-teal-600"
          }`}
          style={{ width: `${fillPct}%` }}
        />
      </div>
    </div>
  );
}

export function DayNutritionProgress({
  calories,
  saltG,
  targetCalories,
  targetSaltG,
}: {
  calories: number;
  saltG: number;
  targetCalories: number | null;
  targetSaltG: number | null;
}) {
  if (targetCalories == null && targetSaltG == null) return null;

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 gap-3"
      aria-label="Tiến độ dinh dưỡng so với mục tiêu"
    >
      {targetCalories != null && (
        <MetricProgressBar
          label="Năng lượng"
          icon="local_fire_department"
          value={calories}
          target={targetCalories}
          unit="kcal"
          mode="band"
        />
      )}
      {targetSaltG != null && (
        <MetricProgressBar
          label="Muối"
          icon="grain"
          value={saltG}
          target={targetSaltG}
          unit="g"
          mode="ceiling"
        />
      )}
    </div>
  );
}

export function MedicalApprovalBadge({
  label,
  medical,
  rejected = false,
  variant = "prominent",
}: {
  label: string;
  medical: boolean;
  rejected?: boolean;
  variant?: "prominent" | "compact";
}) {
  const styles = rejected
    ? "bg-red-50 text-red-900 border-red-300"
    : medical
      ? "bg-sky-900 text-white border-sky-800"
      : "bg-amber-50 text-amber-900 border-amber-300";

  const icon = rejected ? "cancel" : medical ? "verified_user" : "pending_actions";

  if (variant === "compact") {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${styles}`}>
        <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: '"FILL" 1' }}>
          {icon}
        </span>
        {label}
      </span>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border shadow-sm ${styles}`}>
      <span
        className={`material-symbols-outlined text-[22px] ${medical && !rejected ? "text-sky-100" : rejected ? "text-red-700" : "text-amber-700"}`}
        style={{ fontVariationSettings: '"FILL" 1' }}
        aria-hidden
      >
        {icon}
      </span>
      <div>
        <p className="text-xs font-bold leading-tight">{label}</p>
        {medical && !rejected && (
          <p className="text-[10px] text-sky-200/90 mt-0.5">Bác sĩ VinMec đã xác nhận</p>
        )}
      </div>
    </div>
  );
}

export function DayTabButton({
  weekdayShort,
  shortDate,
  isSelected,
  isToday,
  onClick,
}: {
  weekdayShort: string;
  shortDate: string;
  isSelected: boolean;
  isToday: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative shrink-0 px-3 py-2 text-xs transition-colors cursor-pointer border-b-2 ${
        isSelected
          ? "border-teal-600 text-teal-900 font-semibold bg-teal-50/50"
          : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
      }`}
      aria-current={isSelected ? "true" : undefined}
    >
      <span className="flex items-center gap-1.5">
        {isToday && (
          <span
            className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0"
            title="Hôm nay"
            aria-label="Hôm nay"
          />
        )}
        <span>{weekdayShort}</span>
        <span className={`tabular-nums ${isSelected ? "font-bold text-sm" : "font-medium"}`}>
          {shortDate}
        </span>
      </span>
    </button>
  );
}

export function MealSectionHeader({
  label,
  icon,
}: {
  label: string;
  icon: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
      <span className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0">
        <span className="material-symbols-outlined text-teal-700 text-[18px]" aria-hidden>
          {icon}
        </span>
      </span>
      <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide">{label}</h4>
    </div>
  );
}

function AlternativesSwapControl({ alternatives }: { alternatives: MealDishItem[] }) {
  const [open, setOpen] = useState(false);
  if (alternatives.length === 0) return null;

  return (
    <div className="mt-2.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold text-teal-800 bg-teal-50 border border-teal-200 hover:bg-teal-100 hover:border-teal-300 transition-colors cursor-pointer"
        aria-expanded={open}
      >
        <span className="material-symbols-outlined text-[15px]" aria-hidden>
          swap_horiz
        </span>
        {open ? "Ẩn lựa chọn thay thế" : `${alternatives.length} lựa chọn thay thế`}
        <span className="material-symbols-outlined text-[14px]" aria-hidden>
          {open ? "expand_less" : "expand_more"}
        </span>
      </button>
      {open && (
        <ul className="mt-2 space-y-2 pl-1 border-l-2 border-teal-100">
          {alternatives.map((alt, i) => (
            <li
              key={`${alt.foodId || alt.name}-${i}`}
              className="pl-3 py-2 bg-slate-50/80 border border-slate-200 rounded-lg"
            >
              <p className="text-xs font-semibold text-slate-800">{alt.name}</p>
              <div className="mt-1.5">
                <NutrientChipsRow food={alt} compact />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DishCard({
  item,
  portion,
  compact = false,
}: {
  item: MealDishItem;
  portion?: string | null;
  compact?: boolean;
}) {
  const alts = item.alternatives ?? [];

  if (compact) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-2 shadow-xs">
        <p className="text-xs font-semibold text-slate-900 leading-snug">{item.name}</p>
        <div className="mt-1.5">
          <NutrientChipsRow food={item} compact />
        </div>
      </div>
    );
  }

  return (
    <article className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-sm">
      <p className="text-sm sm:text-base font-semibold text-slate-900 leading-snug">{item.name}</p>
      {portion && (
        <p className="text-xs text-slate-600 mt-1">
          Khẩu phần: <span className="font-medium">{portion}</span>
        </p>
      )}
      <div className="mt-2.5">
        <NutrientChipsRow food={item} />
      </div>
      <AlternativesSwapControl alternatives={alts} />
    </article>
  );
}
