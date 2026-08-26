/** Shared metric series for the patient health overlay chart. */

export type MetricSeriesId =
  | "weight"
  | "glucose_fasting"
  | "glucose_postprandial"
  | "systolic"
  | "diastolic"
  | "bmi"
  | "waist"
  | "hba1c";

export type MetricSeriesDef = {
  id: MetricSeriesId;
  label: string;
  unit: string;
  color: string;
  defaultOn: boolean;
  targetMin?: number;
  targetMax?: number;
};

export const METRIC_SERIES: MetricSeriesDef[] = [
  { id: "weight", label: "Cân nặng", unit: "kg", color: "#0F766E", defaultOn: true },
  {
    id: "glucose_fasting",
    label: "Đường lúc đói",
    unit: "mmol/L",
    color: "#B45309",
    defaultOn: true,
    targetMin: 4.4,
    targetMax: 7.2,
  },
  {
    id: "glucose_postprandial",
    label: "Đường sau ăn",
    unit: "mmol/L",
    color: "#C2410C",
    defaultOn: true,
    targetMax: 10,
  },
  {
    id: "systolic",
    label: "HA tâm thu",
    unit: "mmHg",
    color: "#BE123C",
    defaultOn: true,
    targetMax: 130,
  },
  {
    id: "diastolic",
    label: "HA tâm trương",
    unit: "mmHg",
    color: "#9F1239",
    defaultOn: false,
    targetMax: 80,
  },
  { id: "bmi", label: "BMI", unit: "", color: "#4338CA", defaultOn: false },
  { id: "waist", label: "Vòng eo", unit: "cm", color: "#0369A1", defaultOn: false },
  {
    id: "hba1c",
    label: "HbA1c",
    unit: "%",
    color: "#6D28D9",
    defaultOn: false,
    targetMax: 7,
  },
];

export function parseLeadingNumber(value?: string | null): number | null {
  if (!value) return null;
  const match = value.replace(",", ".").match(/[\d.]+/);
  if (!match) return null;
  const n = parseFloat(match[0]);
  return Number.isFinite(n) ? n : null;
}

export function parseGlucoseMmol(raw?: string | null): number | null {
  const n = parseLeadingNumber(raw);
  if (n == null) return null;
  if (/mmol/i.test(raw ?? "") || n < 40) return Math.round(n * 10) / 10;
  return Math.round((n / 18.018) * 10) / 10;
}

export function parseBpPair(raw?: string | null): { sys: number | null; dia: number | null } {
  if (!raw) return { sys: null, dia: null };
  const match = raw.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
  if (!match) return { sys: null, dia: null };
  return { sys: Number(match[1]), dia: Number(match[2]) };
}

export function calcBmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}
