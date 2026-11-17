import type { MetricsHistoryPoint } from "./types";
import { METRIC_SERIES, parseBpPair, parseGlucoseMmol, type MetricSeriesId } from "./metrics-series";
import { vietnamTodayIso } from "./meal-plan-calendar";

export type MetricDay = {
  key: string; label: string; isToday: boolean; recordedAt?: string;
  values: Record<MetricSeriesId, number | null>;
  display: Record<MetricSeriesId, string | null>;
};

export function emptyMetricValues(): Record<MetricSeriesId, number | null> {
  return { weight: null, glucose_fasting: null, glucose_postprandial: null, systolic: null, diastolic: null, bmi: null, waist: null, hba1c: null };
}

export function emptyMetricDisplay(): Record<MetricSeriesId, string | null> {
  return { weight: null, glucose_fasting: null, glucose_postprandial: null, systolic: null, diastolic: null, bmi: null, waist: null, hba1c: null };
}

export function formatMetricValue(id: MetricSeriesId, value: number | null, unit: string): string | null {
  if (value == null) return null;
  const text = ["weight", "bmi", "hba1c"].includes(id) || id.startsWith("glucose") ? String(value) : String(Math.round(value));
  return unit ? `${text} ${unit}` : text;
}

function metricValue(point: MetricsHistoryPoint, id: MetricSeriesId): number | null {
  const bp = parseBpPair(point.blood_pressure);
  switch (id) {
    case "weight": return point.weight ?? null;
    case "bmi": return point.bmi ?? null;
    case "waist": return point.waist_cm ?? null;
    case "systolic": return point.systolic ?? bp.sys;
    case "diastolic": return point.diastolic ?? bp.dia;
    case "glucose_fasting": return point.glucose_fasting ?? parseGlucoseMmol(point.blood_glucose);
    case "glucose_postprandial": return point.glucose_postprandial ?? null;
    case "hba1c": return point.hba1c ?? null;
  }
}

function timestamp(raw: string): number {
  return Date.parse(/[zZ]|[+-]\d{2}:\d{2}$/.test(raw) ? raw : raw + "Z");
}

/** Empty days stay empty; later partial readings do not erase earlier metrics. */
export function buildMetricDays(history: MetricsHistoryPoint[], today: string): MetricDay[] {
  const days: MetricDay[] = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today + "T00:00:00Z");
    date.setUTCDate(date.getUTCDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    return { key, label: index === 6 ? "Hôm nay" : `${key.slice(8)}/${key.slice(5, 7)}`, isToday: index === 6, values: emptyMetricValues(), display: emptyMetricDisplay() };
  });
  const byDay = new Map(days.map((day) => [day.key, day]));
  const sorted = history.map((point) => ({ point, at: timestamp(point.recorded_at) })).filter(({ at }) => Number.isFinite(at)).sort((a, b) => a.at - b.at);
  for (const { point, at } of sorted) {
    const day = byDay.get(vietnamTodayIso(new Date(at)));
    if (!day) continue;
    for (const series of METRIC_SERIES) {
      const value = metricValue(point, series.id);
      if (value == null || !Number.isFinite(value)) continue;
      day.values[series.id] = value;
      day.display[series.id] = formatMetricValue(series.id, value, series.unit);
      day.recordedAt = point.recorded_at;
    }
  }
  return days;
}

export function firstRecordedMetric(days: MetricDay[]): MetricSeriesId {
  if (days.some((day) => day.values.glucose_fasting != null)) return "glucose_fasting";
  return METRIC_SERIES.find((series) => days.some((day) => day.values[series.id] != null))?.id ?? "glucose_fasting";
}

export function mergeSavedMetric(history: MetricsHistoryPoint[], saved: MetricsHistoryPoint): MetricsHistoryPoint[] {
  return [...history.filter((point) => point.id !== saved.id), saved];
}
