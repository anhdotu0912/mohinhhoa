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
  const tone = {
    calories: "border-teal-200 bg-teal-50/70",
    carb: "border-amber-200 bg-amber-50/70",
    salt: "border-sky-200 bg-sky-50/70",
    sugar: "border-violet-200 bg-violet-50/70",
  }[metric.key];

  return (
    <div
      className={`min-w-0 rounded-xl border px-3 py-3 transition-colors ${
        hardFail
          ? "border-rose-300 bg-rose-50/80 ring-1 ring-rose-300/60 shadow-xs"
          : tone
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
        <span
          className={`text-xs font-semibold ${
            hardFail ? "text-rose-900" : "text-on-surface-variant"
          }`}
        >
          {metric.label}
        </span>
        <span
          className={`text-[11px] tabular-nums shrink-0 font-medium ${
            hardFail ? "text-rose-700 font-bold" : "text-on-surface-variant"
          }`}
          title={metric.subText}
        >
          {limitText}
        </span>
      </div>
      <p className="mt-2 flex items-baseline gap-1">
        <span
          className={`text-[22px] font-bold tabular-nums leading-none ${
            hardFail ? "text-rose-700" : "text-on-surface"
          }`}
        >
          {metric.key === "calories" ? Math.round(metric.value) : formatQty(metric.value)}
        </span>
        <span
          className={`text-xs ${
            hardFail ? "text-rose-600" : "text-on-surface-variant"
          }`}
        >
          {metric.unit}
        </span>
      </p>
      <div className="mt-2.5">
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
      label: "Năng lượng",
      unit: "kcal",
      value: calories,
      mode: "band",
      lower: kcalLo,
      upper: kcalHi,
    },
    {
      key: "carb",
      label: "Carb/bữa cao nhất",
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
      className="mx-auto w-full max-w-[960px] space-y-2.5"
      aria-label={`Tổng ngày ${dayLabel}`}
    >
      <h3 className="text-center text-base font-semibold text-slate-800">
        Dinh dưỡng — {dayLabel}
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

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
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
    <div className="flex flex-wrap items-center gap-1.5">
      {cells.map((cell) => (
        <div
          key={cell.label}
          className={`inline-flex w-fit items-baseline gap-1.5 rounded-md border px-2.5 py-1.5 min-w-0 ${
            cell.warn
              ? "border-rose-200 bg-rose-50"
              : "border-outline-variant/60 bg-surface-container-low/40"
          }`}
        >
          <p className="text-sm font-medium text-slate-700">{cell.label}</p>
          <p
            className={`text-[15px] font-bold tabular-nums ${
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
