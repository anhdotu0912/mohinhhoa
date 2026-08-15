/** Map UI labels ↔ API profile codes (contracts PatientProfile). */

export const DISEASE_OPTIONS: { label: string; code: string; hint: string }[] = [
  {
    label: "Tiểu đường type 2",
    code: "diabetes_t2",
    hint: "Kiểm soát carb & đường huyết",
  },
  {
    label: "Tăng huyết áp",
    code: "hypertension",
    hint: "Hạn chế natri / muối",
  },
  {
    label: "Suy thận mạn",
    code: "ckd",
    hint: "Giới hạn protein, muối, phốt pho",
  },
  {
    label: "Gout",
    code: "gout",
    hint: "Hạn chế purin cao",
  },
  {
    label: "Rối loạn lipid máu",
    code: "dyslipidemia",
    hint: "Hạn chế chất béo bão hòa",
  },
  {
    label: "Gan nhiễm mỡ",
    code: "nafld",
    hint: "Giảm kcal, hạn chế đường",
  },
];

export const COMMON_ALLERGIES = [
  "Hải sản",
  "Sữa",
  "Đậu phộng",
  "Trứng",
  "Gluten",
];

/** Preset treatment goals for onboarding step 3 (stored as treatment_goals). */
export const TREATMENT_GOAL_OPTIONS = [
  "Kiểm soát đường huyết ổn định (HbA1c < 7%).",
  "Duy trì huyết áp dưới 130/80 mmHg.",
  "Giảm natri trong khẩu phần ăn dưới 2000mg/ngày.",
  "Giảm cân nhẹ qua chế độ ăn và vận động.",
  "Duy trì acid uric dưới 360 µmol/L.",
  "Hạ triglyceride máu xuống dưới 1.7 mmol/L.",
];

export function diseaseLabelsToCodes(labels: string[]): string[] {
  const map = new Map(DISEASE_OPTIONS.map((d) => [d.label, d.code]));
  return labels
    .map((label) => map.get(label) || label.trim().toLowerCase().replace(/\s+/g, "_"))
    .filter(Boolean);
}

/** Normalize free-text med like "Metformin 500mg" → "metformin". */
export function normalizeMedication(raw: string): string {
  const first = raw.trim().split(/[\s(,/\-]+/)[0] || "";
  return first.toLowerCase();
}

export function normalizeMedications(rawList: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of rawList) {
    const code = normalizeMedication(raw);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

export function calcBmi(weightKg: number, heightCm: number): number | null {
  if (!weightKg || !heightCm || heightCm <= 0) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export function suggestTargetKcal(bmi: number | null, diseases: string[]): number {
  let base = 1800;
  if (bmi != null && bmi >= 25) base = 1600;
  if (bmi != null && bmi < 18.5) base = 2000;
  if (diseases.includes("gout")) base = Math.max(base, 1800);
  return base;
}

export function suggestRestrictions(diseaseCodes: string[]): {
  carb_per_meal: number | null;
  sodium_daily: number | null;
} {
  const hasDiabetes = diseaseCodes.includes("diabetes_t2");
  const hasHtn = diseaseCodes.includes("hypertension") || diseaseCodes.includes("ckd");
  return {
    carb_per_meal: hasDiabetes ? 45 : null,
    sodium_daily: hasHtn ? 1500 : null,
  };
}
