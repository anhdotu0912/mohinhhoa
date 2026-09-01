"use client";

import {
  NUTRIENT_LABEL,
  NUTRIENT_UNIT,
  formatNutrientValue,
  isNutrientValues,
  kindsForLayer,
  toNutrientValues,
  type NutrientKind,
  type NutrientSource,
  type NutrientValues,
} from "@/lib/nutrient-display";

const NUTRIENT_ICON: Record<NutrientKind, { icon: string; iconClass: string }> = {
  kcal: { icon: "local_fire_department", iconClass: "text-amber-600" },
  carb: { icon: "grain", iconClass: "text-blue-600" },
  protein: { icon: "egg_alt", iconClass: "text-emerald-700" },
  fat: { icon: "oil_barrel", iconClass: "text-amber-600" },
  salt: { icon: "science", iconClass: "text-sky-700" },
  sugar: { icon: "cake", iconClass: "text-rose-600" },
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
  const meta = NUTRIENT_ICON[kind];
  const display = formatNutrientValue(kind, value);
  const unit = NUTRIENT_UNIT[kind];
  const label = NUTRIENT_LABEL[kind];

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-slate-50 text-slate-800 tabular-nums ${
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs"
      }`}
      title={`${label}: ${display} ${unit}`}
    >
      <span
        className={`material-symbols-outlined ${meta.iconClass} ${compact ? "text-[12px]" : "text-[14px]"}`}
        aria-hidden
      >
        {meta.icon}
      </span>
      <span className="font-semibold text-slate-600">{label}</span>
      <span className="font-semibold">{display}</span>
      <span className="text-slate-500 font-normal">{unit}</span>
    </span>
  );
}

export function NutrientChips({
  values,
  layer,
  compact = false,
  omit = [],
  className,
}: {
  values: NutrientValues | NutrientSource;
  layer: "summary" | "detail";
  compact?: boolean;
  omit?: NutrientKind[];
  className?: string;
}) {
  const resolved = isNutrientValues(values) ? values : toNutrientValues(values);
  const kinds = kindsForLayer(layer, resolved, omit);

  return (
    <div className={`flex flex-wrap min-w-0 max-w-full ${compact ? "gap-1" : "gap-1.5"} ${className ?? ""}`}>
      {kinds.map((kind) => (
        <NutrientChip key={kind} kind={kind} value={resolved[kind]} compact={compact} />
      ))}
    </div>
  );
}
