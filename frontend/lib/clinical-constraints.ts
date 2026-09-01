/** Shared clinical-constraint ranges — keep in sync with backend/app/schemas/clinical_limits.py. */

export type ClinicalLimitKey =
  | "target_kcal"
  | "carb_per_meal"
  | "sodium_daily"
  | "salt_daily_g"
  | "sugar_daily_g";

export type ClinicalLimitSpec = {
  min: number;
  max: number;
  step: number;
  default: number;
  unit: string;
  label: string;
};

export const CLINICAL_LIMITS: Record<ClinicalLimitKey, ClinicalLimitSpec> = {
  target_kcal: {
    min: 800,
    max: 4000,
    step: 50,
    default: 1800,
    unit: "kcal",
    label: "Năng lượng",
  },
  carb_per_meal: {
    min: 0,
    max: 200,
    step: 5,
    default: 45,
    unit: "g",
    label: "Carb / bữa",
  },
  sodium_daily: {
    min: 0,
    max: 5000,
    step: 50,
    default: 2000,
    unit: "mg",
    label: "Natri / ngày",
  },
  salt_daily_g: {
    min: 0,
    max: 15,
    step: 0.5,
    default: 5,
    unit: "g",
    label: "Muối / ngày",
  },
  sugar_daily_g: {
    min: 0,
    max: 100,
    step: 1,
    default: 25,
    unit: "g",
    label: "Đường / ngày",
  },
};

export const TREATMENT_GOAL_MIN_LEN = 3;
export const TREATMENT_GOAL_MAX_LEN = 80;
export const TREATMENT_GOALS_MAX_COUNT = 12;

export function clampClinical(
  key: ClinicalLimitKey,
  raw: number | null | undefined
): number {
  const spec = CLINICAL_LIMITS[key];
  const n = typeof raw === "number" && Number.isFinite(raw) ? raw : spec.default;
  return Math.min(spec.max, Math.max(spec.min, n));
}

export function validateClinicalNumber(
  key: ClinicalLimitKey,
  raw: number
): string | null {
  const spec = CLINICAL_LIMITS[key];
  if (!Number.isFinite(raw)) {
    return `${spec.label} phải là số.`;
  }
  if (raw < spec.min || raw > spec.max) {
    return `${spec.label} hợp lệ từ ${spec.min}–${spec.max} ${spec.unit}.`;
  }
  return null;
}

export function validateTreatmentGoals(goals: string[]): string | null {
  if (goals.length > TREATMENT_GOALS_MAX_COUNT) {
    return `Tối đa ${TREATMENT_GOALS_MAX_COUNT} mục tiêu điều trị.`;
  }
  for (const raw of goals) {
    const item = raw.trim();
    if (!item) return "Mục tiêu điều trị không được để trống.";
    if (item.length < TREATMENT_GOAL_MIN_LEN) {
      return `Mỗi mục tiêu tối thiểu ${TREATMENT_GOAL_MIN_LEN} ký tự.`;
    }
    if (item.length > TREATMENT_GOAL_MAX_LEN) {
      return `Mỗi mục tiêu tối đa ${TREATMENT_GOAL_MAX_LEN} ký tự.`;
    }
  }
  return null;
}

export function validateConstraintValues(values: {
  target_kcal: number;
  carb_per_meal: number;
  sodium_daily: number;
  salt_daily_g: number;
  sugar_daily_g: number;
  treatment_goals?: string[];
}): string | null {
  const checks: [ClinicalLimitKey, number][] = [
    ["target_kcal", values.target_kcal],
    ["carb_per_meal", values.carb_per_meal],
    ["sodium_daily", values.sodium_daily],
    ["salt_daily_g", values.salt_daily_g],
    ["sugar_daily_g", values.sugar_daily_g],
  ];
  for (const [key, raw] of checks) {
    const err = validateClinicalNumber(key, raw);
    if (err) return err;
  }
  if (values.treatment_goals) {
    const goalErr = validateTreatmentGoals(values.treatment_goals);
    if (goalErr) return goalErr;
  }
  return null;
}
