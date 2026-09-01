/** Map UI labels ↔ API profile codes (contracts PatientProfile). */

export const DISEASE_OPTIONS: { label: string; code: string; hint: string }[] = [
  {
    label: "Tiểu đường type 1",
    code: "diabetes_t1",
    hint: "Đếm carb & insulin basal-bolus (QĐ 1760/QĐ-BYT)",
  },
  {
    label: "Tiểu đường type 2",
    code: "diabetes_t2",
    hint: "Kiểm soát carb & đường huyết (QĐ 5481/QĐ-BYT)",
  },
  {
    label: "Đái tháo đường thai kỳ",
    code: "diabetes_gestational",
    hint: "Chia 3 chính + 3 phụ, carb ≥ 175g/ngày (QĐ 1470/QĐ-BYT)",
  },
  {
    label: "Bệnh thần kinh đái tháo đường",
    code: "diabetic_neuropathy",
    hint: "Ăn mềm dễ tiêu, giảm tê bì (QĐ 3510/QĐ-BYT)",
  },
  {
    label: "Tiền đái tháo đường",
    code: "prediabetes",
    hint: "Lối sống lành mạnh phòng tiến triển ĐTĐ",
  },
];

export const COMMON_ALLERGIES = [
  "Hải sản",
  "Sữa",
  "Đậu phộng",
  "Trứng",
  "Gluten",
];

/** Preset treatment goals for doctor constraints + patient profile (stored as treatment_goals). */
export const TREATMENT_GOAL_OPTIONS = [
  "Kiểm soát đường huyết ổn định (HbA1c < 7%).",
  "Đường huyết đói thai kỳ ≤ 95 mg/dL, 2h sau ăn ≤ 120 mg/dL (QĐ 1470/QĐ-BYT).",
  "Duy trì Time in Range (TIR) > 70%, đếm Carb theo liều Insulin (QĐ 1760/QĐ-BYT).",
  "Cải thiện triệu chứng tê bì bàn chân, kiểm soát biến chứng thần kinh (QĐ 3510/QĐ-BYT).",
  "Duy trì huyết áp dưới 130/80 mmHg.",
  "Giảm natri trong khẩu phần ăn dưới 2000mg/ngày.",
  "Giảm cân nhẹ qua chế độ ăn và vận động.",
];

export function diseaseLabelsToCodes(labels: string[]): string[] {
  const map = new Map(DISEASE_OPTIONS.map((d) => [d.label, d.code]));
  return labels
    .map((label) => map.get(label) || label.trim().toLowerCase().replace(/\s+/g, "_"))
    .filter(Boolean);
}

/** Map API disease code → Vietnamese label (fallback: humanize code). */
export function diseaseCodeToLabel(code: string): string {
  const found = DISEASE_OPTIONS.find((d) => d.code === code);
  return found?.label ?? code.replace(/_/g, " ");
}

export function diseaseCodesToLabels(codes: string[]): string[] {
  return codes.map(diseaseCodeToLabel);
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
  if (diseases.includes("diabetes_gestational")) return 1900;
  if (diseases.includes("diabetes_t1")) return 2100;
  if (bmi != null && bmi >= 25) base = 1600;
  if (bmi != null && bmi < 18.5) base = 2000;
  return base;
}

export function suggestRestrictions(diseaseCodes: string[]): {
  carb_per_meal: number | null;
  sodium_daily: number | null;
} {
  const hasDiabetesT1 = diseaseCodes.includes("diabetes_t1");
  const hasDiabetesT2 = diseaseCodes.includes("diabetes_t2") || diseaseCodes.includes("prediabetes");
  const hasGestational = diseaseCodes.includes("diabetes_gestational");

  let carbLimit: number | null = null;
  if (hasDiabetesT1) carbLimit = 60;
  else if (hasDiabetesT2 || hasGestational) carbLimit = 45;

  return {
    carb_per_meal: carbLimit,
    sodium_daily: null,
  };
}
