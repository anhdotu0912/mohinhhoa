"use client";

export type DayNutritionMetricKey = "calories" | "salt" | "sugar";

type MetricConfig = {
  key: DayNutritionMetricKey;
  label: string;
  unit: string;
  icon: string;
  format: (n: number) => string;
};

const METRICS: MetricConfig[] = [
  {
    key: "calories",
    label: "Kalo",
    unit: "kcal",
    icon: "local_fire_department",
    format: (n) => `${Math.round(n)}`,
  },
  {
    key: "salt",
    label: "Muối",
    unit: "g",
    icon: "water_drop",
    format: (n) => n.toFixed(1),
  },
  {
    key: "sugar",
    label: "Đường",
    unit: "g",
    icon: "nutrition",
    format: (n) => n.toFixed(1),
  },
];

export type DayNutritionDashboardProps = {
  dayLabel: string;
  calories: number;
  saltG: number;
  sugarG: number;
  targetCalories: number;
  targetSaltG: number;
  targetSugarG: number;
  mealBreakdown?: { breakfast: number; lunch: number; dinner: number; snack: number };
  /** Cảnh báo cứng cấp ngày (kalo/natri vượt ngưỡng). */
  dayWarnings?: string[];
  /** Gợi ý cấp ngày — không chặn duyệt. */
  dayAdvisoryWarnings?: string[];
  kcalLower?: number;
  kcalUpper?: number;
};

type Band = { target: number; lower: number; upper: number };

type GuidanceMode = "band" | "ceiling" | "informational";

function bandFor(
  key: DayNutritionMetricKey,
  target: number,
  kcalLower?: number,
  kcalUpper?: number
): Band {
  if (key === "calories") {
    return {
      target: Math.round(target),
      lower: kcalLower ?? Math.round(target * 0.9),
      upper: kcalUpper ?? Math.round(target * 1.1),
    };
  }
  if (key === "salt") {
    const t = Math.max(0.1, target);
    return {
      target: Math.round(t * 10) / 10,
      lower: 0,
      upper: Math.round(t * 10) / 10,
    };
  }
  const t = Math.max(0.1, target);
  return {
    target: Math.round(t * 10) / 10,
    lower: Math.round(t * 0.9 * 10) / 10,
    upper: Math.round(t * 1.1 * 10) / 10,
  };
}

function guidanceModeFor(key: DayNutritionMetricKey): GuidanceMode {
  if (key === "salt") return "ceiling";
  if (key === "sugar") return "informational";
  return "band";
}

function guidanceFor(
  value: number,
  band: Band,
  mode: GuidanceMode = "band"
): {
  kind: "up" | "down" | "ok" | "info";
  badge: string;
  track: string;
  text: string;
  hint: string;
} {
  if (mode === "informational" && value <= 0) {
    return {
      kind: "info",
      badge: "Chưa có dữ liệu",
      track: "bg-surface-container-low",
      text: "text-on-surface-variant",
      hint: "Catalog hiện chưa ghi nhận đường cho món ăn.",
    };
  }

  if (mode === "ceiling") {
    if (value <= band.upper) {
      return {
        kind: "ok",
        badge: "Trong ngưỡng",
        track: "bg-surface-container-low",
        text: "text-on-surface-variant",
        hint: `Dưới hoặc bằng giới hạn ${band.upper}g/ngày.`,
      };
    }
    const over = Math.round((value - band.upper) * 10) / 10;
    return {
      kind: "down",
      badge: "Nên giảm",
      track: "bg-red-50",
      text: "text-red-800",
      hint: `Vượt giới hạn khoảng ${over}g.`,
    };
  }

  if (value < band.lower) {
    const lowGap = Math.round((band.lower - value) * 10) / 10;
    const highGap = Math.round((band.upper - value) * 10) / 10;
    return {
      kind: "up",
      badge: "Nên tăng",
      track: "bg-emerald-50",
      text: "text-emerald-800",
      hint: `Còn thiếu khoảng ${lowGap}–${highGap} để vào ngưỡng.`,
    };
  }
  if (value > band.upper) {
    const lowGap = Math.round((value - band.upper) * 10) / 10;
    const highGap = Math.round((value - band.lower) * 10) / 10;
    return {
      kind: "down",
      badge: "Nên giảm",
      track: "bg-red-50",
      text: "text-red-800",
      hint: `Cần giảm khoảng ${lowGap}–${highGap} để vào ngưỡng.`,
    };
  }
  return {
    kind: "ok",
    badge: "Trong ngưỡng",
    track: "bg-surface-container-low",
    text: "text-on-surface-variant",
    hint: "Đang nằm trong khoảng gợi ý.",
  };
}

export function DayNutritionDashboard({
  dayLabel,
  calories,
  saltG,
  sugarG,
  targetCalories,
  targetSaltG,
  targetSugarG,
  mealBreakdown,
  dayWarnings = [],
  dayAdvisoryWarnings = [],
  kcalLower,
  kcalUpper,
}: DayNutritionDashboardProps) {
  const values: Record<DayNutritionMetricKey, number> = {
    calories,
    salt: saltG,
    sugar: sugarG,
  };
  const targets: Record<DayNutritionMetricKey, number> = {
    calories: Math.max(1, targetCalories),
    salt: Math.max(0.1, targetSaltG),
    sugar: Math.max(0.1, targetSugarG),
  };
  const calBand = bandFor("calories", targets.calories, kcalLower, kcalUpper);

  return (
    <section
      className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md mb-lg shadow-xs"
      aria-label={`Chỉ số dinh dưỡng ${dayLabel}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-xs mb-md">
        <div>
          <h3 className="font-h2 text-h2 text-on-surface font-bold text-base">
            Tổng dinh dưỡng — {dayLabel}
          </h3>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Thanh có vùng xanh = khoảng đạt. Kalo ngày: {calBand.lower}–
            {calBand.upper} kcal (mục tiêu ~{calBand.target}).
          </p>
        </div>
        {mealBreakdown ? (
          <p className="text-[11px] text-on-surface-variant tabular-nums shrink-0">
            Sáng {mealBreakdown.breakfast} · Trưa {mealBreakdown.lunch} · Tối{" "}
            {mealBreakdown.dinner} · Phụ {mealBreakdown.snack} kcal
          </p>
        ) : null}
      </div>

      {dayWarnings.length > 0 && (
        <div className="mb-md p-3 bg-rose-50/80 border border-rose-200/70 rounded-lg space-y-1">
          <div className="flex items-center gap-1.5 text-rose-800">
            <span className="material-symbols-outlined text-[16px]">error</span>
            <strong className="text-[11px] font-bold">Vi phạm lâm sàng (cả ngày)</strong>
          </div>
          {dayWarnings.map((w) => (
            <p key={w} className="text-xs text-rose-900 leading-relaxed">
              {w}
            </p>
          ))}
        </div>
      )}

      {dayAdvisoryWarnings.length > 0 && (
        <div className="mb-md p-3 bg-slate-100 border border-slate-200/80 rounded-lg space-y-1">
          <div className="flex items-center gap-1.5 text-slate-800">
            <span className="material-symbols-outlined text-[16px]">info</span>
            <strong className="text-[11px] font-bold">Gợi ý (không chặn duyệt)</strong>
          </div>
          {dayAdvisoryWarnings.map((w) => (
            <p key={w} className="text-xs text-slate-700 leading-relaxed">
              {w}
            </p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
        {METRICS.map((metric) => {
          const value = values[metric.key];
          const target = targets[metric.key];
          const mode = guidanceModeFor(metric.key);
          const band = bandFor(metric.key, target, kcalLower, kcalUpper);
          const guide = guidanceFor(value, band, mode);
          const scaleMax = Math.max(
            mode === "ceiling" ? band.upper * 1.25 : band.upper * 1.2,
            value,
            1
          );
          const inBand =
            mode === "ceiling"
              ? value <= band.upper
              : mode === "informational" && value <= 0
                ? true
                : value >= band.lower && value <= band.upper;

          return (
            <div
              key={metric.key}
              className={`rounded-lg border border-outline-variant p-sm ${guide.track}`}
            >
              <div className="flex items-start justify-between gap-sm mb-sm">
                <div className="min-w-0">
                  <div className="flex items-center gap-xs text-on-surface">
                    <span className="material-symbols-outlined text-[18px]">
                      {metric.icon}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wide">
                      {metric.label}
                    </span>
                  </div>
                  <p className="mt-1 flex items-baseline gap-1">
                    <span
                      className={`text-2xl font-bold tabular-nums leading-none ${
                        inBand ? "text-on-surface" : "text-amber-800"
                      }`}
                    >
                      {metric.format(value)}
                    </span>
                    <span className="text-xs text-on-surface-variant">
                      {metric.unit}
                    </span>
                  </p>
                  <p className="text-[11px] text-on-surface-variant mt-1 tabular-nums">
                    {metric.key === "salt" ? (
                      <>
                        Giới hạn ≤ {metric.format(band.upper)} {metric.unit}/ngày
                      </>
                    ) : metric.key === "sugar" && value <= 0 ? (
                      <>Chưa có dữ liệu đường từ catalog</>
                    ) : (
                      <>
                        Gợi ý {metric.format(band.lower)}–{metric.format(band.upper)}{" "}
                        {metric.unit}
                        <span className="text-on-surface-variant/80">
                          {" "}
                          (mục tiêu ~{metric.format(band.target)})
                        </span>
                      </>
                    )}
                  </p>
                </div>

                <div
                  className="flex flex-col items-center gap-0.5 shrink-0"
                  aria-label={
                    guide.kind === "up"
                      ? `${metric.label}: nên tăng`
                      : guide.kind === "down"
                        ? `${metric.label}: nên giảm`
                        : guide.kind === "info"
                          ? `${metric.label}: chưa có dữ liệu`
                          : `${metric.label}: trong ngưỡng`
                  }
                >
                  {guide.kind === "up" && (
                    <span className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                      <span className="material-symbols-outlined text-[24px]">
                        arrow_upward
                      </span>
                    </span>
                  )}
                  {guide.kind === "down" && (
                    <span className="w-10 h-10 rounded-lg bg-red-600 text-white flex items-center justify-center shadow-xs">
                      <span className="material-symbols-outlined text-[24px]">
                        arrow_downward
                      </span>
                    </span>
                  )}
                  {guide.kind === "ok" && (
                    <span className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[22px]">
                        check
                      </span>
                    </span>
                  )}
                  {guide.kind === "info" && (
                    <span className="w-10 h-10 rounded-lg bg-surface-container-high text-on-surface-variant border border-outline-variant flex items-center justify-center">
                      <span className="material-symbols-outlined text-[20px]">
                        info
                      </span>
                    </span>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-[10px] text-on-surface-variant mb-1 tabular-nums">
                  <span>0</span>
                  <span>
                    {metric.key === "salt"
                      ? `Giới hạn ≤ ${metric.format(band.upper)}`
                      : `~${metric.format(band.target)} · ${metric.format(band.lower)}–${metric.format(band.upper)}`}
                  </span>
                  <span>{metric.format(band.upper)}+</span>
                </div>
                <div
                  className="relative h-2 rounded-full bg-surface-container-low overflow-hidden"
                  role="progressbar"
                  aria-valuemin={band.lower}
                  aria-valuemax={band.upper}
                  aria-valuenow={Math.round(value)}
                  aria-label={
                    metric.key === "salt"
                      ? `${metric.label}: giới hạn ${band.upper}`
                      : `${metric.label}: ngưỡng ${band.lower}–${band.upper}`
                  }
                >
                  {mode !== "ceiling" && (
                    <div
                      className="absolute inset-y-0 bg-emerald-200/70"
                      style={{
                        left: `${(band.lower / scaleMax) * 100}%`,
                        width: `${((band.upper - band.lower) / scaleMax) * 100}%`,
                      }}
                    />
                  )}
                  {mode === "ceiling" && (
                    <div
                      className="absolute inset-y-0 bg-emerald-200/70"
                      style={{
                        left: 0,
                        width: `${(band.upper / scaleMax) * 100}%`,
                      }}
                    />
                  )}
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${
                      inBand ? "bg-primary/80" : "bg-amber-500/80"
                    }`}
                    style={{
                      width: `${Math.min(100, (value / scaleMax) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              <div className="mt-1.5 flex items-center justify-between gap-sm">
                <span className={`text-[10px] font-bold ${guide.text}`}>
                  {guide.badge}
                </span>
                <span className="text-[10px] text-on-surface-variant">
                  {guide.hint}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
