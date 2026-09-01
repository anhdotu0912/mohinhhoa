"use client";

import { formatQty } from "@/lib/meal-plan-mappers";

type SlotKey = "breakfast" | "lunch" | "dinner" | "snack";

type MetricKey = "calories" | "carb" | "salt" | "sugar";

type CompactMetric = {
  key: MetricKey;
  label: string;
  unit: string;
  value: number;
  mode: "band" | "ceiling";
  lower: number;
  upper: number | null;
  limitText?: string;
  subText?: string;
  isHardFail?: boolean;
};

export type DayNutritionDashboardProps = {
  dayLabel: string;
  calories: number;
  saltG: number;
  sugarG: number;
  carbG?: number;
  targetCalories: number;
  targetSaltG: number | null;
  targetSugarG: number | null;
  targetCarbG?: number | null;
  mealCarbG?: Record<SlotKey, number>;
  carbPerMealLimit?: number | null;
  dayWarnings?: string[];
  dayAdvisoryWarnings?: string[];
  kcalLower?: number;
  kcalUpper?: number;
};

function ThresholdBar({
  value,
  lower,
  upper,
  mode,
  ok,
  label,
}: {
  value: number;
  lower: number;
  upper: number;
  mode: "band" | "ceiling";
  ok: boolean;
  label: string;
}) {
  const scaleMax = Math.max(upper * 1.35, value * 1.15, 1);
  return (
    <div
      className="relative h-2 rounded-full bg-slate-100 overflow-hidden"
      role="progressbar"
      aria-valuemin={mode === "ceiling" ? 0 : lower}
      aria-valuemax={upper}
      aria-valuenow={Math.round(value)}
      aria-label={label}
    >
      {/* Target range background zone */}
      {mode === "ceiling" ? (
        <div
          className="absolute inset-y-0 left-0 bg-emerald-100"
          style={{ width: `${Math.min(100, (upper / scaleMax) * 100)}%` }}
        />
      ) : (
        <div
          className="absolute inset-y-0 bg-emerald-100"
          style={{
            left: `${Math.min(100, (lower / scaleMax) * 100)}%`,
            width: `${Math.min(100 - (lower / scaleMax) * 100, ((upper - lower) / Math.max(scaleMax, 1)) * 100)}%`,
          }}
        />
      )}
      {/* Indicator bar: Emerald when within target, Vivid Rose/Red when exceeding or under limit */}
      <div
        className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${
          ok ? "bg-emerald-600" : "bg-rose-600"
        }`}
        style={{ width: `${Math.min(100, (value / scaleMax) * 100)}%` }}
      />
    </div>
  );
}

function CompactMetricCell({ metric }: { metric: CompactMetric }) {
  const hasUpper = metric.upper != null && metric.upper > 0;
  const upper = metric.upper ?? 0;
  const over = hasUpper && metric.value > upper;
  const under = metric.mode === "band" && metric.value < metric.lower;
  const hardFail = metric.isHardFail !== undefined ? metric.isHardFail : (over || under);
  const limitText =
    metric.limitText ??
    (!hasUpper
      ? "—"
      : metric.mode === "ceiling"
        ? `≤ ${formatQty(upper)}${metric.unit === "kcal" ? "" : metric.unit}`
        : `${Math.round(metric.lower)}–${Math.round(upper)}`);

  return (
    <div
      className={`rounded-lg border px-2.5 py-2 min-w-0 transition-colors ${
        hardFail
          ? "border-rose-300 bg-rose-50/80 ring-1 ring-rose-300/60 shadow-xs"
          : "border-outline-variant bg-surface-container-lowest"
      }`}
    >
      <div className="flex items-baseline justify-between gap-1">
        <span
          className={`text-[10px] font-bold uppercase tracking-wide ${
            hardFail ? "text-rose-900" : "text-on-surface-variant"
          }`}
        >
          {metric.label}
        </span>
        <span
          className={`text-[10px] tabular-nums shrink-0 font-medium ${
            hardFail ? "text-rose-700 font-bold" : "text-on-surface-variant"
          }`}
          title={metric.subText}
        >
          {limitText}
        </span>
      </div>
      <p className="mt-0.5 flex items-baseline gap-0.5">
        <span
          className={`text-base font-bold tabular-nums leading-none ${
            hardFail ? "text-rose-700" : "text-on-surface"
          }`}
        >
          {metric.key === "calories" ? Math.round(metric.value) : formatQty(metric.value)}
        </span>
        <span
          className={`text-[10px] ${
            hardFail ? "text-rose-600" : "text-on-surface-variant"
          }`}
        >
          {metric.unit}
        </span>
      </p>
      <div className="mt-1.5">
        <ThresholdBar
          value={metric.value}
          lower={metric.lower}
          upper={upper > 0 ? upper : Math.max(metric.value, 1)}
          mode={metric.mode}
          ok={!hardFail}
          label={`${metric.label}: ${metric.value}${metric.unit} (${limitText})`}
        />
      </div>
    </div>
  );
}

export function DayNutritionDashboard({
  dayLabel,
  calories,
  saltG,
  sugarG,
  carbG,
  targetCalories,
  targetSaltG,
  targetSugarG,
  targetCarbG,
  mealCarbG,
  carbPerMealLimit,
  dayWarnings = [],
  dayAdvisoryWarnings = [],
  kcalLower,
  kcalUpper,
}: DayNutritionDashboardProps) {
  const kcalTarget = Math.max(1, targetCalories);
  const kcalLo = kcalLower ?? Math.round(kcalTarget * 0.9);
  const kcalHi = kcalUpper ?? Math.round(kcalTarget * 1.1);

  // Muối & Đường: Sử dụng giới hạn lâm sàng được chỉ định hoặc chuẩn khuyến cáo WHO / Bộ Y Tế (Muối ≤ 5g, Đường ≤ 25g)
  const effectiveSaltLimit = targetSaltG != null && targetSaltG > 0 ? targetSaltG : 5;
  const effectiveSugarLimit = targetSugarG != null && targetSugarG > 0 ? targetSugarG : 25;

  const maxMealCarb = mealCarbG
    ? Math.max(mealCarbG.breakfast, mealCarbG.lunch, mealCarbG.dinner, mealCarbG.snack)
    : 0;
  const resolvedCarbG = carbG ?? (mealCarbG ? Object.values(mealCarbG).reduce((a, b) => a + b, 0) : 0);
  const carbOver = carbPerMealLimit != null && carbPerMealLimit > 0 && maxMealCarb > carbPerMealLimit;

  // Dải dinh dưỡng Carb khuyến nghị (45–60% Kcal)
  const carbLo = Math.round((kcalTarget * 0.45) / 4);
  const carbHi = targetCarbG ?? Math.round((kcalTarget * 0.60) / 4);

  const metrics: CompactMetric[] = [
    {
      key: "calories",
      label: "Kcal",
      unit: "kcal",
      value: calories,
      mode: "band",
      lower: kcalLo,
      upper: kcalHi,
    },
    {
      key: "carb",
      label: "Carb/bữa",
      unit: "g",
      value: maxMealCarb,
      mode: "ceiling",
      lower: 0,
      upper: carbPerMealLimit ?? null,
      limitText: carbPerMealLimit != null && carbPerMealLimit > 0 ? `≤ ${formatQty(carbPerMealLimit)}g` : "—",
      subText: carbPerMealLimit != null && carbPerMealLimit > 0 ? `Trần lâm sàng ${carbPerMealLimit}g/bữa (bữa cao nhất: ${formatQty(maxMealCarb)}g)` : "Chưa đặt trần carb/bữa",
      isHardFail: carbOver,
    },
    {
      key: "salt",
      label: "Muối",
      unit: "g",
      value: saltG,
      mode: "ceiling",
      lower: 0,
      upper: effectiveSaltLimit,
      limitText: `≤ ${formatQty(effectiveSaltLimit)}g`,
      isHardFail: saltG > effectiveSaltLimit,
    },
    {
      key: "sugar",
      label: "Đường",
      unit: "g",
      value: sugarG,
      mode: "ceiling",
      lower: 0,
      upper: effectiveSugarLimit,
      limitText: `≤ ${formatQty(effectiveSugarLimit)}g`,
      isHardFail: sugarG > effectiveSugarLimit,
    },
  ];

  return (
    <section
      className="bg-surface-container-lowest border border-outline-variant rounded-xl p-sm shadow-xs"
      aria-label={`Tổng ngày ${dayLabel}`}
    >
      <h3 className="font-h2 text-h2 text-on-surface font-bold text-sm mb-sm">
        Tổng ngày — {dayLabel}
      </h3>

      {dayWarnings.length > 0 && (
        <div className="mb-sm p-2 bg-rose-50 border border-rose-200 rounded-lg space-y-0.5">
          {dayWarnings.map((w) => (
            <p key={w} className="text-[11px] text-rose-900 leading-relaxed">
              {w}
            </p>
          ))}
        </div>
      )}

      {dayAdvisoryWarnings.length > 0 && (
        <div className="mb-sm p-2 bg-surface-container-low border border-outline-variant rounded-lg space-y-0.5">
          {dayAdvisoryWarnings.map((w) => (
            <p key={w} className="text-[11px] text-on-surface-variant leading-relaxed">
              {w}
            </p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {metrics.map((metric) => (
          <CompactMetricCell key={metric.key} metric={metric} />
        ))}
      </div>
    </section>
  );
}

export function MealMetricRow({
  kcal,
  saltG,
  sugarG,
  carbG,
  carbLimit,
}: {
  kcal: number;
  saltG?: number;
  sugarG?: number;
  carbG: number;
  carbLimit?: number | null;
}) {
  const carbOver = carbLimit != null && carbG > carbLimit;
  const cells: { label: string; value: string; warn?: boolean }[] = [
    { label: "Kcal", value: `${Math.round(kcal)}` },
    {
      label: "Carb",
      value:
        carbLimit != null
          ? `${formatQty(carbG)} / ${formatQty(carbLimit)}g`
          : `${formatQty(carbG)}g`,
      warn: carbOver,
    },
    { label: "Muối", value: `${formatQty(saltG ?? 0)}g` },
    { label: "Đường", value: `${formatQty(sugarG ?? 0)}g` },
  ];

  return (
    <div className="grid gap-1 grid-cols-2 sm:grid-cols-4">
      {cells.map((cell) => (
        <div
          key={cell.label}
          className={`rounded-md border px-2 py-1.5 min-w-0 ${
            cell.warn
              ? "border-rose-200 bg-rose-50"
              : "border-outline-variant/60 bg-surface-container-low/40"
          }`}
        >
          <p className="text-[10px] font-semibold text-on-surface-variant">{cell.label}</p>
          <p
            className={`text-xs font-bold tabular-nums ${
              cell.warn ? "text-rose-900" : "text-on-surface"
            }`}
          >
            {cell.value}
          </p>
        </div>
      ))}
    </div>
  );
}
